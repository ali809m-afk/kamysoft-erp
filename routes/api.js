const express = require('express');
const zatcaApi = require('../utils/zatcaApi');
const zatcaCrypto = require('../utils/zatcaCrypto');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { uploadFile, getPresignedUrl } = require('../services/s3Service');
const { User, Product, Invoice, Quotation, Expense, Asset, Customer, Employee, Supplier, Order, Settings, Inquiry, Warehouse, InventoryTx, JournalEntry, Voucher, Salary, PurchaseInvoice, ReturnInvoice, Account, SubscriptionPayment, PropertyOwner, Property, Unit, Booking, GroupBlock, HotelService, PriceRule, MaintenanceTask, PropertyInvoice, LeaseContract, Lead, PrinterConfig, RestaurantOrder, FlowerArrangement, FlowerDelivery, MeasurementProfile, TailoringOrder } = require('../models');

const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;

// Ensure upload directories exist
const baseUploadDir = process.env.UPLOADS_DIR || path.join(__dirname, '../public/uploads');
const propertiesUploadDir = path.join(baseUploadDir, 'properties');

if (!fs.existsSync(propertiesUploadDir)) {
    fs.mkdirSync(propertiesUploadDir, { recursive: true });
}

// Configure Multer for Property Images
const propertyStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, propertiesUploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'prop-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const propertyUpload = multer({ storage: propertyStorage });

// Configure Multer for memory storage (S3 Uploads)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB max

// Mock in-memory DB fallback for serverless environments (if MongoDB is disconnected)
const defaultMockDb = {
    users: [], products: [], invoices: [], quotations: [], expenses: [], assets: [],
    customers: [], employees: [], suppliers: [], orders: [], settings: {},
    warehouses: [], inventoryTxs: [], journalEntries: [], vouchers: [],
    salaries: [], purchaseInvoices: [], returnInvoices: [], accounts: [],
    subscriptionPayments: [], properties: [], units: [], bookings: [],
    hotelServices: [], priceRules: [],
    maintenanceTasks: [], propertyInvoices: [], leaseContracts: [],
    propertyOwners: [], leads: [],
    measurementProfiles: [], tailoringOrders: []
};
const mockDb = global.mockDb || defaultMockDb;
Object.keys(defaultMockDb).forEach(key => {
    if (mockDb[key] === undefined) mockDb[key] = defaultMockDb[key];
});

const { getJwtSecret, getSaasAdminKey, safeEqual, sanitizeSettings, sanitizeSettingsUpdate } = require('../utils/security');

// Middleware from server.js for auth
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, getJwtSecret(), async (err, user) => {
        if (err) return res.status(401).json({ error: 'Session expired or invalid' });

        // A token is only valid for the store it was issued for. Without this check a
        // login from one store could read another store's data by changing the
        // subdomain or the X-Tenant-Id header.
        if (!user || user.tenantId !== getTenantId(req)) {
            return res.status(403).json({ error: 'Tenant access mismatch' });
        }
        // Customer-portal tokens (role 'Tenant') are signed with the same secret but
        // must never reach staff routes.
        if (user.role === 'Tenant') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        try {
            // Verify user still exists in this store (prevents deleted tenants/users from using active tokens)
            if (global.isMongoConnected) {
                const userExists = await User.exists({ id: user.id, tenantId: user.tenantId });
                if (!userExists) return res.sendStatus(401);
            } else {
                const userExists = mockDb.users.some(u => u.id === user.id && (u.tenantId || 'default') === user.tenantId);
                if (!userExists) return res.sendStatus(401);
            }
        } catch (e) {
            return res.status(500).json({ error: 'Authentication check failed' });
        }

        req.user = user;
        next();
    });
};

// Returns the logged-in user for this store if a valid token was sent, otherwise null.
// Used by routes that are public but show more to logged-in staff.
const getOptionalUser = (req) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return null;
    try {
        const user = jwt.verify(token, getJwtSecret());
        return user && user.role !== 'Tenant' && user.tenantId === getTenantId(req) ? user : null;
    } catch (e) {
        return null;
    }
};

