// 26i POS & ERP Express Server Backend
// Implements full MERN API server with ZATCA Phase 2 XML generator, Employee Asset Depreciation, and multi-currency options
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 8089;
const { getJwtSecret, getSaasAdminKey } = require('./utils/security');

// Refuse to start with a missing or published login secret: anyone who knows it can
// create a valid Admin login for any store.
let JWT_SECRET;
try {
    JWT_SECRET = getJwtSecret();
} catch (err) {
    console.error(`[startup] ${err.message}`);
    process.exit(1);
}
if (!getSaasAdminKey()) {
    console.warn('[startup] SAAS_ADMIN_KEY is not set or is weak/published; the /admin provider API is disabled.');
}

// Demo logins (admin/admin123, ...) are only created when explicitly requested.
const SEED_DEMO_USERS = process.env.SEED_DEMO_USERS === 'true';
const DEMO_USERS = [
    { id: '1', username: 'admin', password: 'admin123', role: 'Admin' },
    { id: '2', username: 'manager', password: 'manager123', role: 'Manager' },
    { id: '3', username: 'cashier', password: 'cashier123', role: 'Cashier' },
    { id: '4', username: 'demo', password: 'demo123', role: 'Admin' }
];

// ----------------------------------------------------
// EMAIL SERVICE CONFIGURATION (SMTP)
// ----------------------------------------------------
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
    port: process.env.SMTP_PORT || 587,
    auth: {
        user: process.env.SMTP_USER || 'apikey',
        pass: process.env.SMTP_PASS || process.env.SENDGRID_API_KEY || 'SG.mock-key-for-development'
    }
});

const getBaseDomain = (host) => {
    host = host.toLowerCase();
    if (host.endsWith('ssh-erp.26i.uk')) return 'ssh-erp.26i.uk';
    if (host.endsWith('26i.uk')) return '26i.uk';
    if (host.endsWith('localhost')) return 'localhost';
    return host;
};

const sendLicenseEmail = async (tenantEmail, tenantId, businessName, licenseKey, expiresAt, baseDomain = '26i.uk', verificationToken) => {
    const verifyLink = `http://${baseDomain}/api/auth/verify-email?token=${verificationToken}&tenantId=${tenantId}`;
    if (!process.env.SMTP_PASS && !process.env.SENDGRID_API_KEY) {
        console.log(`[Mock Email] Verify link for ${businessName} (${tenantId}) sent to ${tenantEmail}: ${verifyLink}`);
        return true;
    }
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || "SME Solutions <no-reply@26i.uk>",
            to: tenantEmail,
            subject: 'Verify Your Email - SME Solutions',
            html: `
                <h3>Welcome to SME Solutions, ${businessName}!</h3>
                <p>Your store has been created successfully.</p>
                <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;text-align:center;">
                    <p style="margin-bottom:16px;font-size:16px;">Please verify your email address to activate and launch your store.</p>
                    <a href="${verifyLink}" style="background:#10b981;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Verify Email & Launch Store</a>
                </div>
                <p>Once verified, you can access your store at: <b>http://${tenantId}.${baseDomain}</b></p>
                <p>Your 14-Day Free Trial is valid until: <b>${new Date(expiresAt).toLocaleDateString()}</b>.</p>
            `
        });
        console.log(`License email sent to ${tenantEmail}`);
        return true;
    } catch (err) {
        console.error('Failed to send license email:', err.message);
        return false;
    }
};

const sendPasswordResetEmail = async (tenantEmail, tenantId, resetToken, baseDomain = '26i.uk') => {
    const resetLink = `http://${baseDomain}/reset-password?token=${resetToken}&tenantId=${tenantId}`;
    if (!process.env.SMTP_PASS && !process.env.SENDGRID_API_KEY) {
        console.log(`[Mock Email] Password Reset link for ${tenantId} sent to ${tenantEmail}: ${resetLink}`);
        return true;
    }
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || "SME Solutions <no-reply@26i.uk>",
            to: tenantEmail,
            subject: 'Password Reset - SME Solutions',
            html: `
                <h3>Password Reset Request</h3>
                <p>A password reset was requested for your store: <b>${tenantId}</b>.</p>
                <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;text-align:center;">
                    <p style="margin-bottom:16px;font-size:16px;">Click the button below to reset your password. This link is valid for 1 hour.</p>
                    <a href="${resetLink}" style="background:#3b82f6;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Reset Password</a>
                </div>
                <p>If you did not request this, please ignore this email.</p>
            `
        });
        console.log(`Password reset email sent to ${tenantEmail}`);
        return true;
    } catch (err) {
        console.error('Failed to send password reset email:', err.message);
        return false;
    }
};

const getTenantId = (req) => {
    if (req.tenantId) return req.tenantId;
    const host = (req.headers.host || '').split(':')[0].toLowerCase();
    const baseDomain = getBaseDomain(host);

    if (host.endsWith(`.${baseDomain}`)) {
        const subdomain = host.slice(0, -(baseDomain.length + 1));
        if (subdomain !== 'www' && subdomain !== 'demo') return subdomain;
    }
    if (host === baseDomain) return 'default';

    const tenantHeader = req.headers['x-tenant-id'];
    if (tenantHeader) return tenantHeader.trim().toLowerCase();
    
    return 'default'; // fallback
};

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ----------------------------------------------------
// DATABASE CONNECTION (Portability Mode)
// ----------------------------------------------------
global.isMongoConnected = false;
const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => {
            console.log('Successfully connected to MongoDB.');
            global.isMongoConnected = true;
            seedDatabase();
        })
        .catch(err => {
            console.warn('MongoDB connection failed. Starting in PORTABLE in-memory mode.', err.message);
        });
} else {
    console.log('No MONGO_URI provided. Running in PORTABLE in-memory mode.');
}

