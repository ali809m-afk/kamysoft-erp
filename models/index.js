const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    id: { type: String, required: true },
    username: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true },
    tenantId: { type: String, default: 'default', index: true },
    isActive: { type: Boolean, default: true }
});
userSchema.index({ id: 1, tenantId: 1 }, { unique: true });
userSchema.index({ username: 1, tenantId: 1 }, { unique: true });
const User = mongoose.model('User', userSchema);

const productSchema = new mongoose.Schema({
    id: { type: String, required: true },
    nameEN: { type: String, required: true },
    nameAR: { type: String, required: true },
    price: { type: Number, required: true },
    cost: { type: Number, required: true },
    stock: { type: Number, required: true },
    category: { type: String, required: true },
    emoji: { type: String },
    barcode: { type: String },
    isDigital: { type: Boolean, default: false },
    digitalAssetUrl: { type: String, default: '' },
    digitalAssetInstructions: { type: String, default: '' },
    variants: [{
        name: { type: String, required: true },
        options: [{ type: String, required: true }]
    }],
    tenantId: { type: String, default: 'default', index: true }
});
productSchema.index({ id: 1, tenantId: 1 }, { unique: true });
const Product = mongoose.model('Product', productSchema);

const invoiceItemSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true }
});
const invoiceSchema = new mongoose.Schema({
    id: { type: String, required: true },
    uuid: { type: String, required: true },
    csn: { type: Number, required: true },
    pih: { type: String, required: true },
    xmlHashBase64: { type: String },
    xmlHash: { type: String },
    xml: { type: String },
    signature: { type: String },
    publicKey: { type: String },
    certSignature: { type: String },
    qrCode: { type: String },
    paymentMethod: { type: String },
    branch: { type: String },
    notes: { type: String },
    originalInvoiceId: { type: String },
    invoiceTypeCode: { type: String, default: '388' },
    invoiceTypeCodeName: { type: String, default: '0200000' },
    customer: { type: String, required: true },
    items: [invoiceItemSchema],
    discount: { type: Number, default: 0 },
    vat: { type: Number, required: true },
    total: { type: Number, required: true },
    date: { type: String, required: true },
    zatcaStatus: { type: String, required: true },
    tenantId: { type: String, default: 'default', index: true }
});
invoiceSchema.index({ id: 1, tenantId: 1 }, { unique: true });
const Invoice = mongoose.model('Invoice', invoiceSchema);

const quotationItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true }
});
const quotationSchema = new mongoose.Schema({
    id: { type: String, required: true },
    date: { type: String, required: true },
    customer: { type: String, required: true },
    items: [quotationItemSchema],
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    vat: { type: Number, required: true },
    tenantId: { type: String, default: 'default', index: true }
});
quotationSchema.index({ id: 1, tenantId: 1 }, { unique: true });
const Quotation = mongoose.model('Quotation', quotationSchema);

const expenseSchema = new mongoose.Schema({
    id: { type: String, required: true },
    date: { type: String, required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    description: { type: String },
    tenantId: { type: String, default: 'default', index: true }
});
expenseSchema.index({ id: 1, tenantId: 1 }, { unique: true });
const Expense = mongoose.model('Expense', expenseSchema);

const assetSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    cost: { type: Number, required: true },
    salvage: { type: Number, default: 0 },
    life: { type: Number, required: true },
    date: { type: String, required: true },
    status: { type: String, required: true },
    department: { type: String, required: true },
    serial: { type: String },
    supplier: { type: String },
    assignedTo: { type: String },
    tenantId: { type: String, default: 'default', index: true }
});
assetSchema.index({ id: 1, tenantId: 1 }, { unique: true });
const Asset = mongoose.model('Asset', assetSchema);

const customerSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
    points: { type: Number, default: 0 },
    spent: { type: Number, default: 0 },
    portalPassword: { type: String },
    tenantId: { type: String, default: 'default', index: true }
});
customerSchema.index({ id: 1, tenantId: 1 }, { unique: true });
const Customer = mongoose.model('Customer', customerSchema);

const employeeSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    dept: { type: String, required: true },
    position: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    salary: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    tenantId: { type: String, default: 'default', index: true }
});
employeeSchema.index({ id: 1, tenantId: 1 }, { unique: true });
const Employee = mongoose.model('Employee', employeeSchema);