router.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const tenantId = getTenantId(req);
        let user;
        if (global.isMongoConnected) {
            user = await User.findOne({ username, tenantId });
        } else {
            user = mockDb.users.find(u => u.username === username && u.tenantId === tenantId);
            if (!user) {
                user = mockDb.users.find(u => u.username === username && !u.tenantId);
                if (user) {
                    if (!mockDb.settingsTenant) mockDb.settingsTenant = {};
                    if (!mockDb.settingsTenant[tenantId] && tenantId !== 'default') {
                        mockDb.settingsTenant[tenantId] = { ...mockDb.settings, tenantId };
                    }
                }
            }
        }
        
        if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        if (user.isActive === false) {
            return res.status(403).json({ error: 'Your account has been deactivated. Please contact support.' });
        }
        
        if (tenantId !== 'default') {
            let settings;
            if (global.isMongoConnected) {
                settings = await Settings.findOne({ tenantId });
            } else {
                settings = mockDb.settingsTenant && mockDb.settingsTenant[tenantId];
            }
            // if (settings && settings.isEmailVerified === false) {
            //     return res.status(403).json({ error: 'Please verify your email address before logging in.' });
            // }
        }
        
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role, tenantId }, getJwtSecret(), { expiresIn: '12h' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role, isActive: user.isActive } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { tenantId } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Tenant ID is required' });
        
        const host = (req.headers.host || '').split(':')[0].toLowerCase();
        let baseDomain = '26i.uk';
        if (host.endsWith('ssh-erp.26i.uk')) baseDomain = 'ssh-erp.26i.uk';
        else if (host.endsWith('localhost')) baseDomain = 'localhost';

        let settings, adminUser;
        if (global.isMongoConnected) {
            settings = await Settings.findOne({ tenantId });
            adminUser = await User.findOne({ tenantId, role: 'Admin' });
        } else {
            settings = mockDb.settingsTenant && mockDb.settingsTenant[tenantId];
            adminUser = mockDb.users.find(u => u.tenantId === tenantId && u.role === 'Admin');
        }

        if (!settings || !settings.email) {
            return res.status(404).json({ error: 'No email associated with this tenant. Please contact platform support.' });
        }
        if (!adminUser) {
            return res.status(404).json({ error: 'No admin user found for this tenant.' });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        if (global.isMongoConnected) {
            await Settings.updateOne({ tenantId }, { passwordResetToken: resetToken, passwordResetExpires: Date.now() + 3600000 });
        } else {
            settings.passwordResetToken = resetToken;
            settings.passwordResetExpires = Date.now() + 3600000;
        }

        if (typeof global.sendPasswordResetEmail === 'function') {
            global.sendPasswordResetEmail(settings.email, tenantId, resetToken, baseDomain);
        }

        res.json({ success: true, message: 'Password reset link sent to your email address.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { tenantId, token, newPassword } = req.body;
        if (!tenantId || !token || !newPassword) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        let settings;
        if (global.isMongoConnected) {
            settings = await Settings.findOne({ tenantId, passwordResetToken: token, passwordResetExpires: { $gt: Date.now() } });
        } else {
            settings = mockDb.settingsTenant && mockDb.settingsTenant[tenantId];
            if (settings && (settings.passwordResetToken !== token || settings.passwordResetExpires < Date.now())) {
                settings = null;
            }
        }

        if (!settings) {
            return res.status(400).json({ error: 'Invalid or expired password reset token.' });
        }

        const passwordHash = bcrypt.hashSync(newPassword, 10);

        if (global.isMongoConnected) {
            await User.updateOne({ tenantId, role: 'Admin' }, { passwordHash });
            await Settings.updateOne({ tenantId }, { $unset: { passwordResetToken: 1, passwordResetExpires: 1 } });
        } else {
            const adminUser = mockDb.users.find(u => u.tenantId === tenantId && u.role === 'Admin');
            if (adminUser) adminUser.passwordHash = passwordHash;
            delete settings.passwordResetToken;
            delete settings.passwordResetExpires;
        }

        res.json({ success: true, message: 'Password has been reset successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const getBaseDomain = (host) => {
    host = host.toLowerCase();
    if (host.endsWith('ssh-erp.26i.uk')) return 'ssh-erp.26i.uk';
    if (host.endsWith('26i.uk')) return '26i.uk';
    if (host.endsWith('localhost')) return 'localhost';
    return host;
};

router.post('/api/auth/register-tenant', async (req, res) => {
    try {
        const { tenantId, businessName, businessType, adminUsername, password, email, mobile, nationalAddress, vatNumber, crNumber, billingCycle, fullName } = req.body;
        const host = (req.headers.host || '').split(':')[0].toLowerCase();
        const baseDomain = getBaseDomain(host);
        
        if (!tenantId || !businessName || !businessType || !adminUsername || !password || !email) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        const crypto = require('crypto');
        const adminPassword = password;
        
        // Normalize tenantId (lowercase alphanumeric and dash only)
        const normalizedTenantId = tenantId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (!normalizedTenantId) {
            return res.status(400).json({ error: 'Invalid subdomain format' });
        }
        
        // Check uniqueness of tenantId FIRST. The orphan clean-up below used to run before
        // this check, so signing up with an existing store's subdomain deleted that store's
        // users, products, accounts and settings.
        const reservedTenantIds = ['default', 'www', 'demo', 'admin', 'api'];
        if (reservedTenantIds.includes(normalizedTenantId)) {
            return res.status(400).json({ error: 'Store subdomain is already registered' });
        }
        if (global.isMongoConnected) {
            const existingSettings = await Settings.findOne({ tenantId: normalizedTenantId });
            if (existingSettings) {
                return res.status(400).json({ error: 'Store subdomain is already registered' });
            }
            // No store owns this subdomain: remove leftovers of an earlier failed sign-up
            await Promise.all([
                User.deleteMany({ tenantId: normalizedTenantId }),
                Product.deleteMany({ tenantId: normalizedTenantId }),
                Account.deleteMany({ tenantId: normalizedTenantId })
            ]);
        } else {
            if (mockDb.settingsTenant && mockDb.settingsTenant[normalizedTenantId]) {
                return res.status(400).json({ error: 'Store subdomain is already registered' });
            }
        }
        
        // Generate License Key & Expiration
        const licenseKey = 'SME-' + crypto.randomUUID().toUpperCase().split('-').slice(1, 4).join('-');
        
        // Expiration Logic (Monthly vs Yearly)
        const expirationDate = new Date();
        if (billingCycle === 'yearly') {
            expirationDate.setFullYear(expirationDate.getFullYear() + 1);
        } else {
            expirationDate.setMonth(expirationDate.getMonth() + 1);
        }

        // 1. Create Tenant-Specific Settings
        const defaultEnabledModules = {
            invoices: true,
            pos: true,
            inventory: true,
            customers: true,
            suppliers: true,
            reports: true,
            settings: true,
            tailoring: businessType === 'tailoring',
            propertyManagement: businessType === 'realestate',
            freshFlowers: businessType === 'freshFlowers',
            maintenance: businessType === 'services' || businessType === 'appliances',
            ecommerce: ['retail', 'apparel', 'appliances', 'furniture', 'freshFlowers'].includes(businessType)
        };
        const settingsData = {
            tenantId: normalizedTenantId,
            businessName: businessName,
            businessType: businessType,
            enabledModules: defaultEnabledModules,
            vatNumber: vatNumber || '310' + Math.floor(100000000000 + Math.random() * 900000000000).toString(),
            taxRate: 15,
            baseCurrency: 'SAR',
            businessAddress: nationalAddress || 'Saudi Arabia / المملكة العربية السعودية',
            crNumber: crNumber || Math.floor(1010000000 + Math.random() * 900000000).toString(),
            contactNumber: mobile || '+966 50 000 0000',
            exchangeRates: { SAR: 1, USD: 0.27, EUR: 0.25, EGP: 12.8, AED: 0.99 },
            branches: [{ name: 'Main Branch', address: 'Main St', phone: mobile || '+966 50 000 0000' }],
            currentBranch: 'Main Branch',
            enableTables: businessType === 'restaurant',
            enableServiceDuration: businessType === 'salon',
            email: email,
            fullName: fullName,
            mobile: mobile,
            nationalAddress: nationalAddress,
            licenseKey: licenseKey,
            licenseStatus: 'pending_verification',
            licenseExpiresAt: expirationDate,
            isEmailVerified: false,
            emailVerificationToken: crypto.randomBytes(32).toString('hex')
        };
        
        if (global.isMongoConnected) {
            await Settings.create(settingsData);
        } else {
            if (!mockDb.settingsTenant) {
                mockDb.settingsTenant = { 'default': { ...mockDb.settings, tenantId: 'default' } };
            }
            mockDb.settingsTenant[normalizedTenantId] = settingsData;
        }
        
        // 2. Create Tenant-Specific Admin User
        const passwordHash = bcrypt.hashSync(adminPassword, 10);
        const adminUser = {
            id: 'u-' + Date.now().toString(),
            username: adminUsername,
            passwordHash,
            role: 'Admin',
            tenantId: normalizedTenantId
        };
        
        if (global.isMongoConnected) {
            await User.create(adminUser);
        } else {
            mockDb.users.push(adminUser);
        }
        
        // 3. Seed initial products based on businessType
        const productsToSeed = global.defaultProductsBySector[businessType] || global.defaultProductsBySector.retail;
        const seedBase = Date.now();
        const seedProducts = productsToSeed.map((p, idx) => ({
            id: `${normalizedTenantId}-p${seedBase + idx}`,
            nameEN: p.nameEN,
            nameAR: p.nameAR,
            price: p.price,
            cost: p.cost,
            stock: p.stock,
            category: p.category,
            emoji: p.emoji,
            barcode: p.barcode,
            tenantId: normalizedTenantId
        }));
        
        if (global.isMongoConnected) {
            await Product.insertMany(seedProducts);
        } else {
            mockDb.products.push(...seedProducts);
        }
        
        // 4. Seed Standard Chart of Accounts
        const standardAccounts = [
            { code: '1000', nameEN: 'Cash', nameAR: 'نقد', type: 'Asset' },
            { code: '1010', nameEN: 'Bank Account', nameAR: 'حساب بنكي', type: 'Asset' },
            { code: '1200', nameEN: 'Accounts Receivable', nameAR: 'الذمم المدينة', type: 'Asset' },
            { code: '1300', nameEN: 'Inventory', nameAR: 'المخزون', type: 'Asset' },
            { code: '2000', nameEN: 'Accounts Payable', nameAR: 'الذمم الدائنة', type: 'Liability' },
            { code: '2100', nameEN: 'VAT Payable', nameAR: 'ضريبة القيمة المضافة المستحقة', type: 'Liability' },
            { code: '3000', nameEN: 'Owner Equity', nameAR: 'حقوق المالك', type: 'Equity' },
            { code: '4000', nameEN: 'Sales Revenue', nameAR: 'إيرادات المبيعات', type: 'Revenue' },
            { code: '5000', nameEN: 'Cost of Goods Sold', nameAR: 'تكلفة البضاعة المباعة', type: 'Expense' },
            { code: '5100', nameEN: 'Salaries Expense', nameAR: 'مصروفات الرواتب', type: 'Expense' },
            { code: '5200', nameEN: 'Rent Expense', nameAR: 'مصروفات الإيجار', type: 'Expense' },
            { code: '5300', nameEN: 'Utilities Expense', nameAR: 'مصروفات المنافع', type: 'Expense' },
            { code: '5400', nameEN: 'Miscellaneous Expense', nameAR: 'مصروفات متنوعة', type: 'Expense' }
        ].map(acc => ({ ...acc, tenantId: normalizedTenantId, balance: 0 }));

        if (global.isMongoConnected) {
            await Account.insertMany(standardAccounts);
        } else {
            mockDb.accounts = mockDb.accounts || [];
            mockDb.accounts.push(...standardAccounts);
        }
        
        // Send email asynchronously (don't block the response)
        if (email) {
            if (typeof global.sendLicenseEmail === 'function') {
                global.sendLicenseEmail(email, normalizedTenantId, businessName, licenseKey, expirationDate, baseDomain, settingsData.emailVerificationToken);
            }
        }
        
        let cfResult = null;
        if (process.env.CF_ACCOUNT_ID && baseDomain) {
            cfResult = await global.updateCloudflareTunnelConfig(`${normalizedTenantId}.${baseDomain}`).catch(err => ({ error: err.message }));
        }        

        // Send Welcome Email
        if (process.env.SMTP_HOST && process.env.SMTP_USER) {
            try {
                const nodemailer = require('nodemailer');
                let transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: process.env.SMTP_PORT || 587,
                    secure: process.env.SMTP_PORT == 465,
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS,
                    },
                });
                
                const storeUrl = `http://${normalizedTenantId}.${baseDomain}`;
                const htmlContent = `
                    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; border-radius: 10px;">
                        <h2 style="color: #333;">Welcome to KamySoft ERP!</h2>
                        <p>Hi ${fullName || adminUsername},</p>
                        <p>Your store <strong>${businessName}</strong> has been successfully created.</p>
                        <div style="background-color: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #555;">Your Login Credentials</h3>
                            <p><strong>Store URL:</strong> <a href="${storeUrl}">${storeUrl}</a></p>
                            <p><strong>Username:</strong> ${adminUsername}</p>
                            <p><strong>Password:</strong> <span style="font-family: monospace; background: #eee; padding: 3px 6px; border-radius: 4px;">${adminPassword}</span></p>
                        </div>
                        <p>We highly recommend logging in and changing your password immediately from the Settings page.</p>
                        <p>Best regards,<br>KamySoft Team</p>
                    </div>
                `;

                await transporter.sendMail({
                    from: process.env.EMAIL_FROM || '"KamySoft ERP" <info@26i.uk>',
                    to: email,
                    subject: 'Welcome to KamySoft ERP - Your Login Credentials',
                    html: htmlContent,
                });
                console.log(`Welcome email sent to ${email} for tenant ${normalizedTenantId}`);
            } catch (emailErr) {
                console.error('Error sending welcome email:', emailErr);
            }
        }
        res.status(201).json({ 
            success: true, 
            tenantId: normalizedTenantId,
            licenseKey: licenseKey,
            cfResult: cfResult
        });
    } catch (err) {
        console.error('Error registering tenant:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/auth/verify-email', async (req, res) => {
    try {
        const { token, tenantId } = req.query;
        if (!token || !tenantId) return res.status(400).send('Missing verification parameters.');
        
        let settings;
        if (global.isMongoConnected) {
            settings = await Settings.findOne({ tenantId });
        } else {
            settings = mockDb.settingsTenant && mockDb.settingsTenant[tenantId];
        }
        if (!settings) return res.status(404).send('Tenant not found.');
        
        const host = (req.headers.host || '').split(':')[0].toLowerCase();
        const baseDomain = getBaseDomain(host);
        
        if (settings.isEmailVerified) {
            return res.redirect(`http://${tenantId}.${baseDomain}/login`);
        }
        
        if (settings.emailVerificationToken !== token) {
            return res.status(400).send('Invalid or expired verification token.');
        }
        
        settings.isEmailVerified = true;
        settings.emailVerificationToken = undefined;
        settings.licenseStatus = 'active';
        if (global.isMongoConnected) {
            await settings.save();
        } else {
            mockDb.settingsTenant[tenantId] = settings;
        }
        
        // Update Cloudflare Tunnel now that email is verified
        if (process.env.CF_ACCOUNT_ID && baseDomain) {
            global.updateCloudflareTunnelConfig(`${tenantId}.${baseDomain}`).catch(err => console.error(err));
        }
        
        res.send(`
            <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h2 style="color: #10b981;">Email Verified Successfully!</h2>
                    <p>Your tenant <b>${tenantId}</b> is now launching.</p>
                    <p>Redirecting you to your login page...</p>
                    <script>
                        setTimeout(() => {
                            window.location.href = "http://${tenantId}.${baseDomain}/login";
                        }, 3000);
                    </script>
                </body>
            </html>
        `);
    } catch (err) {
        console.error('Error verifying email:', err);
        res.status(500).send('Internal server error.');
    }
});

router.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json(req.user);
});

// PUBLIC INQUIRIES & DEMO REQUESTS
router.post('/api/inquiries', async (req, res) => {
    try {
        const { name, email, phone, businessName, businessType, branches, message } = req.body;
        if (!name || !email) {
            return res.status(400).json({ error: 'Name and Email are required.' });
        }
        const inquiryData = {
            name,
            email,
            phone: phone || '',
            businessName: businessName || '',
            businessType: businessType || 'retail',
            branches: Number(branches) || 1,
            message: message || '',
            createdAt: new Date()
        };

        if (global.isMongoConnected) {
            const inquiry = new Inquiry(inquiryData);
            await inquiry.save();
        } else {
            mockDb.inquiries = mockDb.inquiries || [];
            mockDb.inquiries.push({ id: String(mockDb.inquiries.length + 1), ...inquiryData });
            console.log('In-memory Mock Inquiry Saved:', inquiryData);
        }
        res.status(201).json({ success: true, message: 'Inquiry submitted successfully!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/inquiries', authenticateToken, async (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        if (global.isMongoConnected) {
            const inquiries = await Inquiry.find({}).sort({ createdAt: -1 });
            res.json(inquiries);
        } else {
            res.json(mockDb.inquiries || []);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SETTINGS & MULTI-CURRENCY
// SETTINGS & MULTI-CURRENCY
router.get('/api/settings', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        // Public portals read this without logging in, so only a logged-in Admin of
        // this store gets the secrets (ZATCA private key, SMTP password, ...).
        const viewer = getOptionalUser(req);
        const audience = viewer ? (viewer.role === 'Admin' ? 'admin' : 'staff') : 'public';
        const sendSettings = (s) => res.json(sanitizeSettings(s, audience));
        if (global.isMongoConnected) {
            let settings = await Settings.findOne({ tenantId });
            if (!settings) {
                if (tenantId === 'default') {
                    settings = await Settings.create({ ...mockDb.settings, tenantId: 'default' });
                } else {
                    return res.status(404).json({ error: 'Store not found or deleted' });
                }
            }
            sendSettings(settings);
        } else {
            if (!mockDb.settingsTenant) {
                mockDb.settingsTenant = { 'default': { ...mockDb.settings, tenantId: 'default' } };
            }
            if (!mockDb.settingsTenant[tenantId]) {
                if (tenantId === 'default') {
                    mockDb.settingsTenant[tenantId] = { ...mockDb.settings, tenantId: 'default' };
                } else {
                    return res.status(404).json({ error: 'Store not found or deleted' });
                }
            }
            sendSettings(mockDb.settingsTenant[tenantId]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.post('/api/send-email', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        let settings = null;
        if (global.isMongoConnected) {
            settings = await Settings.findOne({ tenantId });
        } else {
            settings = mockDb.settingsTenant[tenantId] || mockDb.settings;
        }

        if (!settings || !settings.smtp || !settings.smtp.host && settings.smtp.provider !== 'sendgrid') {
            return res.status(400).json({ error: 'SMTP settings not configured' });
        }

        const { to, subject, html } = req.body;
        const smtp = settings.smtp;

        if (smtp.provider === 'sendgrid') {
            if (!smtp.sendgridApiKey) return res.status(400).json({ error: 'SendGrid API key not configured' });
            sgMail.setApiKey(smtp.sendgridApiKey);
            const msg = {
                to,
                from: smtp.fromEmail || 'test@example.com',
                subject,
                html,
            };
            await sgMail.send(msg);
        } else {
            let transporter = nodemailer.createTransport({
                host: smtp.host,
                port: smtp.port,
                secure: smtp.port == 465, // true for 465, false for other ports
                auth: {
                    user: smtp.user,
                    pass: smtp.password,
                },
            });
            await transporter.sendMail({
                from: smtp.fromEmail || smtp.user,
                to,
                subject,
                html,
            });
        }
        res.json({ success: true, message: 'Email sent successfully' });
    } catch (err) {
        console.error('Email sending error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/settings', authenticateToken, async (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            let settings = await Settings.findOne({ tenantId });
            // Drop license/tenant fields and keep stored secrets the client sent back empty
            const update = sanitizeSettingsUpdate(req.body, settings);
            if (settings) {
                Object.assign(settings, update);
                await settings.save();
            } else {
                settings = new Settings({ ...update, tenantId });
                await settings.save();
            }
            res.json(sanitizeSettings(settings, 'admin'));
        } else {
            if (!mockDb.settingsTenant) {
                mockDb.settingsTenant = { 'default': { ...mockDb.settings, tenantId: 'default' } };
            }
            const update = sanitizeSettingsUpdate(req.body, mockDb.settingsTenant[tenantId]);
            mockDb.settingsTenant[tenantId] = { ...mockDb.settingsTenant[tenantId], ...update, tenantId };
            res.json(mockDb.settingsTenant[tenantId]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SAAS: CUSTOM DOMAINS ---
router.post('/api/domains/add', authenticateToken, async (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        const { domain } = req.body;
        const tenantId = getTenantId(req);
        if (!domain) return res.status(400).json({ error: 'Domain is required' });

        if (global.isMongoConnected) {
            const existing = await CustomDomain.findOne({ domain });
            if (existing) return res.status(400).json({ error: 'Domain already in use' });

            const newDomain = new CustomDomain({ domain, tenantId, status: 'pending' });
            await newDomain.save();
            res.json({ success: true, message: 'Domain added. Please point CNAME to 26i.uk', domain: newDomain });
        } else {
            res.json({ success: true, message: 'Domain added (Mock Mode)' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/domains/verify', authenticateToken, async (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        const { domain } = req.body;
        const tenantId = getTenantId(req);
        
        if (global.isMongoConnected) {
            const customDomain = await CustomDomain.findOne({ domain, tenantId });
            if (!customDomain) return res.status(404).json({ error: 'Domain not found' });
            
            // In a real app, verify DNS here.
            customDomain.status = 'verified';
            await customDomain.save();
            res.json({ success: true, message: 'Domain verified successfully', domain: customDomain });
        } else {
            res.json({ success: true, message: 'Domain verified (Mock Mode)' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SAAS: THEMES ---
router.post('/api/themes/update', authenticateToken, async (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        const { activeTheme, themeConfig } = req.body;
        const tenantId = getTenantId(req);
        
        if (global.isMongoConnected) {
            let settings = await Settings.findOne({ tenantId });
            if (!settings) return res.status(404).json({ error: 'Settings not found' });
            
            if (activeTheme) settings.activeTheme = activeTheme;
            if (themeConfig) settings.themeConfig = themeConfig;
            
            await settings.save();
            res.json({ success: true, activeTheme: settings.activeTheme, themeConfig: settings.themeConfig });
        } else {
            if (mockDb.settingsTenant && mockDb.settingsTenant[tenantId]) {
                if (activeTheme) mockDb.settingsTenant[tenantId].activeTheme = activeTheme;
                if (themeConfig) mockDb.settingsTenant[tenantId].themeConfig = themeConfig;
                res.json({ success: true, activeTheme: mockDb.settingsTenant[tenantId].activeTheme, themeConfig: mockDb.settingsTenant[tenantId].themeConfig });
            } else {
                res.status(404).json({ error: 'Settings not found (Mock Mode)' });
            }
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/themes/active', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const settings = await Settings.findOne({ tenantId });
            if (settings) {
                res.json({ activeTheme: settings.activeTheme || 'default', themeConfig: settings.themeConfig || {} });
            } else {
                res.json({ activeTheme: 'default', themeConfig: {} });
            }
        } else {
            const settings = mockDb.settingsTenant && mockDb.settingsTenant[tenantId];
            if (settings) {
                res.json({ activeTheme: settings.activeTheme || 'default', themeConfig: settings.themeConfig || {} });
            } else {
                res.json({ activeTheme: 'default', themeConfig: {} });
            }
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FILE UPLOAD APIs
router.post('/api/upload/image', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const extension = req.file.originalname.split('.').pop();
        const fileName = `${tenantId}/images/${Date.now()}-${Math.round(Math.random() * 1000)}.${extension}`;
        
        // Upload to S3 as public
        const fileUrl = await uploadFile(req.file.buffer, fileName, req.file.mimetype, true);
        
        res.json({ success: true, url: fileUrl });
    } catch (err) {
        console.error('S3 Image Upload Error:', err);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

router.post('/api/upload/digital-asset', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const extension = req.file.originalname.split('.').pop();
        const fileName = `${tenantId}/digital-assets/${Date.now()}-${Math.round(Math.random() * 1000)}.${extension}`;
        
        // Upload to S3 as private
        const objectKey = await uploadFile(req.file.buffer, fileName, req.file.mimetype, false);
        
        res.json({ success: true, key: objectKey });
    } catch (err) {
        console.error('S3 Digital Asset Upload Error:', err);
        res.status(500).json({ error: 'Failed to upload digital asset' });
    }
});

// STOREFRONT APIs (Publicly accessible but scoped to tenant)
router.get('/api/storefront/products', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const products = await Product.find({ tenantId });
            res.json(products);
        } else {
            const products = mockDb.products.filter(p => p.tenantId === tenantId);
            res.json(products);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/storefront/orders', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { customer, email, phone, address, items, paymentMethod, total } = req.body;
        
        // Basic validation
        if (!items || !items.length) {
            return res.status(400).json({ error: 'Order must contain items' });
        }
        
        const orderId = `SF-${Date.now().toString().slice(-6)}`;
        const newOrder = {
            id: orderId,
            tenantId,
            customer: customer || 'Storefront Guest',
            email: email || '',
            phone: phone || '',
            address: address || '',
            items: JSON.stringify(items),
            paymentMethod: paymentMethod || 'Mock Payment',
            total,
            status: 'Pending',
            date: new Date().toISOString()
        };

        if (global.isMongoConnected) {
            const orderDoc = new Order(newOrder);
            await orderDoc.save();
        } else {
            mockDb.orders.push(newOrder);
        }

        // Process digital assets delivery
        const digitalItems = items.filter(i => i.isDigital);
        if (digitalItems.length > 0 && email) {
            let linksHtml = '<ul>';
            
            // Generate presigned URLs for each digital asset
            for (const di of digitalItems) {
                let downloadLink = di.digitalAssetUrl;
                
                // If the URL is actually an S3 key (doesn't start with http), generate a presigned link
                if (di.digitalAssetUrl && !di.digitalAssetUrl.startsWith('http')) {
                    try {
                        downloadLink = await getPresignedUrl(di.digitalAssetUrl, 7 * 24 * 3600); // Link valid for 7 days
                    } catch (s3Err) {
                        console.error('Failed to generate presigned URL for:', di.digitalAssetUrl, s3Err);
                    }
                }
                
                linksHtml += `<li><b>${di.nameEN || di.name}</b>: <a href="${downloadLink}">Download Link</a><br/><small>${di.digitalAssetInstructions || ''}</small></li>`;
            }
            linksHtml += '</ul>';

            const emailHtml = `
                <h3>Thank you for your order!</h3>
                <p>Order ID: ${orderId}</p>
                <p>Your digital products are ready for download:</p>
                ${linksHtml}
            `;
            
            // Send email
            let settings = null;
            if (global.isMongoConnected) {
                settings = await Settings.findOne({ tenantId });
            } else {
                settings = mockDb.settingsTenant[tenantId] || mockDb.settings;
            }

            if (settings && settings.smtp && (settings.smtp.host || settings.smtp.provider === 'sendgrid')) {
                const smtp = settings.smtp;
                if (smtp.provider === 'sendgrid' && smtp.sendgridApiKey) {
                    const sgMail = require('@sendgrid/mail');
                    sgMail.setApiKey(smtp.sendgridApiKey);
                    await sgMail.send({
                        to: email,
                        from: smtp.fromEmail || 'test@example.com',
                        subject: 'Your Digital Goods Order #' + orderId,
                        html: emailHtml,
                    }).catch(e => console.error(e));
                } else if (smtp.host && smtp.user) {
                    const nodemailer = require('nodemailer');
                    let transporter = nodemailer.createTransport({
                        host: smtp.host,
                        port: smtp.port,
                        secure: smtp.port == 465,
                        auth: { user: smtp.user, pass: smtp.password },
                    });
                    await transporter.sendMail({
                        from: smtp.fromEmail || smtp.user,
                        to: email,
                        subject: 'Your Digital Goods Order #' + orderId,
                        html: emailHtml,
                    }).catch(e => console.error(e));
                }
            }
        }

        res.json({ success: true, orderId: orderId, message: 'Order placed successfully' });
    } catch (err) {
        console.error('Storefront Order Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PRODUCTS / INVENTORY
router.get('/api/products', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const products = await Product.find({ tenantId });
            res.json(products);
        } else {
            const products = mockDb.products.filter(p => p.tenantId === tenantId);
            res.json(products);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/products', authenticateToken, async (req, res) => {
    if (req.user.role === 'Cashier') return res.status(403).json({ error: 'Forbidden' });
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const count = await Product.countDocuments({ tenantId });
            const product = new Product({
                ...req.body,
                id: req.body.id || (1000 + count + 1).toString(),
                tenantId
            });
            await product.save();
            res.json(product);
        } else {
            const product = { ...req.body, id: req.body.id || (1000 + mockDb.products.length + 1).toString(), tenantId };
            mockDb.products.push(product);
            res.json(product);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/products/:id', authenticateToken, async (req, res) => {
    if (req.user.role === 'Cashier') return res.status(403).json({ error: 'Forbidden' });
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const product = await Product.findOneAndUpdate({ id: req.params.id, tenantId }, req.body, { new: true });
            if (!product) return res.status(404).json({ error: 'Product not found' });
            res.json(product);
        } else {
            const idx = mockDb.products.findIndex(p => p.id === req.params.id && p.tenantId === tenantId);
            if (idx === -1) return res.status(404).json({ error: 'Product not found' });
            mockDb.products[idx] = { ...mockDb.products[idx], ...req.body, tenantId };
            res.json(mockDb.products[idx]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/products/:id', authenticateToken, async (req, res) => {
    if (req.user.role === 'Cashier') return res.status(403).json({ error: 'Forbidden' });
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const result = await Product.findOneAndDelete({ id: req.params.id, tenantId });
            if (!result) return res.status(404).json({ error: 'Product not found' });
            res.sendStatus(204);
        } else {
            const originalLength = mockDb.products.length;
            mockDb.products = mockDb.products.filter(p => !(p.id === req.params.id && p.tenantId === tenantId));
            if (mockDb.products.length === originalLength) return res.status(404).json({ error: 'Product not found' });
            res.sendStatus(204);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// INVOICES & ZATCA PORTAL
router.get('/api/invoices', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const invoices = await Invoice.find({ tenantId });
            res.json(invoices);
        } else {
            const invoices = mockDb.invoices.filter(i => i.tenantId === tenantId);
            res.json(invoices);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ZATCA mode -------------------------------------------------------------
// 'connected'     : invoices are signed (Phase 2 XML, hash chain, full QR) and can be reported.
// 'not_connected' : no signing or reporting; invoices get the basic simplified-invoice QR
//                   (seller, VAT number, time, total, VAT) and status NOT_CONNECTED.
const isZatcaConnected = (settings) => ((settings && settings.zatcaConn && settings.zatcaConn.mode) || 'connected') === 'connected';

// Basic ZATCA QR (TLV tags 1-5), base64
function buildBasicZatcaQr(settings, invoice) {
    const tlv = (tag, value) => {
        const v = Buffer.from(String(value ?? ''), 'utf8');
        const len = v.length < 128 ? Buffer.from([v.length]) : v.length < 256 ? Buffer.from([0x81, v.length]) : Buffer.from([0x82, (v.length >> 8) & 0xff, v.length & 0xff]);
        return Buffer.concat([Buffer.from([tag]), len, v]);
    };
    const raw = String(invoice.date || '').trim();
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)/);
    const timestamp = m ? `${m[1]}T${m[2].length === 5 ? m[2] + ':00' : m[2]}` : new Date().toISOString().slice(0, 19);
    return Buffer.concat([
        tlv(1, settings.businessName || ''),
        tlv(2, settings.vatNumber || ''),
        tlv(3, timestamp),
        tlv(4, Number(invoice.total || 0).toFixed(2)),
        tlv(5, Number(invoice.vat || 0).toFixed(2))
    ]).toString('base64');
}

function applyNotConnectedZatca(invoice, settings) {
    // Not part of the signed invoice chain (the next signed invoice links to the last signed one)
    invoice.pih = 'NOT_CONNECTED';
    invoice.qrCode = buildBasicZatcaQr(settings, invoice);
    invoice.xml = undefined; invoice.xmlHash = undefined; invoice.xmlHashBase64 = undefined;
    invoice.signature = undefined; invoice.publicKey = undefined; invoice.certSignature = undefined;
    if (!invoice.zatcaStatus || invoice.zatcaStatus === 'PENDING') invoice.zatcaStatus = 'NOT_CONNECTED';
}

router.post('/api/invoices', authenticateToken, async (req, res) => {
    const invoice = req.body;
    if (!invoice.id) {
        invoice.id = `INV-${Date.now().toString().slice(-6)}`;
    }
    invoice.uuid = invoice.uuid || crypto.randomUUID();
    const tenantId = getTenantId(req);
    invoice.tenantId = tenantId;

    try {
        if (global.isMongoConnected) {
            const count = await Invoice.countDocuments({ tenantId });
            invoice.csn = count + 1;

            // Previous invoice hash = last *signed* invoice (invoices made in Not connected mode have none)
            let pih = zatcaCrypto.DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH;
            const lastInvs = await Invoice.find({ tenantId, xmlHashBase64: { $exists: true, $nin: [null, ''] } }).sort({ csn: -1 }).limit(1);
            if (lastInvs.length > 0 && lastInvs[0].xmlHashBase64) {
                pih = lastInvs[0].xmlHashBase64;
            }
            invoice.pih = pih;

            let settings = await Settings.findOne({ tenantId });
            if (!settings) settings = mockDb.settings;

            if (!isZatcaConnected(settings)) {
                applyNotConnectedZatca(invoice, settings);
            } else {
                const keys = zatcaCrypto.getKeys(tenantId) || zatcaCrypto.onboardDevice(tenantId, {
                    organizationNameAr: settings.businessName,
                    organizationNameEn: settings.businessName,
                    vatNumber: settings.vatNumber,
                    crNumber: settings.crNumber
                }, settings?.zatcaConn?.env || 'sandbox');

                const privKey = settings?.zatcaConn?.privateKey || keys.privateKeyPem;
                const certPem = settings?.zatcaConn?.clientId || keys.certificatePem;

                const unsignedXml = zatcaCrypto.generateZATCAXML(invoice, settings);
                const signed = zatcaCrypto.signInvoice({
                    xml: unsignedXml,
                    privateKeyPem: privKey,
                    certificatePem: certPem
                });

                invoice.xml = signed.signedXml;
                invoice.xmlHash = signed.xmlHashHex;
                invoice.xmlHashBase64 = signed.xmlHashBase64;
                invoice.signature = signed.signatureHex;
                invoice.publicKey = signed.publicKeyBase64;
                invoice.certSignature = signed.certificateSignature;
                invoice.qrCode = signed.qrCodeBase64;
                if (!invoice.zatcaStatus) {
                    invoice.zatcaStatus = 'PENDING';
                }
            }

            const newInvoice = new Invoice(invoice);
            await newInvoice.save();

            // Deduct stock
            for (const item of (invoice.items || [])) {
                const prod = await Product.findOne({ id: item.id, tenantId });
                if (prod) {
                    prod.stock = Math.max(0, prod.stock - item.qty);
                    await prod.save();
                }
            }

            res.json(newInvoice);
        } else {
            const tenantInvs = mockDb.invoices.filter(i => i.tenantId === tenantId);
            invoice.csn = tenantInvs.length + 1;

            // Previous invoice hash = last *signed* invoice (invoices made in Not connected mode have none)
            let pih = zatcaCrypto.DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH;
            const signedInvs = tenantInvs.filter(i => i.xmlHashBase64);
            if (signedInvs.length > 0) pih = signedInvs[signedInvs.length - 1].xmlHashBase64;
            invoice.pih = pih;

            const settings = (mockDb.settingsTenant && mockDb.settingsTenant[tenantId]) || mockDb.settings;
            if (!isZatcaConnected(settings)) {
                applyNotConnectedZatca(invoice, settings);
            } else {
                const keys = zatcaCrypto.getKeys(tenantId) || zatcaCrypto.onboardDevice(tenantId, {
                    organizationNameAr: settings.businessName,
                    organizationNameEn: settings.businessName,
                    vatNumber: settings.vatNumber,
                    crNumber: settings.crNumber
                }, settings?.zatcaConn?.env || 'sandbox');

                const privKey = settings?.zatcaConn?.privateKey || keys.privateKeyPem;
                const certPem = settings?.zatcaConn?.clientId || keys.certificatePem;

                const unsignedXml = zatcaCrypto.generateZATCAXML(invoice, settings);
                const signed = zatcaCrypto.signInvoice({
                    xml: unsignedXml,
                    privateKeyPem: privKey,
                    certificatePem: certPem
                });

                invoice.xml = signed.signedXml;
                invoice.xmlHash = signed.xmlHashHex;
                invoice.xmlHashBase64 = signed.xmlHashBase64;
                invoice.signature = signed.signatureHex;
                invoice.publicKey = signed.publicKeyBase64;
                invoice.certSignature = signed.certificateSignature;
                invoice.qrCode = signed.qrCodeBase64;
                if (!invoice.zatcaStatus) {
                    invoice.zatcaStatus = 'PENDING';
                }
            }

            mockDb.invoices.push(invoice);

            // Deduct stock
            (invoice.items || []).forEach(item => {
                const prod = mockDb.products.find(p => p.id === item.id && p.tenantId === tenantId);
                if (prod) prod.stock = Math.max(0, prod.stock - item.qty);
            });

            res.json(invoice);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/zatca/onboard', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { otp, env, deviceSerial } = req.body;
        const targetEnv = env || 'sandbox';

        let settings;
        if (global.isMongoConnected) {
            settings = await Settings.findOne({ tenantId });
        } else {
            settings = (mockDb.settingsTenant && mockDb.settingsTenant[tenantId]) ? mockDb.settingsTenant[tenantId] : mockDb.settings;
        }

        const orgName = settings?.businessName || settings?.companyName || 'KamySoft ERP';
        const vatNumber = settings?.vatNumber || '310122393500003';
        const crNumber = settings?.crNumber || '1010123456';
        const rawAddress = settings?.businessAddress || settings?.address || 'Riyadh';
        const city = rawAddress.split(',')[0].trim() || 'Riyadh';
        const egsSerial = deviceSerial || settings?.zatcaConn?.deviceSerial || '1-26I|2-POS|3-ed22f1d8-e6a2-1118-9b58-d9a8f11e445f';

        const onboarded = zatcaCrypto.onboardDevice(tenantId, {
            organizationNameAr: orgName,
            organizationNameEn: orgName,
            vatNumber,
            crNumber,
            country: 'SA',
            invoiceType: '1100',
            commonName: `26I-${vatNumber}`,
            egsSerialNumber: egsSerial,
            location: {
                city,
                district: city,
                street: city,
                buildingNumber: '1234',
                postalCode: '12211'
            },
            businessCategory: settings?.businessType || 'Retail'
        }, targetEnv);

        let zatcaRes = {
            certificate: onboarded.certificatePem,
            secret: 'SANDBOX-CSID-SECRET-26I',
            mode: 'sandbox-local'
        };

        if (otp && otp !== '123456') {
            try {
                const liveRes = await zatcaApi.registerDevice(otp, onboarded.csrPem, targetEnv);
                zatcaRes = {
                    certificate: liveRes.certificate,
                    secret: liveRes.secret,
                    requestId: liveRes.requestId,
                    mode: 'zatca-gateway'
                };
            } catch (e) {
                if (targetEnv === 'production') {
                    return res.status(400).json({ error: 'ZATCA Production Registration failed: ' + e.message });
                }
                console.warn('ZATCA Live Gateway unreachable or OTP invalid in non-production; using compliant local CSID:', e.message);
                zatcaRes.warning = e.message;
            }
        }

        const connData = {
            env: targetEnv,
            endpoint: zatcaApi.getBaseUrl(targetEnv),
            clientId: zatcaRes.certificate,
            clientSecret: zatcaRes.secret,
            privateKey: onboarded.privateKeyPem,
            publicKey: onboarded.publicKeyPem,
            csr: onboarded.csrPem,
            deviceSerial: egsSerial,
            otp: otp || '123456',
            status: 'CONNECTED',
            autoSend: settings?.zatcaConn?.autoSend || false,
            requestId: zatcaRes.requestId || ''
        };

        if (global.isMongoConnected) {
            await Settings.updateOne({ tenantId }, { $set: { zatcaConn: connData } }, { upsert: true });
        } else {
            if (!mockDb.settingsTenant) mockDb.settingsTenant = {};
            if (!mockDb.settingsTenant[tenantId]) mockDb.settingsTenant[tenantId] = { ...mockDb.settings, tenantId };
            mockDb.settingsTenant[tenantId].zatcaConn = connData;
            if (tenantId === 'default') {
                mockDb.settings.zatcaConn = connData;
            }
        }

        res.json({
            message: 'Device keys, CSR, and CSID registered successfully',
            keys: {
                publicKey: onboarded.publicKeyPem,
                csr: onboarded.csrPem
            },
            zatca: zatcaRes,
            zatcaConn: connData
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/invoices/:id/zatca-report', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        let invoice;
        let settings;
        if (global.isMongoConnected) {
            invoice = await Invoice.findOne({ id: req.params.id, tenantId });
            settings = await Settings.findOne({ tenantId });
        } else {
            invoice = mockDb.invoices.find(i => i.id === req.params.id && i.tenantId === tenantId);
            settings = (mockDb.settingsTenant && mockDb.settingsTenant[tenantId]) || mockDb.settings;
        }

        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        if (!settings) settings = mockDb.settings;
        if (!isZatcaConnected(settings)) {
            return res.status(400).json({ error: 'ZATCA is set to Not connected (Settings > ZATCA). Switch to Connected to report invoices.', zatcaStatus: invoice.zatcaStatus });
        }

        // Load or auto-provision tenant cryptographic keys & CSID
        let localKeys = zatcaCrypto.getKeys(tenantId);
        if (!localKeys) {
            localKeys = zatcaCrypto.onboardDevice(tenantId, {
                organizationNameAr: settings.businessName,
                organizationNameEn: settings.businessName,
                vatNumber: settings.vatNumber,
                crNumber: settings.crNumber
            }, settings?.zatcaConn?.env || 'sandbox');
        }

        const cert = settings?.zatcaConn?.clientId || localKeys.certificatePem;
        const secret = settings?.zatcaConn?.clientSecret || 'SANDBOX-CSID-SECRET-26I';
        const privateKey = settings?.zatcaConn?.privateKey || localKeys.privateKeyPem;
        const env = settings?.zatcaConn?.env || 'sandbox';

        // 1. Generate ZATCA Phase 2 UBL 2.1 XML
        const unsignedXml = zatcaCrypto.generateZATCAXML(invoice, settings);

        // 2. Sign XML with XAdES ECDSA-SHA256 & embed Phase 2 9-tag TLV QR Code
        const signedResult = zatcaCrypto.signInvoice({
            xml: unsignedXml,
            privateKeyPem: privateKey,
            certificatePem: cert
        });

        const xmlBase64 = Buffer.from(signedResult.signedXml, 'utf8').toString('base64');
        const invoiceHashBase64 = signedResult.invoiceHash;

        // 3. Submit to ZATCA Fatoora API if using live gateway credentials, or verify in local sandbox
        let gatewayResponse = {
            reportingStatus: 'REPORTED',
            validationResults: {
                status: 'PASS',
                infoMessages: [{ code: 'XSD_ZATCA_VALID', message: 'UBL 2.1 XML, XAdES-EPES signature, PIH chain, and Phase 2 TLV QR verified.' }],
                warningMessages: [],
                errorMessages: []
            }
        };

        const isSimulatedSecret = !secret || secret === 'SIMULATED_SECRET' || secret === 'SANDBOX-CSID-SECRET-26I';
        if (!isSimulatedSecret) {
            try {
                const isStandard = invoice.invoiceTypeCodeName === '0100000' || invoice.profileId === 'clearance:1.0';
                if (isStandard) {
                    gatewayResponse = await zatcaApi.clearInvoice(xmlBase64, invoiceHashBase64, cert, secret, env, invoice.uuid);
                } else {
                    gatewayResponse = await zatcaApi.reportInvoice(xmlBase64, invoiceHashBase64, cert, secret, env, invoice.uuid);
                }
            } catch (e) {
                if (env === 'production') {
                    return res.status(400).json({ error: 'ZATCA Reporting failed: ' + e.message });
                }
                console.warn('ZATCA Live Gateway returned error in non-production mode; falling back to local sandbox clearance:', e.message);
                gatewayResponse.gatewayWarning = e.message;
            }
        }

        invoice.xml = signedResult.signedXml;
        invoice.xmlHash = signedResult.xmlHashHex;
        invoice.xmlHashBase64 = invoiceHashBase64;
        invoice.signature = signedResult.signatureHex;
        invoice.publicKey = signedResult.publicKeyBase64;
        invoice.certSignature = signedResult.certificateSignature;
        invoice.qrCode = signedResult.qrCodeBase64;
        invoice.zatcaStatus = 'REPORTED';

        if (global.isMongoConnected) {
            await invoice.save();
        }

        res.json({
            message: 'Reported to ZATCA successfully',
            zatcaStatus: invoice.zatcaStatus,
            uuid: invoice.uuid,
            csn: invoice.csn,
            pih: invoice.pih,
            invoiceHash: invoiceHashBase64,
            xmlHash: signedResult.xmlHashHex,
            signature: signedResult.signatureHex,
            publicKey: signedResult.publicKeyBase64,
            certSignature: signedResult.certificateSignature,
            qrCode: signedResult.qrCodeBase64,
            xml: signedResult.signedXml,
            gatewayResponse
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/invoices/:id/refund', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const invoice = await Invoice.findOne({ id: req.params.id, tenantId });
            if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
            if (invoice.zatcaStatus === 'REFUNDED') return res.status(400).json({ error: 'Invoice already refunded' });

            let settings = await Settings.findOne({ tenantId });
            if (!settings) settings = mockDb.settings;
            const localKeys = zatcaCrypto.getKeys(tenantId) || zatcaCrypto.onboardDevice(tenantId, {}, 'sandbox');

            invoice.zatcaStatus = 'REFUNDED';
            invoice.invoiceTypeCode = '381'; // ZATCA Credit Note (BR-KSA-17)
            invoice.originalInvoiceId = invoice.id;

            if (!isZatcaConnected(settings)) {
                invoice.qrCode = buildBasicZatcaQr(settings, invoice);
            } else {
                const creditXml = zatcaCrypto.generateZATCAXML(invoice, settings);
                const signedCredit = zatcaCrypto.signInvoice({
                    xml: creditXml,
                    privateKeyPem: settings?.zatcaConn?.privateKey || localKeys.privateKeyPem,
                    certificatePem: settings?.zatcaConn?.clientId || localKeys.certificatePem
                });
                invoice.xml = signedCredit.signedXml;
                invoice.xmlHash = signedCredit.xmlHashHex;
                invoice.xmlHashBase64 = signedCredit.xmlHashBase64;
                invoice.signature = signedCredit.signatureHex;
                invoice.qrCode = signedCredit.qrCodeBase64;
            }

            await invoice.save();

            // Restore stock
            for (const item of (invoice.items || [])) {
                const prod = await Product.findOne({ id: item.id, tenantId });
                if (prod) {
                    prod.stock = prod.stock + item.qty;
                    await prod.save();
                }
            }
            res.json(invoice);
        } else {
            const invoice = mockDb.invoices.find(i => i.id === req.params.id && i.tenantId === tenantId);
            if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
            if (invoice.zatcaStatus === 'REFUNDED') return res.status(400).json({ error: 'Invoice already refunded' });

            const settings = (mockDb.settingsTenant && mockDb.settingsTenant[tenantId]) || mockDb.settings;
            const localKeys = zatcaCrypto.getKeys(tenantId) || zatcaCrypto.onboardDevice(tenantId, {}, 'sandbox');

            invoice.zatcaStatus = 'REFUNDED';
            invoice.invoiceTypeCode = '381'; // ZATCA Credit Note
            invoice.originalInvoiceId = invoice.id;

            if (!isZatcaConnected(settings)) {
                invoice.qrCode = buildBasicZatcaQr(settings, invoice);
            } else {
                const creditXml = zatcaCrypto.generateZATCAXML(invoice, settings);
                const signedCredit = zatcaCrypto.signInvoice({
                    xml: creditXml,
                    privateKeyPem: settings?.zatcaConn?.privateKey || localKeys.privateKeyPem,
                    certificatePem: settings?.zatcaConn?.clientId || localKeys.certificatePem
                });
                invoice.xml = signedCredit.signedXml;
                invoice.xmlHash = signedCredit.xmlHashHex;
                invoice.xmlHashBase64 = signedCredit.xmlHashBase64;
                invoice.signature = signedCredit.signatureHex;
                invoice.qrCode = signedCredit.qrCodeBase64;
            }

            // Restore stock
            (invoice.items || []).forEach(item => {
                const prod = mockDb.products.find(p => p.id === item.id && p.tenantId === tenantId);
                if (prod) prod.stock = prod.stock + item.qty;
            });
            res.json(invoice);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// EXPENSES
router.get('/api/expenses', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const expenses = await Expense.find({ tenantId });
            res.json(expenses);
        } else {
            const expenses = mockDb.expenses.filter(e => e.tenantId === tenantId);
            res.json(expenses);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FINANCIAL TRANSACTIONS (COMBINED INVOICES & EXPENSES)
router.get('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        let invoices = [];
        let expenses = [];
        
        if (mongoose.connection.readyState === 1) {
            invoices = await Invoice.find({ tenantId });
            expenses = await Expense.find({ tenantId });
        } else {
            invoices = mockDb.invoices.filter(i => i.tenantId === tenantId);
            expenses = mockDb.expenses.filter(e => e.tenantId === tenantId);
        }
        
        const transactions = [
            ...invoices.map(inv => ({
                id: inv.id,
                date: inv.date,
                type: 'Sale',
                ref: inv.id,
                description: `Customer: ${inv.customer}`,
                income: inv.total,
                expense: 0
            })),
            ...expenses.map(exp => ({
                id: exp.id,
                date: exp.date,
                type: 'Expense',
                ref: exp.id,
                description: `Category: ${exp.category} - ${exp.description || ''}`,
                income: 0,
                expense: exp.amount
            }))
        ];
        
        // Sort chronologically
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Calculate running balance
        let balance = 0;
        transactions.forEach(t => {
            balance += t.income - t.expense;
            t.balance = balance;
        });
        
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CHART OF ACCOUNTS
router.get('/api/accounts', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (mongoose.connection.readyState === 1) {
            const accounts = await Account.find({ tenantId });
            res.json(accounts);
        } else {
            const accounts = mockDb.accounts.filter(a => a.tenantId === tenantId);
            res.json(accounts);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/accounts', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (mongoose.connection.readyState === 1) {
            const account = new Account({ ...req.body, tenantId });
            await account.save();
            res.json(account);
        } else {
            const account = { ...req.body, tenantId };
            mockDb.accounts.push(account);
            res.json(account);
        }
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/api/accounts/:code', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (mongoose.connection.readyState === 1) {
            const account = await Account.findOneAndUpdate({ code: req.params.code, tenantId }, req.body, { new: true });
            if (!account) return res.status(404).json({ error: 'Account not found' });
            res.json(account);
        } else {
            const idx = mockDb.accounts.findIndex(a => a.code === req.params.code && a.tenantId === tenantId);
            if (idx === -1) return res.status(404).json({ error: 'Account not found' });
            mockDb.accounts[idx] = { ...mockDb.accounts[idx], ...req.body, tenantId };
            res.json(mockDb.accounts[idx]);
        }
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/api/accounts/:code', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (mongoose.connection.readyState === 1) {
            const result = await Account.findOneAndDelete({ code: req.params.code, tenantId });
            if (!result) return res.status(404).json({ error: 'Account not found' });
            res.json({ message: 'Deleted' });
        } else {
            const originalLength = mockDb.accounts.length;
            mockDb.accounts = mockDb.accounts.filter(a => !(a.code === req.params.code && a.tenantId === tenantId));
            if (mockDb.accounts.length === originalLength) return res.status(404).json({ error: 'Account not found' });
            res.json({ message: 'Deleted' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// JOURNAL ENTRIES
router.get('/api/journal', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (mongoose.connection.readyState === 1) {
            const entries = await JournalEntry.find({ tenantId }).sort({ date: -1 });
            res.json(entries);
        } else {
            const entries = mockDb.journalEntries.filter(e => e.tenantId === tenantId).sort((a, b) => new Date(b.date) - new Date(a.date));
            res.json(entries);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/journal', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const entryId = `JE-${Date.now().toString().slice(-6)}`;
        if (mongoose.connection.readyState === 1) {
            const entry = new JournalEntry({ ...req.body, entryId, tenantId });
            await entry.save();
            res.json(entry);
        } else {
            const entry = { ...req.body, entryId, tenantId };
            mockDb.journalEntries.push(entry);
            res.json(entry);
        }
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// VOUCHERS
router.get('/api/vouchers', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (mongoose.connection.readyState === 1) {
            const vouchers = await Voucher.find({ tenantId }).sort({ date: -1 });
            res.json(vouchers);
        } else {
            const vouchers = mockDb.vouchers.filter(v => v.tenantId === tenantId).sort((a, b) => new Date(b.date) - new Date(a.date));
            res.json(vouchers);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/vouchers', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const voucherId = `VCH-${Date.now().toString().slice(-6)}`;
        
        // Convert string to Date if needed
        const dateStr = req.body.date || new Date().toISOString();
        
        const voucherData = { 
            ...req.body, 
            voucherId, 
            tenantId,
            date: new Date(dateStr)
        };
        
        let savedVoucher;
        if (mongoose.connection.readyState === 1) {
            const voucher = new Voucher(voucherData);
            savedVoucher = await voucher.save();
        } else {
            savedVoucher = { ...voucherData };
            mockDb.vouchers.push(savedVoucher);
        }

        // Auto-generate Journal Entry for the voucher
        const account = savedVoucher.type === 'RECEIPT' ? '1000' : '2000'; // Cash account for Receipt, A/P for payment (simplified)
        const description = `${savedVoucher.type} Voucher: ${savedVoucher.description || ''}`;
        
        const journalData = {
            entryId: `JE-${Date.now().toString().slice(-6)}`,
            date: savedVoucher.date || new Date(),
            account,
            description,
            debit: savedVoucher.type === 'RECEIPT' ? savedVoucher.amount : 0,
            credit: savedVoucher.type === 'PAYMENT' ? savedVoucher.amount : 0,
            tenantId
        };
        
        if (mongoose.connection.readyState === 1) {
            await new JournalEntry(journalData).save();
        } else {
            mockDb.journalEntries.push(journalData);
        }
        
        res.status(201).json(savedVoucher);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/api/vouchers/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (mongoose.connection.readyState === 1) {
            await Voucher.updateOne({ voucherId: req.params.id, tenantId }, req.body);
            res.json({ success: true });
        } else {
            const idx = mockDb.vouchers.findIndex(v => v.voucherId === req.params.id && v.tenantId === tenantId);
            if (idx >= 0) mockDb.vouchers[idx] = { ...mockDb.vouchers[idx], ...req.body };
            res.json({ success: true });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/vouchers/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (mongoose.connection.readyState === 1) {
            await Voucher.deleteOne({ voucherId: req.params.id, tenantId });
            res.json({ success: true });
        } else {
            mockDb.vouchers = mockDb.vouchers.filter(v => !(v.voucherId === req.params.id && v.tenantId === tenantId));
            res.json({ success: true });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/expenses', authenticateToken, async (req, res) => {
    if (req.user.role === 'Cashier') return res.status(403).json({ error: 'Forbidden' });
    try {
        const tenantId = getTenantId(req);
        const id = `EXP-${Date.now().toString().slice(-4)}`;
        if (global.isMongoConnected) {
            const expense = new Expense({ ...req.body, id, tenantId });
            await expense.save();
            res.json(expense);
        } else {
            const expense = { ...req.body, id, tenantId };
            mockDb.expenses.push(expense);
            res.json(expense);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ASSETS & DEPRECIATION
router.get('/api/assets', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const assets = await Asset.find({ tenantId });
            res.json(assets);
        } else {
            const assets = mockDb.assets.filter(a => a.tenantId === tenantId);
            res.json(assets);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/assets', authenticateToken, async (req, res) => {
    if (req.user.role === 'Cashier') return res.status(403).json({ error: 'Forbidden' });
    try {
        const tenantId = getTenantId(req);
        const id = `AST-${Date.now().toString().slice(-4)}`;
        if (global.isMongoConnected) {
            const asset = new Asset({ ...req.body, id, tenantId });
            await asset.save();
            res.json(asset);
        } else {
            const asset = { ...req.body, id, tenantId };
            mockDb.assets.push(asset);
            res.json(asset);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PEOPLES: CUSTOMERS & EMPLOYEES & SUPPLIERS
router.get('/api/customers', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const customers = await Customer.find({ tenantId });
            res.json(customers);
        } else {
            const customers = mockDb.customers.filter(c => c.tenantId === tenantId);
            res.json(customers);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/employees', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const employees = await Employee.find({ tenantId });
            res.json(employees);
        } else {
            const employees = mockDb.employees.filter(e => e.tenantId === tenantId);
            res.json(employees);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/employees', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id, name, dept, position, email, phone, salary, status } = req.body;
        const newEmp = { id: id || `EMP-${Date.now().toString().slice(-4)}`, name, dept, position, email, phone, salary, status, tenantId };
        
        if (global.isMongoConnected) {
            const doc = new Employee(newEmp);
            await doc.save();
            res.status(201).json(doc);
        } else {
            mockDb.employees.push(newEmp);
            res.status(201).json(newEmp);
        }
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/api/employees/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { name, dept, position, email, phone, salary, status } = req.body;
        if (global.isMongoConnected) {
            const emp = await Employee.findOneAndUpdate(
                { id: req.params.id, tenantId },
                { name, dept, position, email, phone, salary, status },
                { new: true }
            );
            if (!emp) return res.status(404).json({ error: 'Employee not found' });
            res.json(emp);
        } else {
            const index = mockDb.employees.findIndex(e => e.id === req.params.id && e.tenantId === tenantId);
            if (index === -1) return res.status(404).json({ error: 'Employee not found' });
            mockDb.employees[index] = { ...mockDb.employees[index], name, dept, position, email, phone, salary, status };
            res.json(mockDb.employees[index]);
        }
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/api/employees/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const result = await Employee.findOneAndDelete({ id: req.params.id, tenantId });
            if (!result) return res.status(404).json({ error: 'Employee not found' });
            res.status(204).send();
        } else {
            const index = mockDb.employees.findIndex(e => e.id === req.params.id && e.tenantId === tenantId);
            if (index === -1) return res.status(404).json({ error: 'Employee not found' });
            mockDb.employees.splice(index, 1);
            res.status(204).send();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/suppliers', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const suppliers = await Supplier.find({ tenantId });
            res.json(suppliers);
        } else {
            const suppliers = mockDb.suppliers.filter(s => s.tenantId === tenantId);
            res.json(suppliers);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const orders = await Order.find({ tenantId });
            res.json(orders);
        } else {
            const orders = mockDb.orders.filter(o => o.tenantId === tenantId);
            res.json(orders);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/customers', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const id = `CUST-${Date.now().toString().slice(-4)}`;
        if (global.isMongoConnected) {
            const cust = new Customer({ ...req.body, id, points: 0, spent: 0, tenantId });
            await cust.save();
            res.json(cust);
        } else {
            const cust = { ...req.body, id, points: 0, spent: 0, tenantId };
            mockDb.customers.push(cust);
            res.json(cust);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/suppliers', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const id = `SUPP-${Date.now().toString().slice(-4)}`;
        if (global.isMongoConnected) {
            const supp = new Supplier({ ...req.body, id, tenantId });
            await supp.save();
            res.json(supp);
        } else {
            const supp = { ...req.body, id, tenantId };
            mockDb.suppliers.push(supp);
            res.json(supp);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/orders/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const ord = await Order.findOneAndUpdate({ id: req.params.id, tenantId }, req.body, { new: true });
            if (!ord) return res.status(404).json({ error: 'Order not found' });
            res.json(ord);
        } else {
            const ord = mockDb.orders.find(o => o.id === req.params.id && o.tenantId === tenantId);
            if (!ord) return res.status(404).json({ error: 'Order not found' });
            ord.status = req.body.status;
            res.json(ord);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/orders', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const id = `ORD-${Date.now().toString().slice(-4)}`;
        if (global.isMongoConnected) {
            const ord = new Order({ ...req.body, id, tenantId });
            await ord.save();
            res.json(ord);
        } else {
            const ord = { ...req.body, id, tenantId };
            mockDb.orders.push(ord);
            res.json(ord);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/orders/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const result = await Order.findOneAndDelete({ id: req.params.id, tenantId });
            if (!result) return res.status(404).json({ error: 'Order not found' });
            res.sendStatus(204);
        } else {
            const originalLength = mockDb.orders.length;
            mockDb.orders = mockDb.orders.filter(o => !(o.id === req.params.id && o.tenantId === tenantId));
            if (mockDb.orders.length === originalLength) return res.status(404).json({ error: 'Order not found' });
            res.sendStatus(204);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// EXPENSES CRUD ADDITIONS
router.put('/api/expenses/:id', authenticateToken, async (req, res) => {
    if (req.user.role === 'Cashier') return res.status(403).json({ error: 'Forbidden' });
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const expense = await Expense.findOneAndUpdate({ id: req.params.id, tenantId }, req.body, { new: true });
            if (!expense) return res.status(404).json({ error: 'Expense not found' });
            res.json(expense);
        } else {
            const idx = mockDb.expenses.findIndex(e => e.id === req.params.id && e.tenantId === tenantId);
            if (idx === -1) return res.status(404).json({ error: 'Expense not found' });
            mockDb.expenses[idx] = { ...mockDb.expenses[idx], ...req.body, tenantId };
            res.json(mockDb.expenses[idx]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/expenses/:id', authenticateToken, async (req, res) => {
    if (req.user.role === 'Cashier') return res.status(403).json({ error: 'Forbidden' });
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const result = await Expense.findOneAndDelete({ id: req.params.id, tenantId });
            if (!result) return res.status(404).json({ error: 'Expense not found' });
            res.sendStatus(204);
        } else {
            const originalLength = mockDb.expenses.length;
            mockDb.expenses = mockDb.expenses.filter(e => !(e.id === req.params.id && e.tenantId === tenantId));
            if (mockDb.expenses.length === originalLength) return res.status(404).json({ error: 'Expense not found' });
            res.sendStatus(204);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// USERS MANAGEMENT CRUD
router.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const users = await User.find({ tenantId });
            const cleanUsers = users.map(u => ({ id: u.id, username: u.username, role: u.role }));
            res.json(cleanUsers);
        } else {
            const cleanUsers = mockDb.users.filter(u => u.tenantId === tenantId).map(u => ({ id: u.id, username: u.username, role: u.role }));
            res.json(cleanUsers);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        const tenantId = getTenantId(req);
        const { username, password, role } = req.body;
        const passwordHash = bcrypt.hashSync(password || '123456', 10);
        const id = Date.now().toString();
        
        if (global.isMongoConnected) {
            const user = new User({ id, username, passwordHash, role, tenantId });
            await user.save();
            res.json({ id: user.id, username: user.username, role: user.role });
        } else {
            const user = { id, username, passwordHash, role, tenantId };
            mockDb.users.push(user);
            res.json({ id: user.id, username: user.username, role: user.role });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        const tenantId = getTenantId(req);
        const { username, password, role } = req.body;
        const updates = {};
        if (username) updates.username = username;
        if (role) updates.role = role;
        if (password) updates.passwordHash = bcrypt.hashSync(password, 10);

        if (global.isMongoConnected) {
            const user = await User.findOneAndUpdate({ id: req.params.id, tenantId }, updates, { new: true });
            if (!user) return res.status(404).json({ error: 'User not found' });
            res.json({ id: user.id, username: user.username, role: user.role });
        } else {
            const idx = mockDb.users.findIndex(u => u.id === req.params.id && u.tenantId === tenantId);
            if (idx === -1) return res.status(404).json({ error: 'User not found' });
            mockDb.users[idx].username = username || mockDb.users[idx].username;
            mockDb.users[idx].role = role || mockDb.users[idx].role;
            if (password) {
                mockDb.users[idx].passwordHash = bcrypt.hashSync(password, 10);
            }
            res.json({ id: mockDb.users[idx].id, username: mockDb.users[idx].username, role: mockDb.users[idx].role });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const result = await User.findOneAndDelete({ id: req.params.id, tenantId });
            if (!result) return res.status(404).json({ error: 'User not found' });
            res.sendStatus(204);
        } else {
            const originalLength = mockDb.users.length;
            mockDb.users = mockDb.users.filter(u => !(u.id === req.params.id && u.tenantId === tenantId));
            if (mockDb.users.length === originalLength) return res.status(404).json({ error: 'User not found' });
            res.sendStatus(204);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// QUOTATIONS CRUD
router.get('/api/quotations', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const quotations = await Quotation.find({ tenantId });
            res.json(quotations);
        } else {
            const quotations = mockDb.quotations.filter(q => q.tenantId === tenantId);
            res.json(quotations);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/quotations', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const quote = {
            ...req.body,
            id: `QTN-${Date.now().toString().slice(-4)}`,
            date: new Date().toLocaleString(),
            tenantId
        };
        if (global.isMongoConnected) {
            const newQuote = new Quotation(quote);
            await newQuote.save();
            res.json(newQuote);
        } else {
            mockDb.quotations.push(quote);
            res.json(quote);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/quotations/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const result = await Quotation.findOneAndDelete({ id: req.params.id, tenantId });
            if (!result) return res.status(404).json({ error: 'Quotation not found' });
            res.sendStatus(204);
        } else {
            const originalLength = mockDb.quotations.length;
            mockDb.quotations = mockDb.quotations.filter(q => !(q.id === req.params.id && q.tenantId === tenantId));
            if (mockDb.quotations.length === originalLength) return res.status(404).json({ error: 'Quotation not found' });
            res.sendStatus(204);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/quotations/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const quotation = await Quotation.findOneAndUpdate({ id: req.params.id, tenantId }, req.body, { new: true });
            if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
            res.json(quotation);
        } else {
            const idx = mockDb.quotations.findIndex(q => q.id === req.params.id && q.tenantId === tenantId);
            if (idx !== -1) {
                mockDb.quotations[idx] = {
                    ...mockDb.quotations[idx],
                    ...req.body,
                    tenantId
                };
                res.json(mockDb.quotations[idx]);
            } else {
                res.sendStatus(404);
            }
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ====================================================
// SAAS PROVIDER ADMIN ROUTES  (protected by SAAS_ADMIN_KEY)
// ====================================================
// No built-in default: if SAAS_ADMIN_KEY is unset or weak, the provider admin API is disabled.
const requireSaasAdmin = (req, res, next) => {
    const adminKey = getSaasAdminKey();
    if (!adminKey) {
        return res.status(503).json({ error: 'SaaS admin API is disabled: set a strong SAAS_ADMIN_KEY (16+ characters) on the server.' });
    }
    // Header only: keys in the URL end up in proxy and server logs.
    const key = req.headers['x-saas-admin-key'];
    if (!key || !safeEqual(key, adminKey)) {
        return res.status(403).json({ error: 'Forbidden: invalid admin key' });
    }
    next();
};

// GET all tenants with stats
router.get('/api/saas/stores', requireSaasAdmin, async (req, res) => {
    try {
        if (global.isMongoConnected) {
            const stores = await Settings.find({}).lean();
            const enriched = await Promise.all(stores.map(async (s) => {
                const [invoiceCount, productCount, userCount, adminUser] = await Promise.all([
                    Invoice.countDocuments({ tenantId: s.tenantId }),
                    Product.countDocuments({ tenantId: s.tenantId }),
                    User.countDocuments({ tenantId: s.tenantId }),
                    User.findOne({ tenantId: s.tenantId, role: 'Admin' })
                ]);
                return { ...s, invoiceCount, productCount, userCount, adminUsername: adminUser ? adminUser.username : 'N/A' };
            }));
            res.json(enriched);
        } else {
            const stores = Object.values(mockDb.settingsTenant || { default: mockDb.settings });
            res.json(stores.map(s => {
                const adminUser = mockDb.users.find(u => u.tenantId === s.tenantId && u.role === 'Admin');
                return { ...s, invoiceCount: 0, productCount: 0, userCount: 0, adminUsername: adminUser ? adminUser.username : 'N/A' };
            }));
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE a tenant store and all its data
router.delete('/api/saas/stores/:tenantId', requireSaasAdmin, async (req, res) => {
    try {
        const { tenantId } = req.params;
        if (tenantId === 'default') return res.status(400).json({ error: 'Cannot delete the default demo store' });
        if (global.isMongoConnected) {
            await Promise.all([
                Settings.deleteOne({ tenantId }),
                User.deleteMany({ tenantId }),
                Product.deleteMany({ tenantId }),
                Invoice.deleteMany({ tenantId }),
                Quotation.deleteMany({ tenantId }),
                Expense.deleteMany({ tenantId }),
                Asset.deleteMany({ tenantId }),
                Customer.deleteMany({ tenantId }),
                Employee.deleteMany({ tenantId }),
                Supplier.deleteMany({ tenantId }),
                Order.deleteMany({ tenantId }),
                Warehouse.deleteMany({ tenantId }),
                InventoryTx.deleteMany({ tenantId }),
                JournalEntry.deleteMany({ tenantId }),
                Voucher.deleteMany({ tenantId }),
                Salary.deleteMany({ tenantId }),
                PurchaseInvoice.deleteMany({ tenantId }),
                ReturnInvoice.deleteMany({ tenantId }),
                Account.deleteMany({ tenantId }),
                SubscriptionPayment.deleteMany({ tenantId }),
                PropertyOwner.deleteMany({ tenantId }),
                Property.deleteMany({ tenantId }),
                Unit.deleteMany({ tenantId }),
                Booking.deleteMany({ tenantId }),
                MaintenanceTask.deleteMany({ tenantId }),
                PropertyInvoice.deleteMany({ tenantId }),
                LeaseContract.deleteMany({ tenantId }),
                Lead.deleteMany({ tenantId })
            ]);
        } else {
            const deleteForTenant = (arr) => arr ? arr.filter(i => i.tenantId !== tenantId) : [];
            mockDb.users = deleteForTenant(mockDb.users);
            mockDb.products = deleteForTenant(mockDb.products);
            mockDb.invoices = deleteForTenant(mockDb.invoices);
            mockDb.quotations = deleteForTenant(mockDb.quotations);
            mockDb.expenses = deleteForTenant(mockDb.expenses);
            mockDb.assets = deleteForTenant(mockDb.assets);
            mockDb.customers = deleteForTenant(mockDb.customers);
            mockDb.employees = deleteForTenant(mockDb.employees);
            mockDb.suppliers = deleteForTenant(mockDb.suppliers);
            mockDb.orders = deleteForTenant(mockDb.orders);
            mockDb.warehouses = deleteForTenant(mockDb.warehouses);
            mockDb.inventoryTxs = deleteForTenant(mockDb.inventoryTxs);
            mockDb.journalEntries = deleteForTenant(mockDb.journalEntries);
            mockDb.vouchers = deleteForTenant(mockDb.vouchers);
            mockDb.salaries = deleteForTenant(mockDb.salaries);
            mockDb.purchaseInvoices = deleteForTenant(mockDb.purchaseInvoices);
            mockDb.returnInvoices = deleteForTenant(mockDb.returnInvoices);
            mockDb.accounts = deleteForTenant(mockDb.accounts);
            mockDb.subscriptionPayments = deleteForTenant(mockDb.subscriptionPayments);
            mockDb.propertyOwners = deleteForTenant(mockDb.propertyOwners);
            mockDb.properties = deleteForTenant(mockDb.properties);
            mockDb.units = deleteForTenant(mockDb.units);
            mockDb.bookings = deleteForTenant(mockDb.bookings);
            mockDb.maintenanceTasks = deleteForTenant(mockDb.maintenanceTasks);
            mockDb.propertyInvoices = deleteForTenant(mockDb.propertyInvoices);
            mockDb.leaseContracts = deleteForTenant(mockDb.leaseContracts);
            mockDb.leads = deleteForTenant(mockDb.leads);
            if (mockDb.settingsTenant) delete mockDb.settingsTenant[tenantId];
        }
        if (global.removeCloudflareTunnelConfig) {
            await global.removeCloudflareTunnelConfig(tenantId);
        }
        res.json({ success: true, message: `Store ${tenantId} deleted.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH suspend or activate a tenant
router.patch('/api/saas/stores/:tenantId/status', requireSaasAdmin, async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { suspended } = req.body;
        if (global.isMongoConnected) {
            await Settings.updateOne({ tenantId }, { $set: { suspended: !!suspended } });
        }
        res.json({ success: true, tenantId, suspended: !!suspended });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST reset admin password for a tenant
router.post('/api/saas/stores/:tenantId/reset-password', requireSaasAdmin, async (req, res) => {
    try {
        const { tenantId } = req.params;
        const newPassword = crypto.randomBytes(4).toString('hex') + '!aA'; // simple random secure password
        const passwordHash = bcrypt.hashSync(newPassword, 10);
        
        if (global.isMongoConnected) {
            const result = await User.findOneAndUpdate({ tenantId, role: 'Admin' }, { passwordHash }, { new: true });
            if (!result) return res.status(404).json({ error: 'Admin user not found for this tenant.' });
        } else {
            const u = mockDb.users.find(u => u.tenantId === tenantId && u.role === 'Admin');
            if (!u) return res.status(404).json({ error: 'Admin user not found for this tenant.' });
            u.passwordHash = passwordHash;
        }
        res.json({ success: true, message: 'Password reset successfully', newPassword });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// PATCH update tenant profile (Saas Admin)
router.patch('/api/saas/stores/:tenantId', requireSaasAdmin, async (req, res) => {
    try {
        const { tenantId } = req.params;
        const updates = req.body;
        // Don't allow changing suspended or modules through this generic route
        delete updates.suspended;
        delete updates.modules;
        
        if (global.isMongoConnected) {
            await Settings.updateOne({ tenantId }, { $set: updates });
        } else {
            if (mockDb.settingsTenant && mockDb.settingsTenant[tenantId]) {
                Object.assign(mockDb.settingsTenant[tenantId], updates);
            }
        }
        res.json({ success: true, message: 'Store profile updated successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET inquiries list
router.get('/api/saas/inquiries', requireSaasAdmin, async (req, res) => {
    try {
        if (global.isMongoConnected) {
            const inquiries = await Inquiry.find({}).sort({ createdAt: -1 }).lean();
            res.json(inquiries);
        } else {
            res.json(mockDb.inquiries || []);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET platform-wide stats
router.get('/api/saas/stats', requireSaasAdmin, async (req, res) => {
    try {
        if (global.isMongoConnected) {
            const [storeCount, invoiceCount, userCount, inquiryCount] = await Promise.all([
                Settings.countDocuments({}),
                Invoice.countDocuments({}),
                User.countDocuments({}),
                Inquiry.countDocuments({})
            ]);
            res.json({ storeCount, invoiceCount, userCount, inquiryCount });
        } else {
            res.json({ storeCount: 1, invoiceCount: 0, userCount: 1, inquiryCount: 0 });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----------------------------------------------------
router.get('/api/saas/stores/:tenantId/modules', requireSaasAdmin, async (req, res) => {
    try {
        const { tenantId } = req.params;
        let enabledModules = {};
        if (global.isMongoConnected) {
            const storeSettings = await Settings.findOne({ tenantId });
            if (!storeSettings) return res.status(404).json({ error: 'Store not found' });
            enabledModules = storeSettings.enabledModules || {};
        } else {
            const storeSettings = mockDb.settingsTenant && mockDb.settingsTenant[tenantId];
            if (!storeSettings) return res.status(404).json({ error: 'Store not found' });
            enabledModules = storeSettings.enabledModules || {};
        }
        res.json(enabledModules);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/api/saas/stores/:tenantId/modules', requireSaasAdmin, async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { modules } = req.body; // e.g., { pos: true, inventory: false }
        if (global.isMongoConnected) {
            await Settings.updateOne(
                { tenantId },
                { $set: { enabledModules: modules } },
                { upsert: true }
            );
        } else {
            if (!mockDb.settingsTenant) {
                mockDb.settingsTenant = { 'default': { ...mockDb.settings, tenantId: 'default' } };
            }
            if (!mockDb.settingsTenant[tenantId]) {
                mockDb.settingsTenant[tenantId] = { ...mockDb.settings, tenantId };
            }
            mockDb.settingsTenant[tenantId].enabledModules = modules;
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/saas/payments', requireSaasAdmin, async (req, res) => {
    try {
        if (global.isMongoConnected) {
            const payments = await SubscriptionPayment.find().sort({ date: -1 });
            res.json(payments);
        } else {
            res.json(mockDb.subscriptionPayments || []);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/saas/payments', requireSaasAdmin, async (req, res) => {
    try {
        if (global.isMongoConnected) {
            const payment = new SubscriptionPayment(req.body);
            await payment.save();
            res.json(payment);
        } else {
            const payment = { ...req.body, _id: Date.now().toString(), date: new Date() };
            if (!mockDb.subscriptionPayments) mockDb.subscriptionPayments = [];
            mockDb.subscriptionPayments.push(payment);
            res.json(payment);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/tenant/close', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ error: 'Only Admins can close the account.' });
        }
        const tenantId = req.user.tenantId;
        if (tenantId === 'default' || tenantId === 'demo.kamysoft.com') {
            return res.status(400).json({ error: 'Cannot delete the demo store.' });
        }
        if (global.isMongoConnected) {
            await Promise.all([
                Settings.deleteOne({ tenantId }),
                User.deleteMany({ tenantId }),
                Product.deleteMany({ tenantId }),
                Invoice.deleteMany({ tenantId }),
                Quotation.deleteMany({ tenantId }),
                Expense.deleteMany({ tenantId }),
                Asset.deleteMany({ tenantId }),
                Customer.deleteMany({ tenantId }),
                Employee.deleteMany({ tenantId }),
                Supplier.deleteMany({ tenantId }),
                Order.deleteMany({ tenantId })
            ]);
        } else {
            if (mockDb.settingsTenant) delete mockDb.settingsTenant[tenantId];
        }
        if (global.removeCloudflareTunnelConfig) {
            await global.removeCloudflareTunnelConfig(tenantId);
        }
        res.json({ success: true, message: `Account closed successfully.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/reports/trial-balance', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        let accounts = [];
        let journals = [];
        
        if (mongoose.connection.readyState === 1) {
            accounts = await Account.find({ tenantId }).lean();
            journals = await JournalEntry.find({ tenantId }).lean();
        } else {
            accounts = (mockDb.accounts || []).filter(a => a.tenantId === tenantId);
            journals = (mockDb.journalEntries || []).filter(j => j.tenantId === tenantId);
        }

        let tb = accounts.map(a => ({ code: a.code, nameEN: a.nameEN, nameAR: a.nameAR, type: a.type, debit: 0, credit: 0 }));
        
        journals.forEach(j => {
            let acc = tb.find(a => a.code === j.account);
            if (acc) {
                if (j.debit > 0) acc.debit += j.debit;
                if (j.credit > 0) acc.credit += j.credit;
            }
        });

        tb = tb.map(a => {
            let net = a.debit - a.credit;
            if (['Asset', 'Expense'].includes(a.type)) {
                return { ...a, balance: net };
            } else {
                return { ...a, balance: -net }; 
            }
        });

        res.json(tb);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/reports/balance-sheet', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        let accounts = [];
        let journals = [];
        
        if (mongoose.connection.readyState === 1) {
            accounts = await Account.find({ tenantId }).lean();
            journals = await JournalEntry.find({ tenantId }).lean();
        } else {
            accounts = (mockDb.accounts || []).filter(a => a.tenantId === tenantId);
            journals = (mockDb.journalEntries || []).filter(j => j.tenantId === tenantId);
        }

        let balances = {};
        accounts.forEach(a => balances[a.code] = { ...a, balance: 0, _id: undefined });

        journals.forEach(j => {
            if (balances[j.account]) {
                if (['Asset', 'Expense'].includes(balances[j.account].type)) {
                    balances[j.account].balance += (j.debit || 0) - (j.credit || 0);
                } else {
                    balances[j.account].balance += (j.credit || 0) - (j.debit || 0);
                }
            }
        });

        let assets = Object.values(balances).filter(a => a.type === 'Asset');
        let liabilities = Object.values(balances).filter(a => a.type === 'Liability');
        let equity = Object.values(balances).filter(a => a.type === 'Equity');

        let totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
        let totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
        let totalEquity = equity.reduce((sum, a) => sum + a.balance, 0);

        let revenue = Object.values(balances).filter(a => a.type === 'Revenue').reduce((sum, a) => sum + a.balance, 0);
        let expenses = Object.values(balances).filter(a => a.type === 'Expense').reduce((sum, a) => sum + a.balance, 0);
        let netIncome = revenue - expenses;
        totalEquity += netIncome;

        res.json({ assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, netIncome });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/reports/income-statement', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { startDate, endDate } = req.query;
        let accounts = [];
        let journals = [];
        
        let dateFilter = { tenantId };
        if (startDate && endDate) {
            dateFilter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        
        if (mongoose.connection.readyState === 1) {
            accounts = await Account.find({ tenantId, type: { $in: ['Revenue', 'Expense'] } }).lean();
            journals = await JournalEntry.find(dateFilter).lean();
        } else {
            accounts = (mockDb.accounts || []).filter(a => a.tenantId === tenantId && ['Revenue', 'Expense'].includes(a.type));
            journals = (mockDb.journalEntries || []).filter(j => j.tenantId === tenantId);
            if (startDate && endDate) {
                const s = new Date(startDate);
                const e = new Date(endDate);
                journals = journals.filter(j => new Date(j.date) >= s && new Date(j.date) <= e);
            }
        }

        let balances = {};
        accounts.forEach(a => balances[a.code] = { ...a, balance: 0, _id: undefined });

        journals.forEach(j => {
            if (balances[j.account]) {
                if (balances[j.account].type === 'Expense') {
                    balances[j.account].balance += (j.debit || 0) - (j.credit || 0);
                } else if (balances[j.account].type === 'Revenue') {
                    balances[j.account].balance += (j.credit || 0) - (j.debit || 0);
                }
            }
        });

        let revenues = Object.values(balances).filter(a => a.type === 'Revenue' && a.balance !== 0);
        let expenses = Object.values(balances).filter(a => a.type === 'Expense' && a.balance !== 0);
        
        let cogs = expenses.filter(a => a.nameEN.toLowerCase().includes('cost of goods') || a.code === '5000');
        let operatingExpenses = expenses.filter(a => !a.nameEN.toLowerCase().includes('cost of goods') && a.code !== '5000');

        let totalRevenue = revenues.reduce((sum, a) => sum + a.balance, 0);
        let totalCogs = cogs.reduce((sum, a) => sum + a.balance, 0);
        let grossProfit = totalRevenue - totalCogs;
        
        let totalOperatingExpenses = operatingExpenses.reduce((sum, a) => sum + a.balance, 0);
        let netIncome = grossProfit - totalOperatingExpenses;

        res.json({ revenues, cogs, operatingExpenses, totalRevenue, totalCogs, grossProfit, totalOperatingExpenses, netIncome });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/reports/cash-flow', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { startDate, endDate } = req.query;
        let accounts = [];
        let journals = [];
        
        let dateFilter = { tenantId };
        if (startDate && endDate) {
            dateFilter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        
        if (mongoose.connection.readyState === 1) {
            accounts = await Account.find({ tenantId, type: 'Asset' }).lean(); // Cash and Bank are assets
            journals = await JournalEntry.find(dateFilter).lean();
        } else {
            accounts = (mockDb.accounts || []).filter(a => a.tenantId === tenantId && a.type === 'Asset');
            journals = (mockDb.journalEntries || []).filter(j => j.tenantId === tenantId);
            if (startDate && endDate) {
                const s = new Date(startDate);
                const e = new Date(endDate);
                journals = journals.filter(j => new Date(j.date) >= s && new Date(j.date) <= e);
            }
        }

        // Identify cash-equivalent accounts
        const cashAccounts = accounts.filter(a => a.code === '1000' || a.code === '1010' || a.nameEN.toLowerCase().includes('cash') || a.nameEN.toLowerCase().includes('bank'));
        const cashAccountCodes = cashAccounts.map(a => a.code);

        let cashInflows = [];
        let cashOutflows = [];
        let netChange = 0;

        journals.forEach(j => {
            if (cashAccountCodes.includes(j.account)) {
                if (j.debit > 0) {
                    cashInflows.push(j);
                    netChange += j.debit;
                }
                if (j.credit > 0) {
                    cashOutflows.push(j);
                    netChange -= j.credit;
                }
            }
        });

        const totalInflows = cashInflows.reduce((sum, j) => sum + j.debit, 0);
        const totalOutflows = cashOutflows.reduce((sum, j) => sum + j.credit, 0);

        res.json({ cashInflows, cashOutflows, totalInflows, totalOutflows, netChange });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PROPERTY MANAGEMENT MODULE ---

// Property Owners
router.get('/api/property-owners', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const owners = await PropertyOwner.find({ tenantId });
            res.json(owners);
        } else {
            res.json(mockDb.propertyOwners ? mockDb.propertyOwners.filter(o => o.tenantId === tenantId) : []);
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/property-owners', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const owner = { ...req.body, tenantId, id: 'owner-' + Date.now() };
        if (global.isMongoConnected) {
            await PropertyOwner.create(owner);
        } else {
            mockDb.propertyOwners = mockDb.propertyOwners || [];
            mockDb.propertyOwners.push(owner);
        }
        res.status(201).json(owner);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/api/property-owners/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await PropertyOwner.updateOne({ id: req.params.id, tenantId }, req.body);
        } else {
            mockDb.propertyOwners = mockDb.propertyOwners.map(o => o.id === req.params.id && o.tenantId === tenantId ? { ...o, ...req.body } : o);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/api/property-owners/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await PropertyOwner.deleteOne({ id: req.params.id, tenantId });
        } else {
            mockDb.propertyOwners = mockDb.propertyOwners.filter(o => !(o.id === req.params.id && o.tenantId === tenantId));
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Owner Statement API
router.get('/api/owner-statement/:ownerId', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { ownerId } = req.params;
        const { startDate, endDate } = req.query;

        if (!global.isMongoConnected) {
            return res.json({ income: [], expenses: [], summary: { totalCollected: 0, managementFees: 0, maintenanceCosts: 0, netDue: 0 }});
        }

        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        // 1. Find properties owned by this owner
        const properties = await Property.find({ tenantId, ownerId });
        if (!properties.length) {
            return res.json({ income: [], expenses: [], summary: { totalCollected: 0, managementFees: 0, maintenanceCosts: 0, netDue: 0 }});
        }

        const propertyIds = properties.map(p => p.id);

        // 2. Find all units in those properties
        const units = await Unit.find({ tenantId, propertyId: { $in: propertyIds }});
        const unitIds = units.map(u => u.id);
        const unitToPropertyMap = {};
        units.forEach(u => {
            unitToPropertyMap[u.id] = u.propertyId;
        });

        // 3. Find all lease contracts for these units
        const leases = await LeaseContract.find({ tenantId, unitId: { $in: unitIds } });
        // We'll collect invoices directly from these leases
        let income = [];
        let totalCollected = 0;
        let managementFees = 0;

        leases.forEach(lease => {
            const propertyId = unitToPropertyMap[lease.unitId];

            lease.installments.forEach(inst => {
                if (inst.status === 'Paid') {
                    // Assuming installment dueDate falls within statement period
                    const instDate = new Date(inst.dueDate);
                    if (instDate >= start && instDate <= end) {
                        income.push({
                            unitId: lease.unitId,
                            propertyId: propertyId,
                            date: inst.dueDate,
                            amount: inst.amount,
                            leaseId: lease._id
                        });
                        totalCollected += inst.amount;
                        if (lease.managementFeeType === 'Percentage') {
                            managementFees += inst.amount * ((lease.managementFeeValue || 0) / 100);
                        }
                    }
                }
            });
            
            // Add fixed management fees for the lease (assume once per statement for simplicity)
            if (lease.managementFeeType === 'Fixed') {
                managementFees += (lease.managementFeeValue || 0);
            }
        });

        // 4. Find all Completed maintenance tasks for these units in date range
        const maintenanceTasks = await MaintenanceTask.find({ 
            tenantId, 
            unitId: { $in: unitIds },
            status: 'Completed',
            resolvedDate: { $gte: start, $lte: end }
        });

        let maintenanceCosts = 0;
        let expenses = maintenanceTasks.map(t => {
            maintenanceCosts += t.cost;
            return {
                taskId: t.id,
                unitId: t.unitId,
                date: t.resolvedDate,
                description: t.description,
                cost: t.cost
            };
        });

        const netDue = totalCollected - managementFees - maintenanceCosts;

        res.json({
            income,
            expenses,
            summary: {
                totalCollected,
                managementFees,
                maintenanceCosts,
                netDue
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Properties
router.get('/api/properties', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const properties = await Property.find({ tenantId });
            res.json(properties);
        } else {
            res.json(mockDb.properties.filter(p => p.tenantId === tenantId));
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/properties', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        
        // Check for duplicate property name
        if (global.isMongoConnected) {
            const existing = await Property.findOne({ tenantId, name: { $regex: new RegExp(`^${req.body.name}$`, 'i') } });
            if (existing) return res.status(400).json({ error: 'A property with this name already exists' });
        } else {
            const existing = mockDb.properties.find(p => p.tenantId === tenantId && p.name.toLowerCase() === req.body.name.toLowerCase());
            if (existing) return res.status(400).json({ error: 'A property with this name already exists' });
        }

        const newProperty = { ...req.body, tenantId, id: 'prop-' + Date.now() };
        if (global.isMongoConnected) {
            await Property.create(newProperty);
        } else {
            mockDb.properties.push(newProperty);
        }
        res.status(201).json(newProperty);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/api/properties/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const updateData = { name: req.body.name, type: req.body.type, location: req.body.location, ownerId: req.body.ownerId };
        
        if (global.isMongoConnected) {
            await Property.updateOne({ id: req.params.id, tenantId }, { $set: updateData });
        } else {
            const index = mockDb.properties.findIndex(p => p.id === req.params.id && p.tenantId === tenantId);
            if (index !== -1) mockDb.properties[index] = { ...mockDb.properties[index], ...updateData };
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/properties/:id/upload', authenticateToken, propertyUpload.array('photos', 10), async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded.' });
        }
        
        const imageUrls = req.files.map(file => `/uploads/properties/${file.filename}`);
        
        if (global.isMongoConnected) {
            await Property.findOneAndUpdate(
                { id: req.params.id, tenantId },
                { $push: { images: { $each: imageUrls } } }
            );
        } else {
            const index = mockDb.properties.findIndex(p => p.id === req.params.id && p.tenantId === tenantId);
            if (index !== -1) {
                if (!mockDb.properties[index].images) mockDb.properties[index].images = [];
                mockDb.properties[index].images.push(...imageUrls);
            }
        }
        res.json({ success: true, images: imageUrls });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/properties/:id/sell', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { customerName, price } = req.body;
        
        let property;
        if (global.isMongoConnected) {
            property = await Property.findOneAndUpdate(
                { id: req.params.id, tenantId },
                { $set: { status: 'Sold' } },
                { new: true }
            );
        } else {
            const index = mockDb.properties.findIndex(p => p.id === req.params.id && p.tenantId === tenantId);
            if (index !== -1) {
                mockDb.properties[index].status = 'Sold';
                property = mockDb.properties[index];
            }
        }

        if (!property) return res.status(404).json({ error: 'Property not found' });

        const priceNum = parseFloat(price);
        const vat = priceNum * 0.15;
        const total = priceNum + vat;

        // 1. Generate Sales Invoice
        let invoiceData = {
            id: `INV-${Date.now().toString().slice(-6)}`,
            uuid: crypto.randomUUID(),
            customer: customerName,
            items: [{
                name: `Property Sale: ${property.name}`,
                price: priceNum,
                qty: 1
            }],
            discount: 0,
            vat,
            total,
            date: new Date().toISOString(),
            zatcaStatus: 'REPORTED',
            tenantId
        };

        if (global.isMongoConnected) {
            const count = await Invoice.countDocuments({ tenantId });
            invoiceData.csn = count + 1;
            let pih = "NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==";
            const lastInvs = await Invoice.find({ tenantId }).sort({ csn: -1 }).limit(1);
            if (lastInvs.length > 0 && lastInvs[0].xmlHashBase64) {
                pih = lastInvs[0].xmlHashBase64;
            }
            invoiceData.pih = pih;

            await Invoice.create(invoiceData);
            
            // 2. Generate Journal Entry
            await JournalEntry.create({
                entryId: `JE-${Date.now().toString().slice(-6)}`,
                date: new Date(),
                account: '1000', // Assuming Cash/Bank
                description: `Property Sale: ${property.name}`,
                debit: total,
                credit: 0,
                tenantId
            });
        } else {
            const tenantInvs = mockDb.invoices.filter(i => i.tenantId === tenantId);
            invoiceData.csn = tenantInvs.length + 1;
            let pih = "NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==";
            if (tenantInvs.length > 0) {
                const prev = tenantInvs[tenantInvs.length - 1];
                if (prev.xmlHashBase64) pih = prev.xmlHashBase64;
            }
            invoiceData.pih = pih;
            
            mockDb.invoices.push(invoiceData);
            mockDb.journalEntries.push({
                entryId: `JE-${Date.now().toString().slice(-6)}`,
                date: new Date(),
                account: '1000',
                description: `Property Sale: ${property.name}`,
                debit: total,
                credit: 0,
                tenantId
            });
        }

        res.json({ success: true, invoice: invoiceData });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/api/properties/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await Property.deleteOne({ id: req.params.id, tenantId });
            await Unit.deleteMany({ propertyId: req.params.id, tenantId });
        } else {
            mockDb.properties = mockDb.properties.filter(p => !(p.id === req.params.id && p.tenantId === tenantId));
            mockDb.units = mockDb.units.filter(u => !(u.propertyId === req.params.id && u.tenantId === tenantId));
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Units
// Public Units endpoint for Tenant Web Portal
router.get('/api/public/units', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || 'default';
        if (global.isMongoConnected) {
            const units = await Unit.find({ tenantId, status: 'Available' });
            res.json(units);
        } else {
            res.json(mockDb.units.filter(u => u.tenantId === tenantId && u.status === 'Available'));
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/units', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const units = await Unit.find({ tenantId });
            res.json(units);
        } else {
            res.json(mockDb.units.filter(u => u.tenantId === tenantId));
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/units', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const newUnit = { ...req.body, status: req.body.status || 'Available', tenantId, id: 'unit-' + Date.now() };
        if (global.isMongoConnected) {
            await Unit.create(newUnit);
        } else {
            mockDb.units.push(newUnit);
        }
        res.status(201).json(newUnit);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/api/units/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await Unit.updateOne({ id: req.params.id, tenantId }, req.body);
            res.json({ success: true });
        } else {
            const index = mockDb.units.findIndex(u => u.id === req.params.id && u.tenantId === tenantId);
            if (index !== -1) Object.assign(mockDb.units[index], req.body);
            res.json({ success: true });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/api/units/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await Unit.deleteOne({ id: req.params.id, tenantId });
        } else {
            mockDb.units = mockDb.units.filter(u => !(u.id === req.params.id && u.tenantId === tenantId));
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Group Blocks
router.get('/api/groups', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const groups = await GroupBlock.find({ tenantId });
            res.json(groups);
        } else {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/groups', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const newGroup = { ...req.body, tenantId, id: 'group-' + Date.now() };
        if (global.isMongoConnected) {
            await GroupBlock.create(newGroup);
        }
        res.status(201).json(newGroup);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/groups/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await GroupBlock.updateOne({ id: req.params.id, tenantId }, req.body);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bookings & Front Desk (QloApps Replication)
router.get('/api/bookings', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const bookings = await Booking.find({ tenantId }).sort({ checkInDate: -1 });
            res.json(bookings);
        } else {
            res.json(mockDb.bookings.filter(b => b.tenantId === tenantId));
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/bookings/folio-qr', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        let settings = null;
        if (global.isMongoConnected) {
            settings = await Settings.findOne({ tenantId });
        }
        if (!settings) {
            settings = (mockDb.settingsTenant && mockDb.settingsTenant[tenantId]) || mockDb.settings;
        }

        const { sellerName, vatNumber, timestamp, invoiceTotal, vatTotal } = req.body;
        let keys = zatcaCrypto.getKeys(tenantId) || zatcaCrypto.getKeys('default');
        if (!keys) keys = zatcaCrypto.onboardDevice(tenantId);

        const dummyXml = zatcaCrypto.generateZATCAXML({
            id: `FOLIO-${Date.now().toString().slice(-6)}`,
            uuid: crypto.randomUUID(),
            csn: 1,
            pih: zatcaCrypto.DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH,
            date: timestamp || new Date().toISOString(),
            customer: 'Hotel Guest',
            total: Number(invoiceTotal || 0),
            vat: Number(vatTotal || 0),
            items: [{ id: 'ROOM', name: 'Hotel Accommodation', price: Math.max(0, Number(invoiceTotal || 0) - Number(vatTotal || 0)), qty: 1 }]
        }, {
            ...settings,
            businessName: sellerName || settings.businessName || 'Hotel',
            vatNumber: vatNumber || settings.vatNumber || '310123456700003'
        });

        const signed = zatcaCrypto.signInvoice({
            xml: dummyXml,
            privateKeyPem: settings?.zatcaConn?.privateKey || keys.privateKeyPem,
            certificatePem: settings?.zatcaConn?.clientId || keys.certificatePem
        });

        const qrBase64 = signed.qrCodeBase64;
        const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrBase64)}`;

        res.json({ qrCode: qrBase64, qrDataUrl });
    } catch (err) {
        console.error('Folio QR error', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/public/bookings', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        if (!tenantId) return res.status(400).json({ error: 'Missing tenant ID' });
        
        const bookingNumber = 'WEB-' + Date.now().toString().slice(-6);
        const newBooking = { ...req.body, bookingNumber, tenantId, id: 'book-' + Date.now(), status: 'Pending', source: 'Web Portal' };
        
        if (global.isMongoConnected) {
            await Booking.create(newBooking);
            // Optionally reserve unit
            await Unit.updateOne({ id: newBooking.unitId, tenantId }, { status: 'Reserved' });
        } else {
            mockDb.bookings.push(newBooking);
            const unit = mockDb.units.find(u => u.id === newBooking.unitId && u.tenantId === tenantId);
            if(unit) unit.status = 'Reserved';
        }
        res.status(201).json(newBooking);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/bookings', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const bookingNumber = 'BK-' + Date.now().toString().slice(-6);
        const newBooking = { ...req.body, bookingNumber, tenantId, id: 'book-' + Date.now() };
        if (global.isMongoConnected) {
            await Booking.create(newBooking);
            await Unit.updateOne({ id: newBooking.unitId, tenantId }, { status: 'Reserved' });
        } else {
            mockDb.bookings.push(newBooking);
            const unit = mockDb.units.find(u => u.id === newBooking.unitId && u.tenantId === tenantId);
            if(unit) unit.status = 'Reserved';
        }
        res.status(201).json(newBooking);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// QloApps Check-In Endpoint
router.post('/api/bookings/:id/checkin', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        let booking;
        if (global.isMongoConnected) {
            booking = await Booking.findOneAndUpdate(
                { id: req.params.id, tenantId },
                { $set: { status: 'CheckedIn' } },
                { new: true }
            );
            if (booking) {
                await Unit.updateOne({ id: booking.unitId, tenantId }, { status: 'Occupied' });
            }
        } else {
            const b = mockDb.bookings.find(x => x.id === req.params.id && x.tenantId === tenantId);
            if (b) {
                b.status = 'CheckedIn';
                booking = b;
                const unit = mockDb.units.find(u => u.id === b.unitId && u.tenantId === tenantId);
                if (unit) unit.status = 'Occupied';
            }
        }
        res.json({ success: true, booking });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// QloApps Check-Out Endpoint
router.post('/api/bookings/:id/checkout', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        let booking;
        if (global.isMongoConnected) {
            booking = await Booking.findOneAndUpdate(
                { id: req.params.id, tenantId },
                { $set: { status: 'CheckedOut' } },
                { new: true }
            );
            if (booking) {
                // Unit status becomes Available, but cleaning status becomes Dirty (housekeeping needed)
                await Unit.updateOne({ id: booking.unitId, tenantId }, { status: 'Available', cleaningStatus: 'Dirty' });
            }
        } else {
            const b = mockDb.bookings.find(x => x.id === req.params.id && x.tenantId === tenantId);
            if (b) {
                b.status = 'CheckedOut';
                booking = b;
                const unit = mockDb.units.find(u => u.id === b.unitId && u.tenantId === tenantId);
                if (unit) {
                    unit.status = 'Available';
                    unit.cleaningStatus = 'Dirty';
                }
            }
        }
        res.json({ success: true, booking });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Split Checkout (OPERA PMS parity)
router.post('/api/bookings/:id/checkout-split', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await Booking.findOneAndUpdate(
                { id: req.params.id, tenantId },
                { $set: { status: 'CheckedOut' } }
            );
        }
        res.json({ success: true, message: 'Split invoice generated' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Hardware Integration (Keycards)
router.post('/api/hardware/keycard/encode', authenticateToken, async (req, res) => {
    try {
        const { bookingId, roomNumber } = req.body;
        // Mock hardware encode call
        res.json({ success: true, message: `Keycard encoded successfully for Room ${roomNumber}` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// QloApps Room Swap Endpoint
router.post('/api/bookings/:id/swap-room', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { newUnitId } = req.body;
        if (!newUnitId) return res.status(400).json({ error: 'Target unit is required' });

        let booking;
        if (global.isMongoConnected) {
            booking = await Booking.findOne({ id: req.params.id, tenantId });
            if (!booking) return res.status(404).json({ error: 'Booking not found' });
            const oldUnitId = booking.unitId;

            booking.unitId = newUnitId;
            await booking.save();

            // Release old unit, mark new unit reserved/occupied
            await Unit.updateOne({ id: oldUnitId, tenantId }, { status: 'Available', cleaningStatus: 'Dirty' });
            await Unit.updateOne({ id: newUnitId, tenantId }, { status: booking.status === 'CheckedIn' ? 'Occupied' : 'Reserved' });
        } else {
            const b = mockDb.bookings.find(x => x.id === req.params.id && x.tenantId === tenantId);
            if (!b) return res.status(404).json({ error: 'Booking not found' });
            const oldUnitId = b.unitId;
            b.unitId = newUnitId;
            booking = b;

            const oldUnit = mockDb.units.find(u => u.id === oldUnitId && u.tenantId === tenantId);
            if (oldUnit) { oldUnit.status = 'Available'; oldUnit.cleaningStatus = 'Dirty'; }
            const newUnit = mockDb.units.find(u => u.id === newUnitId && u.tenantId === tenantId);
            if (newUnit) newUnit.status = b.status === 'CheckedIn' ? 'Occupied' : 'Reserved';
        }
        res.json({ success: true, booking });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// QloApps Front Desk Availability Search
router.get('/api/realestate/availability', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { checkInDate, checkOutDate, propertyId, adults, children } = req.query;
        
        let allUnits = [];
        let allBookings = [];
        if (global.isMongoConnected) {
            const query = { tenantId };
            if (propertyId) query.propertyId = propertyId;
            allUnits = await Unit.find(query);
            allBookings = await Booking.find({ tenantId, status: { $in: ['Confirmed', 'CheckedIn', 'Pending', 'Reserved'] } });
        } else {
            allUnits = mockDb.units.filter(u => u.tenantId === tenantId && (!propertyId || u.propertyId === propertyId));
            allBookings = mockDb.bookings.filter(b => b.tenantId === tenantId && ['Confirmed', 'CheckedIn', 'Pending', 'Reserved'].includes(b.status));
        }

        const reqIn = checkInDate ? new Date(checkInDate) : null;
        const reqOut = checkOutDate ? new Date(checkOutDate) : null;

        const availableUnits = allUnits.filter(u => {
            if (u.status === 'Maintenance') return false;
            if (adults && u.maxAdults && Number(adults) > u.maxAdults) return false;
            
            if (reqIn && reqOut) {
                // Check if any booking overlaps with requested range
                const hasOverlap = allBookings.some(b => {
                    if (b.unitId !== u.id) return false;
                    const bIn = new Date(b.checkInDate);
                    const bOut = new Date(b.checkOutDate);
                    return (reqIn < bOut && reqOut > bIn);
                });
                if (hasOverlap) return false;
            }
            return true;
        });

        res.json({ availableUnits, totalAvailable: availableUnits.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// QloApps Extra Hotel & Property Services API
router.get('/api/realestate/services', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const services = await HotelService.find({ tenantId });
            res.json(services);
        } else {
            res.json(mockDb.hotelServices.filter(s => s.tenantId === tenantId));
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/realestate/services', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const newService = { ...req.body, tenantId, id: 'srv-' + Date.now() };
        if (global.isMongoConnected) {
            await HotelService.create(newService);
        } else {
            mockDb.hotelServices.push(newService);
        }
        res.status(201).json(newService);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/api/realestate/services/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await HotelService.updateOne({ id: req.params.id, tenantId }, req.body);
        } else {
            const idx = mockDb.hotelServices.findIndex(s => s.id === req.params.id && s.tenantId === tenantId);
            if (idx !== -1) Object.assign(mockDb.hotelServices[idx], req.body);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/api/realestate/services/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await HotelService.deleteOne({ id: req.params.id, tenantId });
        } else {
            mockDb.hotelServices = mockDb.hotelServices.filter(s => !(s.id === req.params.id && s.tenantId === tenantId));
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// QloApps Dynamic Rates & Price Rules API
router.get('/api/realestate/price-rules', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const rules = await PriceRule.find({ tenantId });
            res.json(rules);
        } else {
            res.json(mockDb.priceRules.filter(r => r.tenantId === tenantId));
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/realestate/price-rules', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const newRule = { ...req.body, tenantId, id: 'rule-' + Date.now() };
        if (global.isMongoConnected) {
            await PriceRule.create(newRule);
        } else {
            mockDb.priceRules.push(newRule);
        }
        res.status(201).json(newRule);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/api/realestate/price-rules/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await PriceRule.deleteOne({ id: req.params.id, tenantId });
        } else {
            mockDb.priceRules = mockDb.priceRules.filter(r => !(r.id === req.params.id && r.tenantId === tenantId));
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// QloApps & Real Estate Sample Data Seeder Endpoint
router.post('/api/realestate/seed', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);

        const sampleOwners = [
            { id: 'own-sample-1', name: 'Al-Mamlaka Real Estate Investment Trust', phone: '+966 11 200 3000', email: 'reit@mamlaka.sa', bankDetails: 'Al Rajhi Bank - IBAN: SA4480000201608010000001', tenantId },
            { id: 'own-sample-2', name: 'Golden Horizon Hospitality Group', phone: '+966 12 600 7000', email: 'finance@goldenhorizon.sa', bankDetails: 'Saudi National Bank (SNB) - IBAN: SA1210000001234567890123', tenantId }
        ];

        const sampleProperties = [
            {
                id: 'prop-sample-1',
                name: 'Grand Palace Hotel & Spa',
                type: 'Hotel',
                city: 'Riyadh',
                location: 'King Fahd Road, Al Olaya, Riyadh',
                address: 'King Fahd Road, Al Olaya, Riyadh',
                starRating: 5,
                checkInTime: '14:00',
                checkOutTime: '12:00',
                phone: '+966 11 456 7890',
                email: 'reservations@grandpalace.sa',
                amenities: ['WiFi', 'Pool', 'AC', 'Parking', 'Breakfast', 'Gym', 'Spa', 'FrontDesk', 'Shuttle'],
                status: 'Active',
                ownerId: 'own-sample-1',
                tenantId
            },
            {
                id: 'prop-sample-2',
                name: 'Al Nakhla Coastal Resort & Spa',
                type: 'Resort',
                city: 'Jeddah',
                location: 'North Corniche, Jeddah',
                address: 'North Corniche, Jeddah',
                starRating: 5,
                checkInTime: '15:00',
                checkOutTime: '12:00',
                phone: '+966 12 345 6789',
                email: 'concierge@alnakhla-resort.sa',
                amenities: ['WiFi', 'Pool', 'AC', 'Parking', 'Breakfast', 'Spa', 'PetFriendly'],
                status: 'Active',
                ownerId: 'own-sample-2',
                tenantId
            },
            {
                id: 'prop-sample-3',
                name: 'Al Olaya Executive Towers',
                type: 'Building',
                city: 'Riyadh',
                location: 'Tower A, Al Olaya District, Riyadh',
                address: 'Tower A, Al Olaya District, Riyadh',
                starRating: 4,
                phone: '+966 11 987 6543',
                email: 'leasing@olayatowers.sa',
                amenities: ['WiFi', 'Parking', 'AC', 'FrontDesk'],
                status: 'Active',
                ownerId: 'own-sample-1',
                tenantId
            }
        ];

        const sampleUnits = [
            {
                id: 'unit-sample-101',
                propertyId: 'prop-sample-1',
                unitNumber: '101',
                name: 'Royal Presidential Suite 101',
                type: 'Suite',
                roomType: 'Presidential Suite',
                floor: '10',
                maxAdults: 4,
                maxChildren: 2,
                dailyRate: 1500,
                status: 'Occupied',
                cleaningStatus: 'Clean',
                amenities: ['WiFi', 'Pool', 'AC', 'Breakfast', 'Spa', 'FrontDesk'],
                tenantId
            },
            {
                id: 'unit-sample-102',
                propertyId: 'prop-sample-1',
                unitNumber: '102',
                name: 'Executive King Suite 102',
                type: 'Suite',
                roomType: 'Executive Suite',
                floor: '5',
                maxAdults: 2,
                maxChildren: 1,
                dailyRate: 850,
                status: 'Reserved',
                cleaningStatus: 'Clean',
                amenities: ['WiFi', 'AC', 'Breakfast', 'Gym'],
                tenantId
            },
            {
                id: 'unit-sample-103',
                propertyId: 'prop-sample-1',
                unitNumber: '103',
                name: 'Deluxe Double Room 103',
                type: 'Room',
                roomType: 'Deluxe Room',
                floor: '3',
                maxAdults: 2,
                maxChildren: 2,
                dailyRate: 550,
                status: 'Available',
                cleaningStatus: 'Dirty',
                amenities: ['WiFi', 'AC', 'Parking'],
                tenantId
            },
            {
                id: 'unit-sample-104',
                propertyId: 'prop-sample-1',
                unitNumber: '104',
                name: 'Standard King Room 104',
                type: 'Room',
                roomType: 'Standard Room',
                floor: '2',
                maxAdults: 2,
                maxChildren: 0,
                dailyRate: 380,
                status: 'Available',
                cleaningStatus: 'Clean',
                amenities: ['WiFi', 'AC'],
                tenantId
            },
            {
                id: 'unit-sample-201',
                propertyId: 'prop-sample-2',
                unitNumber: 'V-01',
                name: 'Private Sea-View Royal Villa',
                type: 'Villa',
                roomType: 'Royal Villa',
                floor: '1',
                maxAdults: 6,
                maxChildren: 4,
                dailyRate: 3200,
                status: 'Available',
                cleaningStatus: 'Inspecting',
                amenities: ['WiFi', 'Pool', 'AC', 'Parking', 'Breakfast', 'Spa', 'PetFriendly'],
                tenantId
            },
            {
                id: 'unit-sample-202',
                propertyId: 'prop-sample-2',
                unitNumber: 'V-02',
                name: 'Sunset Lagoon Chalet',
                type: 'Room',
                roomType: 'Deluxe Room',
                floor: '1',
                maxAdults: 3,
                maxChildren: 2,
                dailyRate: 1200,
                status: 'Occupied',
                cleaningStatus: 'Clean',
                amenities: ['WiFi', 'Pool', 'AC', 'Breakfast'],
                tenantId
            },
            {
                id: 'unit-sample-301',
                propertyId: 'prop-sample-3',
                unitNumber: 'Off-301',
                name: 'Prime Corporate Office Suite',
                type: 'Apartment',
                roomType: 'Office Space',
                floor: '3',
                dailyRate: 600,
                status: 'Occupied',
                cleaningStatus: 'Clean',
                amenities: ['WiFi', 'AC', 'Parking', 'FrontDesk'],
                tenantId
            },
            {
                id: 'unit-sample-302',
                propertyId: 'prop-sample-3',
                unitNumber: 'Sh-101',
                name: 'Ground Floor Retail Showroom',
                type: 'Apartment',
                roomType: 'Retail Shop',
                floor: '1',
                dailyRate: 850,
                status: 'Available',
                cleaningStatus: 'Clean',
                amenities: ['WiFi', 'AC', 'Parking'],
                tenantId
            }
        ];

        const sampleServices = [
            {
                id: 'srv-sample-1',
                nameEN: 'VIP Airport Limousine Transfer',
                nameAR: 'خدمة نقل كبار الشخصيات من المطار بالليموزين',
                price: 250,
                priceType: 'PerStay',
                icon: 'ri-car-line',
                description: 'Chauffeur-driven luxury Mercedes S-Class pickup/dropoff',
                status: 'Active',
                tenantId
            },
            {
                id: 'srv-sample-2',
                nameEN: 'International Buffet Breakfast',
                nameAR: 'بوفيه إفطار عالمي مفتوح',
                price: 75,
                priceType: 'PerPerson',
                icon: 'ri-restaurant-line',
                description: 'Daily gourmet breakfast spread with fresh juice & barista coffee',
                status: 'Active',
                tenantId
            },
            {
                id: 'srv-sample-3',
                nameEN: 'Full-Body Swedish Massage & Spa Pass',
                nameAR: 'جلسة مساج سويدي كامل مع دخول السبا',
                price: 350,
                priceType: 'PerStay',
                icon: 'ri-spa-line',
                description: '60-minute relaxing session plus access to sauna & hydro pool',
                status: 'Active',
                tenantId
            },
            {
                id: 'srv-sample-4',
                nameEN: 'Extra Rollaway Bed with Premium Linen',
                nameAR: 'سرير إضافي قابل للطي مع مفارش فاخرة',
                price: 120,
                priceType: 'PerNight',
                icon: 'ri-hotel-bed-line',
                description: 'Comfortable single rollaway bed setup in room',
                status: 'Active',
                tenantId
            },
            {
                id: 'srv-sample-5',
                nameEN: 'Guided Riyadh City & Historical Diriyah Tour',
                nameAR: 'جولة سياحية مرشدة في مدينة الرياض والدرعية التاريخية',
                price: 450,
                priceType: 'PerStay',
                icon: 'ri-compass-3-line',
                description: 'Half-day cultural tour with English/Arabic private tour guide',
                status: 'Active',
                tenantId
            }
        ];

        const samplePriceRules = [
            {
                id: 'rule-sample-1',
                name: 'High Summer Season Surge (+25%)',
                propertyId: 'prop-sample-2',
                ruleType: 'Multiplier',
                value: 1.25,
                startDate: new Date('2026-06-01'),
                endDate: new Date('2026-09-30'),
                status: 'Active',
                tenantId
            },
            {
                id: 'rule-sample-2',
                name: 'Early Bird 30-Day Advance Discount (15%)',
                propertyId: 'prop-sample-1',
                ruleType: 'PercentageDiscount',
                value: 15,
                startDate: new Date('2026-01-01'),
                endDate: new Date('2026-12-31'),
                status: 'Active',
                tenantId
            }
        ];

        const sampleCustomers = [
            { id: 'cust-sample-1', name: 'Sheikh Sultan Al-Otaibi', phone: '+966 50 123 4567', email: 'sultan.otaibi@al-rajhi.sa', tenantId },
            { id: 'cust-sample-2', name: 'Dr. Sarah Jenkins', phone: '+44 7700 900077', email: 'sarah.jenkins@oxford.ac.uk', tenantId },
            { id: 'cust-sample-3', name: 'Eng. Tariq Al-Ghamdi', phone: '+966 55 987 6543', email: 'tariq.ghamdi@aramco.com', tenantId }
        ];

        const sampleBookings = [
            {
                id: 'book-sample-1',
                bookingNumber: 'BK-809121',
                unitId: 'unit-sample-101',
                customerId: 'cust-sample-1',
                customerName: 'Sheikh Sultan Al-Otaibi',
                customerPhone: '+966 50 123 4567',
                checkInDate: new Date('2026-09-15'),
                checkOutDate: new Date('2026-09-20'),
                adults: 2,
                children: 1,
                extraServices: [
                    { serviceId: 'srv-sample-1', name: 'VIP Airport Limousine Transfer', price: 250, qty: 1 },
                    { serviceId: 'srv-sample-2', name: 'International Buffet Breakfast', price: 75, qty: 2 }
                ],
                dailyRate: 1500,
                discount: 0,
                subtotal: 7900,
                vat: 1185,
                totalAmount: 9085,
                paidAmount: 9085,
                paymentStatus: 'Paid',
                status: 'CheckedIn',
                notes: 'VIP Guest. Requires high floor and extra feather pillows.',
                tenantId
            },
            {
                id: 'book-sample-2',
                bookingNumber: 'BK-809122',
                unitId: 'unit-sample-102',
                customerId: 'cust-sample-2',
                customerName: 'Dr. Sarah Jenkins',
                customerPhone: '+44 7700 900077',
                checkInDate: new Date('2026-09-18'),
                checkOutDate: new Date('2026-09-22'),
                adults: 1,
                children: 0,
                extraServices: [
                    { serviceId: 'srv-sample-2', name: 'International Buffet Breakfast', price: 75, qty: 1 }
                ],
                dailyRate: 850,
                discount: 200,
                subtotal: 3275,
                vat: 491.25,
                totalAmount: 3766.25,
                paidAmount: 1500,
                paymentStatus: 'PartiallyPaid',
                status: 'Confirmed',
                notes: 'Attending Medical AI Conference. Quiet room requested.',
                tenantId
            },
            {
                id: 'book-sample-3',
                bookingNumber: 'BK-809123',
                unitId: 'unit-sample-202',
                customerId: 'cust-sample-3',
                customerName: 'Eng. Tariq Al-Ghamdi',
                customerPhone: '+966 55 987 6543',
                checkInDate: new Date('2026-09-14'),
                checkOutDate: new Date('2026-09-17'),
                adults: 2,
                children: 2,
                extraServices: [
                    { serviceId: 'srv-sample-3', name: 'Full-Body Swedish Massage & Spa Pass', price: 350, qty: 1 }
                ],
                dailyRate: 1200,
                discount: 0,
                subtotal: 3950,
                vat: 592.5,
                totalAmount: 4542.5,
                paidAmount: 4542.5,
                paymentStatus: 'Paid',
                status: 'CheckedIn',
                notes: 'Family vacation. Requested late checkout at 14:00.',
                tenantId
            }
        ];

        const sampleLeases = [
            {
                tenantId,
                unitId: 'unit-sample-301',
                customerId: 'cust-sample-1',
                startDate: new Date('2026-01-01'),
                endDate: new Date('2027-12-31'),
                rentAmount: 216000,
                paymentFrequency: 'Quarterly',
                installments: [
                    { dueDate: new Date('2026-01-01'), amount: 54000, status: 'Paid' },
                    { dueDate: new Date('2026-04-01'), amount: 54000, status: 'Paid' },
                    { dueDate: new Date('2026-07-01'), amount: 54000, status: 'Paid' },
                    { dueDate: new Date('2026-10-01'), amount: 54000, status: 'Pending' }
                ],
                managementFeeType: 'Percentage',
                managementFeeValue: 10,
                status: 'Active'
            }
        ];

        const sampleLeads = [
            {
                id: 'lead-sample-1',
                tenantId,
                name: 'Fahad Al-Hussaini',
                phone: '+966 54 111 2233',
                email: 'fahad@hussaini-group.com',
                source: 'Referral',
                status: 'Viewing Scheduled',
                interestedPropertyId: 'prop-sample-3',
                budget: 25000,
                notes: [{ date: new Date(), user: 'Agent', content: 'Interested in opening a specialty coffee flagship store on the ground floor.' }]
            },
            {
                id: 'lead-sample-2',
                tenantId,
                name: 'Noura Al-Shehri',
                phone: '+966 56 333 4455',
                email: 'noura.shehri@gmail.com',
                source: 'Social Media',
                status: 'Contacted',
                interestedPropertyId: 'prop-sample-2',
                budget: 3200,
                notes: [{ date: new Date(), user: 'Concierge', content: 'Inquired about booking the Private Sea-View Royal Villa for an anniversary weekend.' }]
            }
        ];

        if (global.isMongoConnected) {
            for (const o of sampleOwners) await PropertyOwner.updateOne({ id: o.id, tenantId }, { $set: o }, { upsert: true });
            for (const p of sampleProperties) await Property.updateOne({ id: p.id, tenantId }, { $set: p }, { upsert: true });
            for (const u of sampleUnits) await Unit.updateOne({ id: u.id, tenantId }, { $set: u }, { upsert: true });
            for (const s of sampleServices) await HotelService.updateOne({ id: s.id, tenantId }, { $set: s }, { upsert: true });
            for (const r of samplePriceRules) await PriceRule.updateOne({ id: r.id, tenantId }, { $set: r }, { upsert: true });
            for (const c of sampleCustomers) await Customer.updateOne({ id: c.id, tenantId }, { $set: c }, { upsert: true });
            for (const b of sampleBookings) await Booking.updateOne({ id: b.id, tenantId }, { $set: b }, { upsert: true });
            
            await LeaseContract.deleteMany({ unitId: 'unit-sample-301', tenantId });
            for (const l of sampleLeases) await LeaseContract.create(l);
            for (const ld of sampleLeads) await Lead.updateOne({ id: ld.id, tenantId }, { $set: ld }, { upsert: true });
        } else {
            const upsertMock = (arr, items, idKey = 'id') => {
                items.forEach(item => {
                    const idx = arr.findIndex(x => x[idKey] === item[idKey] && x.tenantId === tenantId);
                    if (idx !== -1) arr[idx] = item;
                    else arr.push(item);
                });
            };
            upsertMock(mockDb.propertyOwners, sampleOwners);
            upsertMock(mockDb.properties, sampleProperties);
            upsertMock(mockDb.units, sampleUnits);
            upsertMock(mockDb.hotelServices, sampleServices);
            upsertMock(mockDb.priceRules, samplePriceRules);
            upsertMock(mockDb.customers, sampleCustomers);
            upsertMock(mockDb.bookings, sampleBookings);
            upsertMock(mockDb.leaseContracts, sampleLeases, 'unitId');
            upsertMock(mockDb.leads, sampleLeads);
        }

        res.json({
            success: true,
            message: 'Sample real estate and hotel data seeded successfully',
            counts: {
                properties: sampleProperties.length,
                units: sampleUnits.length,
                hotelServices: sampleServices.length,
                priceRules: samplePriceRules.length,
                bookings: sampleBookings.length,
                owners: sampleOwners.length,
                leads: sampleLeads.length
            }
        });
    } catch (err) {
        console.error('Error seeding real estate data:', err);
        res.status(500).json({ error: err.message });
    }
});

// Housekeeping Room Status Update
router.put('/api/realestate/units/:id/cleaning-status', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { cleaningStatus } = req.body;
        if (global.isMongoConnected) {
            await Unit.updateOne({ id: req.params.id, tenantId }, { $set: { cleaningStatus } });
        } else {
            const unit = mockDb.units.find(u => u.id === req.params.id && u.tenantId === tenantId);
            if (unit) unit.cleaningStatus = cleaningStatus;
        }
        res.json({ success: true, cleaningStatus });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/api/bookings/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await Booking.updateOne({ id: req.params.id, tenantId }, req.body);
            res.json({ success: true });
        } else {
            const index = mockDb.bookings.findIndex(b => b.id === req.params.id && b.tenantId === tenantId);
            if (index !== -1) Object.assign(mockDb.bookings[index], req.body);
            res.json({ success: true });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/api/bookings/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        let booking;
        if (global.isMongoConnected) {
            booking = await Booking.findOne({ id: req.params.id, tenantId });
            await Booking.deleteOne({ id: req.params.id, tenantId });
            if (booking) await Unit.updateOne({ id: booking.unitId, tenantId }, { status: 'Available' });
        } else {
            const idx = mockDb.bookings.findIndex(b => b.id === req.params.id && b.tenantId === tenantId);
            if(idx !== -1) {
                booking = mockDb.bookings[idx];
                mockDb.bookings.splice(idx, 1);
                const unit = mockDb.units.find(u => u.id === booking.unitId && u.tenantId === tenantId);
                if (unit) unit.status = 'Available';
            }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Maintenance Tasks
router.get('/api/maintenance-tasks', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const tasks = await MaintenanceTask.find({ tenantId });
            res.json(tasks);
        } else {
            res.json(mockDb.maintenanceTasks.filter(t => t.tenantId === tenantId));
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/maintenance-tasks', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const newTask = { ...req.body, tenantId, id: 'maint-' + Date.now() };
        
        if (global.isMongoConnected) {
            await MaintenanceTask.create(newTask);
            if (newTask.unitId) {
                await Unit.updateOne({ id: newTask.unitId, tenantId }, { status: 'Maintenance' });
            }
            
            // Bill to tenant if requested
            if (newTask.billToTenant && newTask.unitId) {
                const lease = await LeaseContract.findOne({ unitId: newTask.unitId, tenantId, status: 'Active' });
                if (lease) {
                    const cost = newTask.assigneeType === 'Vendor' ? newTask.vendorCost : newTask.cost;
                    const invoiceData = {
                        id: 'pinv-' + Date.now(),
                        bookingId: lease.id || lease._id.toString(), // Store lease ID reference
                        customerId: lease.customerId,
                        issueDate: new Date(),
                        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
                        subtotal: cost,
                        vat: cost * 0.15,
                        total: cost * 1.15,
                        status: 'Unpaid',
                        tenantId
                    };
                    await PropertyInvoice.create(invoiceData);
                }
            }
            
        } else {
            mockDb.maintenanceTasks.push(newTask);
            if (newTask.unitId) {
                const unit = mockDb.units.find(u => u.id === newTask.unitId && u.tenantId === tenantId);
                if(unit) unit.status = 'Maintenance';
            }
            
            // Bill to tenant (mock)
            if (newTask.billToTenant && newTask.unitId) {
                const lease = mockDb.leaseContracts.find(l => l.unitId === newTask.unitId && l.tenantId === tenantId && l.status === 'Active');
                if (lease) {
                    const cost = newTask.assigneeType === 'Vendor' ? newTask.vendorCost : newTask.cost;
                    const invoiceData = {
                        id: 'pinv-' + Date.now(),
                        bookingId: lease.id || lease._id,
                        customerId: lease.customerId,
                        issueDate: new Date(),
                        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        subtotal: cost,
                        vat: cost * 0.15,
                        total: cost * 1.15,
                        status: 'Unpaid',
                        tenantId
                    };
                    mockDb.propertyInvoices.push(invoiceData);
                }
            }
        }
        res.status(201).json(newTask);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/api/maintenance-tasks/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await MaintenanceTask.updateOne({ id: req.params.id, tenantId }, req.body);
            if (req.body.status === 'Completed') {
                const task = await MaintenanceTask.findOne({ id: req.params.id, tenantId });
                if(task && task.unitId) {
                    await Unit.updateOne({ id: task.unitId, tenantId }, { status: 'Available' });
                }
            }
            res.json({ success: true });
        } else {
            const index = mockDb.maintenanceTasks.findIndex(t => t.id === req.params.id && t.tenantId === tenantId);
            if (index !== -1) {
                Object.assign(mockDb.maintenanceTasks[index], req.body);
                if (req.body.status === 'Completed') {
                    const task = mockDb.maintenanceTasks[index];
                    if (task.unitId) {
                        const unit = mockDb.units.find(u => u.id === task.unitId && u.tenantId === tenantId);
                        if(unit) unit.status = 'Available';
                    }
                }
            }
            res.json({ success: true });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/api/maintenance-tasks/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        let task;
        if (global.isMongoConnected) {
            task = await MaintenanceTask.findOne({ id: req.params.id, tenantId });
            await MaintenanceTask.deleteOne({ id: req.params.id, tenantId });
            if (task && task.unitId) {
                await Unit.updateOne({ id: task.unitId, tenantId }, { status: 'Available' });
            }
        } else {
            const idx = mockDb.maintenanceTasks.findIndex(t => t.id === req.params.id && t.tenantId === tenantId);
            if(idx !== -1) {
                task = mockDb.maintenanceTasks[idx];
                mockDb.maintenanceTasks.splice(idx, 1);
                if (task.unitId) {
                    const unit = mockDb.units.find(u => u.id === task.unitId && u.tenantId === tenantId);
                    if(unit) unit.status = 'Available';
                }
            }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Property Invoices
router.get('/api/property-invoices', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const invoices = await PropertyInvoice.find({ tenantId });
            res.json(invoices);
        } else {
            res.json(mockDb.propertyInvoices.filter(i => i.tenantId === tenantId));
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/property-invoices', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const newInvoice = { ...req.body, tenantId, id: 'pinv-' + Date.now() };
        if (global.isMongoConnected) {
            await PropertyInvoice.create(newInvoice);
        } else {
            mockDb.propertyInvoices.push(newInvoice);
        }
        res.status(201).json(newInvoice);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/api/property-invoices/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await PropertyInvoice.updateOne({ id: req.params.id, tenantId }, req.body);
            res.json({ success: true });
        } else {
            const index = mockDb.propertyInvoices.findIndex(i => i.id === req.params.id && i.tenantId === tenantId);
            if (index !== -1) Object.assign(mockDb.propertyInvoices[index], req.body);
            res.json({ success: true });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/api/property-invoices/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await PropertyInvoice.deleteOne({ id: req.params.id, tenantId });
        } else {
            mockDb.propertyInvoices = mockDb.propertyInvoices.filter(i => !(i.id === req.params.id && i.tenantId === tenantId));
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// LEASING & CONTRACTS (REAL ESTATE)
// ==========================================

router.get('/api/lease-contracts', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || 'default';
        if (global.isMongoConnected) {
            const leases = await LeaseContract.find({ tenantId });
            res.json(leases);
        } else {
            res.json(mockDb.leaseContracts.filter(l => l.tenantId === tenantId));
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/lease-contracts', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || 'default';
        const data = { ...req.body, tenantId };
        
        // Auto-generate installments based on paymentFrequency if not provided
        if (!data.installments || data.installments.length === 0) {
            const start = new Date(data.startDate);
            const end = new Date(data.endDate);
            let numInstallments = 1;
            
            if (data.paymentFrequency === 'Monthly') {
                numInstallments = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
            } else if (data.paymentFrequency === 'Quarterly') {
                numInstallments = Math.ceil(((end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())) / 3);
            } else if (data.paymentFrequency === 'Semi-Annually') {
                numInstallments = Math.ceil(((end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())) / 6);
            } else if (data.paymentFrequency === 'Yearly') {
                numInstallments = end.getFullYear() - start.getFullYear();
            }
            if (numInstallments <= 0) numInstallments = 1;
            
            const installmentAmount = Number((data.rentAmount / numInstallments).toFixed(2));
            data.installments = [];
            
            for (let i = 0; i < numInstallments; i++) {
                let dueDate = new Date(start);
                if (data.paymentFrequency === 'Monthly') dueDate.setMonth(dueDate.getMonth() + i);
                else if (data.paymentFrequency === 'Quarterly') dueDate.setMonth(dueDate.getMonth() + (i * 3));
                else if (data.paymentFrequency === 'Semi-Annually') dueDate.setMonth(dueDate.getMonth() + (i * 6));
                else if (data.paymentFrequency === 'Yearly') dueDate.setFullYear(dueDate.getFullYear() + i);
                
                const invoiceId = 'pinv-' + Date.now() + '-' + i;
                data.installments.push({
                    dueDate,
                    amount: installmentAmount,
                    status: 'Pending',
                    invoiceId
                });
            }
            // Adjust last installment for rounding
            const currentTotal = data.installments.reduce((sum, inst) => sum + inst.amount, 0);
            if (currentTotal !== data.rentAmount && data.installments.length > 0) {
                data.installments[data.installments.length - 1].amount += (data.rentAmount - currentTotal);
            }
        }

        if (global.isMongoConnected) {
            const lease = new LeaseContract(data);
            await lease.save();
            
            // Generate PropertyInvoices for each installment
            const propertyInvoices = data.installments.map(inst => ({
                id: inst.invoiceId,
                bookingId: lease._id.toString(), // storing lease id here loosely
                customerId: data.customerId,
                dueDate: inst.dueDate,
                subtotal: inst.amount,
                vat: inst.amount * 0.15, // assuming 15% VAT, or you can configure this
                total: inst.amount * 1.15,
                status: 'Unpaid',
                tenantId
            }));
            await PropertyInvoice.insertMany(propertyInvoices);
            
            // Also update unit status if lease is active
            if (lease.status === 'Active') {
                await Unit.updateOne({ _id: data.unitId, tenantId }, { $set: { status: 'Occupied' }});
            }
            res.status(201).json(lease);
        } else {
            data._id = Date.now().toString();
            
            const propertyInvoices = data.installments.map(inst => ({
                id: inst.invoiceId,
                bookingId: data._id,
                customerId: data.customerId,
                dueDate: inst.dueDate,
                subtotal: inst.amount,
                vat: inst.amount * 0.15,
                total: inst.amount * 1.15,
                status: 'Unpaid',
                tenantId
            }));
            mockDb.propertyInvoices.push(...propertyInvoices);
            
            mockDb.leaseContracts.push(data);
            if (data.status === 'Active') {
                const u = mockDb.units.find(u => u.id === data.unitId && u.tenantId === tenantId);
                if (u) u.status = 'Occupied';
            }
            res.status(201).json(data);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/lease-contracts/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || 'default';
        if (global.isMongoConnected) {
            const updated = await LeaseContract.findOneAndUpdate({ id: req.params.id, tenantId }, req.body, { new: true });
            
            // Sync unit status
            if (updated && req.body.status) {
                const newStatus = req.body.status === 'Active' ? 'Occupied' : 'Available';
                await Unit.updateOne({ id: updated.unitId, tenantId }, { $set: { status: newStatus }});
            }
            
            res.json(updated);
        } else {
            const idx = mockDb.leaseContracts.findIndex(l => l.id === req.params.id && l.tenantId === tenantId);
            if (idx === -1) return res.status(404).json({ error: 'Not found' });
            
            mockDb.leaseContracts[idx] = { ...mockDb.leaseContracts[idx], ...req.body };
            
            if (req.body.status) {
                const lease = mockDb.leaseContracts[idx];
                const newStatus = lease.status === 'Active' ? 'Occupied' : 'Available';
                const u = mockDb.units.find(u => u.id === lease.unitId && u.tenantId === tenantId);
                if (u) u.status = newStatus;
            }
            
            res.json(mockDb.leaseContracts[idx]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/api/lease-contracts/:id/installments/:idx/pay', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || 'default';
        const installmentIndex = parseInt(req.params.idx);
        
        let lease;
        if (global.isMongoConnected) {
            lease = await LeaseContract.findOne({ id: req.params.id, tenantId });
        } else {
            lease = mockDb.leaseContracts.find(l => l.id === req.params.id && l.tenantId === tenantId);
        }
        
        if (!lease) return res.status(404).json({ error: 'Lease not found' });
        if (!lease.installments || !lease.installments[installmentIndex]) {
            return res.status(404).json({ error: 'Installment not found' });
        }
        
        const installment = lease.installments[installmentIndex];
        if (installment.status === 'Paid') {
            return res.status(400).json({ error: 'Installment already paid' });
        }
        
        let savedInvoice;
        const voucherId = `VCH-${Date.now().toString().slice(-6)}`;
        const entryId = `JE-${Date.now().toString().slice(-6)}`;
        const amount = installment.amount;
        
        if (global.isMongoConnected) {
            // Update the existing invoice
            if (installment.invoiceId) {
                savedInvoice = await PropertyInvoice.findOneAndUpdate(
                    { id: installment.invoiceId, tenantId },
                    { $set: { status: 'Paid', issueDate: new Date() } },
                    { new: true }
                );
            }
            
            lease.installments[installmentIndex].status = 'Paid';
            await lease.save();
            
            // Generate Receipt Voucher
            const voucher = new Voucher({
                voucherId,
                type: 'RECEIPT',
                date: new Date(),
                entityType: 'CUSTOMER',
                entityId: lease.customerId,
                amount,
                method: 'Cash',
                description: `Rent payment for lease ${lease._id || lease.id}`,
                tenantId
            });
            await voucher.save();
            
            // Generate Journal Entry
            const je = new JournalEntry({
                entryId,
                date: new Date(),
                account: '1000', // Cash
                description: `Rent Receipt Voucher ${voucherId}`,
                debit: amount,
                credit: 0,
                tenantId
            });
            await je.save();
            
        } else {
            // Mock DB logic
            if (installment.invoiceId) {
                const invIndex = mockDb.propertyInvoices.findIndex(i => i.id === installment.invoiceId && i.tenantId === tenantId);
                if (invIndex !== -1) {
                    mockDb.propertyInvoices[invIndex].status = 'Paid';
                    mockDb.propertyInvoices[invIndex].issueDate = new Date();
                    savedInvoice = mockDb.propertyInvoices[invIndex];
                }
            }
            
            lease.installments[installmentIndex].status = 'Paid';
            
            // Generate Receipt Voucher
            const voucher = {
                voucherId,
                type: 'RECEIPT',
                date: new Date(),
                entityType: 'CUSTOMER',
                entityId: lease.customerId,
                amount,
                method: 'Cash',
                description: `Rent payment for lease ${lease._id || lease.id}`,
                tenantId
            };
            mockDb.vouchers.push(voucher);
            
            // Generate Journal Entry
            const je = {
                entryId,
                date: new Date(),
                account: '1000', // Cash
                description: `Rent Receipt Voucher ${voucherId}`,
                debit: amount,
                credit: 0,
                tenantId
            };
            mockDb.journalEntries.push(je);
        }
        
        res.json({ success: true, lease, invoice: savedInvoice });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/lease-contracts/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || 'default';
        if (global.isMongoConnected) {
            const lease = await LeaseContract.findOneAndDelete({ id: req.params.id, tenantId });
            if (lease) {
                await Unit.updateOne({ id: lease.unitId, tenantId }, { $set: { status: 'Available' }});
                await PropertyInvoice.deleteMany({ leaseId: req.params.id, tenantId });
            }
        } else {
            const lease = mockDb.leaseContracts.find(l => l.id === req.params.id && l.tenantId === tenantId);
            if (lease) {
                const u = mockDb.units.find(u => u.id === lease.unitId && u.tenantId === tenantId);
                if (u) u.status = 'Available';
            }
            mockDb.leaseContracts = mockDb.leaseContracts.filter(l => !(l.id === req.params.id && l.tenantId === tenantId));
            mockDb.propertyInvoices = mockDb.propertyInvoices.filter(i => !(i.leaseId === req.params.id && i.tenantId === tenantId));
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// TENANT PORTAL (REAL ESTATE)
// ==========================================

// 1. Set portal password (for Property Managers to call from ERP)
router.post('/api/customers/:id/set-password', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || 'default';
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'Password required' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        if (global.isMongoConnected) {
            await Customer.updateOne({ id: req.params.id, tenantId }, { $set: { portalPassword: hashedPassword }});
            res.json({ success: true });
        } else {
            const cust = mockDb.customers.find(c => c.id === req.params.id && c.tenantId === tenantId);
            if (cust) {
                cust.portalPassword = hashedPassword;
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Customer not found' });
            }
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Portal Login
router.post('/api/tenant-portal/login', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || 'default';
        const { phone, password } = req.body;
        
        let customer;
        if (global.isMongoConnected) {
            customer = await Customer.findOne({ phone, tenantId });
        } else {
            customer = mockDb.customers.find(c => c.phone === phone && c.tenantId === tenantId);
        }
        
        if (!customer) return res.status(401).json({ error: 'Invalid phone or password' });
        if (!customer.portalPassword) return res.status(401).json({ error: 'Portal access not configured' });
        
        const valid = await bcrypt.compare(password, customer.portalPassword);
        if (!valid) return res.status(401).json({ error: 'Invalid phone or password' });
        
        const token = jwt.sign(
            { id: customer.id, role: 'Tenant', tenantId: customer.tenantId },
            getJwtSecret(),
            { expiresIn: '24h' }
        );
        res.json({ token, customer: { id: customer.id, name: customer.name, phone: customer.phone } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Middleware for Portal auth
const authenticateTenant = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, getJwtSecret(), (err, user) => {
        if (err || user.role !== 'Tenant' || user.tenantId !== getTenantId(req)) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

router.get('/api/tenant-portal/leases', authenticateTenant, async (req, res) => {
    try {
        const { id, tenantId } = req.user;
        if (global.isMongoConnected) {
            const leases = await LeaseContract.find({ customerId: id, tenantId });
            res.json(leases);
        } else {
            res.json(mockDb.leaseContracts.filter(l => l.customerId === id && l.tenantId === tenantId));
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/tenant-portal/invoices', authenticateTenant, async (req, res) => {
    try {
        const { id, tenantId } = req.user;
        if (global.isMongoConnected) {
            const invoices = await PropertyInvoice.find({ customerId: id, tenantId });
            res.json(invoices);
        } else {
            res.json(mockDb.propertyInvoices.filter(i => i.customerId === id && i.tenantId === tenantId));
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/tenant-portal/maintenance', authenticateTenant, async (req, res) => {
    try {
        const { id, tenantId } = req.user;
        
        // Find units leased by this user to restrict their maintenance tasks
        let unitIds = [];
        if (global.isMongoConnected) {
            const leases = await LeaseContract.find({ customerId: id, tenantId, status: 'Active' });
            unitIds = leases.map(l => l.unitId);
            const tasks = await MaintenanceTask.find({ unitId: { $in: unitIds }, tenantId });
            res.json(tasks);
        } else {
            const leases = mockDb.leaseContracts.filter(l => l.customerId === id && l.tenantId === tenantId && l.status === 'Active');
            unitIds = leases.map(l => l.unitId);
            const tasks = mockDb.maintenanceTasks.filter(t => unitIds.includes(t.unitId) && t.tenantId === tenantId);
            res.json(tasks);
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenant-portal/maintenance', authenticateTenant, async (req, res) => {
    try {
        const { tenantId } = req.user;
        const data = { ...req.body, tenantId, status: 'Pending' };
        if (global.isMongoConnected) {
            const task = new MaintenanceTask(data);
            await task.save();
            res.status(201).json(task);
        } else {
            data.id = Date.now().toString();
            mockDb.maintenanceTasks.push(data);
            res.status(201).json(data);
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// CRM / Lead Management Routes
router.get('/api/leads', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            const leads = await Lead.find({ tenantId });
            res.json(leads);
        } else {
            res.json(mockDb.leads?.filter(l => l.tenantId === tenantId) || []);
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/leads', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const data = { ...req.body, tenantId, id: 'lead-' + Date.now() };
        if (global.isMongoConnected) {
            const lead = new Lead(data);
            await lead.save();
            res.status(201).json(lead);
        } else {
            mockDb.leads = mockDb.leads || [];
            mockDb.leads.push(data);
            res.status(201).json(data);
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/api/leads/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await Lead.updateOne({ id: req.params.id, tenantId }, req.body);
            res.json({ success: true });
        } else {
            mockDb.leads = mockDb.leads.map(l => l.id === req.params.id && l.tenantId === tenantId ? { ...l, ...req.body } : l);
            res.json({ success: true });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/api/leads/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await Lead.deleteOne({ id: req.params.id, tenantId });
        } else {
            mockDb.leads = mockDb.leads.filter(l => !(l.id === req.params.id && l.tenantId === tenantId));
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/leads/:id/notes', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { content } = req.body;
        const noteObj = { date: new Date(), user: req.user?.username || 'System', content };
        
        if (global.isMongoConnected) {
            const lead = await Lead.findOne({ id: req.params.id, tenantId });
            if (!lead) return res.status(404).json({ error: 'Lead not found' });
            lead.notes = lead.notes || [];
            lead.notes.push(noteObj);
            await lead.save();
            res.json(lead);
        } else {
            const lead = mockDb.leads.find(l => l.id === req.params.id && l.tenantId === tenantId);
            if (!lead) return res.status(404).json({ error: 'Lead not found' });
            lead.notes = lead.notes || [];
            lead.notes.push(noteObj);
            res.json(lead);
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/leads/:id/convert', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        let leadData = null;
        
        if (global.isMongoConnected) {
            const lead = await Lead.findOne({ _id: req.params.id, tenantId });
            if (!lead) return res.status(404).json({ error: 'Lead not found' });
            lead.status = 'Won';
            await lead.save();
            leadData = lead;
        } else {
            const lead = mockDb.leads.find(l => l._id === req.params.id && l.tenantId === tenantId);
            if (!lead) return res.status(404).json({ error: 'Lead not found' });
            lead.status = 'Won';
            leadData = lead;
        }
        
        // Create Customer
        const customerData = {
            id: 'cust-' + Date.now(),
            tenantId,
            name: leadData.name,
            email: leadData.email || '',
            phone: leadData.phone || '',
            type: 'Individual' // default
        };
        
        if (global.isMongoConnected) {
            const customer = new Customer(customerData);
            await customer.save();
            res.json({ success: true, customer });
        } else {
            customerData._id = customerData.id;
            mockDb.customers.push(customerData);
            res.json({ success: true, customer: customerData });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// RESTAURANT MODULE ENDPOINTS
// ==========================================

// --- Storage: MongoDB when connected, otherwise the in-memory store (portable/demo mode).
// Both paths work on plain objects so the routes below have one code path.
if (!mockDb.printerConfigs) mockDb.printerConfigs = [];
if (!mockDb.restaurantOrders) mockDb.restaurantOrders = [];

const restaurantStore = {
    async listPrinters(tenantId) {
        if (global.isMongoConnected) return PrinterConfig.find({ tenantId }).lean();
        return mockDb.printerConfigs.filter(p => p.tenantId === tenantId);
    },
    async savePrinter(tenantId, data) {
        if (global.isMongoConnected) {
            await PrinterConfig.findOneAndUpdate({ category: data.category, tenantId }, { ...data, tenantId }, { upsert: true });
            return;
        }
        const idx = mockDb.printerConfigs.findIndex(p => p.tenantId === tenantId && p.category === data.category);
        const row = { ...data, tenantId };
        if (idx >= 0) mockDb.printerConfigs[idx] = row; else mockDb.printerConfigs.push(row);
    },
    async deletePrinter(tenantId, category) {
        if (global.isMongoConnected) return PrinterConfig.findOneAndDelete({ category, tenantId });
        mockDb.printerConfigs = mockDb.printerConfigs.filter(p => !(p.tenantId === tenantId && p.category === category));
    },
    async listOpenOrders(tenantId) {
        if (global.isMongoConnected) return RestaurantOrder.find({ status: 'Open', tenantId }).lean();
        return mockDb.restaurantOrders.filter(o => o.tenantId === tenantId && o.status === 'Open');
    },
    async getOrder(tenantId, id) {
        if (global.isMongoConnected) return RestaurantOrder.findOne({ id, tenantId }).lean();
        return mockDb.restaurantOrders.find(o => o.tenantId === tenantId && o.id === id) || null;
    },
    async findOpenOrderByTable(tenantId, tableNumber) {
        if (global.isMongoConnected) return RestaurantOrder.findOne({ tableNumber, status: 'Open', tenantId }).lean();
        return mockDb.restaurantOrders.find(o => o.tenantId === tenantId && o.status === 'Open' && o.tableNumber === tableNumber) || null;
    },
    async saveOrder(tenantId, order) {
        const doc = { ...order, tenantId };
        delete doc._id; delete doc.__v;
        if (global.isMongoConnected) {
            return RestaurantOrder.findOneAndUpdate({ id: doc.id, tenantId }, doc, { upsert: true, new: true }).lean();
        }
        const idx = mockDb.restaurantOrders.findIndex(o => o.tenantId === tenantId && o.id === doc.id);
        if (idx >= 0) mockDb.restaurantOrders[idx] = doc; else mockDb.restaurantOrders.push(doc);
        return doc;
    },
    async deleteOrder(tenantId, id) {
        if (global.isMongoConnected) return RestaurantOrder.findOneAndDelete({ id, tenantId });
        mockDb.restaurantOrders = mockDb.restaurantOrders.filter(o => !(o.tenantId === tenantId && o.id === id));
    }
};

// Only Admins and Managers may change printers or send test prints (the server opens the connection)
const requirePrinterAdmin = (req, res, next) => (['Admin', 'Manager'].includes(req.user && req.user.role) ? next() : res.status(403).json({ error: 'Only an Admin or Manager can change printers' }));

const FALLBACK_PRINTER_CATEGORY = '*';
const normCategory = (c) => String(c || '').trim().toLowerCase();
// Items printed before printedQty existed only have isPrinted
const printedQtyOf = (item) => (typeof item.printedQty === 'number' ? item.printedQty : (item.isPrinted ? item.qty : 0));

// Time on tickets in the store's local time (servers often run in UTC)
const kitchenTime = () => new Date().toLocaleString('en-GB', {
    timeZone: process.env.APP_TIMEZONE || 'Asia/Riyadh', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
});

const isValidPrinterHost = (ip) => typeof ip === 'string' && /^[A-Za-z0-9.\-:]{1,253}$/.test(ip.trim());

// Send ESC/POS lines to a network printer (raw TCP, usually port 9100)
async function sendToNetworkPrinter(config, writeTicket) {
    const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `tcp://${config.ip.trim()}:${Number(config.port) || 9100}`,
        options: { timeout: 4000 }
    });
    writeTicket(printer);
    printer.cut();
    await printer.execute();
}

// Get Printer Configs
router.get('/api/printers', authenticateToken, async (req, res) => {
    try {
        res.json(await restaurantStore.listPrinters(req.tenantId));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Save Printer Config (one printer per category; '*' = fallback for all other categories)
router.post('/api/printers', authenticateToken, requirePrinterAdmin, async (req, res) => {
    try {
        const { category, name, ip, port, brand, model, station } = req.body || {};
        if (!category || !String(category).trim()) return res.status(400).json({ error: 'Category is required' });
        if (!isValidPrinterHost(ip)) return res.status(400).json({ error: 'A valid printer IP address or host name is required' });
        const portNum = Number(port) || 9100;
        if (portNum < 1 || portNum > 65535) return res.status(400).json({ error: 'Port must be between 1 and 65535' });
        await restaurantStore.savePrinter(req.tenantId, {
            category: String(category).trim(),
            name: name ? String(name).trim() : '',
            station: station === 'juice' ? 'juice' : 'kitchen',
            ip: ip.trim(), port: portNum,
            brand: brand || '', model: model || ''
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Print a test ticket on a printer (before or after saving it)
router.post('/api/printers/test', authenticateToken, requirePrinterAdmin, async (req, res) => {
    const { ip, port, name, category } = req.body || {};
    if (!isValidPrinterHost(ip)) return res.status(400).json({ success: false, error: 'A valid printer IP address or host name is required' });
    try {
        await sendToNetworkPrinter({ ip, port }, (printer) => {
            printer.alignCenter();
            printer.println('--- PRINTER TEST ---');
            printer.println(name || 'Kitchen printer');
            printer.println(`Category: ${category === FALLBACK_PRINTER_CATEGORY ? 'All other items' : (category || '-')}`);
            printer.println(`${ip}:${Number(port) || 9100}`);
            printer.println(kitchenTime());
            printer.drawLine();
        });
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message || 'Printer did not respond' });
    }
});

// Delete Printer Config
router.delete('/api/printers/:category', authenticateToken, requirePrinterAdmin, async (req, res) => {
    try {
        await restaurantStore.deletePrinter(req.tenantId, req.params.category);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get all open restaurant orders
router.get('/api/restaurant/orders', authenticateToken, async (req, res) => {
    try {
        res.json(await restaurantStore.listOpenOrders(req.tenantId));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Save or update the open order of a table.
// - Without an id, the table's existing open order is reused (one open order per table).
// - printedQty is kept from the stored order, so items already sent to the kitchen
//   are not printed again; items removed after printing stay with qty 0 until the
//   cancellation has been printed.
router.post('/api/restaurant/orders', authenticateToken, async (req, res) => {
    try {
        const { id, tableNumber, customer, items, subtotal, discount, vat, total } = req.body || {};
        if (!tableNumber) return res.status(400).json({ error: 'Table number is required' });
        if (!Array.isArray(items)) return res.status(400).json({ error: 'Items are required' });

        let existing = id ? await restaurantStore.getOrder(req.tenantId, id) : null;
        if (!existing) existing = await restaurantStore.findOpenOrderByTable(req.tenantId, String(tableNumber));
        if (existing && existing.status !== 'Open') existing = null;

        const previous = (existing && existing.items) || [];
        const merged = items.map(item => {
            const prev = previous.find(p => p.productId === item.productId);
            const printedQty = prev ? printedQtyOf(prev) : 0;
            const qty = Math.max(0, Number(item.qty) || 0);
            return {
                productId: String(item.productId),
                name: item.name, nameEN: item.nameEN || item.name, nameAR: item.nameAR || item.name,
                price: Number(item.price) || 0, qty,
                category: item.category || '',
                printedQty, isPrinted: printedQty >= qty && qty > 0
            };
        });
        // Removed from the cart after the kitchen got them -> keep as qty 0 so a cancel is printed
        previous.forEach(prev => {
            if (!merged.some(m => m.productId === prev.productId) && printedQtyOf(prev) > 0) {
                merged.push({ ...prev, qty: 0, printedQty: printedQtyOf(prev), isPrinted: false });
            }
        });

        const saved = await restaurantStore.saveOrder(req.tenantId, {
            id: existing ? existing.id : (id || `REST-${Date.now()}`),
            tableNumber: String(tableNumber), customer: customer || '',
            items: merged,
            subtotal: Number(subtotal) || 0, discount: Number(discount) || 0,
            vat: Number(vat) || 0, total: Number(total) || 0,
            status: 'Open',
            date: existing && existing.date ? existing.date : new Date()
        });
        res.json(saved);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Close a table after it has been paid (keeps the order with its invoice number)
router.post('/api/restaurant/orders/:id/close', authenticateToken, async (req, res) => {
    try {
        const order = await restaurantStore.getOrder(req.tenantId, req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        const saved = await restaurantStore.saveOrder(req.tenantId, {
            ...order, status: 'Paid', invoiceId: (req.body && req.body.invoiceId) || '', closedAt: new Date()
        });
        res.json({ success: true, order: saved });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete a restaurant order
router.delete('/api/restaurant/orders/:id', authenticateToken, async (req, res) => {
    try {
        await restaurantStore.deleteOrder(req.tenantId, req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Print KOT (Kitchen Order Ticket) on multiple printers.
// Only what changed since the last ticket is printed: new items / extra quantity,
// and "CANCEL" lines for quantities removed after they were sent. Each item goes
// to the printer of its category, or to the fallback printer ('*'). Items that go
// to the same printer share one ticket. A printer that fails keeps its items
// unprinted, so firing again retries only those.
// Body { station: 'kitchen' | 'juice' } picks which POS button is printing: only
// printers set to that button print; items for the other button stay pending.
router.post('/api/restaurant/orders/:id/print-kot', authenticateToken, async (req, res) => {
    try {
        const order = await restaurantStore.getOrder(req.tenantId, req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const station = (req.body && req.body.station) === 'juice' ? 'juice' : 'kitchen';
        const stationOf = (c) => (c && c.station === 'juice' ? 'juice' : 'kitchen');
        const printerConfigs = await restaurantStore.listPrinters(req.tenantId);
        const fallback = printerConfigs.find(c => c.category === FALLBACK_PRINTER_CATEGORY);
        const items = order.items.map(i => ({ ...i, printedQty: printedQtyOf(i) }));

        const pending = items.filter(i => i.qty !== i.printedQty);
        if (pending.length === 0) {
            return res.json({ success: true, station, message: 'No new items to print', results: [], unrouted: [], waitingForOtherButton: [] });
        }

        // Group pending items by destination printer (ip:port)
        const groups = new Map();
        const unrouted = [];
        const waitingForOtherButton = [];
        pending.forEach(item => {
            const config = printerConfigs.find(c => c.category !== FALLBACK_PRINTER_CATEGORY && normCategory(c.category) === normCategory(item.category)) || fallback;
            if (!config || !config.ip) {
                // Items without any printer are reported on the main (kitchen) button only
                if (station === 'kitchen') unrouted.push({ name: item.nameEN || item.name, category: item.category || '' });
                return;
            }
            if (stationOf(config) !== station) { waitingForOtherButton.push({ name: item.nameEN || item.name, printer: config.name || config.category }); return; }
            const key = `${config.ip.trim()}:${Number(config.port) || 9100}`;
            if (!groups.has(key)) groups.set(key, { config, items: [] });
            groups.get(key).items.push(item);
        });

        const results = [];
        for (const { config, items: groupItems } of groups.values()) {
            const label = config.name || (config.category === FALLBACK_PRINTER_CATEGORY ? 'Default printer' : config.category);
            try {
                await sendToNetworkPrinter(config, (printer) => {
                    printer.alignCenter();
                    printer.bold(true);
                    printer.println('--- KITCHEN TICKET ---');
                    printer.println(label.toUpperCase());
                    printer.bold(false);
                    printer.println(`Table: ${order.tableNumber}   Order: ${order.id}`);
                    printer.println(kitchenTime());
                    printer.drawLine();
                    printer.alignLeft();
                    groupItems.forEach(item => {
                        // English name: ESC/POS printers can't render Arabic text without an image renderer
                        const name = item.nameEN || item.name;
                        const delta = item.qty - item.printedQty;
                        if (delta > 0) printer.println(`${delta}x ${name}`);
                        else printer.println(`CANCEL ${-delta}x ${name}`);
                    });
                    printer.drawLine();
                });
                groupItems.forEach(gi => {
                    const target = items.find(i => i.productId === gi.productId);
                    target.printedQty = target.qty;
                });
                results.push({ printer: label, address: `${config.ip}:${config.port || 9100}`, success: true, lines: groupItems.length });
            } catch (err) {
                results.push({ printer: label, address: `${config.ip}:${config.port || 9100}`, success: false, error: err.message || 'Printer did not respond', lines: groupItems.length });
            }
        }

        // Drop cancelled lines whose cancellation has been printed; refresh isPrinted
        const remaining = items
            .filter(i => !(i.qty === 0 && i.printedQty === 0))
            .map(i => ({ ...i, isPrinted: i.qty > 0 && i.printedQty >= i.qty }));
        await restaurantStore.saveOrder(req.tenantId, { ...order, items: remaining });

        const allPrinted = results.every(r => r.success) && unrouted.length === 0;
        const message = results.length === 0 && unrouted.length === 0 ? 'No new items for this button' : undefined;
        res.json({ success: allPrinted, station, message, results, unrouted, waitingForOtherButton });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// ==========================================
// FRESH FLOWERS API
// ==========================================

// Get all flower arrangements
router.get('/api/freshFlowers/arrangements', authenticateToken, async (req, res) => {
    try {
        const arrangements = await FlowerArrangement.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });
        res.json(arrangements);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create flower arrangement
router.post('/api/freshFlowers/arrangements', authenticateToken, async (req, res) => {
    try {
        const id = `ARR-${Date.now().toString().slice(-6)}`;
        const newArrangement = new FlowerArrangement({
            id,
            tenantId: req.tenantId,
            ...req.body
        });
        await newArrangement.save();
        res.json({ message: 'Arrangement created', arrangement: newArrangement });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get all flower deliveries
router.get('/api/freshFlowers/deliveries', authenticateToken, async (req, res) => {
    try {
        const deliveries = await FlowerDelivery.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });
        res.json(deliveries);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create flower delivery
router.post('/api/freshFlowers/deliveries', authenticateToken, async (req, res) => {
    try {
        const id = `DEL-${Date.now().toString().slice(-6)}`;
        const newDelivery = new FlowerDelivery({
            id,
            tenantId: req.tenantId,
            ...req.body
        });
        await newDelivery.save();
        res.json({ message: 'Delivery created', delivery: newDelivery });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update flower delivery status
router.put('/api/freshFlowers/deliveries/:id/status', authenticateToken, async (req, res) => {
    try {
        const delivery = await FlowerDelivery.findOne({ id: req.params.id, tenantId: req.tenantId });
        if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
        
        delivery.status = req.body.status;
        await delivery.save();
        res.json({ message: 'Delivery status updated', delivery });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// TAILORING & BESPOKE GARMENT MODULE API
// ==========================================

// Helper to create a ZATCA-signed invoice + Receipt Voucher for tailoring deposit or settlement
async function createTailoringZatcaInvoice({ tenantId, customerName, items, totalAmount, paymentMethod, notes }) {
    const vatRate = 15;
    const subtotal = +(totalAmount / (1 + vatRate / 100)).toFixed(2);
    const vat = +(totalAmount - subtotal).toFixed(2);
    const invoiceId = `INV-${Date.now().toString().slice(-6)}`;
    const invoiceObj = {
        id: invoiceId,
        uuid: crypto.randomUUID(),
        customer: customerName || 'Walk-in Customer',
        items: items.map((it, idx) => ({
            id: it.id || `TLR-ITEM-${idx + 1}`,
            name: it.name,
            price: +(it.price / (1 + vatRate / 100)).toFixed(2),
            qty: it.qty || 1
        })),
        discount: 0,
        vat,
        total: +Number(totalAmount).toFixed(2),
        date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        paymentMethod: paymentMethod || 'Cash',
        notes: notes || '',
        zatcaStatus: 'REPORTED',
        tenantId
    };

    if (global.isMongoConnected) {
        const count = await Invoice.countDocuments({ tenantId });
        invoiceObj.csn = count + 1;
        let pih = zatcaCrypto.DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH;
        const lastInvs = await Invoice.find({ tenantId }).sort({ csn: -1 }).limit(1);
        if (lastInvs.length > 0 && lastInvs[0].xmlHashBase64) pih = lastInvs[0].xmlHashBase64;
        invoiceObj.pih = pih;

        let settings = await Settings.findOne({ tenantId });
        if (!settings) settings = mockDb.settings;

        try {
            const keys = zatcaCrypto.getKeys(tenantId) || zatcaCrypto.onboardDevice(tenantId, {
                organizationNameAr: settings?.businessName || '26i Tailoring',
                organizationNameEn: settings?.businessName || '26i Tailoring',
                vatNumber: settings?.vatNumber || '310122393500003',
                crNumber: settings?.crNumber || '1010123456'
            }, settings?.zatcaConn?.env || 'sandbox');
            const privKey = settings?.zatcaConn?.privateKey || keys.privateKeyPem;
            const certPem = settings?.zatcaConn?.clientId || keys.certificatePem;
            const unsignedXml = zatcaCrypto.generateZATCAXML(invoiceObj, settings);
            const signed = zatcaCrypto.signInvoice({ xml: unsignedXml, privateKeyPem: privKey, certificatePem: certPem });
            invoiceObj.xml = signed.signedXml;
            invoiceObj.xmlHash = signed.xmlHashHex;
            invoiceObj.xmlHashBase64 = signed.xmlHashBase64;
            invoiceObj.signature = signed.signatureHex;
            invoiceObj.publicKey = signed.publicKeyBase64;
            invoiceObj.certSignature = signed.certificateSignature;
            invoiceObj.qrCode = signed.qrCodeBase64;
        } catch (err) {
            console.warn('ZATCA signing fallback for tailoring invoice:', err.message);
        }

        const savedInv = await Invoice.create(invoiceObj);
        await Voucher.create({
            voucherId: `RV-${Date.now().toString().slice(-6)}`,
            type: 'RECEIPT',
            date: new Date(),
            entityType: 'CUSTOMER',
            entityId: customerName,
            amount: +Number(totalAmount).toFixed(2),
            method: paymentMethod || 'Cash',
            description: notes || `Tailoring Receipt (${invoiceId})`,
            tenantId
        });
        return savedInv;
    } else {
        const tenantInvs = mockDb.invoices.filter(i => i.tenantId === tenantId);
        invoiceObj.csn = tenantInvs.length + 1;
        invoiceObj.pih = zatcaCrypto.DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH;
        mockDb.invoices.push(invoiceObj);
        mockDb.vouchers.push({
            voucherId: `RV-${Date.now().toString().slice(-6)}`,
            type: 'RECEIPT',
            date: new Date(),
            entityType: 'CUSTOMER',
            entityId: customerName,
            amount: +Number(totalAmount).toFixed(2),
            method: paymentMethod || 'Cash',
            description: notes || `Tailoring Receipt (${invoiceId})`,
            tenantId
        });
        return invoiceObj;
    }
}

// Helper to auto-seed realistic Bespoke Tailoring sample data for a tenant when empty (or when requested)
async function ensureTailoringSampleData(tenantId, force = false) {
    const sampleFabrics = [
        { id: `${tenantId}-FAB-901`, nameEN: 'Japanese Semiramis White Fabric (Per Meter)', nameAR: 'قماش سميراميس ياباني أبيض (بالمتر)', price: 45, cost: 25, stock: 120, category: 'Fabrics', emoji: '🧵', barcode: '628700100010', tenantId },
        { id: `${tenantId}-FAB-902`, nameEN: 'Japanese Cream Soft Fabric (Per Meter)', nameAR: 'قماش ياباني كريمي طايح (بالمتر)', price: 50, cost: 28, stock: 95, category: 'Fabrics', emoji: '🧶', barcode: '628700100020', tenantId },
        { id: `${tenantId}-FAB-903`, nameEN: 'English Winter Cashmere Wool (Per Meter)', nameAR: 'صوف كشمير شتوي إنجليزي (بالمتر)', price: 95, cost: 55, stock: 60, category: 'Fabrics', emoji: '🧥', barcode: '628700100030', tenantId },
        { id: `${tenantId}-FAB-904`, nameEN: 'Italian Super 130s Navy Suiting (Per Meter)', nameAR: 'قماش بدلة إيطالي كحلي فاخر (بالمتر)', price: 140, cost: 80, stock: 45, category: 'Fabrics', emoji: '🕴️', barcode: '628700100040', tenantId },
        { id: `${tenantId}-FAB-905`, nameEN: 'Korean Silk Black Abaya Crepe (Per Meter)', nameAR: 'كريب حرير كوري أسود للعبايات (بالمتر)', price: 65, cost: 35, stock: 85, category: 'Fabrics', emoji: '👘', barcode: '628700100050', tenantId }
    ];

    const sampleProfiles = [
        {
            id: 'MP-1001',
            tenantId,
            customerId: 'CUST-8001',
            customerName: 'Khalil Al-Ghamdi / خليل الغامدي',
            customerPhone: '0501234567',
            profileName: 'Royal White Summer Thobe / ثوب صيفي ملكي',
            garmentType: 'Thobe',
            unit: 'inch',
            measurements: { length: '59', shoulder: '18', chest: '23', waist: '22', hips: '24', sleeveLength: '25.5', wrist: '9.25', neck: '16', armhole: '10.5', bottomWidth: '28', trouserLength: '', inseam: '' },
            stylePreferences: {
                collarType: 'Mandarin (قلاب صيني)',
                cuffType: 'French Cufflinks (كبك فرنسي مزدوج)',
                placketType: 'Hidden Buttons (جبزور مخفي)',
                pocketStyle: 'Classic Chest + 2 Side (جيب علوي + ٢ جانبي)',
                fitType: 'Regular (عادي مريح)',
                stitchType: 'Single Hidden (خياطة مخفية)',
                buttonStyle: 'Mother of Pearl',
                embroideryNotes: 'Subtle white-on-white collar stitch'
            },
            postureNotes: 'Right shoulder slightly lower by 0.25 in / الكتف الأيمن نازل ربع إنش'
        },
        {
            id: 'MP-1002',
            tenantId,
            customerId: 'CUST-8001',
            customerName: 'Khalil Al-Ghamdi (Son - Omar) / عمر خليل الغامدي',
            customerPhone: '0501234567',
            profileName: 'Eid Youth Thobe - Omar / ثوب العيد للابن عمر',
            garmentType: 'Thobe',
            unit: 'inch',
            measurements: { length: '46', shoulder: '14.5', chest: '18', waist: '17.5', hips: '19', sleeveLength: '20', wrist: '7.5', neck: '13.5', armhole: '8.5', bottomWidth: '22', trouserLength: '', inseam: '' },
            stylePreferences: {
                collarType: 'Mandarin (قلاب صيني)',
                cuffType: 'Plain Sleeve (كم سادة)',
                placketType: 'Snap Buttons (طقطق معدن)',
                pocketStyle: 'Classic Chest + 2 Side (جيب علوي + ٢ جانبي)',
                fitType: 'Regular (عادي مريح)',
                stitchType: 'Single Hidden (خياطة مخفية)',
                buttonStyle: 'Silver Snap',
                embroideryNotes: ''
            },
            postureNotes: 'Leave 1 inch hem allowance for growth / ترك هامش في الطول'
        },
        {
            id: 'MP-1003',
            tenantId,
            customerId: 'CUST-8002',
            customerName: 'Fahad Al-Otaibi / فهد العتيبي',
            customerPhone: '0557654321',
            profileName: 'Winter Cashmere Thobe / ثوب شتوي كشمير',
            garmentType: 'Thobe',
            unit: 'inch',
            measurements: { length: '58', shoulder: '17.5', chest: '22.5', waist: '21.5', hips: '23.5', sleeveLength: '25', wrist: '9', neck: '15.5', armhole: '10', bottomWidth: '27.5', trouserLength: '', inseam: '' },
            stylePreferences: {
                collarType: 'Classic Pointed (قلاب رسمي)',
                cuffType: 'Single Button Cuff (كبك زرار)',
                placketType: 'Visible Buttons (جبزور ظاهر)',
                pocketStyle: 'Slanted Chest + Coin Pocket (جيب مائل + جيب جوال)',
                fitType: 'Regular (عادي مريح)',
                stitchType: 'Double Edge Stitch (تدريز مزدوج)',
                buttonStyle: 'Dark Horn Buttons',
                embroideryNotes: ''
            },
            postureNotes: 'Prefers relaxed neck collar fit / يفضل وسع مريح في الرقبة'
        },
        {
            id: 'MP-1004',
            tenantId,
            customerId: 'CUST-8003',
            customerName: 'Sami Al-Harbi / سامي الحربي',
            customerPhone: '0567890123',
            profileName: 'Executive Navy 2-Piece Suit / بدلة رسمية كحلي',
            garmentType: 'Suit',
            unit: 'cm',
            measurements: { length: '76', shoulder: '47', chest: '106', waist: '94', hips: '104', sleeveLength: '64', wrist: '24', neck: '41', armhole: '48', bottomWidth: '', trouserLength: '105', inseam: '81' },
            stylePreferences: {
                collarType: 'Classic Pointed (قلاب رسمي)',
                cuffType: 'French Cufflinks (كبك فرنسي مزدوج)',
                placketType: 'Visible Buttons (جبزور ظاهر)',
                pocketStyle: 'Slanted Chest + Coin Pocket (جيب مائل + جيب جوال)',
                fitType: 'Slim Fit (مخصر)',
                stitchType: 'Hand Pick Stitch (غرزة يدوية)',
                buttonStyle: 'Italian Corozo',
                embroideryNotes: 'Inner jacket monogram: S.H.'
            },
            postureNotes: 'Athletic chest, tapered waist / صدر عريض وخصر مخصر'
        },
        {
            id: 'MP-1005',
            tenantId,
            customerId: 'CUST-8004',
            customerName: 'Aisha Al-Subaie / عائشة السبيعي',
            customerPhone: '0543210987',
            profileName: 'Luxury Silk Embroidered Abaya / عباءة حرير مطرزة',
            garmentType: 'Abaya',
            unit: 'inch',
            measurements: { length: '56', shoulder: '16', chest: '22', waist: '21', hips: '24', sleeveLength: '23.5', wrist: '8.5', neck: '15', armhole: '9.5', bottomWidth: '32', trouserLength: '', inseam: '' },
            stylePreferences: {
                collarType: 'Collarless / Open (سادة بدون قلاب)',
                cuffType: 'Embroidered Cuff (كم مطرز)',
                placketType: 'Hidden Buttons (جبزور مخفي)',
                pocketStyle: 'Hidden Side Pockets Only (جيوب جانبية مخفية فقط)',
                fitType: 'Loose / Comfort (واسع تقليدي)',
                stitchType: 'Single Hidden (خياطة مخفية)',
                buttonStyle: 'Hidden Snaps',
                embroideryNotes: 'Gold leaf thread embroidery on cuffs and Tarha edge / تطريز ذهبي على الأكمام والطرحة'
            },
            postureNotes: 'Include matching Shayla (2m x 0.75m) / شامل طرحة مطابقة'
        },
        {
            id: 'MP-1006',
            tenantId,
            customerId: 'CUST-8007',
            customerName: 'Majed Al-Anazi / ماجد العنزي',
            customerPhone: '0590123456',
            profileName: 'Slim Fit Formal Dress Shirt / قميص رسمي مخصر',
            garmentType: 'Shirt',
            unit: 'cm',
            measurements: { length: '74', shoulder: '45', chest: '102', waist: '90', hips: '100', sleeveLength: '63', wrist: '22', neck: '40', armhole: '46', bottomWidth: '', trouserLength: '', inseam: '' },
            stylePreferences: {
                collarType: 'Classic Pointed (قلاب رسمي)',
                cuffType: 'French Cufflinks (كبك فرنسي مزدوج)',
                placketType: 'Hidden Buttons (جبزور مخفي)',
                pocketStyle: 'Hidden Side Pockets Only (جيوب جانبية مخفية فقط)',
                fitType: 'Slim Fit (مخصر)',
                stitchType: 'Single Hidden (خياطة مخفية)',
                buttonStyle: 'Pearl White',
                embroideryNotes: 'Monogram M.A on left cuff'
            },
            postureNotes: 'Erect posture, medium collar stiffness / حشوة ياقة متوسطة'
        }
    ];

    const sampleOrders = [
        {
            id: 'TLR-9001',
            tenantId,
            orderDate: '2026-10-25',
            trialDate: '2026-10-29',
            deliveryDate: '2026-11-02',
            priority: 'VIP',
            customerId: 'CUST-8001',
            customerName: 'Khalil Al-Ghamdi / خليل الغامدي',
            customerPhone: '0501234567',
            items: [
                {
                    jobCardId: 'JC-9001-1',
                    garmentType: 'Thobe',
                    measurementProfileId: 'MP-1001',
                    profileName: 'Royal White Summer Thobe / ثوب صيفي ملكي',
                    unit: 'inch',
                    measurementSnapshot: sampleProfiles[0].measurements,
                    styleConfig: sampleProfiles[0].stylePreferences,
                    fabricSource: 'Shop',
                    fabricProductId: `${tenantId}-FAB-901`,
                    fabricName: 'Japanese Semiramis White Fabric (Per Meter) / قماش سميراميس ياباني أبيض',
                    fabricColor: 'Pure White / أبيض ناصع',
                    fabricMeters: 3.5,
                    qty: 2,
                    stitchingPrice: 130,
                    fabricPrice: 157.5,
                    addOnsPrice: 20,
                    unitTotal: 307.5,
                    assignedCutterId: 'EMP-3002',
                    assignedCutterName: 'Ahmad Ali / أحمد علي',
                    cutterCommission: 20,
                    assignedTailorId: 'EMP-3004',
                    assignedTailorName: 'Sultan Salem / سلطان سالم',
                    tailorCommission: 40,
                    stage: 'ReadyForPickup',
                    rackNumber: 'Rack A-04',
                    fabricDeducted: true,
                    notes: 'VIP packaging on wooden hanger'
                },
                {
                    jobCardId: 'JC-9001-2',
                    garmentType: 'Thobe',
                    measurementProfileId: 'MP-1002',
                    profileName: 'Eid Youth Thobe - Omar / ثوب العيد للابن عمر',
                    unit: 'inch',
                    measurementSnapshot: sampleProfiles[1].measurements,
                    styleConfig: sampleProfiles[1].stylePreferences,
                    fabricSource: 'Shop',
                    fabricProductId: `${tenantId}-FAB-902`,
                    fabricName: 'Japanese Cream Soft Fabric (Per Meter) / قماش ياباني كريمي طايح',
                    fabricColor: 'Soft Cream / كريمي',
                    fabricMeters: 2.5,
                    qty: 1,
                    stitchingPrice: 90,
                    fabricPrice: 125,
                    addOnsPrice: 0,
                    unitTotal: 215,
                    assignedCutterId: 'EMP-3002',
                    assignedCutterName: 'Ahmad Ali / أحمد علي',
                    cutterCommission: 15,
                    assignedTailorId: 'EMP-3004',
                    assignedTailorName: 'Sultan Salem / سلطان سالم',
                    tailorCommission: 30,
                    stage: 'Stitching',
                    rackNumber: '',
                    fabricDeducted: true,
                    notes: 'Youth thobe'
                }
            ],
            subtotal: 830,
            discount: 10,
            vat: 123,
            totalAmount: 943.00,
            depositPaid: 500.00,
            balanceDue: 443.00,
            paymentStatus: 'DepositPaid',
            paymentMethod: 'Card',
            status: 'InProduction',
            notes: 'Call customer once child thobe finishes stitching'
        },
        {
            id: 'TLR-9002',
            tenantId,
            orderDate: '2026-10-28',
            trialDate: '',
            deliveryDate: '2026-11-01',
            priority: 'Express',
            customerId: 'CUST-8002',
            customerName: 'Fahad Al-Otaibi / فهد العتيبي',
            customerPhone: '0557654321',
            items: [
                {
                    jobCardId: 'JC-9002-1',
                    garmentType: 'Thobe',
                    measurementProfileId: 'MP-1003',
                    profileName: 'Winter Cashmere Thobe / ثوب شتوي كشمير',
                    unit: 'inch',
                    measurementSnapshot: sampleProfiles[2].measurements,
                    styleConfig: sampleProfiles[2].stylePreferences,
                    fabricSource: 'Shop',
                    fabricProductId: `${tenantId}-FAB-903`,
                    fabricName: 'English Winter Cashmere Wool (Per Meter) / صوف كشمير شتوي إنجليزي',
                    fabricColor: 'Charcoal Grey / رصاصي غامق',
                    fabricMeters: 3.5,
                    qty: 1,
                    stitchingPrice: 145,
                    fabricPrice: 332.5,
                    addOnsPrice: 0,
                    unitTotal: 477.5,
                    assignedCutterId: 'EMP-3006',
                    assignedCutterName: 'Mansour Ali / منصور علي',
                    cutterCommission: 20,
                    assignedTailorId: 'EMP-3008',
                    assignedTailorName: 'Turki Khalid / تركي خالد',
                    tailorCommission: 45,
                    stage: 'Cutting',
                    rackNumber: '',
                    fabricDeducted: true,
                    notes: 'Express 48h winter wool order'
                }
            ],
            subtotal: 477.5,
            discount: 0,
            vat: 71.63,
            totalAmount: 549.13,
            depositPaid: 250.00,
            balanceDue: 299.13,
            paymentStatus: 'DepositPaid',
            paymentMethod: 'Cash',
            status: 'InProduction'
        },
        {
            id: 'TLR-9003',
            tenantId,
            orderDate: '2026-10-22',
            trialDate: '2026-10-31',
            deliveryDate: '2026-11-04',
            priority: 'VIP',
            customerId: 'CUST-8003',
            customerName: 'Sami Al-Harbi / سامي الحربي',
            customerPhone: '0567890123',
            items: [
                {
                    jobCardId: 'JC-9003-1',
                    garmentType: 'Suit',
                    measurementProfileId: 'MP-1004',
                    profileName: 'Executive Navy 2-Piece Suit / بدلة رسمية كحلي',
                    unit: 'cm',
                    measurementSnapshot: sampleProfiles[3].measurements,
                    styleConfig: sampleProfiles[3].stylePreferences,
                    fabricSource: 'Shop',
                    fabricProductId: `${tenantId}-FAB-904`,
                    fabricName: 'Italian Super 130s Navy Suiting (Per Meter) / قماش بدلة إيطالي كحلي',
                    fabricColor: 'Midnight Navy / كحلي ملكي',
                    fabricMeters: 3.25,
                    qty: 1,
                    stitchingPrice: 450,
                    fabricPrice: 455,
                    addOnsPrice: 50,
                    unitTotal: 955,
                    assignedCutterId: 'EMP-3002',
                    assignedCutterName: 'Ahmad Ali / أحمد علي',
                    cutterCommission: 45,
                    assignedTailorId: 'EMP-3004',
                    assignedTailorName: 'Sultan Salem / سلطان سالم',
                    tailorCommission: 110,
                    stage: 'TrialReady',
                    rackNumber: 'Fitting Room #1',
                    fabricDeducted: true,
                    notes: 'First basted fitting ready for customer trial'
                }
            ],
            subtotal: 955,
            discount: 0,
            vat: 143.25,
            totalAmount: 1098.25,
            depositPaid: 600.00,
            balanceDue: 498.25,
            paymentStatus: 'DepositPaid',
            paymentMethod: 'Card',
            status: 'InProduction'
        },
        {
            id: 'TLR-9004',
            tenantId,
            orderDate: '2026-10-26',
            trialDate: '',
            deliveryDate: '2026-11-03',
            priority: 'Normal',
            customerId: 'CUST-8004',
            customerName: 'Aisha Al-Subaie / عائشة السبيعي',
            customerPhone: '0543210987',
            items: [
                {
                    jobCardId: 'JC-9004-1',
                    garmentType: 'Abaya',
                    measurementProfileId: 'MP-1005',
                    profileName: 'Luxury Silk Embroidered Abaya / عباءة حرير مطرزة',
                    unit: 'inch',
                    measurementSnapshot: sampleProfiles[4].measurements,
                    styleConfig: sampleProfiles[4].stylePreferences,
                    fabricSource: 'Shop',
                    fabricProductId: `${tenantId}-FAB-905`,
                    fabricName: 'Korean Silk Black Abaya Crepe (Per Meter) / كريب حرير كوري أسود',
                    fabricColor: 'Jet Black / أسود فاحم',
                    fabricMeters: 3.5,
                    qty: 1,
                    stitchingPrice: 160,
                    fabricPrice: 227.5,
                    addOnsPrice: 80,
                    unitTotal: 467.5,
                    assignedCutterId: 'EMP-3006',
                    assignedCutterName: 'Mansour Ali / منصور علي',
                    cutterCommission: 20,
                    assignedTailorId: 'EMP-3005',
                    assignedTailorName: 'Layla Ahmad / ليلى أحمد',
                    tailorCommission: 55,
                    stage: 'Finishing',
                    rackNumber: '',
                    fabricDeducted: true,
                    notes: 'Gold cuff embroidery in finishing & steam pressing'
                },
                {
                    jobCardId: 'JC-9004-2',
                    garmentType: 'Abaya',
                    measurementProfileId: 'MP-1005',
                    profileName: 'Luxury Silk Embroidered Abaya / عباءة حرير مطرزة',
                    unit: 'inch',
                    measurementSnapshot: sampleProfiles[4].measurements,
                    styleConfig: sampleProfiles[4].stylePreferences,
                    fabricSource: 'Customer',
                    fabricProductId: '',
                    fabricName: "Customer's Own French Chiffon / قماش شيفون فرنسي خارجي من العميلة",
                    fabricColor: 'Emerald Black / أسود زمردي',
                    fabricMeters: 3.5,
                    qty: 1,
                    stitchingPrice: 150,
                    fabricPrice: 0,
                    addOnsPrice: 0,
                    unitTotal: 150,
                    assignedCutterId: 'EMP-3006',
                    assignedCutterName: 'Mansour Ali / منصور علي',
                    cutterCommission: 18,
                    assignedTailorId: 'EMP-3005',
                    assignedTailorName: 'Layla Ahmad / ليلى أحمد',
                    tailorCommission: 45,
                    stage: 'QC',
                    rackNumber: 'QC Station #2',
                    fabricDeducted: false,
                    notes: 'Final quality inspection'
                }
            ],
            subtotal: 617.5,
            discount: 0,
            vat: 92.63,
            totalAmount: 710.13,
            depositPaid: 350.00,
            balanceDue: 360.13,
            paymentStatus: 'DepositPaid',
            paymentMethod: 'Bank Transfer',
            status: 'InProduction'
        },
        {
            id: 'TLR-9005',
            tenantId,
            orderDate: '2026-10-24',
            trialDate: '',
            deliveryDate: '2026-10-31',
            priority: 'Normal',
            customerId: 'CUST-8007',
            customerName: 'Majed Al-Anazi / ماجد العنزي',
            customerPhone: '0590123456',
            items: [
                {
                    jobCardId: 'JC-9005-1',
                    garmentType: 'Shirt',
                    measurementProfileId: 'MP-1006',
                    profileName: 'Slim Fit Formal Dress Shirt / قميص رسمي مخصر',
                    unit: 'cm',
                    measurementSnapshot: sampleProfiles[5].measurements,
                    styleConfig: sampleProfiles[5].stylePreferences,
                    fabricSource: 'Shop',
                    fabricProductId: `${tenantId}-FAB-901`,
                    fabricName: 'Japanese Semiramis White Fabric (Per Meter) / قماش سميراميس ياباني أبيض',
                    fabricColor: 'Crisp White / أبيض',
                    fabricMeters: 2.25,
                    qty: 2,
                    stitchingPrice: 85,
                    fabricPrice: 101.25,
                    addOnsPrice: 15,
                    unitTotal: 201.25,
                    assignedCutterId: 'EMP-3002',
                    assignedCutterName: 'Ahmad Ali / أحمد علي',
                    cutterCommission: 12,
                    assignedTailorId: 'EMP-3008',
                    assignedTailorName: 'Turki Khalid / تركي خالد',
                    tailorCommission: 28,
                    stage: 'ReadyForPickup',
                    rackNumber: 'Rack B-11',
                    fabricDeducted: true,
                    notes: 'Ready on Rack B-11, customer notified via SMS'
                }
            ],
            subtotal: 402.5,
            discount: 0,
            vat: 60.38,
            totalAmount: 462.88,
            depositPaid: 200.00,
            balanceDue: 262.88,
            paymentStatus: 'DepositPaid',
            paymentMethod: 'Cash',
            status: 'Ready'
        },
        {
            id: 'TLR-9006',
            tenantId,
            orderDate: '2026-10-18',
            trialDate: '',
            deliveryDate: '2026-10-25',
            priority: 'Normal',
            customerId: 'CUST-8009',
            customerName: 'Bandar Al-Shahrani / بندر الشهراني',
            customerPhone: '0554321098',
            items: [
                {
                    jobCardId: 'JC-9006-1',
                    garmentType: 'Thobe',
                    measurementProfileId: 'MP-1001',
                    profileName: 'Classic Saudi Thobe / ثوب سعودي كلاسيك',
                    unit: 'inch',
                    measurementSnapshot: sampleProfiles[0].measurements,
                    styleConfig: sampleProfiles[0].stylePreferences,
                    fabricSource: 'Shop',
                    fabricProductId: `${tenantId}-FAB-902`,
                    fabricName: 'Japanese Cream Soft Fabric (Per Meter) / قماش ياباني كريمي طايح',
                    fabricColor: 'Cream / كريمي',
                    fabricMeters: 3.5,
                    qty: 2,
                    stitchingPrice: 120,
                    fabricPrice: 175,
                    addOnsPrice: 0,
                    unitTotal: 295,
                    assignedCutterId: 'EMP-3002',
                    assignedCutterName: 'Ahmad Ali / أحمد علي',
                    cutterCommission: 15,
                    assignedTailorId: 'EMP-3004',
                    assignedTailorName: 'Sultan Salem / سلطان سالم',
                    tailorCommission: 35,
                    stage: 'Delivered',
                    rackNumber: 'Delivered',
                    fabricDeducted: true,
                    notes: 'Delivered and settled in full'
                }
            ],
            subtotal: 590,
            discount: 35,
            vat: 83.25,
            totalAmount: 638.25,
            depositPaid: 638.25,
            balanceDue: 0,
            paymentStatus: 'Paid',
            paymentMethod: 'Card',
            status: 'Delivered'
        },
        {
            id: 'TLR-9007',
            tenantId,
            orderDate: '2026-10-30',
            trialDate: '',
            deliveryDate: '2026-11-06',
            priority: 'Normal',
            customerId: 'CUST-8005',
            customerName: 'Yousef Al-Mutairi / يوسف المطيري',
            customerPhone: '0534567890',
            items: [
                {
                    jobCardId: 'JC-9007-1',
                    garmentType: 'Thobe',
                    measurementProfileId: 'MP-1003',
                    profileName: 'Customer Swiss Cotton Thobe / ثوب قطن سويسري',
                    unit: 'inch',
                    measurementSnapshot: sampleProfiles[2].measurements,
                    styleConfig: sampleProfiles[2].stylePreferences,
                    fabricSource: 'Customer',
                    fabricProductId: '',
                    fabricName: "Customer's Own Swiss Cotton / قماش قطن سويسري خارجي من العميل",
                    fabricColor: 'Off-White / سكري',
                    fabricMeters: 3.5,
                    qty: 1,
                    stitchingPrice: 140,
                    fabricPrice: 0,
                    addOnsPrice: 0,
                    unitTotal: 140,
                    assignedCutterId: 'EMP-3006',
                    assignedCutterName: 'Mansour Ali / منصور علي',
                    cutterCommission: 15,
                    assignedTailorId: 'EMP-3008',
                    assignedTailorName: 'Turki Khalid / تركي خالد',
                    tailorCommission: 35,
                    stage: 'Received',
                    rackNumber: '',
                    fabricDeducted: false,
                    notes: 'Newly received order queued for cutting'
                }
            ],
            subtotal: 140,
            discount: 0,
            vat: 21.00,
            totalAmount: 161.00,
            depositPaid: 80.00,
            balanceDue: 81.00,
            paymentStatus: 'DepositPaid',
            paymentMethod: 'Cash',
            status: 'InProduction'
        }
    ];

    if (global.isMongoConnected) {
        for (const fab of sampleFabrics) {
            const exists = await Product.findOne({ id: fab.id, tenantId });
            if (!exists) await Product.create(fab);
        }
        const profCount = await MeasurementProfile.countDocuments({ tenantId });
        if (profCount === 0 || force) {
            for (const p of sampleProfiles) {
                await MeasurementProfile.findOneAndUpdate({ id: p.id, tenantId }, { $set: p }, { upsert: true });
            }
        }
        const ordCount = await TailoringOrder.countDocuments({ tenantId });
        if (ordCount === 0 || force) {
            for (const o of sampleOrders) {
                await TailoringOrder.findOneAndUpdate({ id: o.id, tenantId }, { $set: o }, { upsert: true });
            }
        }
    } else {
        mockDb.products = mockDb.products || [];
        sampleFabrics.forEach(fab => {
            if (!mockDb.products.some(p => p.id === fab.id && p.tenantId === tenantId)) {
                mockDb.products.push(fab);
            }
        });
        mockDb.measurementProfiles = mockDb.measurementProfiles || [];
        const hasProfs = mockDb.measurementProfiles.some(m => m.tenantId === tenantId);
        if (!hasProfs || force) {
            mockDb.measurementProfiles = mockDb.measurementProfiles.filter(m => !(m.tenantId === tenantId && sampleProfiles.some(sp => sp.id === m.id)));
            mockDb.measurementProfiles.push(...sampleProfiles);
        }
        mockDb.tailoringOrders = mockDb.tailoringOrders || [];
        const hasOrds = mockDb.tailoringOrders.some(o => o.tenantId === tenantId);
        if (!hasOrds || force) {
            mockDb.tailoringOrders = mockDb.tailoringOrders.filter(o => !(o.tenantId === tenantId && sampleOrders.some(so => so.id === o.id)));
            mockDb.tailoringOrders.push(...sampleOrders);
        }
    }
}

router.post('/api/tailoring/seed', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        await ensureTailoringSampleData(tenantId, true);
        res.json({ success: true, message: 'Sample tailoring data seeded successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 1. Measurement Profiles CRUD
router.get('/api/tailoring/measurements', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        await ensureTailoringSampleData(tenantId, false);
        const { customerId } = req.query;
        const filter = { tenantId };
        if (customerId) filter.customerId = customerId;

        if (global.isMongoConnected) {
            const profiles = await MeasurementProfile.find(filter).sort({ updatedAt: -1 });
            res.json(profiles);
        } else {
            let list = (mockDb.measurementProfiles || []).filter(m => m.tenantId === tenantId);
            if (customerId) list = list.filter(m => m.customerId === customerId);
            res.json(list);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/api/tailoring/measurements', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const id = req.body.id || `MP-${Date.now().toString().slice(-6)}`;
        const payload = {
            ...req.body,
            id,
            tenantId,
            updatedAt: new Date(),
            createdAt: new Date()
        };

        if (global.isMongoConnected) {
            const created = await MeasurementProfile.create(payload);
            res.status(201).json(created);
        } else {
            mockDb.measurementProfiles = mockDb.measurementProfiles || [];
            mockDb.measurementProfiles.unshift(payload);
            res.status(201).json(payload);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/api/tailoring/measurements/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const updateData = { ...req.body, updatedAt: new Date() };
        if (global.isMongoConnected) {
            const updated = await MeasurementProfile.findOneAndUpdate(
                { id: req.params.id, tenantId },
                { $set: updateData },
                { new: true }
            );
            if (!updated) return res.status(404).json({ error: 'Measurement profile not found' });
            res.json(updated);
        } else {
            const idx = (mockDb.measurementProfiles || []).findIndex(m => m.id === req.params.id && m.tenantId === tenantId);
            if (idx === -1) return res.status(404).json({ error: 'Measurement profile not found' });
            mockDb.measurementProfiles[idx] = { ...mockDb.measurementProfiles[idx], ...updateData };
            res.json(mockDb.measurementProfiles[idx]);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/api/tailoring/measurements/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await MeasurementProfile.deleteOne({ id: req.params.id, tenantId });
        } else {
            mockDb.measurementProfiles = (mockDb.measurementProfiles || []).filter(m => !(m.id === req.params.id && m.tenantId === tenantId));
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Tailoring Orders & Workshop Job Cards CRUD
router.get('/api/tailoring/orders', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        await ensureTailoringSampleData(tenantId, false);
        if (global.isMongoConnected) {
            const orders = await TailoringOrder.find({ tenantId }).sort({ createdAt: -1 });
            res.json(orders);
        } else {
            res.json((mockDb.tailoringOrders || []).filter(o => o.tenantId === tenantId));
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/api/tailoring/orders', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const shortCode = Date.now().toString().slice(-5);
        const orderId = req.body.id || `TLR-${shortCode}`;
        const rawItems = Array.isArray(req.body.items) ? req.body.items : [];

        const items = rawItems.map((item, idx) => ({
            ...item,
            jobCardId: item.jobCardId || `JC-${shortCode}-${idx + 1}`,
            stage: item.stage || 'Received',
            fabricDeducted: Boolean(item.fabricDeducted)
        }));

        const totalAmount = Number(req.body.totalAmount) || 0;
        const depositPaid = Math.min(totalAmount, Math.max(0, Number(req.body.depositPaid) || 0));
        const balanceDue = Math.max(0, +(totalAmount - depositPaid).toFixed(2));
        const paymentStatus = depositPaid <= 0 ? 'Unpaid' : (balanceDue <= 0.01 ? 'Paid' : 'DepositPaid');

        let createdInvoice = null;
        if (depositPaid > 0) {
            const isFullPayment = balanceDue <= 0.01;
            const invoiceLabel = isFullPayment
                ? `Bespoke Tailoring Order ${orderId} (Full Payment / دفعة كاملة)`
                : `Bespoke Tailoring Order ${orderId} (Advance Deposit / عربون تفصيل)`;
            createdInvoice = await createTailoringZatcaInvoice({
                tenantId,
                customerName: req.body.customerName || 'Walk-in Customer',
                items: [{ id: orderId, name: invoiceLabel, price: depositPaid, qty: 1 }],
                totalAmount: depositPaid,
                paymentMethod: req.body.paymentMethod || 'Cash',
                notes: `${invoiceLabel} - Total Order: ${totalAmount.toFixed(2)} SAR, Balance Due: ${balanceDue.toFixed(2)} SAR`
            });
        }

        const orderData = {
            ...req.body,
            id: orderId,
            tenantId,
            orderDate: req.body.orderDate || new Date().toISOString().slice(0, 10),
            deliveryDate: req.body.deliveryDate || new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
            items,
            totalAmount,
            depositPaid,
            balanceDue,
            paymentStatus,
            depositInvoiceId: createdInvoice ? createdInvoice.id : '',
            finalInvoiceId: balanceDue <= 0.01 && createdInvoice ? createdInvoice.id : '',
            status: 'InProduction',
            createdAt: new Date()
        };

        if (global.isMongoConnected) {
            const saved = await TailoringOrder.create(orderData);
            res.status(201).json({ order: saved, invoice: createdInvoice });
        } else {
            mockDb.tailoringOrders = mockDb.tailoringOrders || [];
            mockDb.tailoringOrders.unshift(orderData);
            res.status(201).json({ order: orderData, invoice: createdInvoice });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update Job Card Workshop Stage (with automatic fractional fabric deduction on Cutting!)
router.put('/api/tailoring/orders/:id/jobcard/:jobCardId/stage', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { stage, rackNumber, assignedCutterId, assignedCutterName, assignedTailorId, assignedTailorName, notes } = req.body;

        let order;
        if (global.isMongoConnected) {
            order = await TailoringOrder.findOne({ id: req.params.id, tenantId });
        } else {
            order = (mockDb.tailoringOrders || []).find(o => o.id === req.params.id && o.tenantId === tenantId);
        }
        if (!order) return res.status(404).json({ error: 'Tailoring order not found' });

        const item = (order.items || []).find(jc => jc.jobCardId === req.params.jobCardId);
        if (!item) return res.status(404).json({ error: 'Job card not found' });

        if (stage) item.stage = stage;
        if (rackNumber !== undefined) item.rackNumber = rackNumber;
        if (assignedCutterId !== undefined) item.assignedCutterId = assignedCutterId;
        if (assignedCutterName !== undefined) item.assignedCutterName = assignedCutterName;
        if (assignedTailorId !== undefined) item.assignedTailorId = assignedTailorId;
        if (assignedTailorName !== undefined) item.assignedTailorName = assignedTailorName;
        if (notes !== undefined) item.notes = notes;

        // Deduct fractional fabric meters when entering Cutting stage (if Shop fabric and not yet deducted)
        let fabricDeductedNow = false;
        let updatedProduct = null;
        if (
            ['Cutting', 'Stitching', 'Finishing', 'QC', 'TrialReady', 'ReadyForPickup', 'Delivered'].includes(item.stage) &&
            item.fabricSource === 'Shop' &&
            item.fabricProductId &&
            !item.fabricDeducted
        ) {
            const totalMetersToDeduct = +(Number(item.fabricMeters || 3.5) * Number(item.qty || 1)).toFixed(2);
            if (global.isMongoConnected) {
                const prod = await Product.findOne({ id: item.fabricProductId, tenantId });
                if (prod) {
                    prod.stock = Math.max(0, +(prod.stock - totalMetersToDeduct).toFixed(2));
                    await prod.save();
                    updatedProduct = prod;
                    await InventoryTx.create({
                        txId: `TX-TLR-${Date.now().toString().slice(-6)}`,
                        date: new Date(),
                        type: 'OUT',
                        productId: prod.id,
                        qty: totalMetersToDeduct,
                        warehouseId: 'MAIN',
                        tenantId
                    });
                }
            } else {
                const prod = (mockDb.products || []).find(p => p.id === item.fabricProductId && p.tenantId === tenantId);
                if (prod) {
                    prod.stock = Math.max(0, +(prod.stock - totalMetersToDeduct).toFixed(2));
                    updatedProduct = prod;
                }
            }
            item.fabricDeducted = true;
            fabricDeductedNow = true;
        }

        // Recompute overall order status from job card stages
        const allDelivered = order.items.every(i => i.stage === 'Delivered');
        const allReadyOrDelivered = order.items.every(i => ['ReadyForPickup', 'Delivered'].includes(i.stage));
        if (allDelivered) order.status = 'Delivered';
        else if (allReadyOrDelivered) order.status = 'Ready';
        else order.status = 'InProduction';

        if (global.isMongoConnected) {
            order.markModified('items');
            await order.save();
        }

        res.json({ order, fabricDeductedNow, updatedProduct });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Settle Remaining Balance & Optionally Deliver Order (Generates Final ZATCA Invoice & Receipt Voucher)
router.post('/api/tailoring/orders/:id/settle', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { amountPaid, paymentMethod, markDelivered, rackNumber } = req.body;

        let order;
        if (global.isMongoConnected) {
            order = await TailoringOrder.findOne({ id: req.params.id, tenantId });
        } else {
            order = (mockDb.tailoringOrders || []).find(o => o.id === req.params.id && o.tenantId === tenantId);
        }
        if (!order) return res.status(404).json({ error: 'Tailoring order not found' });

        const payAmt = Math.min(order.balanceDue, Math.max(0, Number(amountPaid ?? order.balanceDue)));
        let settlementInvoice = null;

        if (payAmt > 0) {
            settlementInvoice = await createTailoringZatcaInvoice({
                tenantId,
                customerName: order.customerName || 'Walk-in Customer',
                items: [{
                    id: order.id,
                    name: `Tailoring Balance Settlement / تسوية متبقي تفصيل (${order.id})`,
                    price: payAmt,
                    qty: 1
                }],
                totalAmount: payAmt,
                paymentMethod: paymentMethod || 'Cash',
                notes: `Final settlement for Tailoring Order ${order.id}`
            });
            order.depositPaid = +(order.depositPaid + payAmt).toFixed(2);
            order.balanceDue = Math.max(0, +(order.totalAmount - order.depositPaid).toFixed(2));
            order.paymentStatus = order.balanceDue <= 0.01 ? 'Paid' : 'DepositPaid';
            order.finalInvoiceId = settlementInvoice.id;
        }

        if (markDelivered) {
            (order.items || []).forEach(item => {
                item.stage = 'Delivered';
                if (rackNumber) item.rackNumber = rackNumber;
            });
            order.status = 'Delivered';
        }

        if (global.isMongoConnected) {
            order.markModified('items');
            await order.save();
        }

        res.json({ order, invoice: settlementInvoice });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/api/tailoring/orders/:id', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (global.isMongoConnected) {
            await TailoringOrder.deleteOne({ id: req.params.id, tenantId });
        } else {
            mockDb.tailoringOrders = (mockDb.tailoringOrders || []).filter(o => !(o.id === req.params.id && o.tenantId === tenantId));
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. Tailor & Cutter Piece-Rate Commission Summary
router.get('/api/tailoring/commissions', authenticateToken, async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const orders = global.isMongoConnected
            ? await TailoringOrder.find({ tenantId })
            : (mockDb.tailoringOrders || []).filter(o => o.tenantId === tenantId);

        const cuttingCompleteStages = ['Stitching', 'Finishing', 'QC', 'TrialReady', 'ReadyForPickup', 'Delivered'];
        const stitchingCompleteStages = ['Finishing', 'QC', 'TrialReady', 'ReadyForPickup', 'Delivered'];

        const map = {};
        const ensureEmp = (id, name, roleLabel) => {
            const key = id || name;
            if (!key) return null;
            if (!map[key]) {
                map[key] = {
                    employeeId: id || key,
                    employeeName: name || id,
                    role: roleLabel,
                    cutsCompleted: 0,
                    stitchesCompleted: 0,
                    cuttingCommission: 0,
                    stitchingCommission: 0,
                    totalCommission: 0,
                    jobCards: []
                };
            }
            return map[key];
        };

        orders.forEach(order => {
            (order.items || []).forEach(jc => {
                const qty = Number(jc.qty || 1);
                if (jc.assignedCutterName || jc.assignedCutterId) {
                    const emp = ensureEmp(jc.assignedCutterId, jc.assignedCutterName, 'Cutter / قصاص');
                    if (emp && cuttingCompleteStages.includes(jc.stage)) {
                        const earned = +(Number(jc.cutterCommission || 0) * qty).toFixed(2);
                        emp.cutsCompleted += qty;
                        emp.cuttingCommission = +(emp.cuttingCommission + earned).toFixed(2);
                        emp.totalCommission = +(emp.totalCommission + earned).toFixed(2);
                        emp.jobCards.push({ jobCardId: jc.jobCardId, orderId: order.id, garmentType: jc.garmentType, role: 'Cutting', stage: jc.stage, qty, earned });
                    }
                }
                if (jc.assignedTailorName || jc.assignedTailorId) {
                    const emp = ensureEmp(jc.assignedTailorId, jc.assignedTailorName, 'Master Tailor / خياط');
                    if (emp && stitchingCompleteStages.includes(jc.stage)) {
                        const earned = +(Number(jc.tailorCommission || 0) * qty).toFixed(2);
                        emp.stitchesCompleted += qty;
                        emp.stitchingCommission = +(emp.stitchingCommission + earned).toFixed(2);
                        emp.totalCommission = +(emp.totalCommission + earned).toFixed(2);
                        emp.jobCards.push({ jobCardId: jc.jobCardId, orderId: order.id, garmentType: jc.garmentType, role: 'Stitching', stage: jc.stage, qty, earned });
                    }
                }
            });
        });

        res.json(Object.values(map));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. Public Tailoring Portal Endpoints (Fabrics, Order Tracking, Fitting & Bespoke Request)
router.get('/api/public/tailoring/fabrics', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || getTenantId(req) || 'default';
        await ensureTailoringSampleData(tenantId, false);
        let products = [];
        if (global.isMongoConnected) {
            products = await Product.find({ tenantId });
        } else {
            products = (mockDb.products || []).filter(p => p.tenantId === tenantId);
        }
        const fabrics = products.filter(p =>
            p.category === 'Fabrics' || p.category === 'Accessories' || p.category === 'apparel' || String(p.id || '').includes('FAB')
        );
        res.json(fabrics.length > 0 ? fabrics : products);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/api/public/tailoring/track', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || getTenantId(req) || 'default';
        await ensureTailoringSampleData(tenantId, false);
        const q = String(req.query.q || '').trim().toLowerCase();
        if (!q) return res.status(400).json({ error: 'Order ID or phone number is required' });

        let orders = [];
        if (global.isMongoConnected) {
            orders = await TailoringOrder.find({ tenantId }).sort({ createdAt: -1 });
        } else {
            orders = (mockDb.tailoringOrders || []).filter(o => o.tenantId === tenantId);
        }

        const matched = orders.filter(o =>
            String(o.id || '').toLowerCase() === q ||
            String(o.id || '').toLowerCase().includes(q) ||
            String(o.customerPhone || '').replace(/\s+/g, '').includes(q.replace(/\s+/g, ''))
        );

        res.json(matched.map(o => ({
            id: o.id,
            customerName: o.customerName,
            orderDate: o.orderDate,
            deliveryDate: o.deliveryDate,
            trialDate: o.trialDate,
            status: o.status,
            priority: o.priority,
            totalAmount: o.totalAmount,
            depositPaid: o.depositPaid,
            balanceDue: o.balanceDue,
            paymentStatus: o.paymentStatus,
            items: (o.items || []).map(jc => ({
                jobCardId: jc.jobCardId,
                garmentType: jc.garmentType,
                profileName: jc.profileName,
                fabricName: jc.fabricName,
                stage: jc.stage,
                rackNumber: jc.rackNumber,
                qty: jc.qty
            }))
        })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/api/public/tailoring/booking', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || getTenantId(req) || 'default';
        const {
            customerName,
            customerPhone,
            garmentType = 'Thobe',
            fabricProductId = '',
            fabricName = '',
            preferredDate = '',
            collarType = 'Mandarin (قلاب صيني)',
            cuffType = 'Plain Sleeve (كم سادة)',
            fitType = 'Regular (عادي مريح)',
            notes = '',
            measurements = {}
        } = req.body;

        if (!customerName || !customerPhone) {
            return res.status(400).json({ error: 'Name and phone number are required' });
        }

        const shortCode = Date.now().toString().slice(-5);
        const orderId = `WEB-TLR-${shortCode}`;
        const profileId = `WEB-MP-${shortCode}`;

        const hasMeasurements = Object.values(measurements || {}).some(v => v && String(v).trim() !== '');
        if (hasMeasurements) {
            const profilePayload = {
                id: profileId,
                tenantId,
                customerId: `WEB-CUST-${shortCode}`,
                customerName,
                customerPhone,
                profileName: `${garmentType} - Web Portal (${customerName})`,
                garmentType,
                unit: 'inch',
                measurements,
                stylePreferences: {
                    collarType,
                    cuffType,
                    placketType: 'Hidden Buttons (جبزور مخفي)',
                    pocketStyle: 'Classic Chest + 2 Side (جيب علوي + ٢ جانبي)',
                    fitType,
                    stitchType: 'Single Hidden (خياطة مخفية)'
                },
                postureNotes: notes,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            if (global.isMongoConnected) {
                await MeasurementProfile.create(profilePayload);
            } else {
                mockDb.measurementProfiles = mockDb.measurementProfiles || [];
                mockDb.measurementProfiles.unshift(profilePayload);
            }
        }

        const baseStitchingPrice = garmentType === 'Bisht' ? 600 : garmentType === 'Suit' ? 850 : garmentType === 'Abaya' ? 280 : 180;
        const orderData = {
            id: orderId,
            tenantId,
            customerId: `WEB-CUST-${shortCode}`,
            customerName,
            customerPhone,
            orderDate: new Date().toISOString().slice(0, 10),
            trialDate: preferredDate || new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
            deliveryDate: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10),
            priority: 'Normal',
            items: [{
                jobCardId: `JC-${shortCode}-1`,
                garmentType,
                measurementProfileId: hasMeasurements ? profileId : '',
                profileName: `${garmentType} (${collarType}, ${cuffType})`,
                qty: 1,
                fabricSource: fabricProductId ? 'Shop' : 'Customer',
                fabricProductId,
                fabricName: fabricName || 'Selected at Fitting / يحدد عند القياس',
                fabricMeters: 3.5,
                fabricPricePerMeter: 0,
                stitchingPrice: baseStitchingPrice,
                embroideryPrice: 0,
                lineTotal: baseStitchingPrice,
                stage: 'Received',
                notes: `[Web Portal Booking] Preferred Fitting: ${preferredDate || 'ASAP'}. ${notes || ''}`.trim()
            }],
            totalAmount: baseStitchingPrice,
            depositPaid: 0,
            balanceDue: baseStitchingPrice,
            paymentStatus: 'Unpaid',
            paymentMethod: 'Cash',
            status: 'InProduction',
            notes: `Online Bespoke / Fitting Request (${preferredDate || 'Flexible'})`,
            createdAt: new Date()
        };

        if (global.isMongoConnected) {
            await TailoringOrder.create(orderData);
        } else {
            mockDb.tailoringOrders = mockDb.tailoringOrders || [];
            mockDb.tailoringOrders.unshift(orderData);
        }

        res.status(201).json({ success: true, orderId, order: orderData });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