// ----------------------------------------------------
// IN-MEMORY STORAGE (Fallback / Mock Database)
// ----------------------------------------------------
const mockDb = {
    properties: [],
    propertyOwners: [],
    units: [],
    bookings: [],
    maintenanceTasks: [],
    propertyInvoices: [],
    leaseContracts: [],
    leads: [],
    subscriptionPayments: [],
    accounts: [],
    journalEntries: [],
    expenses: [],
    assets: [],
    suppliers: [],
    quotations: [],
    orders: [],
    settingsTenant: {},
    // Demo logins only exist when SEED_DEMO_USERS=true (local demos / desktop first run)
    users: SEED_DEMO_USERS
        ? DEMO_USERS.map(u => ({ id: u.id, username: u.username, passwordHash: bcrypt.hashSync(u.password, 10), role: u.role }))
        : [],
    products: [
        { id: '1001', nameEN: 'Premium Smart Monitor 27"', nameAR: 'شاشة ذكية فاخرة 27 بوصة', price: 950, cost: 650, stock: 12, category: 'electronics', emoji: '🖥️', barcode: '628100100010' },
        { id: '1002', nameEN: 'Wireless Laser Scanner', nameAR: 'قارئ باركود لاسلكي ليزري', price: 250, cost: 170, stock: 8, category: 'electronics', emoji: '🔦', barcode: '628100200020' },
        { id: '1003', nameEN: 'Direct Thermal Receipt Printer', nameAR: 'طابعة فواتير حرارية مباشرة', price: 320, cost: 210, stock: 15, category: 'electronics', emoji: '🖨️', barcode: '628100300030' },
        { id: '1004', nameEN: 'Leather Executive Chair', nameAR: 'كرسي مكتب جلد فخم', price: 420, cost: 280, stock: 4, category: 'office', emoji: '💺', barcode: '628100400040' },
        { id: '1005', nameEN: 'Organic Coffee Beans 1kg', nameAR: 'حبوب قهوة عضوية 1 كجم', price: 75, cost: 48, stock: 30, category: 'groceries', emoji: '☕', barcode: '628100500050' },
        { id: '1006', nameEN: 'Saudi Classic Thobe (White)', nameAR: 'ثوب سعودي كلاسيك أبيض', price: 180, cost: 110, stock: 45, category: 'apparel', emoji: '👔', barcode: '628100600060' },
        { id: '1007', nameEN: 'Luxury Shemagh (Red)', nameAR: 'شماغ أحمر ملكي فاخر', price: 220, cost: 140, stock: 30, category: 'apparel', emoji: '🧣', barcode: '628100700070' },
        { id: '1008', nameEN: 'Premium Black Abaya', nameAR: 'عباءة سوداء فاخرة مطرزة', price: 350, cost: 220, stock: 25, category: 'apparel', emoji: '👘', barcode: '628100800080' },
        { id: '1009', nameEN: 'Casual Formal Suit (Blue)', nameAR: 'بدلة رسمية كلاسيكية زرقاء', price: 650, cost: 420, stock: 10, category: 'apparel', emoji: '🧥', barcode: '628100900090' },
        { id: '1010', nameEN: 'Mechanical Keyboard (RGB)', nameAR: 'لوحة مفاتيح ميكانيكية ملونة', price: 150, cost: 90, stock: 20, category: 'electronics', emoji: '⌨️', barcode: '628101000100' },
        { id: '1011', nameEN: 'Ergonomic Standing Desk', nameAR: 'مكتب وقوف مرن مريح', price: 1200, cost: 850, stock: 5, category: 'office', emoji: '🎚️', barcode: '628101100110' },
        { id: '1012', nameEN: 'Automatic Water Dispenser', nameAR: 'موزع مياه أوتوماتيكي', price: 95, cost: 60, stock: 15, category: 'groceries', emoji: '🥛', barcode: '628101200120' }
    ],
    invoices: [
        { id: 'INV-100001', uuid: '6338b0be-0987-4321-bcde-54a7cda98e6a', csn: 1, pih: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', xmlHashBase64: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', customer: 'خليل الغامدي', items: [{ id: '1001', name: 'شاشة ذكية فاخرة 27 بوصة', price: 950, qty: 1 }], discount: 0, vat: 142.5, total: 1092.5, date: '2026-06-20 10:30', zatcaStatus: 'REPORTED' },
        { id: 'INV-100002', uuid: '6338b0be-0987-4321-bcde-54a7cda98e6b', csn: 2, pih: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', xmlHashBase64: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', customer: 'عميل نقدي', items: [{ id: '1002', name: 'Wireless Laser Scanner', price: 250, qty: 2 }], discount: 0, vat: 75.0, total: 575.0, date: '2026-06-21 11:15', zatcaStatus: 'REPORTED' },
        { id: 'INV-100003', uuid: '6338b0be-0987-4321-bcde-54a7cda98e6c', csn: 3, pih: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', xmlHashBase64: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', customer: 'فهد العتيبي', items: [{ id: '1003', name: 'Direct Thermal Receipt Printer', price: 320, qty: 1 }], discount: 10, vat: 46.5, total: 356.5, date: '2026-06-21 14:00', zatcaStatus: 'REPORTED' },
        { id: 'INV-100004', uuid: '6338b0be-0987-4321-bcde-54a7cda98e6d', csn: 4, pih: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', xmlHashBase64: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', customer: 'عميل نقدي', items: [{ id: '1005', name: 'Organic Coffee Beans 1kg', price: 75, qty: 4 }], discount: 0, vat: 45.0, total: 345.0, date: '2026-06-22 09:30', zatcaStatus: 'REPORTED' },
        { id: 'INV-100005', uuid: '6338b0be-0987-4321-bcde-54a7cda98e6e', csn: 5, pih: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', xmlHashBase64: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', customer: 'سارة سالم', items: [{ id: '1006', name: 'Saudi Classic Thobe (White)', price: 180, qty: 2 }], discount: 0, vat: 54.0, total: 414.0, date: '2026-06-22 15:45', zatcaStatus: 'REPORTED' },
        { id: 'INV-100006', uuid: '6338b0be-0987-4321-bcde-54a7cda98e6f', csn: 6, pih: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', xmlHashBase64: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', customer: 'خليل الغامدي', items: [{ id: '1008', name: 'Premium Black Abaya', price: 350, qty: 1 }], discount: 5, vat: 51.75, total: 396.75, date: '2026-06-23 10:00', zatcaStatus: 'REPORTED' },
        { id: 'INV-100007', uuid: '6338b0be-0987-4321-bcde-54a7cda98e70', csn: 7, pih: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', xmlHashBase64: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', customer: 'عميل نقدي', items: [{ id: '1004', name: 'Leather Executive Chair', price: 420, qty: 1 }], discount: 0, vat: 63.0, total: 483.0, date: '2026-06-23 13:20', zatcaStatus: 'REPORTED' },
        { id: 'INV-100008', uuid: '6338b0be-0987-4321-bcde-54a7cda98e71', csn: 8, pih: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', xmlHashBase64: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', customer: 'أحمد علي', items: [{ id: '1007', name: 'Luxury Shemagh (Red)', price: 220, qty: 2 }], discount: 0, vat: 66.0, total: 506.0, date: '2026-06-24 11:10', zatcaStatus: 'REPORTED' },
        { id: 'INV-100009', uuid: '6338b0be-0987-4321-bcde-54a7cda98e72', csn: 9, pih: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', xmlHashBase64: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', customer: 'عميل نقدي', items: [{ id: '1009', name: 'Casual Formal Suit (Blue)', price: 650, qty: 1 }], discount: 0, vat: 97.5, total: 747.5, date: '2026-06-24 16:30', zatcaStatus: 'REPORTED' },
        { id: 'INV-100010', uuid: '6338b0be-0987-4321-bcde-54a7cda98e73', csn: 10, pih: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', xmlHashBase64: 'NWZlY2Q1Y2QyODgyY2NmYTE5YTY1ODIzMDYyMzA5MTRmYmJhYmQ2YmQxMTBiYTkyYTk4YmM0ZTc0Y2Y5MmQ2ZQ==', customer: 'فهد العتيبي', items: [{ id: '1001', name: 'Premium Smart Monitor 27"', price: 950, qty: 2 }], discount: 50, vat: 277.5, total: 2127.5, date: '2026-06-25 09:00', zatcaStatus: 'REPORTED' }
    ],
    quotations: [
        { id: 'QTN-2001', date: '2026-06-24 10:00', customer: 'خليل الغامدي', items: [{ name: 'Monitor x1', price: 950, qty: 1 }], discount: 0, total: 1092.5, vat: 142.5 },
        { id: 'QTN-2002', date: '2026-06-24 11:30', customer: 'فهد العتيبي', items: [{ name: 'Scanner x2', price: 250, qty: 2 }], discount: 0, total: 575.0, vat: 75.0 },
        { id: 'QTN-2003', date: '2026-06-24 12:45', customer: 'عميل نقدي', items: [{ name: 'Printer x1', price: 320, qty: 1 }], discount: 0, total: 368.0, vat: 48.0 },
        { id: 'QTN-2004', date: '2026-06-24 14:15', customer: 'مستشفى الفهد', items: [{ name: 'Office Chair x4', price: 420, qty: 4 }], discount: 0, total: 1932.0, vat: 252.0 },
        { id: 'QTN-2005', date: '2026-06-24 16:00', customer: 'أحمد علي', items: [{ name: 'Coffee x10', price: 75, qty: 10 }], discount: 0, total: 862.5, vat: 112.5 },
        { id: 'QTN-2006', date: '2026-06-25 08:30', customer: 'مدرسة المنار', items: [{ name: 'White Thobe x30', price: 180, qty: 30 }], discount: 0, total: 6210.0, vat: 810.0 },
        { id: 'QTN-2007', date: '2026-06-25 09:15', customer: 'سارة سالم', items: [{ name: 'Red Shemagh x5', price: 220, qty: 5 }], discount: 0, total: 1265.0, vat: 165.0 },
        { id: 'QTN-2008', date: '2026-06-25 10:00', customer: 'مؤسسة التقنية', items: [{ name: 'Black Abaya x15', price: 350, qty: 15 }], discount: 0, total: 6037.5, vat: 787.5 },
        { id: 'QTN-2009', date: '2026-06-25 11:20', customer: 'خالد محمد', items: [{ name: 'Blue Suit x8', price: 650, qty: 8 }], discount: 0, total: 5980.0, vat: 780.0 },
        { id: 'QTN-2010', date: '2026-06-25 13:00', customer: 'الشركة العربية', items: [{ name: 'Keyboard x12', price: 150, qty: 12 }], discount: 0, total: 2070.0, vat: 270.0 }
    ],
    expenses: [
        { id: 'EXP-5001', date: '2026-06-01', category: 'rent', amount: 300, description: 'Office Rent / إيجار المكتب الرئيسي' },
        { id: 'EXP-5002', date: '2026-06-10', category: 'marketing', amount: 50, description: 'Google Ads / إعلانات جوجل' },
        { id: 'EXP-5003', date: '2026-06-12', category: 'salaries', amount: 1500, description: 'Monthly Employees Salaries / رواتب الموظفين لشهر يونيو' },
        { id: 'EXP-5004', date: '2026-06-14', category: 'shipping', amount: 32, description: 'Aramex Delivery Fees / رسوم توصيل أرامكس' },
        { id: 'EXP-5005', date: '2026-06-15', category: 'other', amount: 18, description: 'Office Pantry Items / مستلزمات ضيافة مكتبية' },
        { id: 'EXP-5006', date: '2026-06-18', category: 'rent', amount: 45, description: 'Internet & Landline / فاتورة الإنترنت والهاتف' },
        { id: 'EXP-5007', date: '2026-06-20', category: 'marketing', amount: 75, description: 'Snapchat Marketing Campaign / حملة سناب شات' },
        { id: 'EXP-5008', date: '2026-06-21', category: 'other', amount: 12, description: 'Electricity Bill / فاتورة الكهرباء' },
        { id: 'EXP-5009', date: '2026-06-22', category: 'shipping', amount: 45, description: 'DHL Custom Clearance / رسوم تخليص جمركي دي إتش إل' },
        { id: 'EXP-5010', date: '2026-06-24', category: 'salaries', amount: 400, description: 'Contractor Commissions / عمولات مناديب المبيعات' }
    ],
    customers: [
        { id: 'CUST-8001', name: 'Khalil Al-Ghamdi / خليل الغامدي', phone: '0501234567', email: 'khalil@26i.uk', points: 150, spent: 1725 },
        { id: 'CUST-8002', name: 'Fahad Al-Otaibi / فهد العتيبي', phone: '0557654321', email: 'fahad@kamysoft.com', points: 45, spent: 480 },
        { id: 'CUST-8003', name: 'Sami Al-Harbi / سامي الحربي', phone: '0567890123', email: 'sami@example.com', points: 30, spent: 320 },
        { id: 'CUST-8004', name: 'Aisha Al-Subaie / عائشة السبيعي', phone: '0543210987', email: 'aisha@example.com', points: 280, spent: 3450 },
        { id: 'CUST-8005', name: 'Yousef Al-Mutairi / يوسف المطيري', phone: '0534567890', email: 'yousef@example.com', points: 90, spent: 1200 },
        { id: 'CUST-8006', name: 'Reem Al-Dosari / ريم الدوسري', phone: '0578901234', email: 'reem@example.com', points: 15, spent: 150 },
        { id: 'CUST-8007', name: 'Majed Al-Anazi / ماجد العنزي', phone: '0590123456', email: 'majed@example.com', points: 110, spent: 1450 },
        { id: 'CUST-8008', name: 'Sarah Al-Qahtani / سارة القحطاني', phone: '0587654321', email: 'sarah@example.com', points: 65, spent: 780 },
        { id: 'CUST-8009', name: 'Bandar Al-Shahrani / بندر الشهراني', phone: '0554321098', email: 'bandar@example.com', points: 200, spent: 2500 },
        { id: 'CUST-8010', name: 'Noura Al-Shehri / نورة الشهري', phone: '0532109876', email: 'noura@example.com', points: 350, spent: 4890 }
    ],
    employees: [
        { id: 'EMP-3001', name: 'Khalil Al-Ghamdi / خليل الغامدي', dept: 'IT Operations' },
        { id: 'EMP-3002', name: 'Ahmad Ali / أحمد علي', dept: 'Finance' },
        { id: 'EMP-3003', name: 'Sarah Salem / سارة سالم', dept: 'Administration' },
        { id: 'EMP-3004', name: 'Sultan Salem / سلطان سالم', dept: 'Sales' },
        { id: 'EMP-3005', name: 'Layla Ahmad / ليلى أحمد', dept: 'Customer Support' },
        { id: 'EMP-3006', name: 'Mansour Ali / منصور علي', dept: 'Logistics' },
        { id: 'EMP-3007', name: 'Hoda Fahad / هدى فهد', dept: 'Human Resources' },
        { id: 'EMP-3008', name: 'Turki Khalid / تركي خالد', dept: 'Sales' },
        { id: 'EMP-3009', name: 'Fatimah Mohammad / فاطمة محمد', dept: 'Marketing' },
        { id: 'EMP-3010', name: 'Saad Abdallah / سعد عبدالله', dept: 'Procurement' }
    ],
    suppliers: [
        { id: 'SUPP-9001', company: 'Rawaa Supplies Co. / شركة رواء للتوريد', contact: 'Ahmad Ali', phone: '0599998888', items: 'Smart Monitors, POS printers' },
        { id: 'SUPP-9002', company: 'Saudi Tech Importers / مستوردي التقنية السعودية', contact: 'Sami Salem', phone: '0544443333', items: 'Barcode scanners, office equipment' },
        { id: 'SUPP-9003', company: 'Modern Office Furniture / أثاث المكتب الحديث', contact: 'Fahad Al-Sami', phone: '0533332222', items: 'Ergonomic chairs, standing desks' },
        { id: 'SUPP-9004', company: 'Jazeera Trading House / دار الجزيرة التجارية', contact: 'Omar Khalid', phone: '0522221111', items: 'Apparel accessories, raw materials' },
        { id: 'SUPP-9005', company: 'Global Coffee Importers / مستوردي البن العالمي', contact: 'Tariq Ali', phone: '0511110000', items: 'Organic coffee beans, syrups' },
        { id: 'SUPP-9006', company: 'Unified Stationery / المكتبة الموحدة', contact: 'Adel Ahmad', phone: '0500009999', items: 'Office stationery, paper goods' },
        { id: 'SUPP-9007', company: 'Pioneers Electronic / رواد الإلكترونيات', contact: 'Nasser Salem', phone: '0599997777', items: 'Thermal printers, cash drawers' },
        { id: 'SUPP-9008', company: 'Premium Textile Co. / شركة المنسوجات المتميزة', contact: 'Waleed Ali', phone: '0588886666', items: 'Classic white thobes, shemaghs' },
        { id: 'SUPP-9009', company: 'Raw Food Distributors / موزعي الغذاء الخام', contact: 'Ziyad Salem', phone: '0577775555', items: 'Packaged groceries, snacks' },
        { id: 'SUPP-9010', company: 'Elite Fashion Hub / مركز النخبة للأزياء', contact: 'Majed Al-Fahad', phone: '0566664444', items: 'Luxury abayas, suits' }
    ],
    orders: [
        { id: 'ORD-7001', date: '2026-06-24 12:00', customer: 'خليل الغامدي', items: 'طابعة فواتير حرارية مباشرة x1', total: 368.0, status: 'Preparing' },
        { id: 'ORD-7002', date: '2026-06-24 13:00', customer: 'عميل نقدي', items: 'حبوب قهوة عضوية 1 كجم x3', total: 258.75, status: 'Ready' },
        { id: 'ORD-7003', date: '2026-06-24 15:45', customer: 'فهد العتيبي', items: 'قارئ باركود لاسلكي ليزري x2', total: 575.0, status: 'Completed' },
        { id: 'ORD-7004', date: '2026-06-24 17:00', customer: 'سارة سالم', items: 'شاشة ذكية فاخرة 27 بوصة x1', total: 1092.5, status: 'Delivered' },
        { id: 'ORD-7005', date: '2026-06-24 19:20', customer: 'عميل نقدي', items: 'بدلة رسمية كلاسيكية زرقاء x1', total: 747.5, status: 'Pending' },
        { id: 'ORD-7006', date: '2026-06-25 09:30', customer: 'سامي الحربي', items: 'كرسي مكتب جلد فخم x2', total: 966.0, status: 'Preparing' },
        { id: 'ORD-7007', date: '2026-06-25 10:15', customer: 'عائشة السبيعي', items: 'شماغ أحمر ملكي فاخر x10', total: 2530.0, status: 'Ready' },
        { id: 'ORD-7008', date: '2026-06-25 11:00', customer: 'يوسف المطيري', items: 'ثوب سعودي كلاسيك أبيض x5', total: 1035.0, status: 'Completed' },
        { id: 'ORD-7009', date: '2026-06-25 12:15', customer: 'عميل نقدي', items: 'عباءة سوداء فاخرة مطرزة x3', total: 1207.5, status: 'Pending' },
        { id: 'ORD-7010', date: '2026-06-25 13:40', customer: 'نورة الشهري', items: 'لوحة مفاتيح ميكانيكية ملونة x5', total: 862.5, status: 'Preparing' }
    ],
    assets: [
        { id: 'AST-2001', name: 'Server Host B Machine', cost: 4500, salvage: 500, life: 5, date: '2025-01-15', status: 'active', department: 'IT / Operations', serial: 'SN-76543A', supplier: 'Saudi Tech Importers', assignedTo: 'EMP-3001' },
        { id: 'AST-2002', name: 'Laser Printer HP LaserJet', cost: 1200, salvage: 200, life: 4, date: '2025-03-10', status: 'active', department: 'Administration', serial: 'SN-99881P', supplier: 'Rawaa Supplies Co.', assignedTo: 'EMP-3003' },
        { id: 'AST-2003', name: 'ERP Backend Server AWS EC2', cost: 6000, salvage: 0, life: 3, date: '2025-05-01', status: 'active', department: 'IT / Operations', serial: 'AWS-EC2-ERP', supplier: 'Amazon Web Services', assignedTo: 'EMP-3001' },
        { id: 'AST-2004', name: 'Office Workstation Laptops (Dell)', cost: 15000, salvage: 1500, life: 4, date: '2025-06-01', status: 'active', department: 'IT / Operations', serial: 'SN-DELL-IT', supplier: 'Saudi Tech Importers', assignedTo: 'EMP-3001' },
        { id: 'AST-2005', name: 'IT Staff Laptops (Apple MacBook)', cost: 18000, salvage: 2000, life: 4, date: '2025-07-15', status: 'active', department: 'IT / Operations', serial: 'SN-MAC-01', supplier: 'Saudi Tech Importers', assignedTo: 'EMP-3001' },
        { id: 'AST-2006', name: 'Conference Room Smart Screen 85"', cost: 8500, salvage: 500, life: 5, date: '2025-08-20', status: 'active', department: 'Sales / Marketing', serial: 'SN-SCREEN-85', supplier: 'Rawaa Supplies Co.', assignedTo: 'EMP-3004' },
        { id: 'AST-2007', name: 'Office Main Air Conditioning Unit', cost: 11000, salvage: 1000, life: 8, date: '2024-05-10', status: 'active', department: 'Administration', serial: 'SN-AC-MAIN', supplier: 'Saudi Tech Importers', assignedTo: 'EMP-3003' },
        { id: 'AST-2008', name: 'Warehouse Delivery Forklift', cost: 35000, salvage: 5000, life: 10, date: '2024-01-15', status: 'active', department: 'Logistics', serial: 'SN-FORK-09', supplier: 'Saudi Tech Importers', assignedTo: 'EMP-3006' },
        { id: 'AST-2009', name: 'Reception Desk Furniture Set', cost: 3800, salvage: 300, life: 7, date: '2024-03-01', status: 'active', department: 'Administration', serial: 'SN-FURN-REC', supplier: 'Modern Office Furniture', assignedTo: 'EMP-3005' },
        { id: 'AST-2010', name: 'Kitchen Breakroom Refrigerator', cost: 2500, salvage: 100, life: 5, date: '2024-04-10', status: 'active', department: 'Administration', serial: 'SN-REF-01', supplier: 'Raw Food Distributors', assignedTo: 'EMP-3003' }
    ],
    settings: {
        businessName: '26i ERP & POS',
        fullName: 'خليل الغامدي / Khalil Al-Ghamdi',
        vatNumber: '310123456700003',
        taxRate: 15,
        baseCurrency: 'SAR',
        businessAddress: 'الرياض، المملكة العربية السعودية / Riyadh, Saudi Arabia',
        crNumber: '1010123456',
        contactNumber: '+966 50 123 4567',
        exchangeRates: {
            SAR: 1,
            USD: 0.27,
            EUR: 0.25,
            EGP: 12.8,
            AED: 0.99
        },
        branches: [
            { name: 'Main Branch - Riyadh', address: 'Olaya District, Riyadh', phone: '+966 50 123 4567' },
            { name: 'Jeddah Branch', address: 'Tahlia St, Jeddah', phone: '+966 50 765 4321' }
        ],
        currentBranch: 'Main Branch - Riyadh',
        businessType: 'retail',
        enableTables: false,
        enableServiceDuration: false
    },
    inquiries: []
};

// Pre-populate mockDb items with tenantId: 'default'
Object.keys(mockDb).forEach(key => {
    if (Array.isArray(mockDb[key])) {
        mockDb[key].forEach(item => {
            if (item && typeof item === 'object' && !item.tenantId) {
                item.tenantId = 'default';
            }
        });
    } else if (mockDb[key] && typeof mockDb[key] === 'object') {
        if (!mockDb[key].tenantId) mockDb[key].tenantId = 'default';
    }
});

// ----------------------------------------------------
// MONGOOSE SCHEMAS (If connected)
// ----------------------------------------------------
const { User, Product, Invoice, Quotation, Expense, Asset, Customer, Employee, Supplier, Order, Settings, Inquiry, Warehouse, InventoryTx, JournalEntry, Voucher, Salary, PurchaseInvoice, ReturnInvoice } = require('./models');

async function seedDatabase() {
    try {
        // Dynamic Migration: Ensure all pre-existing documents without tenantId get tenantId: 'default'
        const models = [User, Product, Invoice, Quotation, Expense, Asset, Customer, Employee, Supplier, Order, Settings];
        for (const model of models) {
            await model.updateMany(
                { tenantId: { $exists: false } },
                { $set: { tenantId: 'default' } }
            );
        }
        console.log('Database migration complete: Added tenantId to pre-existing documents.');

        // Settings — scoped to default tenant
        const settingsCount = await Settings.countDocuments({ tenantId: 'default' });
        if (settingsCount === 0) {
            await Settings.create({ ...mockDb.settings, tenantId: 'default' });
            console.log('Database seeded: Settings.');
        }

        // Warn about demo accounts already in the database that still use the published passwords
        for (const demo of DEMO_USERS) {
            const existing = await User.findOne({ username: demo.username, tenantId: 'default' });
            if (existing && existing.isActive !== false && existing.passwordHash && bcrypt.compareSync(demo.password, existing.passwordHash)) {
                console.warn(`[security] WARNING: user "${demo.username}" in the default store still uses the published password "${demo.password}". Change or delete this account.`);
            }
        }

        // Users — scoped to default tenant (only when SEED_DEMO_USERS=true; mockDb.users is empty otherwise)
        for (const u of mockDb.users.filter(u => u.tenantId === 'default')) {
            const exists = await User.findOne({ username: u.username, tenantId: 'default' });
            if (!exists) {
                await User.create(u);
                console.log(`Database seeded user: ${u.username}`);
            } else if (u.username === 'demo' && exists.role !== 'Admin') {
                exists.role = 'Admin';
                await exists.save();
                console.log('Updated demo user to Admin role.');
            }
        }

        // Products — scoped to default tenant
        const productCount = await Product.countDocuments({ tenantId: 'default' });
        if (productCount === 0) {
            await Product.insertMany(mockDb.products.filter(p => p.tenantId === 'default'));
            console.log('Database seeded: Products.');
        }

        // Invoices — scoped to default tenant
        const invoiceCount = await Invoice.countDocuments({ tenantId: 'default' });
        if (invoiceCount === 0) {
            await Invoice.insertMany(mockDb.invoices.filter(i => i.tenantId === 'default'));
            console.log('Database seeded: Invoices.');
        }

        // Quotations — scoped to default tenant
        const quotationCount = await Quotation.countDocuments({ tenantId: 'default' });
        if (quotationCount === 0) {
            await Quotation.insertMany(mockDb.quotations.filter(q => q.tenantId === 'default'));
            console.log('Database seeded: Quotations.');
        }

        // Expenses — scoped to default tenant
        const expenseCount = await Expense.countDocuments({ tenantId: 'default' });
        if (expenseCount === 0) {
            await Expense.insertMany(mockDb.expenses.filter(e => e.tenantId === 'default'));
            console.log('Database seeded: Expenses.');
        }

        // Assets — scoped to default tenant
        const assetCount = await Asset.countDocuments({ tenantId: 'default' });
        if (assetCount === 0) {
            await Asset.insertMany(mockDb.assets.filter(a => a.tenantId === 'default'));
            console.log('Database seeded: Assets.');
        }

        // Customers — scoped to default tenant
        const customerCount = await Customer.countDocuments({ tenantId: 'default' });
        if (customerCount === 0) {
            await Customer.insertMany(mockDb.customers.filter(c => c.tenantId === 'default'));
            console.log('Database seeded: Customers.');
        }

        // Employees — scoped to default tenant
        const employeeCount = await Employee.countDocuments({ tenantId: 'default' });
        if (employeeCount === 0) {
            await Employee.insertMany(mockDb.employees.filter(e => e.tenantId === 'default'));
            console.log('Database seeded: Employees.');
        }

        // Suppliers — scoped to default tenant
        const supplierCount = await Supplier.countDocuments({ tenantId: 'default' });
        if (supplierCount === 0) {
            await Supplier.insertMany(mockDb.suppliers.filter(s => s.tenantId === 'default'));
            console.log('Database seeded: Suppliers.');
        }

        // Orders — scoped to default tenant
        const orderCount = await Order.countDocuments({ tenantId: 'default' });
        if (orderCount === 0) {
            await Order.insertMany(mockDb.orders.filter(o => o.tenantId === 'default'));
            console.log('Database seeded: Orders.');
        }
    } catch (err) {
        console.error('Error seeding database:', err.message);
    }
}


// AUTH MIDDLEWARE
// ----------------------------------------------------
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Access token required' });
    
    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) return res.status(403).json({ error: 'Token expired or invalid' });
        
        const tenantId = getTenantId(req);
        if (user.tenantId !== tenantId) {
            return res.status(403).json({ error: 'Tenant access mismatch' });
        }
        
        // --- License Validation Check ---
        if (tenantId !== 'default' && tenantId !== 'demo') {
            let tenantSettings;
            if (global.isMongoConnected) {
                tenantSettings = await Settings.findOne({ tenantId });
            } else {
                tenantSettings = mockDb.settingsTenant[tenantId];
            }
            
            if (tenantSettings && tenantSettings.licenseExpiresAt) {
                if (new Date() > new Date(tenantSettings.licenseExpiresAt)) {
                    return res.status(403).json({ error: 'LICENSE_EXPIRED', message: 'Your store license has expired. Please renew your subscription.' });
                }
            }
        }
        // --------------------------------
        
        req.user = user;
        next();
    });
}