const supplierSchema = new mongoose.Schema({
    id: { type: String, required: true },
    company: { type: String, required: true },
    contact: { type: String },
    phone: { type: String },
    items: { type: String },
    tenantId: { type: String, default: 'default', index: true }
});
supplierSchema.index({ id: 1, tenantId: 1 }, { unique: true });
const Supplier = mongoose.model('Supplier', supplierSchema);

const orderSchema = new mongoose.Schema({
    id: { type: String, required: true },
    date: { type: String, required: true },
    customer: { type: String, required: true },
    items: { type: String, required: true },
    total: { type: Number, required: true },
    status: { type: String, required: true },
    tenantId: { type: String, default: 'default', index: true }
});
orderSchema.index({ id: 1, tenantId: 1 }, { unique: true });
const Order = mongoose.model('Order', orderSchema);

const settingsSchema = new mongoose.Schema({
    tenantId: { type: String, default: 'default', index: true, unique: true },
    businessName: { type: String, required: true },
    vatNumber: { type: String, required: true },
    taxRate: { type: Number, required: true },
    baseCurrency: { type: String, required: true },
    logo: { type: String },
    businessAddress: { type: String },
    crNumber: { type: String },
    contactNumber: { type: String },
    exchangeRates: {
        type: Map,
        of: Number
    },
    branches: [
        {
            name: String,
            address: String,
            phone: String
        }
    ],
    currentBranch: { type: String, default: 'Main Branch - Riyadh' },
    businessType: { type: String, default: 'retail' },
    enableTables: { type: Boolean, default: false },
    enableServiceDuration: { type: Boolean, default: false },
    enabledModules: { type: Object, default: {} },
    visibleModules: { type: Object, default: {} },
    smtp: {
        provider: { type: String, default: 'smtp' }, // 'smtp' or 'sendgrid'
        host: { type: String },
        port: { type: Number },
        user: { type: String },
        password: { type: String },
        fromEmail: { type: String },
        sendgridApiKey: { type: String }
    },
    
    // SaaS Registration Details
    email: { type: String },
    fullName: { type: String },
    mobile: { type: String },
    nationalAddress: { type: String },
    
    // License Tracking
    licenseKey: { type: String },
    licenseStatus: { type: String, default: 'active' }, // 'active', 'expired', 'pending_verification'
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    licenseExpiresAt: { type: Date },
    
    // Public Portal Settings
    portalImages: [{ type: String }],
    portalDescription: { type: String },
    portalDescriptionAr: { type: String },
    portalAmenities: [{ type: String }],
    contactEmail: { type: String },
    contactPhone: { type: String },
    contactAddress: { type: String },
    contactAddressAr: { type: String },
    iban: { type: String },
    socialLinks: {
        facebook: { type: String },
        instagram: { type: String },
        twitter: { type: String }
    },
    
    // SaaS Themes
    activeTheme: { type: String, default: 'default' },
    themeConfig: { type: Object, default: {} },

    // Hardware Integrations
    keycardConfig: {
        vendor: { type: String, default: 'mock' }, // e.g. AssaAbloy, VingCard
        endpoint: { type: String, default: 'http://localhost:5000' }
    },
    zatcaConn: {
        env: { type: String, default: 'sandbox' },
        endpoint: { type: String, default: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal' },
        clientId: { type: String, default: '' },
        clientSecret: { type: String, default: '' },
        privateKey: { type: String, default: '' },
        publicKey: { type: String, default: '' },
        csr: { type: String, default: '' },
        deviceSerial: { type: String, default: '1-26I|2-POS|3-ed22f1d8-e6a2-1118-9b58-d9a8f11e445f' },
        otp: { type: String, default: '' },
        autoSend: { type: Boolean, default: false },
        status: { type: String, default: 'DISCONNECTED' },
        requestId: { type: String, default: '' }
    }
});
const Settings = mongoose.model('Settings', settingsSchema);

const inquirySchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    businessName: { type: String },
    businessType: { type: String },
    branches: { type: Number, default: 1 },
    message: { type: String },
    createdAt: { type: Date, default: Date.now }
});
const Inquiry = mongoose.model('Inquiry', inquirySchema);