// ----------------------------------------------------
// CRYPTOGRAPHIC SHA-256 IN NODE
// ----------------------------------------------------
const crypto = require('crypto');
function sha256Node(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}
function signHashNode(hashHex) {
    const hash = crypto.createHash('sha256').update(hashHex + '26iPrivateKeySecp256k1_2026').digest('base64');
    return hash;
}

const zatcaCrypto = require('./utils/zatcaCrypto');
function generateZATCAXML(invoice, settings) {
    return zatcaCrypto.generateZATCAXML(invoice, settings);
}

// Enrich seed invoices with genuine ZATCA Phase 2 UBL 2.1 XML, Hash Chain, ECDSA Signature & TLV QR
(function enrichSeedInvoices() {
    const defaultKeys = zatcaCrypto.getKeys('default') || zatcaCrypto.onboardDevice('default', {
        organizationNameAr: mockDb.settings.businessName,
        organizationNameEn: mockDb.settings.businessName,
        vatNumber: mockDb.settings.vatNumber,
        crNumber: mockDb.settings.crNumber
    }, 'sandbox');
    if (!mockDb.settings.zatcaConn) {
        mockDb.settings.zatcaConn = {
            env: 'sandbox',
            endpoint: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
            clientId: defaultKeys.certificatePem,
            clientSecret: 'SANDBOX-CSID-SECRET-26I',
            privateKey: defaultKeys.privateKeyPem,
            publicKey: defaultKeys.publicKeyPem,
            csr: defaultKeys.csrPem,
            deviceSerial: '1-26I|2-POS|3-ed22f1d8-e6a2-1118-9b58-d9a8f11e445f',
            status: 'CONNECTED',
            autoSend: false
        };
    }
    let prevHash = zatcaCrypto.DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH;
    mockDb.invoices.forEach((inv, idx) => {
        inv.csn = idx + 1;
        inv.pih = prevHash;
        const unsignedXml = zatcaCrypto.generateZATCAXML(inv, mockDb.settings);
        const signed = zatcaCrypto.signInvoice({
            xml: unsignedXml,
            privateKeyPem: defaultKeys.privateKeyPem,
            certificatePem: defaultKeys.certificatePem
        });
        inv.xml = signed.signedXml;
        inv.xmlHash = signed.xmlHashHex;
        inv.xmlHashBase64 = signed.xmlHashBase64;
        inv.signature = signed.signatureHex;
        inv.publicKey = signed.publicKeyBase64;
        inv.certSignature = signed.certificateSignature;
        inv.qrCode = signed.qrCodeBase64;
        prevHash = signed.xmlHashBase64;
    });
})();

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// AUTHENTICATION
const defaultProductsBySector = {
    restaurant: [
        { nameEN: 'Grilled Chicken Meal', nameAR: 'وجبة دجاج شواية', price: 25, cost: 12, stock: 50, category: 'Main Course', emoji: '🍗', barcode: '828100100010' },
        { nameEN: 'Beef Burger Combo', nameAR: 'وجبة برجر لحم', price: 35, cost: 18, stock: 30, category: 'Fast Food', emoji: '🍔', barcode: '828100100011' },
        { nameEN: 'Margherita Pizza', nameAR: 'بيتزا مارغريتا', price: 40, cost: 15, stock: 20, category: 'Pizza', emoji: '🍕', barcode: '828100100012' },
        { nameEN: 'Caesar Salad', nameAR: 'سلطة سيزر', price: 20, cost: 8, stock: 25, category: 'Appetizers', emoji: '🥗', barcode: '828100100013' },
        { nameEN: 'Fresh Orange Juice', nameAR: 'عصير برتقال طازج', price: 15, cost: 5, stock: 40, category: 'Beverages', emoji: '🥤', barcode: '828100100014' },
        { nameEN: 'Kunafa with Cream', nameAR: 'كنافة بالقشطة', price: 22, cost: 10, stock: 15, category: 'Desserts', emoji: '🍮', barcode: '828100100015' },
        { nameEN: 'Chicken Shawarma Wrap', nameAR: 'ساندوتش شاورما دجاج', price: 12, cost: 6, stock: 60, category: 'Fast Food', emoji: '🌯', barcode: '828100100016' },
        { nameEN: 'Pepperoni Pizza', nameAR: 'بيتزا بيبيروني', price: 45, cost: 18, stock: 25, category: 'Pizza', emoji: '🍕', barcode: '828100100017' },
        { nameEN: 'Lamb Kabsa', nameAR: 'كبسة لحم', price: 55, cost: 25, stock: 35, category: 'Main Course', emoji: '🍛', barcode: '828100100018' },
        { nameEN: 'Arabic Coffee Pot', nameAR: 'دلة قهوة عربية', price: 30, cost: 12, stock: 50, category: 'Beverages', emoji: '☕', barcode: '828100100019' }
    ],
    appliances: [
        { nameEN: 'Smart Split AC 18000 BTU', nameAR: 'مكيف سبليت ذكي 18000 وحدة', price: 2400, cost: 1700, stock: 10, category: 'appliances', emoji: '❄️', barcode: '728100100010' },
        { nameEN: 'Double Door Refrigerator 450L', nameAR: 'ثلاجة دولابي 450 لتر', price: 3500, cost: 2600, stock: 5, category: 'appliances', emoji: '🎛️', barcode: '728100100011' },
        { nameEN: 'Fully Automatic Washing Machine', nameAR: 'غسالة ملابس أوتوماتيكية بالكامل', price: 1800, cost: 1300, stock: 8, category: 'appliances', emoji: '🧺', barcode: '728100100012' },
        { nameEN: 'Digital Microwave Oven 30L', nameAR: 'ميكروويف رقمي 30 لتر', price: 450, cost: 310, stock: 15, category: 'appliances', emoji: '🍳', barcode: '728100100013' }
    ],
    furniture: [
        { nameEN: 'Luxury L-Shape Sofa Set', nameAR: 'طقم كنب فاخر على شكل حرف L', price: 4500, cost: 3200, stock: 4, category: 'furniture', emoji: '🛋️', barcode: '728200100020' },
        { nameEN: 'King Size Bed Frame with Headboard', nameAR: 'سرير مقاس كينج خشبي فخم', price: 2800, cost: 1900, stock: 6, category: 'furniture', emoji: '🛏️', barcode: '728200100021' },
        { nameEN: 'Solid Oak Dining Table (6 Chairs)', nameAR: 'طاولة طعام خشب بلوط مع 6 كراسي', price: 3200, cost: 2200, stock: 3, category: 'furniture', emoji: '🪑', barcode: '728200100022' },
        { nameEN: 'Modern Wooden Coffee Table', nameAR: 'طاولة قهوة خشبية مودرن', price: 650, cost: 420, stock: 12, category: 'furniture', emoji: '☕', barcode: '728200100023' }
    ],
    spareparts: [
        { nameEN: 'Brake Pad Set (Front)', nameAR: 'قماش فرامل أمامي', price: 180, cost: 120, stock: 25, category: 'spareparts', emoji: '🚗', barcode: '728300100030' },
        { nameEN: 'Engine Oil Filter (Synthetic)', nameAR: 'فلتر زيت محرك تخليقي', price: 35, cost: 20, stock: 60, category: 'spareparts', emoji: '🛢️', barcode: '728300100031' },
        { nameEN: 'Copper Plumbing Elbow 1/2"', nameAR: 'كوع نحاس للسباكة 1/2 بوصة', price: 12, cost: 7, stock: 150, category: 'spareparts', emoji: '🔧', barcode: '728300100032' },
        { nameEN: 'Heavy Duty HVAC Capacitor 45uF', nameAR: 'كابستور مكيف شديد التحمل 45 ميكرو', price: 45, cost: 25, stock: 40, category: 'spareparts', emoji: '⚡', barcode: '728300100033' },
        { nameEN: 'LED Circuit Board Panel', nameAR: 'لوحة دارة إلكترونية LED', price: 95, cost: 60, stock: 20, category: 'spareparts', emoji: '🔌', barcode: '728300100034' }
    ],
    retail: [
        { nameEN: 'Premium Smart Monitor 27"', nameAR: 'شاشة ذكية فاخرة 27 بوصة', price: 950, cost: 650, stock: 12, category: 'electronics', emoji: '🖥️', barcode: '628100100010' },
        { nameEN: 'Wireless Laser Scanner', nameAR: 'قارئ باركود لاسلكي ليزري', price: 250, cost: 170, stock: 8, category: 'electronics', emoji: '🔦', barcode: '628100200020' },
        { nameEN: 'Direct Thermal Receipt Printer', nameAR: 'طابعة فواتير حرارية مباشرة', price: 320, cost: 210, stock: 15, category: 'electronics', emoji: '🖨️', barcode: '628100300030' },
        { nameEN: 'Leather Executive Chair', nameAR: 'كرسي مكتب جلد فخم', price: 420, cost: 280, stock: 4, category: 'office', emoji: '💺', barcode: '628100400040' },
        { nameEN: 'Organic Coffee Beans 1kg', nameAR: 'حبوب قهوة عضوية 1 كجم', price: 75, cost: 48, stock: 30, category: 'groceries', emoji: '☕', barcode: '628100500050' },
        { nameEN: 'Saudi Classic Thobe (White)', nameAR: 'ثوب سعودي كلاسيك أبيض', price: 180, cost: 110, stock: 45, category: 'apparel', emoji: '👔', barcode: '628100600060' },
        { nameEN: 'Luxury Shemagh (Red)', nameAR: 'شماغ أحمر ملكي فاخر', price: 220, cost: 140, stock: 30, category: 'apparel', emoji: '🧣', barcode: '628100700070' },
        { nameEN: 'Premium Black Abaya', nameAR: 'عباءة سوداء فاخرة مطرزة', price: 350, cost: 220, stock: 25, category: 'apparel', emoji: '👘', barcode: '628100800080' },
        { nameEN: 'Casual Formal Suit (Blue)', nameAR: 'بدلة رسمية كلاسيكية زرقاء', price: 650, cost: 420, stock: 10, category: 'apparel', emoji: '🧥', barcode: '628100900090' },
        { nameEN: 'Mechanical Keyboard (RGB)', nameAR: 'لوحة مفاتيح ميكانيكية ملونة', price: 150, cost: 90, stock: 20, category: 'electronics', emoji: '⌨️', barcode: '628101000100' },
        { nameEN: 'Ergonomic Standing Desk', nameAR: 'مكتب وقوف مرن مريح', price: 1200, cost: 850, stock: 5, category: 'office', emoji: '🎚️', barcode: '628101100110' },
        { nameEN: 'Automatic Water Dispenser', nameAR: 'موزع مياه أوتوماتيكي', price: 95, cost: 60, stock: 15, category: 'groceries', emoji: '🥛', barcode: '628101200120' }
    ],
    restaurant: [
        { nameEN: 'Classic Cheeseburger', nameAR: 'تشيز برجر كلاسيك', price: 28, cost: 12, stock: 50, category: 'Main Course', emoji: '🍔', barcode: '628200100010' },
        { nameEN: 'Margherita Pizza', nameAR: 'بيتزا مارغريتا', price: 45, cost: 18, stock: 30, category: 'Main Course', emoji: '🍕', barcode: '628200100020' },
        { nameEN: 'Grilled Chicken Sandwich', nameAR: 'ساندوتش دجاج مشوي', price: 25, cost: 10, stock: 40, category: 'Sandwiches', emoji: '🥪', barcode: '628200100030' },
        { nameEN: 'French Fries (Large)', nameAR: 'بطاطس مقلية (كبير)', price: 12, cost: 4, stock: 100, category: 'Sides', emoji: '🍟', barcode: '628200100040' },
        { nameEN: 'Caesar Salad', nameAR: 'سلطة سيزر', price: 30, cost: 12, stock: 20, category: 'Salads', emoji: '🥗', barcode: '628200100050' },
        { nameEN: 'Fresh Orange Juice', nameAR: 'عصير برتقال طازج', price: 15, cost: 5, stock: 60, category: 'Beverages', emoji: '🥤', barcode: '628200100060' },
        { nameEN: 'Cappuccino', nameAR: 'كابتشينو', price: 18, cost: 4, stock: 80, category: 'Beverages', emoji: '☕', barcode: '628200100070' },
        { nameEN: 'Chocolate Brownie', nameAR: 'براوني الشوكولاتة', price: 22, cost: 8, stock: 25, category: 'Desserts', emoji: '🧁', barcode: '628200100080' }
    ],
    freshFlowers: [
        { nameEN: 'Red Roses Luxury Bouquet', nameAR: 'باقة جوري أحمر فاخرة', price: 180, cost: 80, stock: 25, category: 'Bouquets', emoji: '🌹', barcode: '628900100010' },
        { nameEN: 'Spring Mix Tulips & Lilies', nameAR: 'تنسيق ربيعي توليب وزنبق', price: 240, cost: 110, stock: 15, category: 'Arrangements', emoji: '🌷', barcode: '628900100020' },
        { nameEN: 'White Orchid in Ceramic Pot', nameAR: 'أوركيد أبيض في حوض سيراميك', price: 320, cost: 150, stock: 10, category: 'Potted Plants', emoji: '🪴', barcode: '628900100030' },
        { nameEN: 'Bridal Hand Bouquet', nameAR: 'مسكة عروس ملكية', price: 450, cost: 200, stock: 8, category: 'Weddings', emoji: '💐', barcode: '628900100040' },
        { nameEN: 'Flower & Belgian Chocolate Box', nameAR: 'بوكس ورد وشوكولاتة بلجيكية', price: 290, cost: 130, stock: 20, category: 'Gift Boxes', emoji: '🎁', barcode: '628900100050' },
        { nameEN: 'Single Long Stem Rose', nameAR: 'وردة جوري مفردة مع تغليف', price: 15, cost: 5, stock: 100, category: 'Single Flowers', emoji: '🥀', barcode: '628900100060' }
    ],
    tailoring: [
        { nameEN: 'Japanese Semiramis White Fabric (Per Meter)', nameAR: 'قماش سميراميس ياباني أبيض (بالمتر)', price: 45, cost: 25, stock: 120, category: 'Fabrics', emoji: '🧵', barcode: '628700100010' },
        { nameEN: 'Japanese Cream Soft Fabric (Per Meter)', nameAR: 'قماش ياباني كريمي طايح (بالمتر)', price: 50, cost: 28, stock: 95, category: 'Fabrics', emoji: '🧶', barcode: '628700100020' },
        { nameEN: 'English Winter Cashmere Wool (Per Meter)', nameAR: 'صوف كشمير شتوي إنجليزي (بالمتر)', price: 95, cost: 55, stock: 60, category: 'Fabrics', emoji: '🧥', barcode: '628700100030' },
        { nameEN: 'Italian Super 130s Navy Suiting (Per Meter)', nameAR: 'قماش بدلة إيطالي كحلي فاخر (بالمتر)', price: 140, cost: 80, stock: 45, category: 'Fabrics', emoji: '🕴️', barcode: '628700100040' },
        { nameEN: 'Korean Silk Black Abaya Crepe (Per Meter)', nameAR: 'كريب حرير كوري أسود للعبايات (بالمتر)', price: 65, cost: 35, stock: 85, category: 'Fabrics', emoji: '👘', barcode: '628700100050' },
        { nameEN: 'Luxury Cufflinks Set (Silver/Onyx)', nameAR: 'طقم كبك رجالي فضي ملكي', price: 120, cost: 55, stock: 30, category: 'Accessories', emoji: '💎', barcode: '628700100060' }
    ],
    // Starter items for business types that used to get the retail electronics list
    grocery: [
        { nameEN: 'Fresh Tomatoes 1kg', nameAR: 'طماطم طازجة ١ كجم', price: 6.5, cost: 4, stock: 80, category: 'Vegetables', emoji: '🍅', barcode: '628300100010' },
        { nameEN: 'Bananas 1kg', nameAR: 'موز ١ كجم', price: 7, cost: 4.5, stock: 70, category: 'Fruits', emoji: '🍌', barcode: '628300100020' },
        { nameEN: 'Fresh Milk 2L', nameAR: 'حليب طازج ٢ لتر', price: 11, cost: 8, stock: 60, category: 'Dairy', emoji: '🥛', barcode: '628300100030' },
        { nameEN: 'Basmati Rice 5kg', nameAR: 'أرز بسمتي ٥ كجم', price: 42, cost: 31, stock: 40, category: 'Pantry', emoji: '🍚', barcode: '628300100040' },
        { nameEN: 'Arabic Bread (Pack)', nameAR: 'خبز عربي (ربطة)', price: 3, cost: 1.8, stock: 100, category: 'Bakery', emoji: '🫓', barcode: '628300100050' },
        { nameEN: 'Eggs (30 pcs)', nameAR: 'بيض (٣٠ حبة)', price: 22, cost: 16, stock: 50, category: 'Dairy', emoji: '🥚', barcode: '628300100060' },
        { nameEN: 'Dates Sukkari 1kg', nameAR: 'تمر سكري ١ كجم', price: 35, cost: 24, stock: 45, category: 'Pantry', emoji: '🌴', barcode: '628300100070' },
        { nameEN: 'Laundry Detergent 3L', nameAR: 'منظف غسيل ٣ لتر', price: 29, cost: 20, stock: 35, category: 'Household', emoji: '🧴', barcode: '628300100080' }
    ],
    apparel: [
        { nameEN: 'Classic White Thobe', nameAR: 'ثوب أبيض كلاسيك', price: 180, cost: 110, stock: 45, category: 'Men', emoji: '👔', barcode: '628400100010' },
        { nameEN: 'Red Shemagh', nameAR: 'شماغ أحمر', price: 120, cost: 70, stock: 40, category: 'Men', emoji: '🧣', barcode: '628400100020' },
        { nameEN: 'Embroidered Black Abaya', nameAR: 'عباءة سوداء مطرزة', price: 350, cost: 220, stock: 25, category: 'Women', emoji: '👘', barcode: '628400100030' },
        { nameEN: 'Casual Dress', nameAR: 'فستان كاجوال', price: 210, cost: 130, stock: 20, category: 'Women', emoji: '👗', barcode: '628400100040' },
        { nameEN: 'Kids T-Shirt', nameAR: 'تيشيرت أطفال', price: 45, cost: 22, stock: 60, category: 'Kids', emoji: '👕', barcode: '628400100050' },
        { nameEN: 'Leather Sandals', nameAR: 'صندل جلد', price: 160, cost: 95, stock: 30, category: 'Shoes', emoji: '🩴', barcode: '628400100060' }
    ],
    services: [
        { nameEN: 'General Consultation', nameAR: 'استشارة عامة', price: 150, cost: 0, stock: 999, category: 'Consultations', emoji: '🩺', barcode: '628500100010' },
        { nameEN: 'Follow-up Visit', nameAR: 'زيارة متابعة', price: 100, cost: 0, stock: 999, category: 'Consultations', emoji: '📋', barcode: '628500100020' },
        { nameEN: 'Home Visit', nameAR: 'زيارة منزلية', price: 300, cost: 0, stock: 999, category: 'Visits', emoji: '🏠', barcode: '628500100030' },
        { nameEN: 'AC Maintenance Visit', nameAR: 'زيارة صيانة مكيف', price: 180, cost: 40, stock: 999, category: 'Maintenance', emoji: '🛠️', barcode: '628500100040' },
        { nameEN: 'Annual Service Package', nameAR: 'باقة خدمة سنوية', price: 900, cost: 200, stock: 999, category: 'Packages', emoji: '📦', barcode: '628500100050' }
    ],
    salon: [
        { nameEN: 'Haircut', nameAR: 'قص شعر', price: 60, cost: 0, stock: 999, category: 'Hair', emoji: '💇', barcode: '628600100010' },
        { nameEN: 'Beard Trim & Shape', nameAR: 'تهذيب وتشكيل اللحية', price: 40, cost: 0, stock: 999, category: 'Grooming', emoji: '🧔', barcode: '628600100020' },
        { nameEN: 'Hair Colouring', nameAR: 'صبغ الشعر', price: 220, cost: 60, stock: 999, category: 'Hair', emoji: '🎨', barcode: '628600100030' },
        { nameEN: 'Facial Treatment', nameAR: 'تنظيف بشرة', price: 180, cost: 40, stock: 999, category: 'Skin care', emoji: '🧖', barcode: '628600100040' },
        { nameEN: 'Manicure & Pedicure', nameAR: 'مناكير وباديكير', price: 150, cost: 30, stock: 999, category: 'Nails', emoji: '💅', barcode: '628600100050' }
    ]
};

// The first duplicate updateCloudflareTunnelConfig was removed

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// AUTHENTICATION
global.defaultProductsBySector = {
    appliances: [
        { nameEN: 'Smart Split AC 18000 BTU', nameAR: 'مكيف سبليت ذكي 18000 وحدة', price: 2400, cost: 1700, stock: 10, category: 'appliances', emoji: '❄️', barcode: '728100100010' },
        { nameEN: 'Double Door Refrigerator 450L', nameAR: 'ثلاجة دولابي 450 لتر', price: 3500, cost: 2600, stock: 5, category: 'appliances', emoji: '🎛️', barcode: '728100100011' },
        { nameEN: 'Fully Automatic Washing Machine', nameAR: 'غسالة ملابس أوتوماتيكية بالكامل', price: 1800, cost: 1300, stock: 8, category: 'appliances', emoji: '🧺', barcode: '728100100012' },
        { nameEN: 'Digital Microwave Oven 30L', nameAR: 'ميكروويف رقمي 30 لتر', price: 450, cost: 310, stock: 15, category: 'appliances', emoji: '🍳', barcode: '728100100013' }
    ],
    furniture: [
        { nameEN: 'Luxury L-Shape Sofa Set', nameAR: 'طقم كنب فاخر على شكل حرف L', price: 4500, cost: 3200, stock: 4, category: 'furniture', emoji: '🛋️', barcode: '728200100020' },
        { nameEN: 'King Size Bed Frame with Headboard', nameAR: 'سرير مقاس كينج خشبي فخم', price: 2800, cost: 1900, stock: 6, category: 'furniture', emoji: '🛏️', barcode: '728200100021' },
        { nameEN: 'Solid Oak Dining Table (6 Chairs)', nameAR: 'طاولة طعام خشب بلوط مع 6 كراسي', price: 3200, cost: 2200, stock: 3, category: 'furniture', emoji: '🪑', barcode: '728200100022' },
        { nameEN: 'Modern Wooden Coffee Table', nameAR: 'طاولة قهوة خشبية مودرن', price: 650, cost: 420, stock: 12, category: 'furniture', emoji: '☕', barcode: '728200100023' }
    ],
    spareparts: [
        { nameEN: 'Brake Pad Set (Front)', nameAR: 'قماش فرامل أمامي', price: 180, cost: 120, stock: 25, category: 'spareparts', emoji: '🚗', barcode: '728300100030' },
        { nameEN: 'Engine Oil Filter (Synthetic)', nameAR: 'فلتر زيت محرك تخليقي', price: 35, cost: 20, stock: 60, category: 'spareparts', emoji: '🛢️', barcode: '728300100031' },
        { nameEN: 'Copper Plumbing Elbow 1/2"', nameAR: 'كوع نحاس للسباكة 1/2 بوصة', price: 12, cost: 7, stock: 150, category: 'spareparts', emoji: '🔧', barcode: '728300100032' },
        { nameEN: 'Heavy Duty HVAC Capacitor 45uF', nameAR: 'كابستور مكيف شديد التحمل 45 ميكرو', price: 45, cost: 25, stock: 40, category: 'spareparts', emoji: '⚡', barcode: '728300100033' },
        { nameEN: 'LED Circuit Board Panel', nameAR: 'لوحة دارة إلكترونية LED', price: 95, cost: 60, stock: 20, category: 'spareparts', emoji: '🔌', barcode: '728300100034' }
    ],
    retail: [
        { nameEN: 'Premium Smart Monitor 27"', nameAR: 'شاشة ذكية فاخرة 27 بوصة', price: 950, cost: 650, stock: 12, category: 'electronics', emoji: '🖥️', barcode: '628100100010' },
        { nameEN: 'Wireless Laser Scanner', nameAR: 'قارئ باركود لاسلكي ليزري', price: 250, cost: 170, stock: 8, category: 'electronics', emoji: '🔦', barcode: '628100200020' },
        { nameEN: 'Leather Executive Chair', nameAR: 'كرسي مكتب جلد فخم', price: 420, cost: 280, stock: 4, category: 'office', emoji: '💺', barcode: '628100400040' }
    ],
    freshFlowers: [
        { nameEN: 'Red Roses Luxury Bouquet', nameAR: 'باقة جوري أحمر فاخرة', price: 180, cost: 80, stock: 25, category: 'Bouquets', emoji: '🌹', barcode: '628900100010' },
        { nameEN: 'Spring Mix Tulips & Lilies', nameAR: 'تنسيق ربيعي توليب وزنبق', price: 240, cost: 110, stock: 15, category: 'Arrangements', emoji: '🌷', barcode: '628900100020' },
        { nameEN: 'White Orchid in Ceramic Pot', nameAR: 'أوركيد أبيض في حوض سيراميك', price: 320, cost: 150, stock: 10, category: 'Potted Plants', emoji: '🪴', barcode: '628900100030' },
        { nameEN: 'Bridal Hand Bouquet', nameAR: 'مسكة عروس ملكية', price: 450, cost: 200, stock: 8, category: 'Weddings', emoji: '💐', barcode: '628900100040' },
        { nameEN: 'Flower & Belgian Chocolate Box', nameAR: 'بوكس ورد وشوكولاتة بلجيكية', price: 290, cost: 130, stock: 20, category: 'Gift Boxes', emoji: '🎁', barcode: '628900100050' },
        { nameEN: 'Single Long Stem Rose', nameAR: 'وردة جوري مفردة مع تغليف', price: 15, cost: 5, stock: 100, category: 'Single Flowers', emoji: '🥀', barcode: '628900100060' }
    ],
    tailoring: [
        { nameEN: 'Japanese Semiramis White Fabric (Per Meter)', nameAR: 'قماش سميراميس ياباني أبيض (بالمتر)', price: 45, cost: 25, stock: 120, category: 'Fabrics', emoji: '🧵', barcode: '628700100010' },
        { nameEN: 'Japanese Cream Soft Fabric (Per Meter)', nameAR: 'قماش ياباني كريمي طايح (بالمتر)', price: 50, cost: 28, stock: 95, category: 'Fabrics', emoji: '🧶', barcode: '628700100020' },
        { nameEN: 'English Winter Cashmere Wool (Per Meter)', nameAR: 'صوف كشمير شتوي إنجليزي (بالمتر)', price: 95, cost: 55, stock: 60, category: 'Fabrics', emoji: '🧥', barcode: '628700100030' },
        { nameEN: 'Italian Super 130s Navy Suiting (Per Meter)', nameAR: 'قماش بدلة إيطالي كحلي فاخر (بالمتر)', price: 140, cost: 80, stock: 45, category: 'Fabrics', emoji: '🕴️', barcode: '628700100040' },
        { nameEN: 'Korean Silk Black Abaya Crepe (Per Meter)', nameAR: 'كريب حرير كوري أسود للعبايات (بالمتر)', price: 65, cost: 35, stock: 85, category: 'Fabrics', emoji: '👘', barcode: '628700100050' },
        { nameEN: 'Luxury Cufflinks Set (Silver/Onyx)', nameAR: 'طقم كبك رجالي فضي ملكي', price: 120, cost: 55, stock: 30, category: 'Accessories', emoji: '💎', barcode: '628700100060' }
    ]
};