const subscriptionPaymentSchema = new mongoose.Schema({
    tenantId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['Paid', 'Pending', 'Failed'], default: 'Paid' },
    method: { type: String, default: 'Bank Transfer' },
    reference: { type: String }
});
const SubscriptionPayment = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);

// --- NEW SCHEMAS FOR MODERNIZATION ---

const warehouseSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    location: { type: String },
    manager: { type: String },
    tenantId: { type: String, default: 'default', index: true }
});
const Warehouse = mongoose.model('Warehouse', warehouseSchema);

const inventoryTxSchema = new mongoose.Schema({
    txId: { type: String, required: true },
    date: { type: Date, default: Date.now },
    type: { type: String, enum: ['IN', 'OUT', 'TRANSFER', 'ADJUST'], required: true },
    productId: { type: String, required: true },
    qty: { type: Number, required: true },
    warehouseId: { type: String, required: true },
    toWarehouseId: { type: String }, // For transfers
    tenantId: { type: String, default: 'default', index: true }
});
const InventoryTx = mongoose.model('InventoryTx', inventoryTxSchema);

const journalEntrySchema = new mongoose.Schema({
    entryId: { type: String, required: true },
    date: { type: Date, default: Date.now },
    description: { type: String, required: true },
    account: { type: String, required: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    tenantId: { type: String, default: 'default', index: true }
});
const JournalEntry = mongoose.model('JournalEntry', journalEntrySchema);

const accountSchema = new mongoose.Schema({
    code: { type: String, required: true },
    nameEN: { type: String, required: true },
    nameAR: { type: String, required: true },
    type: { type: String, enum: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'], required: true },
    balance: { type: Number, default: 0 },
    tenantId: { type: String, default: 'default', index: true }
});
accountSchema.index({ code: 1, tenantId: 1 }, { unique: true });
const Account = mongoose.model('Account', accountSchema);


const voucherSchema = new mongoose.Schema({
    voucherId: { type: String, required: true },
    type: { type: String, enum: ['RECEIPT', 'PAYMENT'], required: true },
    date: { type: Date, default: Date.now },
    entityType: { type: String, enum: ['CUSTOMER', 'SUPPLIER', 'OTHER'], required: true },
    entityId: { type: String },
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    description: { type: String },
    tenantId: { type: String, default: 'default', index: true }
});
const Voucher = mongoose.model('Voucher', voucherSchema);

const salarySchema = new mongoose.Schema({
    salaryId: { type: String, required: true },
    employeeId: { type: String, required: true },
    date: { type: Date, default: Date.now },
    amount: { type: Number, required: true },
    deductions: { type: Number, default: 0 },
    bonuses: { type: Number, default: 0 },
    netPay: { type: Number, required: true },
    month: { type: String, required: true },
    tenantId: { type: String, default: 'default', index: true }
});
const Salary = mongoose.model('Salary', salarySchema);

const purchaseInvoiceSchema = new mongoose.Schema({
    invoiceId: { type: String, required: true },
    supplierId: { type: String, required: true },
    date: { type: Date, default: Date.now },
    items: [
        {
            productId: { type: String, required: true },
            qty: { type: Number, required: true },
            cost: { type: Number, required: true }
        }
    ],
    subtotal: { type: Number, required: true },
    vat: { type: Number, required: true },
    total: { type: Number, required: true },
    tenantId: { type: String, default: 'default', index: true }
});
const PurchaseInvoice = mongoose.model('PurchaseInvoice', purchaseInvoiceSchema);

const returnInvoiceSchema = new mongoose.Schema({
    returnId: { type: String, required: true },
    originalInvoiceId: { type: String, required: true },
    type: { type: String, enum: ['SALES', 'PURCHASE'], required: true },
    date: { type: Date, default: Date.now },
    items: [
        {
            productId: { type: String, required: true },
            qty: { type: Number, required: true },
            price: { type: Number, required: true }
        }
    ],
    totalReturn: { type: Number, required: true },
    tenantId: { type: String, default: 'default', index: true }
});
const ReturnInvoice = mongoose.model('ReturnInvoice', returnInvoiceSchema);

const propertyOwnerSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
    bankDetails: { type: String },
    tenantId: { type: String, default: 'default', index: true }
});
propertyOwnerSchema.index({ id: 1, tenantId: 1 }, { unique: true });
const PropertyOwner = mongoose.model('PropertyOwner', propertyOwnerSchema);

const propertySchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['Resort', 'Building', 'Hotel', 'Compound'], required: true },
    location: { type: String },
    city: { type: String, default: '' },
    address: { type: String, default: '' },
    starRating: { type: Number, default: 4 },
    checkInTime: { type: String, default: '14:00' },
    checkOutTime: { type: String, default: '12:00' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    amenities: [{ type: String }], // e.g. WiFi, Pool, Parking, AC, Breakfast, Gym, Spa
    status: { type: String, enum: ['Active', 'Maintenance', 'Sold'], default: 'Active' },
    ownerId: { type: String },
    tenantId: { type: String, default: 'default', index: true },
    images: [{ type: String }] // Array of image URLs
});
const Property = mongoose.model('Property', propertySchema);

const unitSchema = new mongoose.Schema({
    id: { type: String, required: true },
    propertyId: { type: String, required: true },
    unitNumber: { type: String, required: true },
    name: { type: String },
    type: { type: String, enum: ['Room', 'Suite', 'Apartment', 'Villa'], required: true },
    roomType: { type: String, default: 'Deluxe' }, // Standard, Deluxe, Executive, Presidential, Villa
    beds: { type: Number, default: 1 },
    maxAdults: { type: Number, default: 2 },
    maxChildren: { type: Number, default: 1 },
    floor: { type: String, default: '1' },
    amenities: [{ type: String }],
    dailyRate: { type: Number, required: true },
    status: { type: String, enum: ['Available', 'Occupied', 'Maintenance', 'Reserved'], default: 'Available' },
    cleaningStatus: { type: String, enum: ['Clean', 'Dirty', 'Inspecting', 'OutOfService'], default: 'Clean' },
    images: [{ type: String }],
    tenantId: { type: String, default: 'default', index: true }
});
const Unit = mongoose.model('Unit', unitSchema);

const groupBlockSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    status: { type: String, enum: ['Tentative', 'Definite', 'Cancelled'], default: 'Tentative' },
    companyId: { type: String }, // For corporate events
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    roomsBlocked: { type: Number, required: true },
    rate: { type: Number, required: true },
    tenantId: { type: String, default: 'default', index: true }
});
const GroupBlock = mongoose.model('GroupBlock', groupBlockSchema);

const bookingSchema = new mongoose.Schema({
    id: { type: String, required: true },
    bookingNumber: { type: String },
    unitId: { type: String, required: true },
    customerId: { type: String, required: true },
    customerName: { type: String },
    customerPhone: { type: String },
    groupBlockId: { type: String }, // Links to GroupBlock
    billingRouting: {
        roomCharges: { type: String, enum: ['Guest', 'Company'], default: 'Guest' },
        extraCharges: { type: String, enum: ['Guest', 'Company'], default: 'Guest' },
        companyId: { type: String }
    },
    checkInDate: { type: Date, required: true },
    checkOutDate: { type: Date, required: true },
    adults: { type: Number, default: 1 },
    children: { type: Number, default: 0 },
    extraServices: [{
        serviceId: { type: String },
        name: { type: String },
        price: { type: Number },
        qty: { type: Number, default: 1 }
    }],
    dailyRate: { type: Number },
    discount: { type: Number, default: 0 },
    subtotal: { type: Number },
    vat: { type: Number },
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['Unpaid', 'PartiallyPaid', 'Paid', 'Refunded'], default: 'Paid' },
    status: { type: String, enum: ['Pending', 'Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled', 'NoShow'], default: 'Confirmed' },
    notes: { type: String },
    zatcaQrCode: { type: String },
    zatcaInvoiceId: { type: String },
    tenantId: { type: String, default: 'default', index: true }
});
const Booking = mongoose.model('Booking', bookingSchema);