const https = require('https');
const dns = require('dns');

const customResolver = new dns.Resolver();
customResolver.setServers(['1.1.1.1', '8.8.8.8']);

function requestCloudflare(url, options, body = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            lookup: (hostname, opts, callback) => {
                customResolver.resolve4(hostname, (err, addresses) => {
                    if (err) return callback(err);
                    if (!addresses || addresses.length === 0) return callback(new Error('No addresses found'));
                    if (opts.all) {
                        return callback(null, addresses.map(a => ({ address: a, family: 4 })));
                    }
                    callback(null, addresses[0], 4);
                });
            }
        };

        const req = https.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        });

        req.on('error', (err) => reject(err));
        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

// Function to update Cloudflare Zero Trust Tunnel configuration dynamically
async function updateCloudflareTunnelConfig(tenantDomain) {
    const cfAccountId = (process.env.CF_ACCOUNT_ID || '').replace(/^"|"$/g, '');
    const cfTunnelId = (process.env.CF_TUNNEL_ID || '').replace(/^"|"$/g, '');
    const cfApiToken = (process.env.CF_API_TOKEN || '').replace(/^"|"$/g, '');

    if (!cfAccountId || !cfTunnelId || !cfApiToken) {
        console.warn('Cloudflare credentials missing. Skipping Tunnel update.');
        return { success: false, error: 'Cloudflare credentials missing' };
    }

    try {
        const headers = {
            'Authorization': `Bearer ${cfApiToken}`,
            'Content-Type': 'application/json'
        };

        // 1. Get Zone ID for the base domain
        const baseDomain = tenantDomain.split('.').slice(1).join('.');
        let cfZoneId = null;
        
        const zoneData = await requestCloudflare(`https://api.cloudflare.com/client/v4/zones?name=${baseDomain}`, { headers });
        
        if (zoneData.success && zoneData.result.length > 0) {
            cfZoneId = zoneData.result[0].id;
        } else {
            console.error('Failed to fetch Zone ID for', baseDomain, zoneData.errors);
            return { success: false, error: 'Failed to fetch Zone ID', details: zoneData.errors };
        }

        // 2. Create DNS CNAME record for the tenant
        if (cfZoneId) {
            const dnsPayload = {
                type: 'CNAME',
                name: tenantDomain,
                content: `${cfTunnelId}.cfargotunnel.com`,
                ttl: 1, // Auto
                proxied: true
            };
            
            const dnsData = await requestCloudflare(`https://api.cloudflare.com/client/v4/zones/${cfZoneId}/dns_records`, {
                method: 'POST',
                headers
            }, dnsPayload);
            
            if (dnsData.success) {
                console.log(`Successfully created CNAME record for ${tenantDomain}`);
            } else {
                // If it already exists, that's fine (code 81053)
                const exists = dnsData.errors.some(e => e.code === 81053 || e.message.includes('already exists'));
                if (exists) {
                    console.log(`CNAME record for ${tenantDomain} already exists.`);
                } else {
                    console.error('Failed to create CNAME record:', dnsData.errors);
                }
            }
        }

        // 3. Fetch existing Tunnel configuration
        const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/cfd_tunnel/${cfTunnelId}/configurations`;
        const fetchData = await requestCloudflare(url, { headers });

        if (!fetchData.success) {
            console.error('Failed to fetch CF Tunnel config:', fetchData.errors);
            return { success: false, error: 'Failed to fetch CF Tunnel config', details: fetchData.errors };
        }

        const config = fetchData.result.config;
        if (!config || !config.ingress) {
            console.error('CF Tunnel config is malformed.');
            return { success: false, error: 'CF Tunnel config is malformed' };
        }

        // 4. Check if route already exists in Tunnel
        const routeExists = config.ingress.some(route => route.hostname === tenantDomain);
        if (routeExists) {
            console.log(`Route for ${tenantDomain} already exists in Cloudflare Tunnel.`);
            return { success: true, message: 'Route already exists' };
        }

        // 5. Add new route to Tunnel
        const newRoute = {
            hostname: tenantDomain,
            service: "http://127.0.0.1:30184"
        };
        
        // Find index of catch-all rule to insert before it
        const catchAllIndex = config.ingress.findIndex(route => !route.hostname || route.service === 'http_status:404');
        if (catchAllIndex !== -1) {
            config.ingress.splice(catchAllIndex, 0, newRoute);
        } else {
            config.ingress.push(newRoute);
        }

        // 6. Update the Tunnel configuration
        const updateData = await requestCloudflare(url, {
            method: 'PUT',
            headers
        }, { config });

        if (updateData.success) {
            console.log(`Successfully added Cloudflare Tunnel route for ${tenantDomain}`);
            return { success: true, message: 'Tunnel updated successfully' };
        } else {
            console.error('Failed to update CF Tunnel config:', updateData.errors);
            return { success: false, error: 'Failed to update CF Tunnel config', details: updateData.errors };
        }
    } catch (err) {
        console.error('Error updating Cloudflare Tunnel:', err);
        return { success: false, error: err.message, cause: err.cause ? err.cause.message : 'No cause provided' };
    }
}

async function removeCloudflareTunnelConfig(tenantDomain) {
    const cfAccountId = (process.env.CF_ACCOUNT_ID || '').replace(/^"|"$/g, '');
    const cfTunnelId = (process.env.CF_TUNNEL_ID || '').replace(/^"|"$/g, '');
    const cfApiToken = (process.env.CF_API_TOKEN || '').replace(/^"|"$/g, '');

    if (!cfAccountId || !cfTunnelId || !cfApiToken) {
        console.warn('Cloudflare credentials missing. Skipping Tunnel removal.');
        return;
    }

    try {
        const headers = {
            'Authorization': `Bearer ${cfApiToken}`,
            'Content-Type': 'application/json'
        };

        const baseDomain = tenantDomain.split('.').slice(1).join('.');
        let cfZoneId = null;
        
        const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${baseDomain}`, { headers });
        const zoneData = await zoneRes.json();
        
        if (zoneData.success && zoneData.result.length > 0) {
            cfZoneId = zoneData.result[0].id;
        }

        if (cfZoneId) {
            // Find the DNS record ID
            const dnsListRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${cfZoneId}/dns_records?name=${tenantDomain}`, { headers });
            const dnsListData = await dnsListRes.json();
            
            if (dnsListData.success && dnsListData.result.length > 0) {
                const recordId = dnsListData.result[0].id;
                // Delete the DNS record
                const delRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${cfZoneId}/dns_records/${recordId}`, {
                    method: 'DELETE',
                    headers
                });
                const delData = await delRes.json();
                if (delData.success) {
                    console.log(`Successfully removed Cloudflare DNS record for ${tenantDomain}`);
                } else {
                    console.error('Failed to remove DNS record:', delData.errors);
                }
            } else {
                console.log(`No DNS record found for ${tenantDomain} to remove.`);
            }
        }
        
        // Note: We don't necessarily need to remove the route from the Tunnel config JSON 
        // since it just maps to a local service that doesn't exist anymore, but we could 
        // fetch and update it if needed. Removing the DNS record is sufficient to stop traffic.
        
    } catch (err) {
        console.error('Error removing Cloudflare Tunnel config:', err);
    }
}

global.mockDb = mockDb;
global.generateZATCAXML = generateZATCAXML;
global.sha256Node = sha256Node;
global.signHashNode = signHashNode;
global.getTenantId = getTenantId;
global.defaultProductsBySector = defaultProductsBySector;
global.sendLicenseEmail = sendLicenseEmail;
global.sendPasswordResetEmail = sendPasswordResetEmail;
global.updateCloudflareTunnelConfig = updateCloudflareTunnelConfig;
global.removeCloudflareTunnelConfig = removeCloudflareTunnelConfig;

const resolveTenantMiddleware = async (req, res, next) => {
    const host = (req.headers.host || '').split(':')[0].toLowerCase();
    const baseDomain = getBaseDomain(host);
    
    if (!host.endsWith(baseDomain) && host !== 'localhost') {
        if (global.isMongoConnected) {
            try {
                const { CustomDomain } = require('./models');
                const customDomain = await CustomDomain.findOne({ domain: host, status: 'verified' });
                if (customDomain) {
                    req.tenantId = customDomain.tenantId;
                    return next();
                }
            } catch (err) {
                console.error('Error resolving custom domain:', err);
            }
        }
    }
    req.tenantId = getTenantId(req);
    next();
};
app.use(resolveTenantMiddleware);

const apiRoutes = require('./routes/api');
app.use('/', apiRoutes);

const frontendBuild = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(path.join(__dirname, 'public')));
if (process.env.UPLOADS_DIR) {
    app.use('/uploads', express.static(process.env.UPLOADS_DIR));
}
app.use(express.static(frontendBuild));

app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`26i POS & ERP server running on http://localhost:${PORT}`);
});