// QloApps Extra Hotel & Property Services (Airport pickup, Breakfast, Spa, Extra Bed, Housekeeping)
const hotelServiceSchema = new mongoose.Schema({
    id: { type: String, required: true },
    nameEN: { type: String, required: true },
    nameAR: { type: String, required: true },
    price: { type: Number, required: true },
    priceType: { type: String, enum: ['PerStay', 'PerNight', 'PerPerson'], default: 'PerStay' },
    icon: { type: String, default: 'ri-service-line' },
    description: { type: String },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    tenantId: { type: String, default: 'default', index: true }
});
hotelServiceSchema.index({ id: 1, tenantId: 1 }, { unique: true });
const HotelService = mongoose.model('HotelService', hotelServiceSchema);

// QloApps Dynamic Rates & Price Rules (Seasonal multipliers, weekend surcharges, promo rates)
const priceRuleSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    propertyId: { type: String }, // optional, if specific property
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    ruleType: { type: String, enum: ['Multiplier', 'FixedDiscount', 'PercentageDiscount', 'CustomRate'], default: 'Multiplier' },
    value: { type: Number, required: true }, // e.g. 1.2 (+20% in season) or 50 (50 SAR off)
    daysOfWeek: [{ type: Number }], // 0 for Sunday ... 6 for Saturday
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    tenantId: { type: String, default: 'default', index: true }
});
priceRuleSchema.index({ id: 1, tenantId: 1 }, { unique: true });
const PriceRule = mongoose.model('PriceRule', priceRuleSchema);

const maintenanceTaskSchema = new mongoose.Schema({
    id: { type: String, required: true },
    propertyId: { type: String }, // For Facility maintenance
    unitId: { type: String }, // Optional, since it could be facility-wide
    maintenanceType: { type: String, enum: ['Corrective', 'Preventative'], default: 'Corrective' },
    frequency: { type: String, enum: ['None', 'Daily', 'Weekly', 'Monthly', 'Yearly'], default: 'None' },
    nextScheduledDate: { type: Date },
    description: { type: String, required: true },
    reportedDate: { type: Date, default: Date.now },
    resolvedDate: { type: Date },
    status: { type: String, enum: ['Pending', 'InProgress', 'Completed'], default: 'Pending' },
    cost: { type: Number, default: 0 },
    assignedTo: { type: String }, // references Employee ID
    assignedSupplierId: { type: String }, // references Supplier ID
    vendorCost: { type: Number, default: 0 },
    tenantId: { type: String, default: 'default', index: true }
});
const MaintenanceTask = mongoose.model('MaintenanceTask', maintenanceTaskSchema);

const propertyInvoiceSchema = new mongoose.Schema({
    id: { type: String, required: true },
    bookingId: { type: String, required: true },
    customerId: { type: String, required: true },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    subtotal: { type: Number, required: true },
    vat: { type: Number, required: true },
    total: { type: Number, required: true },
    status: { type: String, enum: ['Unpaid', 'Paid', 'Cancelled'], default: 'Unpaid' },
    tenantId: { type: String, default: 'default', index: true }
});
const PropertyInvoice = mongoose.model('PropertyInvoice', propertyInvoiceSchema);

// Leasing & Contracts (Real Estate expansion)
const leaseContractSchema = new mongoose.Schema({
    tenantId: { type: String, default: 'default', index: true },
    unitId: { type: String, required: true },
    customerId: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    rentAmount: { type: Number, required: true },
    paymentFrequency: { type: String, enum: ['Monthly', 'Quarterly', 'Semi-Annually', 'Yearly', 'One-time'], default: 'Monthly' },
    installments: [{
        dueDate: { type: Date, required: true },
        amount: { type: Number, required: true },
        status: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
        invoiceId: { type: String }
    }],
    managementFeeType: { type: String, enum: ['Percentage', 'Fixed'], default: 'Percentage' },
    managementFeeValue: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'Expired', 'Terminated'], default: 'Active' },
    createdAt: { type: Date, default: Date.now }
});
const LeaseContract = mongoose.model('LeaseContract', leaseContractSchema);

// Real Estate CRM Leads
const leadSchema = new mongoose.Schema({
    id: { type: String, required: true },
    tenantId: { type: String, default: 'default', index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    source: { type: String, enum: ['Website', 'Referral', 'Walk-in', 'Social Media', 'Other'], default: 'Website' },
    status: { type: String, enum: ['New', 'Contacted', 'Viewing Scheduled', 'Negotiation', 'Won', 'Lost'], default: 'New' },
    interestedPropertyId: { type: String }, // optional ref to Property
    budget: { type: Number },
    notes: [{
        date: { type: Date, default: Date.now },
        user: { type: String }, // who added the note
        content: { type: String, required: true }
    }],
    createdAt: { type: Date, default: Date.now }
});
const Lead = mongoose.model('Lead', leadSchema);

// SaaS Custom Domains
const customDomainSchema = new mongoose.Schema({
    domain: { type: String, required: true, unique: true },
    tenantId: { type: String, required: true, index: true },
    status: { type: String, enum: ['pending', 'verified'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});
const CustomDomain = mongoose.model('CustomDomain', customDomainSchema);

// Restaurant Module Schemas
const printerConfigSchema = new mongoose.Schema({
    category: { type: String, required: true },
    ip: { type: String, required: true },
    port: { type: Number, default: 9100 },
    tenantId: { type: String, default: 'default', index: true }
});
printerConfigSchema.index({ category: 1, tenantId: 1 }, { unique: true });
const PrinterConfig = mongoose.model('PrinterConfig', printerConfigSchema);

const restaurantOrderSchema = new mongoose.Schema({
    id: { type: String, required: true },
    tableNumber: { type: String, required: true },
    customer: { type: String },
    items: [
        {
            productId: { type: String, required: true },
            name: { type: String, required: true },
            price: { type: Number, required: true },
            qty: { type: Number, required: true },
            category: { type: String },
            isPrinted: { type: Boolean, default: false }
        }
    ],
    status: { type: String, enum: ['Open', 'Paid'], default: 'Open' },
    subtotal: { type: Number, required: true },
    vat: { type: Number, required: true },
    total: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    tenantId: { type: String, default: 'default', index: true }
});
restaurantOrderSchema.index({ id: 1, tenantId: 1 }, { unique: true });
const RestaurantOrder = mongoose.model('RestaurantOrder', restaurantOrderSchema);


const flowerArrangementSchema = new mongoose.Schema({
    id: { type: String, required: true },
    tenantId: { type: String, default: 'default', index: true },
    name: { type: String, required: true },
    components: { type: String, required: true },
    price: { type: Number, required: true },
    status: { type: String, default: 'Active' },
    createdAt: { type: Date, default: Date.now }
});
flowerArrangementSchema.index({ id: 1, tenantId: 1 }, { unique: true });
const FlowerArrangement = mongoose.model('FlowerArrangement', flowerArrangementSchema);

const flowerDeliverySchema = new mongoose.Schema({
    id: { type: String, required: true },
    tenantId: { type: String, default: 'default', index: true },
    customer: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    status: { type: String, default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});
flowerDeliverySchema.index({ id: 1, tenantId: 1 }, { unique: true });
const FlowerDelivery = mongoose.model('FlowerDelivery', flowerDeliverySchema);

// ==========================================
// TAILORING & BESPOKE GARMENTS MODULE SCHEMAS
// ==========================================

const measurementProfileSchema = new mongoose.Schema({
    id: { type: String, required: true },
    tenantId: { type: String, default: 'default', index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    profileName: { type: String, required: true },
    garmentType: { type: String, enum: ['Thobe', 'Suit', 'Shirt', 'Trouser', 'Abaya', 'Dress', 'Uniform'], default: 'Thobe' },
    unit: { type: String, enum: ['inch', 'cm'], default: 'inch' },
    measurements: {
        length: { type: String, default: '' },
        shoulder: { type: String, default: '' },
        chest: { type: String, default: '' },
        waist: { type: String, default: '' },
        hips: { type: String, default: '' },
        sleeveLength: { type: String, default: '' },
        wrist: { type: String, default: '' },
        neck: { type: String, default: '' },
        armhole: { type: String, default: '' },
        bottomWidth: { type: String, default: '' },
        trouserLength: { type: String, default: '' },
        inseam: { type: String, default: '' },
        thigh: { type: String, default: '' },
        knee: { type: String, default: '' }
    },
    stylePreferences: {
        collarType: { type: String, default: 'Mandarin (قلاب صيني)' },
        cuffType: { type: String, default: 'Plain Sleeve (سادة)' },
        placketType: { type: String, default: 'Hidden Buttons (جبزور مخفي)' },
        pocketStyle: { type: String, default: 'Classic Chest + 2 Side' },
        fitType: { type: String, default: 'Regular (عادي)' },
        stitchType: { type: String, default: 'Single Hidden (خياطة مخفية)' },
        buttonStyle: { type: String, default: 'Standard Pearl' },
        embroideryNotes: { type: String, default: '' }
    },
    postureNotes: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});
measurementProfileSchema.index({ id: 1, tenantId: 1 }, { unique: true });
const MeasurementProfile = mongoose.model('MeasurementProfile', measurementProfileSchema);

const tailoringJobCardSchema = new mongoose.Schema({
    jobCardId: { type: String, required: true },
    garmentType: { type: String, default: 'Thobe' },
    measurementProfileId: { type: String, default: '' },
    profileName: { type: String, default: '' },
    unit: { type: String, default: 'inch' },
    measurementSnapshot: { type: Object, default: {} },
    styleConfig: { type: Object, default: {} },
    fabricSource: { type: String, enum: ['Shop', 'Customer'], default: 'Shop' },
    fabricProductId: { type: String, default: '' },
    fabricName: { type: String, default: '' },
    fabricColor: { type: String, default: '' },
    fabricMeters: { type: Number, default: 3.5 },
    qty: { type: Number, default: 1 },
    stitchingPrice: { type: Number, default: 0 },
    fabricPrice: { type: Number, default: 0 },
    addOnsPrice: { type: Number, default: 0 },
    unitTotal: { type: Number, default: 0 },
    assignedCutterId: { type: String, default: '' },
    assignedCutterName: { type: String, default: '' },
    cutterCommission: { type: Number, default: 15 },
    assignedTailorId: { type: String, default: '' },
    assignedTailorName: { type: String, default: '' },
    tailorCommission: { type: Number, default: 35 },
    stage: {
        type: String,
        enum: ['Received', 'Cutting', 'Stitching', 'Finishing', 'QC', 'TrialReady', 'ReadyForPickup', 'Delivered'],
        default: 'Received'
    },
    rackNumber: { type: String, default: '' },
    fabricDeducted: { type: Boolean, default: false },
    notes: { type: String, default: '' }
});

const tailoringOrderSchema = new mongoose.Schema({
    id: { type: String, required: true },
    tenantId: { type: String, default: 'default', index: true },
    orderDate: { type: String, required: true },
    trialDate: { type: String, default: '' },
    deliveryDate: { type: String, required: true },
    priority: { type: String, enum: ['Normal', 'Express', 'VIP'], default: 'Normal' },
    customerId: { type: String, default: '' },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    items: [tailoringJobCardSchema],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    vat: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    depositPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['Unpaid', 'DepositPaid', 'Paid'], default: 'Unpaid' },
    paymentMethod: { type: String, default: 'Cash' },
    depositInvoiceId: { type: String, default: '' },
    finalInvoiceId: { type: String, default: '' },
    status: { type: String, enum: ['InProduction', 'Ready', 'Delivered', 'Cancelled'], default: 'InProduction' },
    isAlteration: { type: Boolean, default: false },
    originalOrderId: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});
tailoringOrderSchema.index({ id: 1, tenantId: 1 }, { unique: true });
const TailoringOrder = mongoose.model('TailoringOrder', tailoringOrderSchema);

module.exports = {
    FlowerArrangement, FlowerDelivery,
    MeasurementProfile, TailoringOrder,
    User, Product, Invoice, Quotation, Expense, Asset, Customer, Employee, Supplier, Order, Settings, Inquiry,
    Warehouse,
    InventoryTx,
    JournalEntry,
    Voucher,
    Salary,
    PurchaseInvoice,
    ReturnInvoice,
    SubscriptionPayment,
    Account,
    SubscriptionPayment,
    PropertyOwner,
    Property, Unit, Booking, GroupBlock, HotelService, PriceRule, MaintenanceTask, PropertyInvoice, LeaseContract, Lead, CustomDomain,
    PrinterConfig, RestaurantOrder
};
