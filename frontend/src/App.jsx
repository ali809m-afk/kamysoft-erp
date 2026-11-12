import html2pdf from 'html2pdf.js';
import React, { useState, useEffect } from 'react';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import LandingPage from './LandingPage';
import Invoices from './views/invoices/Invoices';
import Settings from './views/settings/Settings';
import Storefront from './views/storefront/Storefront';
import BookingPortal from './views/realestate/BookingPortal';
import TenantWebPortal from './views/realestate/TenantWebPortal';
import RoomDetails from './views/realestate/RoomDetails';
import StorefrontSettings from './views/storefront/StorefrontSettings';
import DigitalAssets from './views/storefront/DigitalAssets';
import Reports from './views/reports/Reports';
import ModuleSwitcher from './views/moduleSwitcher/ModuleSwitcher';
import Warehouses from './views/inventory/Warehouses';
import InventoryTransactions from './views/inventory/InventoryTransactions';
import JournalEntries from './views/financials/JournalEntries';
import FinancialTransactions from './views/financials/FinancialTransactions';
import ChartOfAccounts from './views/financials/ChartOfAccounts';
import GeneralLedger from './views/financials/GeneralLedger';
import TrialBalance from './views/financials/TrialBalance';
import BalanceSheet from './views/financials/BalanceSheet';
import IncomeStatement from './views/financials/IncomeStatement';
import CashFlow from './views/financials/CashFlow';
import Vouchers from './views/financials/Vouchers';
import Salaries from './views/people/Salaries';
import Purchases from './views/invoices/Purchases';
import Returns from './views/invoices/Returns';
import Customers from './views/people/Customers';
import Suppliers from './views/people/Suppliers';
import Inventory from './views/inventory/Inventory';
import POS from './views/pos/POS';
import Dashboard from './views/dashboard/Dashboard';
import Employees from './views/people/Employees';
import Sidebar from './components/Sidebar';
import TableManagement from './views/restaurant/TableManagement';
import PrinterSetup from './views/restaurant/PrinterSetup';
import BusinessLandingPage from './views/storefront/BusinessLandingPage';

// When the server rejects the saved login (expired, the server's login secret changed, the
// user was removed, or it belongs to another store), sign out and show the login page.
// Before, the app stayed on the dashboard and every screen silently came back empty.
// Installed once at load, before any screen starts its requests.
let onLoginRejected = null;
if (typeof window !== 'undefined' && !window.__kamyFetchWatcher) {
    window.__kamyFetchWatcher = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
        const response = await originalFetch(input, init);
        try {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            const h = init && init.headers;
            const auth = h && (typeof h.get === 'function' ? h.get('Authorization') : (h.Authorization || h.authorization));
            const isApi = url.startsWith('/api/') || url.startsWith(window.location.origin + '/api/');
            const isLogin = url.includes('/api/auth/') || url.includes('/api/tenant-portal/');
            if (auth && isApi && !isLogin && localStorage.getItem('token') && onLoginRejected) {
                if (response.status === 401) {
                    onLoginRejected();
                } else if (response.status === 403) {
                    // Only a store mismatch means the login itself is wrong; other 403s are permissions
                    const body = await response.clone().json().catch(() => ({}));
                    if (body && body.error === 'Tenant access mismatch') onLoginRejected();
                }
            }
        } catch (e) { /* never break the request */ }
        return response;
    };
}
import SaasAdmin from './SaasAdmin';
import Maintenance from './views/services/Maintenance';
import Properties from './views/realestate/Properties';
import Units from './views/realestate/Units';
import Bookings from './views/realestate/Bookings';
import GroupBlocks from './views/realestate/GroupBlocks';
import ExtraServices from './views/realestate/ExtraServices';
import PriceRules from './views/realestate/PriceRules';
import Housekeeping from './views/realestate/Housekeeping';
import LeasingContracts from './views/realestate/LeasingContracts';
import RealEstateCRM from './views/realestate/RealEstateCRM';
import PropertyOwners from './views/realestate/PropertyOwners';
import OwnerAccounting from './views/realestate/OwnerAccounting';

// Fresh Flowers
import FreshFlowersDashboard from './views/freshFlowers/FreshFlowersDashboard';
import FlowersArrangements from './views/freshFlowers/FlowersArrangements';
import FlowersDeliveries from './views/freshFlowers/FlowersDeliveries';

// Bespoke Tailoring & Workshop
import TailoringDashboard from './views/tailoring/TailoringDashboard';
import MeasurementProfiles from './views/tailoring/MeasurementProfiles';
import TailoringOrders from './views/tailoring/TailoringOrders';
import WorkshopKanban from './views/tailoring/WorkshopKanban';
import TailoringWebPortal from './views/tailoring/TailoringWebPortal';

import { applyTheme } from './themes/themeManager';

export const formatAddress = (addressStr) => {
    if (!addressStr) return '';
    try {
        const a = typeof addressStr === 'string' ? JSON.parse(addressStr) : addressStr;
        if (a && typeof a === 'object' && (a.buildingNo || a.street || a.city || a.district)) {
            return `${a.buildingNo || ''} ${a.street || ''}, ${a.district || ''}, ${a.city || ''} ${a.postalCode || ''}`.trim();
        }
    } catch (e) {
        // Not JSON, just return string
    }
    return addressStr;
};

// Automatically add x-tenant-id header to relative API calls
const getBaseDomain = (host) => {
    host = host.toLowerCase();
    if (host.endsWith('ssh-erp.26i.uk')) return 'ssh-erp.26i.uk';
    if (host.endsWith('26i.uk')) return '26i.uk';
    if (host.endsWith('localhost')) return 'localhost';
    return host;
};

const originalFetch = window.fetch;
window.fetch = function (url, options = {}) {
    if (typeof url === 'string' && url.startsWith('/api/')) {
        options.headers = options.headers || {};
        
        // Resolve tenant
        const host = window.location.hostname.toLowerCase();
        let tenant = 'default';
        
        const urlParams = new URLSearchParams(window.location.search);
        const urlTenant = urlParams.get('simTenant');
        
        const isSaaSDomain = host.endsWith('26i.uk') || host.endsWith('localhost') || host.endsWith('127.0.0.1');
        const isLocal = !isSaaSDomain || host === 'localhost' || host === '127.0.0.1';
        
        if (urlTenant) {
            tenant = urlTenant;
        } else if (isLocal || host === 'gcloud.26i.uk' || host === 'ssh-erp.26i.uk') {
            tenant = localStorage.getItem('simulatedTenant') || 'default';
            const simDomain = localStorage.getItem('simulatedDomain') || 'marketing';
            if (simDomain === 'demo') tenant = 'default';
            else if (simDomain === 'marketing') tenant = 'default';
        } else {
            const baseDomain = getBaseDomain(host);
            if (host === `demo.${baseDomain}` || host === `www.${baseDomain}` || host === baseDomain) {
                tenant = 'default';
            } else if (host.endsWith(`.${baseDomain}`)) {
                const subdomain = host.slice(0, -(baseDomain.length + 1));
                if (subdomain !== 'www' && subdomain !== 'demo') {
                    tenant = subdomain;
                }
            }
        }
        
        if (options.headers instanceof Headers) {
            options.headers.set('x-tenant-id', tenant);
        } else {
            options.headers['x-tenant-id'] = tenant;
        }
    }
    
    return originalFetch(url, options).then(response => {
        if (response.status === 401 || response.status === 403) {
            if (typeof url === 'string' && url.includes('/api/') && !url.includes('/api/auth/login')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/' + window.location.search;
            }
        }
        return response;
    });
};

// Unified Translations Dictionary
const translations = {
    en: {
        dashboard: "Dashboard",
        paymentMethod: "Payment Method",
        paymentCash: "Cash",
        paymentVisa: "Visa",
        paymentMada: "Mada",
        paymentMobile: "Mobile Pay",
        paymentStc: "STC Pay",
        paymentApplePay: "Apple Pay",
        paymentTabby: "Tabby",
        paymentTamara: "Tamara",
        paymentNinja: "Ninja",
        paymentKeeta: "Keeta",
        paymentHungerstation: "HungerStation",
        paymentSplit: "Split",
        dailyReport: "Daily Report",
        posCashier: "POS / Cashier",
        inventory: "Inventory",
        expenses: "Expenses Management",
        customers: "Customers",
        suppliers: "Suppliers",
        invoices: "Sales Management",
        orders: "Orders Management",
        assets: "Asset Management",
        permissions: "Users & Permissions",
        reports: "Detailed Reports",
        taxReport: "Tax Return Report",
        settings: "Settings",
        quotations: "Quotations",
        addQuotation: "Create Quotation",
        saveAsQuotation: "Save as Quotation",
        quotationNum: "Quotation ID",
        quotationDate: "Quotation Date",
        quotationTotal: "Total Amount",
        purchaseCost: "Purchase Cost",
        sellingPrice: "Selling Price",
        
        // ZATCA Connection Settings
        zatcaSettings: "ZATCA Connection Settings",
        zatcaEnv: "ZATCA Environment",
        zatcaEndpoint: "ZATCA Endpoint URL",
        zatcaClientId: "Client ID",
        zatcaClientSecret: "Client Secret",
        zatcaDeviceSerial: "Device Serial Number",
        csrGenerate: "Generate Private Key & CSR",
        registerDevice: "Register Device",
        zatcaStatusLabel: "Connection Status",
        zatcaStatusConnected: "CONNECTED & REGISTERED",
        zatcaStatusDisconnected: "NOT REGISTERED",

        // Reports View
        dailyReports: "Daily Report",
        monthlyReports: "Monthly Report",
        annualReports: "Annual Report",
        totalSalesTax: "Total Sales (Inc. VAT)",
        totalVatCollected: "Total VAT Collected (15%)",
        invoiceCount: "Invoices Issued",
        netSalesValue: "Net Sales Value",
        printReport: "Print Report Summary",
        
        // Dashboard Stats
        totalSales: "Total Sales",
        activeProducts: "Active Products",
        invoicesGenerated: "Invoices Generated",
        netRevenue: "Net Revenue",
        lowStockAlert: "Low Stock Alert",
        recentTransactions: "Recent Transactions",
        salesSummary: "Sales Summary",
        
        // POS interface
        searchPlaceholder: "Search products by name or code...",
        allCategories: "All Categories",
        electronics: "Electronics",
        groceries: "Groceries",
        apparel: "Apparel",
        stationery: "Stationery",
        office: "Office Equipment",
        cartTitle: "Current Cart",
        cartEmpty: "Your cart is empty",
        subtotal: "Subtotal",
        vat: "VAT (15%)",
        discount: "Discount",
        couponLabel: "Apply Coupon",
        grandTotal: "Grand Total",
        payCheckout: "Pay & Print Invoice",
        holdCart: "Hold Cart",
        clearCart: "Clear Cart",
        customerSelect: "Assign Customer",
        walkIn: "Walk-in Customer",
        
        // Orders
        orderNum: "Order ID",
        orderStatus: "Status",
        statusPending: "Pending",
        statusPreparing: "Preparing",
        statusReady: "Ready",
        statusDelivered: "Delivered",
        statusCompleted: "Completed",
        statusCancelled: "Cancelled",
        updateStatus: "Update Status",
        
        // Expenses
        addExpense: "Record New Expense",
        expenseCat: "Category",
        expenseAmount: "Amount",
        expenseDesc: "Description",
        expenseDate: "Date",
        rent: "Rent & Utilities",
        shipping: "Shipping & Logisitics",
        salaries: "Salaries",
        marketing: "Marketing",
        other: "Other Expenses",
        
        // CRM
        addCustomer: "Add New Customer",
        addSupplier: "Add New Supplier",
        custName: "Customer Name",
        suppName: "Supplier Name",
        phone: "Phone Number",
        email: "Email Address",
        loyaltyPoints: "Loyalty Points",
        totalPurchases: "Total Purchases",
        suppliedItems: "Products Supplied",

        // Assets
        addAsset: "Register New Asset",
        assetId: "Asset ID",
        assetName: "Asset Name",
        assetCost: "Purchase Cost",
        assetDate: "Purchase Date",
        assetStatus: "Status",
        assetDept: "Department / Location",
        active: "Active / operational",
        maintenance: "In Maintenance",
        disposed: "Disposed / Deprecated",
        saveAsset: "Save Asset",
        totalAssetsValue: "Total Capital Cost",
        assetSalvage: "Salvage Value",
        assetLife: "Useful Life (Years)",
        annualDepreciation: "Annual Depreciation",
        bookValue: "Current Book Value",
        serialNo: "Serial Number",
        assetSupplier: "Supplier",
        assetSummary: "Financial Asset Depreciation Summary",
        totalDepreciation: "Total Annual Depreciation",
        netBookValue: "Net Book Value of Assets",
        assignedTo: "Assigned Employee",
        unassigned: "Unassigned / Available",
        
        // Permissions
        roleSelect: "Switch User Role",
        currentRole: "Current Role",
        roleAdmin: "Administrator (All Access)",
        roleManager: "Manager (POS, Inventory, Reports)",
        roleCashier: "Cashier (POS & Sales only)",
        restrictMsg: "Some tabs are hidden based on your active role permissions.",

        // Tax Return Report
        taxStatement: "Simplified Tax Return (ZATCA Standard)",
        taxableSales: "Total Taxable Sales",
        taxCollected: "VAT Collected on Sales (15%)",
        taxableExpenses: "Total Taxable Expenses",
        taxPaid: "VAT Paid on Expenses (15%)",
        netTaxDue: "Net VAT Payable to Authority",
        netEarnings: "Net Profit (Sales - Expenses)",
        
        // Invoicing
        invoiceDetails: "Electronic Invoice Receipt",
        taxInvoice: "Simplified Tax Invoice",
        printedOn: "Date Printed",
        billedTo: "Billed To",
        cashier: "Cashier",
        vatNumber: "VAT Registered No.",
        close: "Close",
        print: "Print & Finalize",
        
        // Bonat
        bonatSystem: "Bonat Loyalty Integration",
        appliedCoupon: "Applied Coupon",
        pointsEarned: "Loyalty Points Earned",
        
        // Missing Translations fixed
        themeLabel: "Theme Mode",
        salesReport: "Welcome to Cashier, POS & Assets Management System",
        invoiceDate: "Date & Time",
        invoiceCustomer: "Customer",
        invoiceTotal: "Total Amount",
        actions: "Actions",
        addProduct: "Add New Product",
        prodId: "Product Code",
        prodName: "Product Name",
        prodCategory: "Category",
        prodStock: "Stock Qty",
        prodPrice: "Price",
        invoiceNum: "Invoice ID",
        invoiceStatus: "Status",
        generalSettings: "General System Settings",
        businessName: "Business Name",
        taxRateLabel: "VAT Rate (%)",
        saveSettings: "Save Settings",
        saveProduct: "Save Product",
        prodNameAr: "Product Name (Arabic)",
        prodNameEn: "Product Name (English)",
        suppContact: "Contact Person",
        orderItems: "Items",

        // ZATCA Phase 2 integration additions
        zatcaPortal: "ZATCA Phase 2 Integration Portal",
        zatcaStatus: "ZATCA Status",
        zatcaUuid: "Invoice UUID",
        zatcaHash: "Invoice Cryptographic Hash (SHA-256)",
        zatcaCsn: "Sequence Number (CSN)",
        zatcaPih: "Previous Invoice Hash (PIH)",
        downloadXml: "Download XML Invoice",
        reportToZatca: "Report & Validate XML",
        xmlValid: "XML Structure Validation",
        reportedStatus: "REPORTED & REGISTERED",
        clearedStatus: "CLEARED & APPROVED",
        sandboxConsole: "ZATCA Sandbox Response Console",
        zatcaReportSummary: "ZATCA Integration Analytics",
        signature: "Cryptographic Signature",
        xmlValidationOk: "UBL 2.1 Schema Compliance: Valid",
        
        currencySymbol: "\u20C1",
        tailoring_dashboard: "Bespoke Tailoring Dashboard",
        tailoring_measurements: "Customer Measurement Profiles",
        tailoring_orders: "Tailoring Orders & Advance Deposits",
        tailoring_workshop: "Workshop Production Kanban & Commissions"
    },
    ar: {
        dashboard: "لوحة التحكم",
        paymentMethod: "طريقة الدفع",
        paymentCash: "نقداً",
        paymentVisa: "فيزا",
        paymentMada: "مدى",
        paymentMobile: "دفع الهاتف",
        paymentStc: "STC Pay",
        paymentApplePay: "Apple Pay",
        paymentTabby: "تابي",
        paymentTamara: "تمارا",
        paymentNinja: "نينجا",
        paymentKeeta: "كيتا",
        paymentHungerstation: "هنقرستيشن",
        paymentSplit: "دفع مجزأ",
        dailyReport: "التقرير اليومي",
        posCashier: "تطبيق الكاشير",
        inventory: "إدارة المخزون",
        expenses: "إدارة المصروفات",
        customers: "إدارة العملاء",
        suppliers: "إدارة الموردين",
        invoices: "إدارة المبيعات والفواتير",
        orders: "إدارة الطلبات",
        assets: "إدارة الأصول",
        permissions: "المستخدمين والصلاحيات",
        reports: "تقارير مفصلة",
        taxReport: "تقرير الإقرار الضريبي",
        settings: "الإعدادات",
        quotations: "عروض الأسعار",
        addQuotation: "إنشاء عرض سعر",
        saveAsQuotation: "حفظ كعرض سعر",
        quotationNum: "رقم عرض السعر",
        quotationDate: "تاريخ عرض السعر",
        quotationTotal: "المبلغ الإجمالي",
        purchaseCost: "تكلفة الشراء",
        sellingPrice: "سعر البيع",
        
        // ZATCA Connection Settings
        zatcaSettings: "إعدادات الربط والاتصال بهيئة الزكاة والضريبة والجمارك (ZATCA)",
        zatcaEnv: "بيئة عمل نظام الهيئة",
        zatcaEndpoint: "رابط خادم الهيئة (Endpoint)",
        zatcaClientId: "معرف العميل (Client ID)",
        zatcaClientSecret: "الرمز السري للعميل (Client Secret)",
        zatcaDeviceSerial: "الرقم التسلسلي للجهاز المرتبط",
        csrGenerate: "توليد المفتاح الخاص وطلب التوقيع (CSR)",
        registerDevice: "تسجيل الجهاز",
        zatcaStatusLabel: "حالة اتصال خادم الهيئة",
        zatcaStatusConnected: "متصل ومسجل بنجاح (نشط)",
        zatcaStatusDisconnected: "غير مسجل",

        // Reports View
        dailyReports: "التقرير اليومي",
        monthlyReports: "التقرير الشهري",
        annualReports: "التقرير السنوي",
        totalSalesTax: "إجمالي المبيعات (شامل الضريبة)",
        totalVatCollected: "ضريبة القيمة المضافة المحصلة (15%)",
        invoiceCount: "عدد الفواتير المصدرة",
        netSalesValue: "صافي قيمة المبيعات (دون الضريبة)",
        printReport: "طباعة ملخص التقرير",
        
        // Dashboard Stats
        totalSales: "إدارة المبيعات",
        activeProducts: "المنتجات النشطة",
        invoicesGenerated: "الفواتير المصدرة",
        netRevenue: "صافي الأرباح",
        lowStockAlert: "تنبيهات انخفاض المخزون",
        recentTransactions: "أحدث العمليات",
        salesSummary: "ملخص المبيعات",
        
        // POS interface
        searchPlaceholder: "ابحث عن منتج بالاسم أو الرمز المالي...",
        allCategories: "جميع الفئات",
        electronics: "إلكترونيات",
        groceries: "مواد غذائية",
        apparel: "ملابس",
        stationery: "قرطاسية",
        office: "أثاث ومعدات مكتبية",
        cartTitle: "السلة الحالية",
        cartEmpty: "السلة فارغة حالياً",
        subtotal: "المجموع الفرعي",
        vat: "ضريبة القيمة المضافة (15%)",
        discount: "الخصم",
        couponLabel: "تطبيق الكوبون",
        grandTotal: "المجموع الكلي",
        payCheckout: "دفع وإصدار الفاتورة",
        holdCart: "تعليق السلة",
        clearCart: "تفريغ السلة",
        customerSelect: "تعيين العميل",
        walkIn: "عميل نقدي سريع",
        
        // Orders
        orderNum: "رقم الطلب",
        orderStatus: "حالة الطلب",
        statusPending: "قيد الانتظار",
        statusPreparing: "جاري التحضير",
        statusReady: "جاهز للتسليم",
        statusDelivered: "تم التوصيل",
        statusCompleted: "مكتمل",
        statusCancelled: "ملغي",
        updateStatus: "تحديث الحالة",
        
        // Expenses
        addExpense: "تسجيل مصروف جديد",
        expenseCat: "الفئة",
        expenseAmount: "المبلغ الإجمالي",
        expenseDesc: "الوصف",
        expenseDate: "التاريخ",
        rent: "الإيجارات والخدمات",
        shipping: "الشحن والخدمات اللوجستية",
        salaries: "الرواتب والأجور",
        marketing: "التسويق والدعاية",
        other: "مصاريف أخرى",
        
        // CRM
        addCustomer: "إضافة عميل جديد",
        addSupplier: "إضافة مورد جديد",
        custName: "اسم العميل",
        suppName: "اسم المورد",
        phone: "رقم الجوال",
        email: "البريد الإلكتروني",
        loyaltyPoints: "نقاط الولاء",
        totalPurchases: "إجمالي المشتريات",
        suppliedItems: "المنتجات الموردة",

        // Assets
        addAsset: "تسجيل أصل جديد",
        assetId: "رمز الأصل",
        assetName: "اسم الأصل",
        assetCost: "تكلفة الشراء",
        assetDate: "تاريخ الشراء",
        assetStatus: "حالة الأصل",
        assetDept: "القسم / الموقع",
        active: "نشط / قيد التشغيل",
        maintenance: "في الصيانة",
        disposed: "تم استبعاده / تالف",
        saveAsset: "حفظ الأصل",
        totalAssetsValue: "إجمالي التكلفة الرأسمالية",
        assetSalvage: "القيمة المتبقية (خردة)",
        assetLife: "العمر الافتراضي (سنوات)",
        annualDepreciation: "الإهلاك السنوي",
        bookValue: "القيمة الدفترية الحالية",
        serialNo: "الرقم التسلسلي",
        assetSupplier: "المورد",
        assetSummary: "خلاصة الإهلاك المالي للأصول",
        totalDepreciation: "إجمالي الإهلاك السنوي",
        netBookValue: "صافي القيمة الدفترية للأصول",
        assignedTo: "المستلم / الموظف",
        unassigned: "غير محدد / متوفر في العهدة",
        
        // Permissions
        roleSelect: "تغيير صلاحية المستخدم",
        currentRole: "الصلاحية الحالية",
        roleAdmin: "مدير النظام (كامل الصلاحيات)",
        roleManager: "مشرف (المبيعات، المخزون، المصروفات)",
        roleCashier: "كاشير (المبيعات والكاشير فقط)",
        restrictMsg: "يتم إخفاء بعض التبويبات تلقائياً بناءً على صلاحيات دورك النشط.",

        // Tax Return Report
        taxStatement: "الإقرار الضريبي المبسط (معايير هيئة الزكاة والضريبة والجمارك)",
        taxableSales: "إجمالي المبيعات الخاضعة للضريبة",
        taxCollected: "ضريبة القيمة المضافة المحصلة (15%)",
        taxableExpenses: "إجمالي المصاريف الخاضعة للضريبة",
        taxPaid: "ضريبة القيمة المضافة المدفوعة (15%)",
        netTaxDue: "صافي الضريبة المستحقة للهيئة",
        netEarnings: "صافي الأرباح (المبيعات - المصاريف)",
        
        // Invoicing
        invoiceDetails: "إيصال الفاتورة الإلكترونية",
        taxInvoice: "فاتورة ضريبية مبسطة",
        printedOn: "تاريخ الطباعة",
        billedTo: "مفوتر إلى",
        cashier: "الكاشير",
        vatNumber: "الرقم الضريبي للمنشأة",
        close: "إغلاق",
        print: "طباعة واعتماد الفاتورة",
        
        // Bonat
        bonatSystem: "الربط مع بونات ونقاط الولاء",
        appliedCoupon: "كوبون الخصم النشط",
        pointsEarned: "نقاط الولاء المحتسبة للعميل",
        
        // Missing Translations fixed
        themeLabel: "المظهر",
        salesReport: "مرحباً بك في نظام كاشير لإدارة المبيعات والأصول",
        invoiceDate: "التاريخ والوقت",
        invoiceCustomer: "العميل",
        invoiceTotal: "المبلغ الإجمالي",
        actions: "الإجراءات",
        addProduct: "إضافة منتج جديد",
        prodId: "رمز المنتج",
        prodName: "اسم المنتج",
        prodCategory: "الفئة",
        prodStock: "الكمية بالمخزن",
        prodPrice: "السعر",
        invoiceNum: "رقم الفاتورة",
        invoiceStatus: "الحالة",
        generalSettings: "الإعدادات العامة للنظام",
        businessName: "اسم المنشأة",
        taxRateLabel: "نسبة ضريبة القيمة المضافة (%)",
        saveSettings: "حفظ التغييرات",
        saveProduct: "حفظ المنتج",
        prodNameAr: "اسم المنتج (بالعربية)",
        prodNameEn: "اسم المنتج (بالإنجليزية)",
        suppContact: "مسؤول الاتصال",
        orderItems: "البيان",

        // ZATCA Phase 2 integration additions
        zatcaPortal: "بوابة التكامل والربط الإلكتروني (ZATCA)",
        zatcaStatus: "حالة الفاتورة لدى الهيئة",
        zatcaUuid: "المعرف الفريد للفاتورة (UUID)",
        zatcaHash: "الرمز التشفيري للفاتورة (SHA-256)",
        zatcaCsn: "الرقم التسلسلي التراكمي (CSN)",
        zatcaPih: "الهاش للفاتورة السابقة (PIH)",
        downloadXml: "تحميل ملف XML المعتمد",
        reportToZatca: "إرسال واعتماد الفاتورة",
        xmlValid: "فحص هيكلية وقواعد ملف XML",
        reportedStatus: "تم الإرسال والتسجيل بنجاح",
        clearedStatus: "تم الاعتماد والموافقة التامة",
        sandboxConsole: "شاشة استجابة محاكاة الهيئة",
        zatcaReportSummary: "إحصائيات ربط منظومة الفاتورة الإلكترونية",
        signature: "التوقيع التشفيري الرقمي",
        xmlValidationOk: "مطابقة هيكلية UBL 2.1: سليم وصالح",
        
        currencySymbol: "\u20C1",
        tailoring_dashboard: "لوحة القيادة للخياطة والتفصيل",
        tailoring_measurements: "سجل مقاسات العملاء وتفضيلات الموديل",
        tailoring_orders: "أوامر التفصيل والعربون والتسليم",
        tailoring_workshop: "مراحل المشغل وعمولات القصاصين والخياطين"
    }
};

const getPaymentMethodLabel = (method, lang) => {
    const isAr = lang === 'ar';
    if (!method) return isAr ? 'نقداً' : 'Cash';
    const m = method.toLowerCase();
    if (m.includes('cash')) return isAr ? 'نقداً' : 'Cash';
    if (m.includes('visa')) return isAr ? 'فيزا' : 'Visa';
    if (m.includes('mada')) return isAr ? 'مدى' : 'Mada';
    if (m.includes('mobile')) return isAr ? 'دفع الجوال' : 'Mobile Pay';
    if (m.includes('stc')) return 'STC Pay';
    if (m.includes('apple')) return 'Apple Pay';
    if (m.includes('tabby') || m.includes('tabbi')) return isAr ? 'تابي' : 'Tabby';
    if (m.includes('tamara')) return isAr ? 'تمارا' : 'Tamara';
    if (m.includes('ninja')) return isAr ? 'نينجا' : 'Ninja';
    if (m.includes('keeta')) return isAr ? 'كيتا' : 'Keeta';
    if (m.includes('hungerstation') || m.includes('hunger')) return isAr ? 'هنقرستيشن' : 'HungerStation';
    if (m.includes('split')) {
        if (isAr) {
            return method.replace('Split / مجزأ', 'دفع مجزأ').replace('Cash:', 'نقداً:').replace('Card:', 'بطاقة:');
        } else {
            return method.replace('Split / مجزأ', 'Split').replace('Cash:', 'Cash:').replace('Card:', 'Card:');
        }
    }
    return method;
};

export default function App() {
    // Domain Routing & Simulated Environment State
    const [hostname, setHostname] = useState(window.location.hostname);
    const [simulatedDomain, setSimulatedDomain] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.has('simDomain')) return params.get('simDomain');
        return localStorage.getItem('simulatedDomain') || '';
    });
    const [simulatedTenant, setSimulatedTenant] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.has('simTenant')) return params.get('simTenant');
        return localStorage.getItem('simulatedTenant') || 'cust-1';
    });

    useEffect(() => {
        localStorage.setItem('simulatedDomain', simulatedDomain);
    }, [simulatedDomain]);

    useEffect(() => {
        localStorage.setItem('simulatedTenant', simulatedTenant);
    }, [simulatedTenant]);

    const baseDomain = getBaseDomain(hostname);

    const handleRegisterSuccess = (newTenantId) => {
        // Clear token so the user is forced to log in to their newly created store
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        if (isLocalhost) {
            localStorage.setItem('simulatedTenant', newTenantId);
            localStorage.setItem('simulatedDomain', 'customer');
            window.open(`${window.location.origin}?simDomain=customer&simTenant=${newTenantId}`, '_blank');
        } else {
            window.open(`https://${newTenantId}.${baseDomain}`, '_blank');
        }
    };

    // Hostname Routing Calculations
    let isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || (!hostname.includes('26i.uk') && !hostname.includes('localhost'));
    
    // Determine active route mode: 'marketing', 'demo', or 'customer'
    let routeMode = 'marketing';
    const isDesktop = new URLSearchParams(window.location.search).get('desktop') === 'true' || localStorage.getItem('isDesktop') === 'true';
    let tenantId = null;
    if (isDesktop) { localStorage.setItem('isDesktop', 'true'); isLocalhost = false; routeMode = 'customer'; tenantId = 'offline'; }

    if (!isDesktop) {
    if (isLocalhost && simulatedDomain) {
            routeMode = simulatedDomain;
            if (routeMode === 'customer') {
                tenantId = simulatedTenant;
            }
        } else {
            // Live hostname parsing
            const host = hostname.toLowerCase();
            if (host === `demo.${baseDomain}` || host.startsWith('demo.')) {
                routeMode = 'demo';
            } else {
                if (host.endsWith(`.${baseDomain}`)) {
                    const subdomain = host.slice(0, -(baseDomain.length + 1));
                    if (subdomain !== 'www' && subdomain !== 'demo' && subdomain !== 'ssh-erp' && subdomain !== 'ssh-cloud') {
                        routeMode = 'customer';
                        tenantId = subdomain;
                    } else {
                        routeMode = 'marketing';
                    }
                } else {
                    routeMode = 'marketing';
                }
            }
        }
    }

    const handleLaunchApp = (targetTenantId) => {
        // Guard: if called directly as an onClick handler, targetTenantId will be a MouseEvent object, not a string.
        // Only treat it as a real tenant ID when it is actually a non-empty string.
        const isRealTenantId = typeof targetTenantId === 'string' && targetTenantId.trim() !== '' && targetTenantId !== 'demo' && targetTenantId !== 'default';
        if (isRealTenantId) {
            // Launch a specific tenant's store
            if (isLocalhost) {
                localStorage.setItem('simulatedDomain', 'customer');
                localStorage.setItem('simulatedTenant', targetTenantId);
                window.open(`${window.location.origin}?simDomain=customer&simTenant=${targetTenantId}`, '_blank');
            } else {
                window.open(`https://${targetTenantId}.${baseDomain}`, '_blank');
            }
        } else {
            // Launch the generic demo store
            if (isLocalhost) {
                localStorage.setItem('simulatedDomain', 'demo');
                window.open(`${window.location.origin}?simDomain=demo`, '_blank');
            } else {
                window.open(`https://demo.${baseDomain}`, '_blank');
            }
        }
    };

    const handleGoBackToHome = () => {
        if (isLocalhost) {
            setSimulatedDomain('marketing');
        } else {
            window.location.href = `https://${baseDomain}`;
        }
    };

    // Auth States
    const [token, setToken] = useState(localStorage.getItem('token') || '');
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [authView, setAuthView] = useState(() => {
        if (window.location.pathname === '/reset-password') return 'reset-password';
        if (window.location.pathname === '/forgot-password') return 'forgot-password';
        return 'login';
    });

    // System Core Configurations
    const [currentLanguage, setCurrentLanguage] = useState('en');
    const [theme, setTheme] = useState('dark');
    const [activeTab, setActiveTab] = useState('dashboard');
    const [settings, setSettings] = useState({
        businessName: 'CASHIER',
        fullName: 'خليل الغامدي / Khalil Al-Ghamdi',
        vatNumber: '310123456700003',
        taxRate: 15,
        baseCurrency: 'SAR',
        businessAddress: 'الرياض، المملكة العربية السعودية / Riyadh, Saudi Arabia',
        crNumber: '1010123456',
        contactNumber: '+966 50 123 4567',
        exchangeRates: { SAR: 1, USD: 0.27, EUR: 0.25, EGP: 12.8, AED: 0.99 },
        branches: [
            { name: 'Main Branch - Riyadh', address: 'Olaya District, Riyadh', phone: '+966 50 123 4567' },
            { name: 'Jeddah Branch', address: 'Tahlia St, Jeddah', phone: '+966 50 765 4321' }
        ],
        currentBranch: 'Main Branch - Riyadh',
        businessType: 'retail',
        enableTables: false,
        enableServiceDuration: false,
        enabledModules: { invoices: false, pos: true, maintenance: false, inventory: true, customers: false, employees: false, suppliers: true, warehouses: false, financials: false, reports: false, settings: true, propertyManagement: false, freshFlowers: false }
    });

    const [zatcaConn, setZatcaConn] = useState({
        env: 'sandbox',
        mode: 'connected',
        endpoint: 'https://developer.zatca.gov.sa/api/v2/invoice',
        clientId: 'test-client-id-1092837',
        clientSecret: '••••••••••••••••••••••••',
        deviceSerial: 'CASHIER-310123456700003',
        status: 'CONNECTED',
        autoSend: true,
    });
    // ZATCA mode (Settings > ZATCA): 'connected' signs and reports invoices, 'not_connected' does neither
    const zatcaConnected = ((zatcaConn && zatcaConn.mode) || 'connected') === 'connected';
    // Restaurant: is a printer assigned to the separate Juice button?
    const [hasJuicePrinter, setHasJuicePrinter] = useState(false);

    const [reportSubTab, setReportSubTab] = useState('daily');
    const [quotations, setQuotations] = useState([]);
    const [activeQuotation, setActiveQuotation] = useState(null);
    const [showQuotationModal, setShowQuotationModal] = useState(false);
    const [showQuotationCrudModal, setShowQuotationCrudModal] = useState(false);
    const [quotationForm, setQuotationForm] = useState({ customer: '', itemsText: '', total: '' });

    // Database Models State
    const [products, setProducts] = useState([]);
    const [invoices, setInvoices] = useState([]);
    useEffect(() => {
        setInvoices(prev => prev.filter((v,i,a)=>a.findIndex(t=>t.id===v.id)===i));
    }, [invoices.length]);
    const [expenses, setExpenses] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [assets, setAssets] = useState([]);
    const [units, setUnits] = useState([
        { id: '1', nameAR: 'قطعة', nameEN: 'Piece' },
        { id: '2', nameAR: 'كيلوجرام', nameEN: 'Kg' },
        { id: '3', nameAR: 'كرتون', nameEN: 'Box' }
    ]);

    // POS Cart State
    const [cart, setCart] = useState([]);
    const [activeCustomer, setActiveCustomer] = useState('walk-in');
    const [couponInput, setCouponInput] = useState('');
    const [activeCoupon, setActiveCoupon] = useState(null);
    // Cashier's manual discount in the POS: a percentage of the subtotal or a fixed amount
    const [manualDiscount, setManualDiscount] = useState({ type: 'percent', value: '' });
    // Open restaurant order loaded from Table Management (reused when the table is saved again)
    const [activeRestaurantOrderId, setActiveRestaurantOrderId] = useState(null);
    const [posFilter, setPosFilter] = useState('all');
    const [posSearch, setPosSearch] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [splitCash, setSplitCash] = useState('');
    const [splitCard, setSplitCard] = useState('');

    // POS Cashier business specific states
    const [tableNum, setTableNum] = useState('1');
    const [serviceDuration, setServiceDuration] = useState('30 mins');
    
    // Mobile menu toggle state
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    
    // Sales Management search and date filter states
    const [salesSearch, setSalesSearch] = useState('');
    const [salesStartDate, setSalesStartDate] = useState('');
    const [salesEndDate, setSalesEndDate] = useState('');

    useEffect(() => {
        if (!token) return;
        
        // Fetch settings
        fetch('/api/settings', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(data => {
                setSettings(data);
                if (data.activeTheme) {
                    applyTheme(data.activeTheme, data.themeConfig);
                }
            })
            .catch(() => console.log("Using default fallback settings"));

        // Fetch products
        fetch('/api/products', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(data => setProducts(data))
            .catch(() => console.log("Failed to fetch products"));

        // Fetch invoices
        fetch('/api/invoices', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(data => setInvoices(data.filter((v,i,a)=>a.findIndex(t=>t.id===v.id)===i)))
            .catch(() => console.log("Failed to fetch invoices"));

        // Fetch customers
        fetch('/api/customers', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(data => setCustomers(data))
            .catch(() => console.log("Failed to fetch customers"));
    }, [token]);

    // Modal Triggers
    const [activeInvoice, setActiveInvoice] = useState(null);
    const [invoiceFormat, setInvoiceFormat] = useState('thermal');
    const [invoiceSource, setInvoiceSource] = useState('pos'); // 'pos' = POS checkout (thermal locked) | 'sales' = Sales reprint (a4 default with toggle)
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailAddress, setEmailAddress] = useState('');
    const [isEmailSending, setIsEmailSending] = useState(false);
    
    const [showAssetModal, setShowAssetModal] = useState(false);
    const [assetForm, setAssetForm] = useState({ name: '', cost: '', salvage: 0, life: 5, date: '', status: 'active', department: 'Operations', serial: '', supplier: '', assignedTo: 'unassigned' });
    const [activeAssetForQr, setActiveAssetForQr] = useState(null);
    const [showAssetQrModal, setShowAssetQrModal] = useState(false);

    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [custForm, setCustForm] = useState({ name: '', phone: '', email: '' });

    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expForm, setExpForm] = useState({ category: 'rent', amount: '', description: '', date: '' });

    const [showUserModal, setShowUserModal] = useState(false);
    const [userForm, setUserForm] = useState({ username: '', password: '', role: 'Cashier' });
    const [usersList, setUsersList] = useState([
        { id: '1', username: 'admin', role: 'Admin' },
        { id: '2', username: 'manager', role: 'Manager' },
        { id: '3', username: 'cashier', role: 'Cashier' }
    ]);

    const [showOrderModal, setShowOrderModal] = useState(false);
    const [orderForm, setOrderForm] = useState({ customer: '', items: '', total: '', status: 'Pending', date: new Date().toLocaleString() });

    // B2B Sales Panel State
    const [b2bForm, setB2bForm] = useState({
        customer: '',
        date: new Date().toISOString().split('T')[0],
        items: [{ id: Date.now().toString(), productId: '', name: '', qty: 1, price: 0, vatRate: 15, total: 0 }],
        notes: '',
        saveAs: 'Invoice' // 'Invoice', 'Draft', 'Quotation'
    });

    // ZATCA Sandbox Output Log Console state
    const [zatcaConsole, setZatcaConsole] = useState([
        { type: "SYSTEM", text: "ZATCA Phase 2 Sandbox clearance engine active. Ready." }
    ]);
    const [zatcaSelectInvoice, setZatcaSelectInvoice] = useState('');
    const [isReportingZatca, setIsReportingZatca] = useState(false);

    // ----------------------------------------------------
    // LOAD STATE FROM EXPRESS API OR FALLBACK MOCKS
    // ----------------------------------------------------
    const headers = token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

    useEffect(() => {
        if (!token) return;
        
        // Fetch settings
        fetch('/api/settings', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(data => { setSettings(data); if (data && data.zatcaConn) setZatcaConn(prev => ({ ...prev, ...data.zatcaConn })); })
            .catch(() => console.log("Using default fallback settings"));

        // Fetch products
        fetch('/api/products', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(data => setProducts(data))
            .catch(() => console.log("Failed to fetch products"));

        // Fetch invoices
        fetch('/api/invoices', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(data => setInvoices(data.filter((v,i,a)=>a.findIndex(t=>t.id===v.id)===i)))
            .catch(() => console.log("Failed to fetch invoices"));

        // Fetch expenses
        fetch('/api/expenses', { headers })
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(data => setExpenses(data))
            .catch(() => console.log("Failed to fetch expenses"));

        // Fetch assets
        fetch('/api/assets', { headers })
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(data => setAssets(data))
            .catch(() => console.log("Failed to fetch assets"));

        // Fetch CRM lists
        fetch('/api/customers', { headers }).then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(data => setCustomers(data)).catch(() => {});
        fetch('/api/employees', { headers }).then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(data => setEmployees(data)).catch(() => {});
        fetch('/api/suppliers', { headers }).then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(data => setSuppliers(data)).catch(() => {});
        fetch('/api/orders', { headers }).then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(data => setOrders(data)).catch(() => {});
        fetch('/api/users', { headers }).then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(data => { if (Array.isArray(data)) setUsersList(data); }).catch(() => {});
        fetch('/api/quotations', { headers }).then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(data => setQuotations(data.filter((v,i,a)=>a.findIndex(t=>t.id===v.id)===i))).catch(() => {});
        fetch('/api/printers', { headers }).then(res => res.ok ? res.json() : []).then(list => setHasJuicePrinter(Array.isArray(list) && list.some(p => p.station === 'juice'))).catch(() => {});
    }, [token]);

    // Apply configurations on load
    useEffect(() => {
        document.body.dir = (currentLanguage === 'ar') ? 'rtl' : 'ltr';
        document.body.setAttribute('lang', currentLanguage);
    }, [currentLanguage]);

    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
    }, [theme]);

    // Pre-populate credentials in demo mode
    useEffect(() => {
        if (routeMode === 'demo' && !token) {
            setLoginUsername('demo');
            setLoginPassword('demo123');
        } else if (routeMode === 'customer' && !token) {
            const lastUser = localStorage.getItem('lastRegisteredUsername') || 'admin';
            setLoginUsername(lastUser);
            setLoginPassword('');
        }
    }, [routeMode, token]);

    // Auto-configure POS Business Type based on Subdomain or URL ?sector=X parameter (and fetch tenant settings for unauthenticated portal)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const querySector = params.get('sector');
        let activeSector = '';

        if (querySector) {
            activeSector = querySector.toLowerCase();
        } else if (routeMode === 'customer' && tenantId) {
            const cleanTenant = tenantId.toLowerCase();
            if (cleanTenant.includes('tailor') || cleanTenant.includes('thobe') || cleanTenant.includes('atelier') || cleanTenant.includes('khayata')) activeSector = 'tailoring';
            else if (cleanTenant.includes('hotel') || cleanTenant.includes('property') || cleanTenant.includes('realestate') || cleanTenant.includes('resort') || cleanTenant.includes('suites')) activeSector = 'realestate';
            else if (cleanTenant.includes('restaurant') || cleanTenant.includes('cafe')) activeSector = 'restaurant';
            else if (cleanTenant.includes('furniture')) activeSector = 'furniture';
            else if (cleanTenant.includes('spareparts') || cleanTenant.includes('parts')) activeSector = 'spareparts';
            else if (cleanTenant.includes('grocery') || cleanTenant.includes('supermarket')) activeSector = 'grocery';
            else if (cleanTenant.includes('appliances') || cleanTenant.includes('electrical') || cleanTenant.includes('hvac')) activeSector = 'appliances';
            else if (cleanTenant.includes('apparel') || cleanTenant.includes('garments')) activeSector = 'apparel';
            else if (cleanTenant.includes('flowers') || cleanTenant.includes('florist')) activeSector = 'freshFlowers';
            else if (cleanTenant.includes('services')) activeSector = 'services';
        }

        if (activeSector) {
            const supportedSectors = ['retail', 'restaurant', 'services', 'appliances', 'furniture', 'spareparts', 'apparel', 'grocery', 'freshFlowers', 'tailoring', 'realestate'];
            if (supportedSectors.includes(activeSector)) {
                setSettings(prev => ({
                    ...prev,
                    businessType: activeSector,
                    businessName: routeMode === 'customer' && tenantId ? `${tenantId.toUpperCase()} ERP` : `26i ${activeSector.toUpperCase()} POS`,
                    enableTables: activeSector === 'restaurant',
                    enableServiceDuration: activeSector === 'services',
                    enabledModules: {
                        ...(prev.enabledModules || {}),
                        ...(activeSector === 'freshFlowers' ? { freshFlowers: true } : {}),
                        ...(activeSector === 'tailoring' ? { tailoring: true } : {}),
                        ...(activeSector === 'realestate' ? { propertyManagement: true } : {})
                    }
                }));
            }
        }

        // Also load tenant settings publicly on customer subdomains when unauthenticated so root portal knows businessType
        if (routeMode === 'customer' && tenantId && !token) {
            fetch('/api/settings', { headers: { 'x-tenant-id': tenantId } })
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data && !data.error) {
                        setSettings(prev => ({ ...prev, ...data }));
                    }
                })
                .catch(() => {});
        }
    }, [routeMode, tenantId, token]);

    // ----------------------------------------------------
    // LOGIN & AUTHENTICATION HANDLERS
    // ----------------------------------------------------
    // Dynamic Currency Exchange Formatter
    const formatCurrency = (amountSAR) => {
        const rates = (settings && settings.exchangeRates) || {};
        const baseCurr = (settings && settings.baseCurrency) || 'SAR';
        const rate = rates[baseCurr] || 1;
        const converted = amountSAR * rate;
        // Saudi Riyal uses the official SAMA symbol (U+20C1, drawn by the bundled
        // SaudiRiyal font). Other base currencies show their ISO code; before, the
        // English UI showed "SAR" even after converting the amount to USD/EUR.
        const symbol = baseCurr === 'SAR' ? translations[currentLanguage].currencySymbol : baseCurr;
        return `${converted.toFixed(2)} ${symbol}`;
    };
    const handleLogin = (e) => {
        e.preventDefault();
        setAuthError('');

        fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: loginUsername, password: loginPassword })
        })
        .then(async res => {
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Invalid credentials');
            }
            return res.json();
        })
        .then(data => {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            setToken(data.token);
            setUser(data.user);
            setActiveTab('dashboard');
            window.history.pushState({}, '', '/admin' + window.location.search);
        })
        .catch(err => {
            if (err.message === 'Failed to fetch') {
                // Local offline mock fallback login for portability
                const username = loginUsername.toLowerCase();
                const password = loginPassword;
                let role = '';

                if (username === 'admin' && password === 'admin123') role = 'Admin';
                else if (username === 'demo' && password === 'demo123') role = 'Admin';
                else if (username === 'manager' && password === 'manager123') role = 'Manager';
                else if (username === 'cashier' && password === 'cashier123') role = 'Cashier';

                if (role) {
                    const mockUser = { id: Date.now().toString(), username, role };
                    localStorage.setItem('token', 'mock-token-secret');
                    localStorage.setItem('user', JSON.stringify(mockUser));
                    setToken('mock-token-secret');
                    setUser(mockUser);
                    setActiveTab('dashboard');
                    window.history.pushState({}, '', '/admin' + window.location.search);
                } else {
                    setAuthError(currentLanguage === 'ar' ? 'خطأ في الاتصال بالشبكة' : 'Network error or backend unreachable.');
                }
            } else {
                setAuthError(err.message || (currentLanguage === 'ar' ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials'));
            }
        });
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken('');
        setUser(null);
    };

    // Called by the fetch watcher at the top of this file when the saved login is rejected
    onLoginRejected = handleLogout;

    // Check Role Restrictions
    const isAllowedTab = (tabName) => {
        if (!user) return false;
        const role = user.role;
        if (role === 'Cashier') {
            return !['inventory', 'expenses', 'customers', 'suppliers', 'assets', 'permissions', 'reports', 'settings', 'zatca'].includes(tabName);
        } else if (role === 'Manager') {
            return !['permissions', 'settings', 'zatca'].includes(tabName);
        }
        return true;
    };

    

    const generateZatcaQR = (sellerName, vatNumber, dateString, totalWithVat, vatTotal, xmlHashHexOrBase64, signatureHexOrBase64, publicKeyBase64, certSignatureBase64) => {
        try {
            const encoder = new TextEncoder();
            const getTagBytes = (tag, value, isBytes = false) => {
                const valBytes = isBytes ? value : encoder.encode(String(value ?? ''));
                const length = valBytes.length;
                let lengthBytes;
                if (length < 128) {
                    lengthBytes = [length];
                } else if (length < 256) {
                    lengthBytes = [0x81, length];
                } else {
                    lengthBytes = [0x82, (length >> 8) & 0xff, length & 0xff];
                }
                return [tag, ...lengthBytes, ...valBytes];
            };

            const hexToBase64Str = (hex) => {
                const clean = String(hex || '').trim();
                if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) return clean;
                let bin = '';
                for (let i = 0; i < clean.length; i += 2) {
                    bin += String.fromCharCode(parseInt(clean.substr(i, 2), 16));
                }
                return btoa(bin);
            };

            const base64ToUint8 = (b64) => {
                try {
                    const clean = String(b64 || '')
                        .replace(/-----BEGIN [^-]+-----/g, '')
                        .replace(/-----END [^-]+-----/g, '')
                        .replace(/\s+/g, '');
                    const binaryString = atob(clean);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                    return bytes;
                } catch {
                    return encoder.encode('ZATCA-PHASE2-KEY');
                }
            };

            let timestamp = '2026-01-01T12:00:00Z';
            if (dateString) {
                const str = String(dateString).trim();
                const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}(?::\d{2})?))?/);
                if (isoMatch) {
                    const t = isoMatch[2] ? (isoMatch[2].length === 5 ? isoMatch[2] + ':00' : isoMatch[2]) : '12:00:00';
                    timestamp = `${isoMatch[1]}T${t}Z`;
                } else {
                    const parsed = new Date(str);
                    if (!isNaN(parsed.getTime())) {
                        timestamp = parsed.toISOString().replace(/\.\d{3}Z$/, 'Z');
                    }
                }
            }

            const hashBase64 = xmlHashHexOrBase64
                ? (/^[0-9a-fA-F]{64}$/.test(xmlHashHexOrBase64) ? hexToBase64Str(xmlHashHexOrBase64) : xmlHashHexOrBase64)
                : 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';
            const sigBase64 = signatureHexOrBase64
                ? (/^[0-9a-fA-F]{64,}$/.test(signatureHexOrBase64) ? hexToBase64Str(signatureHexOrBase64) : signatureHexOrBase64)
                : btoa('ZATCA-PHASE2-ECDSA-SIGNATURE');
            const pkB64 = publicKeyBase64 || 'MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEbE08C8wK7zH6r2wR3pS1a1gD4o6H4L8T1F3E2W1Q2A3B4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0S1T2U3V4W==';
            const certSigBytes = certSignatureBase64 ? base64ToUint8(certSignatureBase64) : encoder.encode('ZATCA-PHASE2-CSID-STAMP');

            const tags = [
                getTagBytes(1, sellerName || 'Unknown'),
                getTagBytes(2, vatNumber || '310122393500003'),
                getTagBytes(3, timestamp),
                getTagBytes(4, parseFloat(totalWithVat || 0).toFixed(2)),
                getTagBytes(5, parseFloat(vatTotal || 0).toFixed(2)),
                getTagBytes(6, hashBase64),
                getTagBytes(7, sigBase64),
                getTagBytes(8, base64ToUint8(pkB64), true),
                getTagBytes(9, certSigBytes, true)
            ];

            const flattened = tags.reduce((acc, val) => acc.concat(Array.from(val)), []);
            const uint8Array = new Uint8Array(flattened);
            let binary = '';
            for (let i = 0; i < uint8Array.byteLength; i++) {
                binary += String.fromCharCode(uint8Array[i]);
            }
            return btoa(binary);
        } catch(e) {
            console.error('QR Phase 2 Error:', e);
            return '';
        }
    };

    // ----------------------------------------------------
    // POS CART & CHECKOUT MECHANICS
    // ----------------------------------------------------
    const addToCart = (product) => {
        if (product.stock <= 0) return;
        const itemIdx = cart.findIndex(c => c.product.id === product.id);
        if (itemIdx !== -1) {
            const updated = [...cart];
            if (updated[itemIdx].qty < product.stock) {
                updated[itemIdx].qty++;
                setCart(updated);
            }
        } else {
            setCart([...cart, { product, qty: 1 }]);
        }
    };

    const updateCartQty = (productId, delta) => {
        const itemIdx = cart.findIndex(c => c.product.id === productId);
        if (itemIdx === -1) return;
        const updated = [...cart];
        const newQty = updated[itemIdx].qty + delta;
        if (newQty <= 0) {
            updated.splice(itemIdx, 1);
        } else if (newQty <= updated[itemIdx].product.stock) {
            updated[itemIdx].qty = newQty;
        }
        setCart(updated);
    };

    const applyCoupon = () => {
        if (couponInput === 'KAMY50') {
            setActiveCoupon({ code: 'KAMY50', rate: 0.50 });
            alert(currentLanguage === 'ar' ? 'تم تطبيق خصم بونات 50%!' : 'Bonat 50% discount applied!');
        } else {
            alert(currentLanguage === 'ar' ? 'الكوبون غير صحيح' : 'Invalid coupon');
        }
    };

    // Total cart discount before VAT: the coupon (e.g. KAMY50) plus the manual discount.
    // A percentage applies to what is left after the coupon; the total never exceeds the subtotal.
    const getCartDiscount = (subtotal) => {
        const couponPart = activeCoupon ? subtotal * activeCoupon.rate : 0;
        const value = parseFloat(manualDiscount.value);
        let manualPart = 0;
        if (!isNaN(value) && value > 0) {
            manualPart = manualDiscount.type === 'percent'
                ? (subtotal - couponPart) * Math.min(value, 100) / 100
                : value;
        }
        return Math.max(0, Math.min(subtotal, Math.round((couponPart + manualPart) * 100) / 100));
    };

    const loadCartFromOrder = (order) => {
        if (!order) {
            setCart([]);
            setActiveCoupon(null);
            setManualDiscount(d => ({ ...d, value: '' }));
            setActiveRestaurantOrderId(null);
            return;
        }
        const mappedCart = order.items.filter(item => Number(item.qty) > 0).map(item => {
            const product = products.find(p => p.id === item.productId) || {
                id: item.productId,
                nameEN: item.name,
                nameAR: item.name,
                price: item.price,
                category: item.category
            };
            return { product, qty: item.qty };
        });
        setCart(mappedCart);
        setActiveCustomer(order.customer || 'walk-in');
        setTableNum(order.tableNumber);
        setActiveCoupon(null);
        setManualDiscount({ type: 'amount', value: Number(order.discount) > 0 ? String(order.discount) : '' });
        setActiveRestaurantOrderId(order.id);
    };

    // Builds the open order for the selected table from the cart. The order id of a
    // table opened from Table Management is reused, so saving again updates that
    // order instead of creating a second one for the same table.
    const buildRestaurantOrder = () => {
        let subtotal = 0;
        const items = cart.map(c => {
            subtotal += c.product.price * c.qty;
            return {
                productId: c.product.id,
                name: currentLanguage === 'ar' ? c.product.nameAR : c.product.nameEN,
                nameEN: c.product.nameEN || c.product.nameAR,
                nameAR: c.product.nameAR || c.product.nameEN,
                price: c.product.price,
                qty: c.qty,
                category: c.product.category
            };
        });
        const discount = getCartDiscount(subtotal);
        const taxable = subtotal - discount;
        const vat = taxable * (settings.taxRate / 100);
        return {
            id: activeRestaurantOrderId || undefined,
            tableNumber: tableNum,
            customer: activeCustomer !== 'walk-in' ? customers.find(c => c.id === activeCustomer)?.name : '',
            items,
            subtotal,
            discount,
            vat,
            total: taxable + vat
        };
    };

    const resetRestaurantCart = () => {
        setCart([]);
        setActiveCoupon(null);
        setManualDiscount(d => ({ ...d, value: '' }));
        setActiveRestaurantOrderId(null);
        setTableNum('');
        setActiveTab('tableManagement');
    };

    const saveRestaurantOrder = () => {
        if (cart.length === 0 || !tableNum) {
            alert(currentLanguage === 'ar' ? 'السلة فارغة أو لم يتم تحديد طاولة' : 'Cart is empty or no table selected');
            return Promise.resolve(null);
        }
        return fetch('/api/restaurant/orders', {
            method: 'POST',
            headers,
            body: JSON.stringify(buildRestaurantOrder())
        }).then(res => res.json().then(data => {
            if (!res.ok) throw new Error(data.error || 'Saving the table failed');
            return data;
        }));
    };

    const handleHoldTable = () => {
        saveRestaurantOrder()
            .then(saved => {
                if (!saved) return;
                alert(currentLanguage === 'ar' ? 'تم حفظ الطاولة بنجاح' : 'Table held successfully');
                resetRestaurantCart();
            })
            .catch(err => alert((currentLanguage === 'ar' ? 'تعذر حفظ الطاولة: ' : 'Could not save the table: ') + err.message));
    };

    // Saves the table, then sends only new / changed items to the kitchen printers.
    // Tells the cashier which printers worked, which failed and which items have no printer.
    // station 'kitchen' = main Fire button (Main + Kitchen printers); 'juice' = separate Juice button
    const handleFireToKitchen = (station = 'kitchen') => {
        saveRestaurantOrder()
            .then(saved => {
                if (!saved) return;
                return fetch(`/api/restaurant/orders/${saved.id}/print-kot`, { method: 'POST', headers, body: JSON.stringify({ station }) })
                    .then(res => res.json())
                    .then(printRes => {
                        const ar = currentLanguage === 'ar';
                        const lines = [];
                        (printRes.results || []).forEach(r => lines.push(r.success
                            ? `✓ ${r.printer} (${r.lines})`
                            : `✗ ${r.printer} (${r.address}): ${r.error}`));
                        if ((printRes.unrouted || []).length > 0) {
                            lines.push((ar ? 'بدون طابعة: ' : 'No printer for: ') + printRes.unrouted.map(u => `${u.name}${u.category ? ` [${u.category}]` : ''}`).join(', '));
                        }
                        if (printRes.error) lines.push(printRes.error);
                        const isJuice = station === 'juice';
                        if ((printRes.waitingForOtherButton || []).length > 0) {
                            lines.push((isJuice
                                ? (ar ? 'بانتظار زر المطبخ: ' : 'Waiting for the Kitchen button: ')
                                : (ar ? 'بانتظار زر العصائر: ' : 'Waiting for the Juice button: ')) + printRes.waitingForOtherButton.map(w => w.name).join(', '));
                        }
                        let title;
                        if (printRes.message) title = isJuice ? (ar ? 'لا توجد عصائر جديدة' : 'No new juice items') : (ar ? 'لا توجد أصناف جديدة للمطبخ' : 'No new items to send to the kitchen');
                        else if (printRes.success) title = isJuice ? (ar ? 'تم إرسال العصائر' : 'Juices sent') : (ar ? 'تم إرسال الطلب للمطبخ' : 'Order fired to kitchen');
                        else title = ar ? 'لم تتم طباعة كل الأصناف. أعد الإرسال بعد إصلاح الطابعة؛ ستُطبع الأصناف غير المطبوعة فقط.' : 'Not everything printed. Fire again after fixing the printer; only the unprinted items will be sent.';
                        alert([title, ...lines].join('\n'));
                        // The order is saved either way; unprinted items stay pending on the table
                        resetRestaurantCart();
                    });
            })
            .catch(err => alert((currentLanguage === 'ar' ? 'تعذر الإرسال للمطبخ: ' : 'Could not send to the kitchen: ') + err.message));
    };

    const processCheckout = () => {
        if (cart.length === 0) return;

        let subtotal = 0;
        const items = cart.map(c => {
            subtotal += c.product.price * c.qty;
            return { id: c.product.id, name: currentLanguage === 'ar' ? c.product.nameAR : c.product.nameEN, price: c.product.price, qty: c.qty };
        });

        const discount = getCartDiscount(subtotal);
        const taxable = subtotal - discount;
        const vat = taxable * (settings.taxRate / 100);
        const grandTotal = taxable + vat;

        // Find Customer Name
        let customerLabel = currentLanguage === 'ar' ? 'عميل نقدي' : 'Walk-in Cashier Customer';
        if (activeCustomer !== 'walk-in') {
            const cObj = customers.find(c => c.id === activeCustomer);
            if (cObj) customerLabel = cObj.name;
        }

        // Save a fixed "YYYY-MM-DD HH:mm:ss" (local time) instead of toLocaleString(),
        // whose format changes with the browser language (Arabic digits, Hijri calendar).
        // Reports and the ZATCA XML (IssueDate/IssueTime) both read this format directly.
        const nowDate = new Date();
        const pad2 = (n) => String(n).padStart(2, '0');
        const formattedDate = `${nowDate.getFullYear()}-${pad2(nowDate.getMonth() + 1)}-${pad2(nowDate.getDate())} ${pad2(nowDate.getHours())}:${pad2(nowDate.getMinutes())}:${pad2(nowDate.getSeconds())}`;

        const postData = {
            date: formattedDate,
            customer: customerLabel,
            items: items,
            discount: discount,
            total: grandTotal,
            vat: vat,
            paymentMethod: paymentMethod === 'split' ? `Split / مجزأ (Cash: ${splitCash} SAR, Card: ${splitCard} SAR)` : paymentMethod,
            branch: settings.currentBranch || 'Main Branch - Riyadh',
            tableNumber: settings.businessType === 'restaurant' && settings.enableTables ? tableNum : undefined,
            serviceDuration: settings.businessType === 'services' && settings.enableServiceDuration ? serviceDuration : undefined
        };

        fetch('/api/invoices', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(postData)
        })
        .then(res => {
            if (!res.ok) throw new Error('Checkout API failed');
            return res.json();
        })
        .then(newInv => {
            let finalInv = newInv;
            if (activeRestaurantOrderId) {
                const closingId = activeRestaurantOrderId;
                fetch(`/api/restaurant/orders/${closingId}/close`, { method: 'POST', headers, body: JSON.stringify({ invoiceId: newInv.id }) })
                    .catch(err => console.error('Could not close table order', err));
                setActiveRestaurantOrderId(null);
            }
            setInvoices([...invoices, newInv]);
            setActiveInvoice(newInv);
            setInvoiceFormat(activeTab === 'b2bsale' ? 'a4' : 'thermal'); 
            setInvoiceSource(activeTab === 'b2bsale' ? 'sales' : 'pos');
            setShowInvoiceModal(true);
            setCart([]);
            setActiveCoupon(null);
            setManualDiscount(d => ({ ...d, value: '' }));
            setCouponInput('');

            if (zatcaConnected && zatcaConn.autoSend) {
                fetch(`/api/invoices/${newInv.id}/zatca-report`, { method: 'POST', headers: headers })
                .then(res => res.json().then(data => ({ ok: res.ok, data })))
                .then(({ ok, data }) => {
                    // Only mark REPORTED when ZATCA accepted it; otherwise it stays PENDING to retry
                    if (!ok) { console.warn('ZATCA auto-send failed:', data.error); return; }
                    const status = data.zatcaStatus || 'REPORTED';
                    setInvoices(prev => prev.map(i => i.id === newInv.id ? { ...i, zatcaStatus: status, qrCode: data.qrCode || i.qrCode } : i));
                    setActiveInvoice(prev => prev && prev.id === newInv.id ? { ...prev, zatcaStatus: status, qrCode: data.qrCode || prev.qrCode } : prev);
                })
                .catch(err => console.warn('ZATCA auto-send failed:', err.message));
            }
        })
        .catch(() => {
            // Local fallback logic
            const mockInv = {
                ...postData,
                id: `INV-${Date.now().toString().slice(-6)}`,
                uuid: 'f81d4fae-7dec-11d0-a765-' + Math.floor(100000000000 + Math.random() * 900000000000),
                csn: invoices.length + 1,
                pih: invoices.length > 0 ? invoices[invoices.length - 1].xmlHashBase64 || '0' : '0',
                xml: '', xmlHash: 'mock-hash', xmlHashBase64: 'mock-base64', signature: 'mock-sig',
                publicKey: 'mock-key', certSignature: 'mock-cert-sig', zatcaStatus: 'PENDING'
            };
            setInvoices([...invoices, mockInv]);
            setActiveInvoice(mockInv);
            setInvoiceFormat(activeTab === 'b2bsale' ? 'a4' : 'thermal'); 
            setInvoiceSource(activeTab === 'b2bsale' ? 'sales' : 'pos');
            setShowInvoiceModal(true);
            setCart([]);
            setActiveCoupon(null);
            setManualDiscount(d => ({ ...d, value: '' }));
            setCouponInput('');

            // Not saved on the server, so it can't have been reported to ZATCA
        });
    };
    
    
    const handleSendEmail = async () => {
        if (!emailAddress) {
            alert(currentLanguage === 'ar' ? 'الرجاء إدخال البريد الإلكتروني' : 'Please enter an email address');
            return;
        }
        setIsEmailSending(true);
        try {
            const invoiceHtml = document.getElementById('invoicePrintArea').outerHTML;
            const res = await fetch(`${getBaseDomain()}/api/send-email`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: emailAddress,
                    subject: `Invoice ${activeInvoice.id} from ${settings.businessName}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px;">
                            <h2>Hello,</h2>
                            <p>Please find your invoice details below from <strong>${settings.businessName}</strong>.</p>
                            <hr />
                            ${invoiceHtml}
                            <hr />
                            <p>Thank you for your business!</p>
                        </div>
                    `
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(currentLanguage === 'ar' ? 'تم إرسال البريد الإلكتروني بنجاح!' : 'Email sent successfully!');
                setShowEmailModal(false);
                setEmailAddress('');
            } else {
                alert((currentLanguage === 'ar' ? 'فشل إرسال البريد: ' : 'Failed to send email: ') + (data.error || 'Unknown error'));
            }
        } catch (err) {
            alert((currentLanguage === 'ar' ? 'حدث خطأ أثناء الإرسال: ' : 'Error sending email: ') + err.message);
        } finally {
            setIsEmailSending(false);
        }
    };
const handleB2BSubmit = () => {
        if (b2bForm.items.length === 0 || !b2bForm.items[0].productId) return;
        
        const validItems = b2bForm.items.filter(i => i.productId);
        const subtotal = validItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const vat = validItems.reduce((acc, item) => acc + (item.price * item.qty * (item.vatRate / 100)), 0);
        const grandTotal = subtotal + vat;

        const customerLabel = b2bForm.customer || (currentLanguage === 'ar' ? 'عميل نقدي' : 'Walk-in Customer');

        const postData = {
            date: b2bForm.date,
            customer: customerLabel,
            items: validItems.map(i => ({ id: i.productId, name: i.name, price: i.price, qty: i.qty })),
            discount: 0,
            total: grandTotal,
            vat: vat,
            paymentMethod: 'Credit',
            branch: settings.currentBranch || 'Main Branch - Riyadh',
            notes: b2bForm.notes
        };

        if (b2bForm.saveAs === 'Quotation') {
            const newQuote = { ...postData, id: `QT-${Date.now().toString().slice(-6)}`, status: 'Valid' };
            setQuotations([...quotations, newQuote]);
            setActiveTab('quotations');
        } else {
            const invPayload = {
                ...postData,
                invoiceTypeCode: '388',
                invoiceTypeCodeName: '0100000',
                profileId: 'clearance:1.0',
                zatcaStatus: b2bForm.saveAs === 'Draft' ? 'DRAFT' : 'PENDING'
            };
            fetch('/api/invoices', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(invPayload)
            })
            .then(res => {
                if (!res.ok) throw new Error('B2B Invoice save failed');
                return res.json();
            })
            .then(savedInv => {
                setInvoices(prev => [...prev, savedInv]);
                if (b2bForm.saveAs === 'Invoice') {
                    setActiveInvoice(savedInv);
                    setInvoiceFormat('a4');
                    setInvoiceSource('sales');
                    setShowInvoiceModal(true);
                }
                setActiveTab('invoices');
            })
            .catch(() => {
                const newInv = {
                    ...invPayload,
                    id: `INV-${Date.now().toString().slice(-6)}`
                };
                setInvoices(prev => [...prev, newInv]);
                if (b2bForm.saveAs === 'Invoice') {
                    setActiveInvoice(newInv);
                    setInvoiceFormat('a4');
                    setInvoiceSource('sales');
                    setShowInvoiceModal(true);
                }
                setActiveTab('invoices');
            });
        }
        
        // Reset Form
        setB2bForm({
            customer: '', date: new Date().toISOString().split('T')[0],
            items: [{ id: Date.now().toString(), productId: '', name: '', qty: 1, price: 0, vatRate: 15, total: 0 }],
            notes: '', saveAs: 'Invoice'
        });
    };

    const handleB2BItemChange = (index, field, value) => {
        const newItems = [...b2bForm.items];
        
        if (field === 'productId') {
            // Check if this product already exists in another row
            const existingIndex = newItems.findIndex((item, idx) => idx !== index && item.productId === value && value !== '');
            if (existingIndex >= 0) {
                newItems[existingIndex].qty += 1;
                newItems[existingIndex].total = newItems[existingIndex].qty * newItems[existingIndex].price;
                // Reset the current row
                newItems[index] = { id: newItems[index].id, productId: '', name: '', qty: 1, price: 0, vatRate: 15, total: 0 };
                setB2bForm({ ...b2bForm, items: newItems });
                return;
            }

            const prod = products.find(p => p.id === value);
            if (prod) {
                newItems[index].productId = prod.id;
                newItems[index].name = currentLanguage === 'ar' ? prod.nameAR : prod.nameEN;
                newItems[index].price = prod.price;
            }
        } else if (field === 'qty') {
            newItems[index].qty = Number(value) || 1;
        } else if (field === 'price') {
            newItems[index].price = Number(value) || 0;
        } else if (field === 'vatRate') {
            newItems[index].vatRate = Number(value) || 0;
        }
        newItems[index].total = newItems[index].qty * newItems[index].price;
        setB2bForm({ ...b2bForm, items: newItems });
    };

    const handleB2BAddItem = () => {
        setB2bForm({
            ...b2bForm,
            items: [...b2bForm.items, { id: Date.now().toString(), productId: '', name: '', qty: 1, price: 0, vatRate: 15, total: 0 }]
        });
    };

    const handleB2BRemoveItem = (index) => {
        const newItems = [...b2bForm.items];
        newItems.splice(index, 1);
        setB2bForm({ ...b2bForm, items: newItems });
    };

    const handleSaveQuotationFromCart = () => {
        if (cart.length === 0) return;

        let subtotal = 0;
        const items = cart.map(c => {
            subtotal += c.product.price * c.qty;
            return { id: c.product.id, name: currentLanguage === 'ar' ? c.product.nameAR : c.product.nameEN, price: c.product.price, qty: c.qty };
        });

        const discount = getCartDiscount(subtotal);
        const taxable = subtotal - discount;
        const vat = taxable * (settings.taxRate / 100);
        const grandTotal = taxable + vat;

        let customerLabel = currentLanguage === 'ar' ? 'عميل نقدي' : 'Walk-in Cashier Customer';
        if (activeCustomer !== 'walk-in') {
            const cObj = customers.find(c => c.id === activeCustomer);
            if (cObj) customerLabel = cObj.name;
        }

        const postData = {
            customer: customerLabel,
            items: items,
            discount: discount,
            total: grandTotal,
            vat: vat
        };

        fetch('/api/quotations', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(postData)
        })
        .then(res => {
            if (!res.ok) throw new Error('Quotation API failed');
            return res.json();
        })
        .then(newQuote => {
            setQuotations([...quotations, newQuote]);
            setActiveQuotation(newQuote);
            setShowQuotationModal(true);
            setCart([]);
            setActiveCoupon(null);
            setManualDiscount(d => ({ ...d, value: '' }));
            setCouponInput('');
        })
        .catch(() => {
            const mockQuote = {
                ...postData,
                id: `QTN-${Date.now().toString().slice(-4)}`,
                date: new Date().toLocaleString()
            };
            setQuotations([...quotations, mockQuote]);
            setActiveQuotation(mockQuote);
            setShowQuotationModal(true);
            setCart([]);
            setActiveCoupon(null);
            setManualDiscount(d => ({ ...d, value: '' }));
            setCouponInput('');
        });
    };

    const handleDeleteQuotation = (quoteId) => {
        if (!confirm(currentLanguage === 'ar' ? "هل أنت متأكد من حذف عرض السعر؟" : "Are you sure you want to delete this quotation?")) return;
        fetch(`/api/quotations/${quoteId}`, {
            method: 'DELETE',
            headers: headers
        })
        .then(() => {
            setQuotations(quotations.filter(q => q.id !== quoteId));
        })
        .catch(() => {
            setQuotations(quotations.filter(q => q.id !== quoteId));
        });
    };

    const handleSaveQuotation = (e) => {
        e.preventDefault();
        const total = parseFloat(quotationForm.total) || 0;
        const vat = total * (settings.taxRate / 100);
        const parsedItems = (quotationForm.itemsText || '').split(',').map((str, idx) => {
            const parts = str.trim().split('x');
            const name = parts[0].trim();
            const qty = parts[1] ? parseInt(parts[1].trim(), 10) || 1 : 1;
            const price = total ? (total / qty) : 0;
            return { id: `item-${idx}`, name, price, qty };
        });

        const postData = {
            customer: quotationForm.customer,
            items: parsedItems,
            discount: 0,
            total: total + vat,
            vat: vat
        };

        if (quotationForm.id) {
            fetch(`/api/quotations/${quotationForm.id}`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(postData)
            })
            .then(res => {
                if (!res.ok) throw new Error('Quotation update failed');
                return res.json();
            })
            .then(updatedQuote => {
                setQuotations(quotations.map(q => q.id === quotationForm.id ? { ...q, ...updatedQuote } : q));
                setShowQuotationCrudModal(false);
            })
            .catch(() => {
                const updatedMock = { ...quotationForm, ...postData };
                setQuotations(quotations.map(q => q.id === quotationForm.id ? updatedMock : q));
                setShowQuotationCrudModal(false);
            });
        } else {
            fetch('/api/quotations', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(postData)
            })
            .then(res => {
                if (!res.ok) throw new Error('Quotation create failed');
                return res.json();
            })
            .then(newQuote => {
                setQuotations([...quotations, newQuote]);
                setShowQuotationCrudModal(false);
            })
            .catch(() => {
                const mockQuote = {
                    ...postData,
                    id: `QTN-${Date.now().toString().slice(-4)}`,
                    date: new Date().toLocaleString()
                };
                setQuotations([...quotations, mockQuote]);
                setShowQuotationCrudModal(false);
            });
        }
    };

    // ----------------------------------------------------
    // ZATCA SIMULATOR LOGICS
    // ----------------------------------------------------
    const triggerZatcaPortalClearance = () => {
        if (!zatcaSelectInvoice) return;
        const inv = invoices.find(i => i.id === zatcaSelectInvoice);
        if (!inv) return;

        setIsReportingZatca(true);
        setZatcaConsole([]);

        const appendLog = (type, text, delay) => {
            setTimeout(() => {
                setZatcaConsole(prev => [...prev, { type, text }]);
            }, delay);
        };

        appendLog("SYSTEM", "Initializing ZATCA Phase 2 clearance endpoint connection...", 100);
        appendLog("XML", `UBL 2.1 compliant XML layout generated. UUID: ${inv.uuid}`, 500);
        appendLog("HASH", `Computed SHA-256 Digest: ${inv.xmlHash || '5e2a39bc...'}`, 1100);
        appendLog("SIGN", `Constructing simulated ECDSA cryptographic stamp signature...`, 1800);
        appendLog("CHAIN", `CSN Sequence No: ${inv.csn} | PIH Link: ${inv.pih ? inv.pih.slice(0, 20) : 'None'}...`, 2400);
        appendLog("API", "Sending API payload to ZATCA /v2/invoices/reporting portal...", 3000);

        setTimeout(() => {
            fetch(`/api/invoices/${inv.id}/zatca-report`, { method: 'POST', headers: headers })
                .then(res => {
                    if (!res.ok) return res.json().then(e => { throw new Error(e.error || 'ZATCA Error'); });
                    return res.json();
                })
                .then(data => {
                    const updated = invoices.map(i => i.id === inv.id ? {
                        ...i,
                        zatcaStatus: data.zatcaStatus || 'REPORTED',
                        xml: data.xml || i.xml,
                        xmlHash: data.xmlHash || i.xmlHash,
                        xmlHashBase64: data.invoiceHash || i.xmlHashBase64,
                        signature: data.signature || i.signature,
                        publicKey: data.publicKey || i.publicKey,
                        certSignature: data.certSignature || i.certSignature,
                        qrCode: data.qrCode || i.qrCode
                    } : i);
                    setInvoices(updated);
                    appendLog("SUCCESS", `HTTP/1.1 200 OK | Hash: ${(data.invoiceHash || '').slice(0, 24)}...`, 100);
                    appendLog("SUCCESS", "Tax Invoice cryptographically signed & registered in ZATCA portal.", 200);
                    setIsReportingZatca(false);
                })
                .catch((err) => {
                    // Not reported: keep the invoice's status so it can be retried
                    appendLog("ERROR", `ZATCA reporting failed: ${err.message}`, 100);
                    setIsReportingZatca(false);
                });
        }, 3600);
    };

    // Download XML file
    const downloadXml = (inv) => {
        const dummyXml = inv.xml || `<?xml version="1.0" encoding="UTF-8"?><Invoice><ID>${inv.id}</ID><UUID>${inv.uuid}</UUID></Invoice>`;
        const blob = new Blob([dummyXml], { type: 'text/xml' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `ZATCA-Phase2-Invoice-${inv.id}.xml`;
        link.click();
    };

    const handleRefundInvoice = (id) => {
        if (!window.confirm(currentLanguage === 'ar' ? 'هل أنت متأكد من رغبتك في استرجاع هذه الفاتورة؟' : 'Are you sure you want to refund this invoice?')) {
            return;
        }
        fetch(`/api/invoices/${id}/refund`, {
            method: 'POST',
            headers: headers
        })
        .then(res => {
            if (!res.ok) {
                return res.json().then(err => { throw new Error(err.error || 'Refund failed'); });
            }
            return res.json();
        })
        .then(data => {
            setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, zatcaStatus: 'REFUNDED' } : inv));
            fetch('/api/products', { headers })
                .then(res => res.json())
                .then(prods => setProducts(prods))
                .catch(() => {});
            alert(currentLanguage === 'ar' ? "تمت عملية الاسترجاع بنجاح وإعادة الكميات للمخزن" : "Refund processed successfully and stock restored");
        })
        .catch(err => {
            const inv = invoices.find(i => i.id === id);
            if (inv) {
                if (inv.zatcaStatus === 'REFUNDED') {
                    alert(currentLanguage === 'ar' ? "هذه الفاتورة مسترجعة بالفعل" : "Invoice already refunded");
                    return;
                }
                const updatedInvoices = invoices.map(i => i.id === id ? { ...i, zatcaStatus: 'REFUNDED' } : i);
                setInvoices(updatedInvoices);
                const updatedProducts = products.map(p => {
                    const item = inv.items.find(it => it.id === p.id);
                    if (item) {
                        return { ...p, stock: (p.stock || 0) + item.qty };
                    }
                    return p;
                });
                setProducts(updatedProducts);
                alert(currentLanguage === 'ar' ? "تم الاسترجاع محلياً بنجاح" : "Refunded locally successfully");
            } else {
                alert(err.message);
            }
        });
    };

    // ----------------------------------------------------
    // INVENTORY / ASSET / CRM CRUD HANDLERS
    // ----------------------------------------------------
    const handleSaveAsset = (e) => {
        e.preventDefault();
        fetch('/api/assets', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(assetForm)
        })
        .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
        })
        .then(data => {
            setAssets([...assets, data]);
            setShowAssetModal(false);
        })
        .catch(() => {
            const mock = { ...assetForm, id: `AST-${Date.now().toString().slice(-4)}` };
            setAssets([...assets, mock]);
            setShowAssetModal(false);
        });
    };

    const handleSaveExpense = (e) => {
        e.preventDefault();
        const method = expForm.id ? 'PUT' : 'POST';
        const url = expForm.id ? `/api/expenses/${expForm.id}` : '/api/expenses';
        fetch(url, {
            method: method,
            headers: headers,
            body: JSON.stringify(expForm)
        })
        .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
        })
        .then(data => {
            if (expForm.id) {
                setExpenses(expenses.map(e => e.id === expForm.id ? data : e));
            } else {
                setExpenses([...expenses, data]);
            }
            setShowExpenseModal(false);
            setExpForm({ category: 'rent', amount: '', description: '', date: '' });
        })
        .catch(() => {
            if (expForm.id) {
                setExpenses(expenses.map(e => e.id === expForm.id ? { ...expForm } : e));
            } else {
                const mock = { ...expForm, id: `EXP-${Date.now().toString().slice(-4)}` };
                setExpenses([...expenses, mock]);
            }
            setShowExpenseModal(false);
            setExpForm({ category: 'rent', amount: '', description: '', date: '' });
        });
    };

    const handleDeleteExpense = (id) => {
        if (!confirm(currentLanguage === 'ar' ? 'هل أنت متأكد من حذف هذا المصروف؟' : 'Are you sure you want to delete this expense?')) return;
        fetch(`/api/expenses/${id}`, { method: 'DELETE', headers: headers })
        .then(() => {
            setExpenses(expenses.filter(e => e.id !== id));
        })
        .catch(() => {
            setExpenses(expenses.filter(e => e.id !== id));
        });
    };

    const handleSaveOrder = (e) => {
        e.preventDefault();
        const method = orderForm.id ? 'PUT' : 'POST';
        const url = orderForm.id ? `/api/orders/${orderForm.id}` : '/api/orders';
        fetch(url, {
            method: method,
            headers: headers,
            body: JSON.stringify(orderForm)
        })
        .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
        })
        .then(data => {
            if (orderForm.id) {
                setOrders(orders.map(o => o.id === orderForm.id ? data : o));
            } else {
                setOrders([...orders, data]);
            }
            setShowOrderModal(false);
            setOrderForm({ customer: '', items: '', total: '', status: 'Pending', date: new Date().toLocaleString() });
        })
        .catch(() => {
            if (orderForm.id) {
                setOrders(orders.map(o => o.id === orderForm.id ? { ...orderForm } : o));
            } else {
                const mock = { ...orderForm, id: `ORD-${Date.now().toString().slice(-4)}` };
                setOrders([...orders, mock]);
            }
            setShowOrderModal(false);
            setOrderForm({ customer: '', items: '', total: '', status: 'Pending', date: new Date().toLocaleString() });
        });
    };

    const handleDeleteOrder = (id) => {
        if (!confirm(currentLanguage === 'ar' ? 'هل أنت متأكد من حذف هذا الطلب؟' : 'Are you sure you want to delete this order?')) return;
        fetch(`/api/orders/${id}`, { method: 'DELETE', headers: headers })
        .then(() => {
            setOrders(orders.filter(o => o.id !== id));
        })
        .catch(() => {
            setOrders(orders.filter(o => o.id !== id));
        });
    };

    const handleSaveUser = (e) => {
        e.preventDefault();
        
        if (!userForm.id && usersList.length >= 3) {
            alert(currentLanguage === 'ar' ? 'لقد وصلت للحد الأقصى لعدد المستخدمين (3 مستخدمين).' : 'You have reached the maximum limit of 3 users for this store.');
            return;
        }

        const method = userForm.id ? 'PUT' : 'POST';
        const url = userForm.id ? `/api/users/${userForm.id}` : '/api/users';
        fetch(url, {
            method: method,
            headers: headers,
            body: JSON.stringify({ ...userForm, isActive: userForm.isActive !== false })
        })
        .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
        })
        .then(data => {
            if (userForm.id) {
                setUsersList(usersList.map(u => u.id === userForm.id ? data : u));
            } else {
                setUsersList([...usersList, data]);
            }
            setShowUserModal(false);
            setUserForm({ username: '', password: '', role: 'Cashier' });
        })
        .catch(() => {
            if (userForm.id) {
                setUsersList(usersList.map(u => u.id === userForm.id ? { ...userForm } : u));
            } else {
                const mock = { ...userForm, id: Date.now().toString() };
                setUsersList([...usersList, mock]);
            }
            setShowUserModal(false);
            setUserForm({ username: '', password: '', role: 'Cashier' });
        });
    };

    const handleDeleteUser = (id) => {
        if (id === user.id) {
            alert(currentLanguage === 'ar' ? 'لا يمكنك حذف حسابك الحالي!' : 'You cannot delete your own active account!');
            return;
        }
        if (!confirm(currentLanguage === 'ar' ? 'هل أنت متأكد من حذف هذا المستخدم؟' : 'Are you sure you want to delete this user?')) return;
        fetch(`/api/users/${id}`, { method: 'DELETE', headers: headers })
        .then(() => {
            setUsersList(usersList.filter(u => u.id !== id));
        })
        .catch(() => {
            setUsersList(usersList.filter(u => u.id !== id));
        });
    };

    const handleSaveCustomer = (e) => {
        e.preventDefault();
        const method = custForm.id ? 'PUT' : 'POST';
        const url = custForm.id ? `/api/customers/${custForm.id}` : '/api/customers';
        
        fetch(url, {
            method: method,
            headers: headers,
            body: JSON.stringify(custForm)
        })
        .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
        })
        .then(data => {
            if (custForm.id) {
                setCustomers(customers.map(c => c.id === custForm.id ? data : c));
            } else {
                setCustomers([...customers, data]);
            }
            setShowCustomerModal(false);
            setCustForm({ name: '', phone: '', email: '' });
        })
        .catch(() => {
            if (custForm.id) {
                setCustomers(customers.map(c => c.id === custForm.id ? { ...custForm } : c));
            } else {
                const mock = { ...custForm, id: `CUST-${Date.now().toString().slice(-4)}`, loyaltyPoints: 0, totalPurchases: 0 };
                setCustomers([...customers, mock]);
            }
            setShowCustomerModal(false);
            setCustForm({ name: '', phone: '', email: '' });
        });
    };

    const handleDeleteCustomer = (id) => {
        if (!confirm(currentLanguage === 'ar' ? 'هل أنت متأكد من حذف هذا العميل؟' : 'Are you sure you want to delete this customer?')) return;
        fetch(`/api/customers/${id}`, { method: 'DELETE', headers: headers })
        .then(() => {
            setCustomers(customers.filter(c => c.id !== id));
        })
        .catch(() => {
            setCustomers(customers.filter(c => c.id !== id));
        });
    };

    const handleDeleteSupplier = (id) => {
        if (!confirm(currentLanguage === 'ar' ? 'هل أنت متأكد من حذف هذا المورد؟' : 'Are you sure you want to delete this supplier?')) return;
        fetch(`/api/suppliers/${id}`, { method: 'DELETE', headers: headers })
        .then(() => {
            setSuppliers(suppliers.filter(s => s.id !== id));
        })
        .catch(() => {
            setSuppliers(suppliers.filter(s => s.id !== id));
        });
    };

    // Calculate Asset Depreciation schedule
    const calculateAssetValues = (a) => {
        const currentYear = new Date().getFullYear();
        const purchaseYear = new Date(a.date).getFullYear() || 2025;
        const yearsElapsed = Math.max(0, currentYear - purchaseYear);
        const annualDep = (a.cost - a.salvage) / a.life;
        const accumulatedDep = annualDep * yearsElapsed;
        const currentBookValue = Math.max(a.salvage, a.cost - accumulatedDep);
        return { annualDep, currentBookValue };
    };

    // ----------------------------------------------------
    // RENDER INTERACTIVE SECTIONS
    // ----------------------------------------------------
    
    const renderDevToolbar = () => {
        if (!isLocalhost) return null;
        return (
            <div style={{
                position: 'fixed',
                bottom: '10px',
                right: currentLanguage === 'ar' ? 'auto' : '10px',
                left: currentLanguage === 'ar' ? '10px' : 'auto',
                background: 'rgba(10, 10, 18, 0.95)',
                border: '2px solid var(--accent-purple)',
                padding: '10px 14px',
                borderRadius: '8px',
                zIndex: 99999,
                fontSize: '11px',
                color: 'var(--text-primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                fontFamily: 'sans-serif'
            }} dir="ltr">
                <div style={{ fontWeight: 'bold', color: 'var(--accent-cyan)', textAlign: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '4px' }}>
                    🛠️ Localhost Domain Switcher
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                        onClick={() => { setSimulatedDomain('marketing'); }}
                        style={{
                            padding: '4px 6px',
                            background: routeMode === 'marketing' ? 'var(--accent-purple)' : '#222',
                            color: '#fff',
                            borderRadius: '4px',
                            fontSize: '10px',
                            cursor: 'pointer'
                        }}
                    >
                        26i.uk (Web)
                    </button>
                    <button 
                        onClick={() => { setSimulatedDomain('demo'); }}
                        style={{
                            padding: '4px 6px',
                            background: routeMode === 'demo' ? 'var(--accent-purple)' : '#222',
                            color: '#fff',
                            borderRadius: '4px',
                            fontSize: '10px',
                            cursor: 'pointer'
                        }}
                    >
                        Demo Tenant
                    </button>
                    <button 
                        onClick={() => { setSimulatedDomain('customer'); }}
                        style={{
                            padding: '4px 6px',
                            background: routeMode === 'customer' ? 'var(--accent-purple)' : '#222',
                            color: '#fff',
                            borderRadius: '4px',
                            fontSize: '10px',
                            cursor: 'pointer'
                        }}
                    >
                        cust-x (Tenant)
                    </button>
                </div>
                {routeMode === 'customer' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Tenant:</span>
                        <input 
                            type="text" 
                            value={simulatedTenant} 
                            onChange={(e) => setSimulatedTenant(e.target.value)}
                            style={{
                                width: '80px',
                                background: '#111',
                                border: '1px solid var(--glass-border)',
                                color: '#fff',
                                padding: '2px 4px',
                                borderRadius: '2px',
                                fontSize: '10px'
                            }}
                        />
                    </div>
                )}
            </div>
        );
    };

    // Check if SaaS superadmin panel is requested via URL path (restricted to marketing/root domain on /saas-admin only)
    const isSaaSDomain = (routeMode === 'marketing');
    if (
        isSaaSDomain && (
            window.location.pathname === '/saas-admin' || 
            window.location.pathname.startsWith('/saas-admin/')
        )
    ) {
        return <SaasAdmin baseDomain={baseDomain} />;
    }

    // Check if Tenant Portal is requested via URL path
    if (window.location.pathname === '/portal' || window.location.pathname.startsWith('/portal/')) {
        return <TenantPortal />;
    }

    // Render Marketing Landing Page
    if (routeMode === 'marketing') {
        return (
            <>
                <LandingPage 
                    currentLanguage={currentLanguage} 
                    setCurrentLanguage={setCurrentLanguage} 
                    theme={theme} 
                    setTheme={setTheme} 
                    onLaunchApp={handleLaunchApp} 
                    onRegisterSuccess={handleRegisterSuccess}
                    baseDomain={baseDomain}
                    settings={settings}
                />
                {renderDevToolbar()}
            </>
        );
    }
    
    // Auth Overlay Login page (for demo.26i.uk or cust-x.26i.uk)
    // Storefront Routing (Public, Unauthenticated)
    const isAdminPath = window.location.pathname.startsWith('/admin');
    const isStorefrontPath = window.location.pathname.startsWith('/store');
    if (routeMode === 'customer' && isStorefrontPath) {
        return (
            <Storefront 
                tenantId={tenantId}
                currentLanguage={currentLanguage}
                setLanguage={setCurrentLanguage}
            />
        );
    }


    const isRootPath = window.location.pathname === '/';
    // Public Tenant Web Portal at root URL (always shown at / for customers)
        const isRoomPath = window.location.pathname.startsWith('/room/');
    if (routeMode === 'customer' && isRoomPath) {
        return (
            <RoomDetails 
                tenantId={tenantId}
                currentLanguage={currentLanguage}
                setLanguage={setCurrentLanguage}
            />
        );
    }

    const isTailoringPortalPath = window.location.pathname === '/tailoring-portal' || window.location.pathname.startsWith('/tailoring-portal/');
    if ((routeMode === 'customer' || routeMode === 'demo') && isTailoringPortalPath) {
        return (
            <TailoringWebPortal
                tenantId={tenantId || 'default'}
                currentLanguage={currentLanguage}
                setLanguage={setCurrentLanguage}
                initialSettings={settings}
            />
        );
    }

    if (routeMode === 'customer' && isRootPath) {
        const lowerTenant = (tenantId || '').toLowerCase();
        const isTailoringTenant =
            settings?.businessType === 'tailoring' ||
            (settings?.enabledModules?.tailoring && !settings?.enabledModules?.propertyManagement && settings?.businessType !== 'realestate') ||
            lowerTenant.includes('tailor') ||
            lowerTenant.includes('thobe') ||
            lowerTenant.includes('atelier') ||
            lowerTenant.includes('khayata');

        if (isTailoringTenant) {
            return (
                <TailoringWebPortal
                    tenantId={tenantId}
                    currentLanguage={currentLanguage}
                    setLanguage={setCurrentLanguage}
                    initialSettings={settings}
                />
            );
        }

        // Property-management stores keep the property portal; every other business type
        // gets a home page designed for its kind of business (it used to be the property
        // portal for everyone).
        const isRealEstateTenant =
            settings?.businessType === 'realestate' ||
            (!settings?.businessType && settings?.enabledModules?.propertyManagement);
        if (isRealEstateTenant) {
            return (
                <TenantWebPortal
                    tenantId={tenantId}
                    currentLanguage={currentLanguage}
                    setLanguage={setCurrentLanguage}
                />
            );
        }

        return (
            <BusinessLandingPage
                tenantId={tenantId}
                currentLanguage={currentLanguage}
                setLanguage={setCurrentLanguage}
                initialSettings={settings?.tenantId === tenantId ? settings : null}
            />
        );
    }

    if (!token) {

        if (authView === 'forgot-password') {
            return (
                <>
                    <ForgotPassword onNavigate={setAuthView} />
                    {renderDevToolbar()}
                </>
            );
        }
        
        if (authView === 'reset-password') {
            return (
                <>
                    <ResetPassword onNavigate={setAuthView} />
                    {renderDevToolbar()}
                </>
            );
        }

        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '20px' }}>
                <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div className="brand" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="ri-store-2-line"></i>
                            <span>
                                {routeMode === 'customer' ? (tenantId ? tenantId.toUpperCase() : 'SME Solutions') : 'SME Solutions'}
                            </span>
                        </div>
                        <button 
                            className="btn btn-secondary" 
                            onClick={() => setCurrentLanguage(currentLanguage === 'ar' ? 'en' : 'ar')} 
                            style={{ padding: '4px 8px', fontSize: '11px', height: '28px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
                            type="button"
                        >
                            <i className="ri-translate" style={{ fontSize: '12px' }}></i>
                            <span>{currentLanguage === 'ar' ? 'English' : 'العربية'}</span>
                        </button>
                    </div>

                    {routeMode === 'demo' && (
                        <div style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid var(--accent-cyan)', padding: '10px 14px', borderRadius: '4px', marginBottom: '20px', fontSize: '12px', lineHeight: '1.4' }}>
                            <i className="ri-information-line" style={{ marginRight: '6px', color: 'var(--accent-cyan)' }}></i>
                            {currentLanguage === 'ar' ? 'مرحباً بك في النظام التجريبي. تم ملء بيانات الدخول تلقائياً (demo / demo123).' : 'Welcome to 26i Demo. Credentials are pre-filled (demo / demo123).'}
                        </div>
                    )}

                    {routeMode === 'customer' && (
                        <div style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid var(--accent-purple)', padding: '10px 14px', borderRadius: '4px', marginBottom: '20px', fontSize: '12px', lineHeight: '1.4' }}>
                            <i className="ri-shield-user-line" style={{ marginRight: '6px', color: 'var(--accent-purple)' }}></i>
                            {currentLanguage === 'ar' ? `بوابة العميل الخاصة بـ: ${tenantId ? tenantId.toUpperCase() : 'خارجية'}` : `Branded Client Portal for: ${tenantId ? tenantId.toUpperCase() : 'N/A'}`}
                        </div>
                    )}

                    <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>{currentLanguage === 'ar' ? 'تسجيل الدخول' : 'User Login'}</h3>
                    {new URLSearchParams(window.location.search).get('verified') === 'true' && (
                        <div style={{ color: 'var(--accent-success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '15px', textAlign: 'center', border: '1px solid var(--accent-success)' }}>
                            {currentLanguage === 'ar' ? 'تم التحقق من بريدك الإلكتروني بنجاح! يمكنك الآن تسجيل الدخول.' : 'Email verified successfully! You can now log in.'}
                        </div>
                    )}
                    {authError && <div style={{ color: 'var(--accent-danger)', fontSize: '13px', marginBottom: '15px', textAlign: 'center' }}>{authError}</div>}
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label>{currentLanguage === 'ar' ? 'اسم المستخدم' : 'Username'}</label>
                            <input type="text" className="form-control" placeholder="admin / manager / cashier" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>{currentLanguage === 'ar' ? 'كلمة المرور' : 'Password'}</label>
                            <input type="password" className="form-control" placeholder="admin123" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>{currentLanguage === 'ar' ? 'دخول' : 'Login'}</button>
                        
                        <div style={{ textAlign: 'center', marginTop: '16px' }}>
                            <button type="button" onClick={() => setAuthView('forgot-password')} style={{ background: 'transparent', border: 'none', color: 'var(--accent-purple)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>
                                {currentLanguage === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                            </button>
                        </div>
                    </form>

                    <div style={{ textAlign: 'center', marginTop: '24px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                        <button 
                            className="btn btn-secondary" 
                            style={{ padding: '8px 16px', fontSize: '12px', background: 'none', border: 'none', color: 'var(--accent-purple)' }}
                            onClick={handleGoBackToHome}
                        >
                            <i className="ri-arrow-left-line" style={{ marginRight: '4px', verticalAlign: 'middle' }}></i>
                            {currentLanguage === 'ar' ? 'العودة للموقع الرئيسي 26i.uk' : 'Back to 26i.uk Homepage'}
                        </button>
                    </div>
                </div>
                {renderDevToolbar()}
            </div>
        );
    }

    const props = { generateZatcaQR, handleHoldTable, handleFireToKitchen, hasJuicePrinter, setHasJuicePrinter, zatcaConnected,loadCartFromOrder, handleB2BAddItem, setHostname, products, settings, activeCoupon, manualDiscount, setManualDiscount, getCartDiscount, handleLaunchApp, simulatedDomain, setQuotations, setAuthError, handleB2BItemChange, loginUsername, calculateAssetValues, handleDeleteExpense, handleSaveQuotation, handleB2BRemoveItem, simulatedTenant, setReportSubTab, handleRefundInvoice, handleRegisterSuccess, setServiceDuration, activeCustomer, setLoginPassword, setMobileMenuOpen, setZatcaConsole, zatcaSelectInvoice, setShowAssetModal, invoices, setUser, setTableNum, quotations, quotationForm, currentLanguage, showAssetQrModal, posFilter, setToken, setInvoiceSource, showCustomerModal, salesStartDate, usersList, setSplitCard, activeTab, downloadXml, setActiveInvoice, setActiveAssetForQr, setCustForm, couponInput, setInvoiceFormat, splitCash, setShowOrderModal, setPosFilter, setSalesEndDate, setShowAssetQrModal, showOrderModal, applyCoupon, handleSaveOrder, setZatcaConn, zatcaConsole, setQuotationForm, setOrderForm, handleSaveQuotationFromCart, setShowCustomerModal, handleDeleteOrder, setSimulatedDomain, setShowExpenseModal, setB2bForm, expenses, isReportingZatca, showQuotationModal, setCurrentLanguage, reportSubTab, handleSaveUser, setProducts, orders, handleSaveAsset, setSalesSearch, setEmployees, handleB2BSubmit, customers, setExpForm, orderForm, setCustomers, serviceDuration, assets, showUserModal, getBaseDomain, activeQuotation, updateCartQty, setActiveCustomer, simulateZATCAReporting, setZatcaSelectInvoice, user, setSuppliers, handleLogin, handleSaveCustomer, invoiceFormat, setCart, setPosSearch, activeAssetForQr, hostname, setActiveQuotation, custForm, splitCard, suppliers, addToCart, authError, zatcaConn, setOrders, setLoginUsername, handleDeleteCustomer, setActiveTab, handleSaveExpense, handleDeleteQuotation, setTheme, userForm, expForm, salesSearch, setSplitCash, setSalesStartDate, salesEndDate, invoiceSource, b2bForm, isAllowedTab, triggerZatcaPortalClearance, setSimulatedTenant, setShowQuotationModal, setPaymentMethod, setExpenses, setShowQuotationCrudModal, setShowInvoiceModal, processCheckout, setUsersList, setIsReportingZatca, posSearch, showInvoiceModal, setAssetForm, getPaymentMethodLabel, formatCurrency, handleLogout, setInvoices, tableNum, setSettings, cart, setActiveCoupon, mobileMenuOpen, paymentMethod, assetForm, showExpenseModal, token, employees, setShowUserModal, showAssetModal, setUserForm, loginPassword, handleDeleteUser, theme, setCouponInput, setAssets, activeInvoice, showQuotationCrudModal, translations, headers, units, setUnits };

    const b2bProductOptions = products.map(p => (
        <option key={p.id} value={p.id}>{currentLanguage === 'ar' ? p.nameAR : p.nameEN}</option>
    ));

    return (
        <div className="app-container">
            <Sidebar settings={settings} 
                handleLogout={handleLogout}
                mobileMenuOpen={mobileMenuOpen} 
                setMobileMenuOpen={setMobileMenuOpen} 
                currentLanguage={currentLanguage} 
                setCurrentLanguage={setCurrentLanguage} 
                theme={theme} 
                setTheme={setTheme} 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
            />

            {/* Main Application Area */}
            <main className="main-content">
                <header className="header">
                    <button 
                        className="mobile-menu-toggle" 
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle Menu"
                    >
                        <i className="ri-menu-line"></i>
                    </button>
                    <div className="header-title">
                        <h1>{translations[currentLanguage][activeTab]}</h1>
                        <p style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {routeMode === 'demo' ? (
                                <span style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--accent-cyan)', border: '1px solid var(--accent-cyan)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' }}>
                                    {currentLanguage === 'ar' ? 'نظام تجريبي' : 'DEMO'}
                                </span>
                            ) : null}
                            <span>
                                {routeMode === 'demo' ? (
                                    currentLanguage === 'ar' ? 'مرحباً بك في النظام التجريبي لـ 26i' : 'Welcome to 26i Demo Store'
                                ) : (
                                    settings && settings.fullName ? (
                                        currentLanguage === 'ar' ? `مرحباً بك، ${settings.fullName}` : `Welcome, ${settings.fullName}`
                                    ) : (
                                        translations[currentLanguage].salesReport
                                    )
                                )}
                            </span>
                        </p>
                    </div>
                    <div className="header-actions">
                        <div className="glass-card" style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                            <i className="ri-shield-check-line" style={{ color: 'var(--accent-cyan)' }}></i>
                            <strong>{user ? user.role : ''}</strong>
                        </div>
                        <div className="glass-card" style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: '600' }}>
                            <span>{new Date().toLocaleDateString()}</span>
                        </div>
                    </div>
                </header>

                {/* TAB: DASHBOARD */}
                {['dashboard'].includes(activeTab) && <Dashboard {...props} />}

                {['warehouses', 'addWarehouse', 'stocktaking'].includes(activeTab) && <Warehouses {...props} />}
                {['transferQty'].includes(activeTab) && <InventoryTransactions {...props} />}
                {['financials', 'dailyJournal'].includes(activeTab) && <JournalEntries {...props} />}
                {activeTab === 'financialTrans' && <FinancialTransactions {...props} />}
                {activeTab === 'chartAccounts' && <ChartOfAccounts {...props} />}
                {activeTab === 'generalLedger' && <GeneralLedger {...props} />}
                {activeTab === 'trialBalance' && <TrialBalance {...props} />}
                {activeTab === 'balanceSheet' && <BalanceSheet {...props} />}
                {activeTab === 'incomeStatement' && <IncomeStatement {...props} />}
                {activeTab === 'cashFlow' && <CashFlow {...props} />}
                {['receiptVoucher', 'paymentVoucher'].includes(activeTab) && <Vouchers {...props} />}
                {['salaryPayment', 'salariesReport'].includes(activeTab) && <Salaries {...props} />}
                {['purchaseInvoice'].includes(activeTab) && <Purchases {...props} />}
                {['salesReturn', 'purchaseReturn'].includes(activeTab) && <Returns {...props} />}
                {['invoices', 'unpaidInvoices'].includes(activeTab) && <Invoices {...props} />}

                {/* TAB: POS CASHIER & B2B SALE */}
                {activeTab === 'pos' && <POS {...props} />}
                {activeTab === 'tableManagement' && <TableManagement {...props} />}
                {activeTab === 'printerSetup' && <PrinterSetup {...props} />}

                {/* TAB: B2B SALES PANEL */}
                {['b2bsale', 'salesInvoice'].includes(activeTab) && (
                    <div className="glass-card" style={{ padding: "24px", width: "100%", margin: "0 auto" }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="ri-building-line"></i> {currentLanguage === 'ar' ? 'فاتورة مبيعات B2B جديدة' : 'New B2B Sales Invoice'}
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                                    {currentLanguage === 'ar' ? 'إنشاء فاتورة ضريبية رسمية (A4) لقطاع الأعمال' : 'Create standard A4 Tax Invoice for B2B customers'}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn btn-secondary" onClick={() => setActiveTab('invoices')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <i className="ri-arrow-left-line"></i> {currentLanguage === 'ar' ? 'عودة للمبيعات' : 'Back to Sales'}
                                </button>
                                <button className="btn btn-primary glow-button" onClick={handleB2BSubmit} disabled={b2bForm.items.length === 0 || !b2bForm.items[0].productId} style={{ display: "flex", alignItems: "center", gap: "6px", height: "60px", fontSize: "1.2rem", padding: "0 30px" }}
                                >
                                    <i className="ri-check-double-line"></i> {
                                        currentLanguage === 'ar' 
                                            ? (b2bForm.saveAs === 'Invoice' ? 'إنشاء فاتورة' : b2bForm.saveAs === 'Draft' ? 'حفظ مسودة' : 'إنشاء عرض سعر') 
                                            : (b2bForm.saveAs === 'Invoice' ? 'Create Invoice' : b2bForm.saveAs === 'Draft' ? 'Save Draft' : 'Create Quotation')
                                    }
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 300px' }}>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>{currentLanguage === 'ar' ? 'العميل' : 'Customer'}</label>
                                <select className="form-control" value={b2bForm.customer} onChange={(e) => setB2bForm({ ...b2bForm, customer: e.target.value })}>
                                    <option value="">{currentLanguage === 'ar' ? 'عميل نقدي' : 'Walk-in Customer'}</option>
                                    {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: '1 1 200px' }}>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>{currentLanguage === 'ar' ? 'تاريخ الإصدار' : 'Issue Date'}</label>
                                <input type="date" className="form-control" value={b2bForm.date} onChange={(e) => setB2bForm({ ...b2bForm, date: e.target.value })} />
                            </div>
                            <div style={{ flex: '1 1 200px' }}>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>{currentLanguage === 'ar' ? 'طريقة الحفظ' : 'Save As'}</label>
                                <select className="form-control" value={b2bForm.saveAs} onChange={(e) => setB2bForm({ ...b2bForm, saveAs: e.target.value })}>
                                    <option value="Invoice">{currentLanguage === 'ar' ? 'فاتورة ضريبية معتمدة' : 'Final Invoice (A4)'}</option>
                                    <option value="Draft">{currentLanguage === 'ar' ? 'مسودة' : 'Draft'}</option>
                                    <option value="Quotation">{currentLanguage === 'ar' ? 'عرض سعر' : 'Quotation'}</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                                {currentLanguage === 'ar' ? 'مسح الباركود' : 'Scan Barcode'}
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder={currentLanguage === 'ar' ? 'امسح الباركود هنا...' : 'Scan barcode here...'}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const barcode = e.target.value.trim();
                                        if (!barcode) return;
                                        
                                        const prod = products.find(p => p.barcode === barcode || p.sku === barcode || p.id === barcode);
                                        if (prod) {
                                            const newItems = [...b2bForm.items];
                                            const existingIndex = newItems.findIndex(item => item.productId === prod.id);
                                            
                                            if (existingIndex >= 0) {
                                                newItems[existingIndex].qty += 1;
                                                newItems[existingIndex].total = newItems[existingIndex].qty * newItems[existingIndex].price;
                                            } else {
                                                let emptyIndex = newItems.findIndex(item => !item.productId);
                                                if (emptyIndex === -1) {
                                                    emptyIndex = newItems.length;
                                                    newItems.push({ id: Date.now().toString(), productId: '', name: '', qty: 1, price: 0, vatRate: 15, total: 0 });
                                                }
                                                newItems[emptyIndex].productId = prod.id;
                                                newItems[emptyIndex].name = currentLanguage === 'ar' ? prod.nameAR : prod.nameEN;
                                                newItems[emptyIndex].price = prod.price;
                                                newItems[emptyIndex].qty = 1;
                                                newItems[emptyIndex].total = prod.price;
                                            }
                                            
                                            setB2bForm({ ...b2bForm, items: newItems });
                                            e.target.value = '';
                                        } else {
                                            alert(currentLanguage === 'ar' ? 'المنتج غير موجود' : 'Product not found');
                                            e.target.value = '';
                                        }
                                    }
                                }}
                            />
                        </div>

                        <div className="table-container" style={{ marginBottom: '24px', border: '1px solid var(--glass-border)', borderRadius: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                            <table>
                                <thead>
                                    <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                                        <th style={{ width: '40%' }}>{currentLanguage === 'ar' ? 'المنتج / الخدمة' : 'Product / Service'}</th>
                                        <th style={{ width: '15%' }}>{currentLanguage === 'ar' ? 'الكمية' : 'Quantity'}</th>
                                        <th style={{ width: '20%' }}>{currentLanguage === 'ar' ? 'السعر (بدون ضريبة)' : 'Unit Price (Ex. VAT)'}</th>
                                        <th style={{ width: '15%' }}>{currentLanguage === 'ar' ? 'الإجمالي (بدون ضريبة)' : 'Line Total'}</th>
                                        <th style={{ width: '10%' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {b2bForm.items.map((item, index) => (
                                        <tr key={item.id}>
                                            <td>
                                                <select className="form-control" value={item.productId} onChange={(e) => handleB2BItemChange(index, 'productId', e.target.value)} style={{ background: 'rgba(0,0,0,0.4)', border: 'none' }}>
                                                    <option value="">{currentLanguage === 'ar' ? 'اختر المنتج...' : 'Select Product...'}</option>
                                                    {b2bProductOptions}
                                                </select>
                                            </td>
                                            <td>
                                                <input type="number" min="1" className="form-control" value={item.qty} onChange={(e) => handleB2BItemChange(index, 'qty', e.target.value)} style={{ background: 'rgba(0,0,0,0.4)', border: 'none', textAlign: 'center' }} />
                                            </td>
                                            <td>
                                                <input type="number" min="0" step="0.01" className="form-control" value={item.price} onChange={(e) => handleB2BItemChange(index, 'price', e.target.value)} style={{ background: 'rgba(0,0,0,0.4)', border: 'none' }} />
                                            </td>
                                            <td style={{ fontWeight: 'bold' }}>
                                                {formatCurrency(item.qty * item.price)}
                                            </td>
                                            <td>
                                                <button className="btn btn-danger" onClick={() => handleB2BRemoveItem(index)} style={{ padding: '6px' }} disabled={b2bForm.items.length === 1}>
                                                    <i className="ri-delete-bin-line"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ padding: '12px' }}>
                                <button className="btn btn-secondary" onClick={handleB2BAddItem} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                                    <i className="ri-add-line"></i> {currentLanguage === 'ar' ? 'إضافة سطر' : 'Add Item'}
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 300px' }}>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>{currentLanguage === 'ar' ? 'ملاحظات إضافية' : 'Additional Notes / Terms'}</label>
                                <textarea className="form-control" rows="4" value={b2bForm.notes} onChange={(e) => setB2bForm({ ...b2bForm, notes: e.target.value })} placeholder={currentLanguage === 'ar' ? 'اكتب شروط الدفع أو أي تفاصيل أخرى هنا...' : 'Enter payment terms or additional info...'}></textarea>
                            </div>
                            <div style={{ flex: '1 1 50%' }}>
                                <div className="glass-card" style={{ padding: '20px', background: 'rgba(0,0,0,0.2)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                                        <span>{currentLanguage === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}:</span>
                                        <span>{formatCurrency(b2bForm.items.filter(i => i.productId).reduce((acc, i) => acc + (i.price * i.qty), 0))}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                                        <span>{currentLanguage === 'ar' ? 'ضريبة القيمة المضافة (15%)' : 'VAT (15%)'}:</span>
                                        <span>{formatCurrency(b2bForm.items.filter(i => i.productId).reduce((acc, i) => acc + (i.price * i.qty * 0.15), 0))}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)', fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-success)' }}>
                                        <span>{currentLanguage === 'ar' ? 'الإجمالي' : 'Total'}:</span>
                                        <span>{formatCurrency(b2bForm.items.filter(i => i.productId).reduce((acc, i) => acc + (i.price * i.qty * 1.15), 0))}</span>
                                    </div>
                                    <button 
                                        className="btn btn-primary glow-button" 
                                        style={{ width: '100%', marginTop: '20px', padding: '14px', fontSize: '15px' }} 
                                        onClick={handleB2BSubmit}
                                        disabled={b2bForm.items.length === 0 || !b2bForm.items[0].productId}
                                    >
                                        <i className="ri-check-double-line"></i> {
                                            currentLanguage === 'ar' 
                                                ? (b2bForm.saveAs === 'Invoice' ? 'إنشاء فاتورة' : b2bForm.saveAs === 'Draft' ? 'حفظ مسودة' : 'إنشاء عرض سعر') 
                                                : (b2bForm.saveAs === 'Invoice' ? 'Create Invoice' : b2bForm.saveAs === 'Draft' ? 'Save Draft' : 'Create Quotation')
                                        }
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: INVENTORY */}
                {['inventory', 'units', 'categories', 'items', 'itemsReorder'].includes(activeTab) && <Inventory {...props} />}

                {/* TAB: MAINTENANCE */}
                {['maintenance'].includes(activeTab) && <Maintenance {...props} />}

                {/* TAB: PROPERTY & HOSPITALITY MANAGEMENT (QloApps Replication) */}
                {['property_properties'].includes(activeTab) && <Properties {...props} />}
                {['property_units'].includes(activeTab) && <Units {...props} />}
                {['property_bookings', 'property_invoices'].includes(activeTab) && <Bookings {...props} defaultTab={activeTab === 'property_invoices' ? 'invoices' : 'frontDesk'} />}
                {['property_groupblocks'].includes(activeTab) && <GroupBlocks {...props} />}
                {['property_services'].includes(activeTab) && <ExtraServices {...props} />}
                {['property_pricerules'].includes(activeTab) && <PriceRules {...props} />}
                {['property_housekeeping'].includes(activeTab) && <Housekeeping {...props} />}
                {['property_leasing'].includes(activeTab) && <LeasingContracts {...props} />}
                {['property_crm'].includes(activeTab) && <RealEstateCRM {...props} />}
                {['property_owners'].includes(activeTab) && <PropertyOwners {...props} />}
                {['property_owner_accounting'].includes(activeTab) && <OwnerAccounting {...props} />}

                {/* TAB: FRESH FLOWERS */}
                {['flowers_dashboard'].includes(activeTab) && <FreshFlowersDashboard {...props} />}
                {['flowers_arrangements'].includes(activeTab) && <FlowersArrangements {...props} />}
                {['flowers_deliveries'].includes(activeTab) && <FlowersDeliveries {...props} />}

                {/* TAB: BESPOKE TAILORING & WORKSHOP */}
                {['tailoring_dashboard', 'tailoring'].includes(activeTab) && <TailoringDashboard {...props} />}
                {['tailoring_measurements'].includes(activeTab) && <MeasurementProfiles {...props} />}
                {['tailoring_orders'].includes(activeTab) && <TailoringOrders {...props} />}
                {['tailoring_workshop'].includes(activeTab) && <WorkshopKanban {...props} />}

                {/* TAB: CAPITAL ASSETS DEPRECIATION */}
                {activeTab === 'assets' && (
                    <div className="glass-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 data-i18n="assets">{translations[currentLanguage].assets}</h3>
                            <button className="btn btn-primary" onClick={() => setShowAssetModal(true)}>{translations[currentLanguage].addAsset}</button>
                        </div>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>{translations[currentLanguage].assetId}</th>
                                        <th>{translations[currentLanguage].assetName}</th>
                                        <th>{translations[currentLanguage].assetCost}</th>
                                        <th>{translations[currentLanguage].annualDepreciation}</th>
                                        <th>{translations[currentLanguage].bookValue}</th>
                                        <th>{translations[currentLanguage].assignedTo}</th>
                                        <th>{translations[currentLanguage].assetStatus}</th>
                                        <th>{translations[currentLanguage].actions}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assets.map(a => {
                                        const { annualDep, currentBookValue } = calculateAssetValues(a);
                                        const custodian = employees.find(e => e.id === a.assignedTo)?.name || translations[currentLanguage].unassigned;
                                        return (
                                            <tr key={a.id}>
                                                <td>{a.id}</td>
                                                <td>{a.name}</td>
                                                <td>{formatCurrency(a.cost)}</td>
                                                <td>{formatCurrency(annualDep)}</td>
                                                <td>{formatCurrency(currentBookValue)}</td>
                                                <td>{custodian}</td>
                                                <td><span className={`badge ${a.status === 'active' ? 'green' : 'gold'}`}>{translations[currentLanguage][a.status] || a.status}</span></td>
                                                <td>
                                                    <button className="btn btn-secondary" onClick={() => { setActiveAssetForQr(a); setShowAssetQrModal(true); }}>
                                                        <i className="ri-qr-code-line"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB: CUSTOMERS */}
                {['customers', 'customersManagement', 'customerStatement'].includes(activeTab) && <Customers {...props} />}

                {/* TAB: SUPPLIERS */}
                {['suppliers', 'suppliersManagement', 'supplierStatement'].includes(activeTab) && <Suppliers {...props} />}
                {['employees', 'employeesManagement'].includes(activeTab) && <Employees {...props} />}
                {/* TAB: EXPENSES */}
                {activeTab === 'expenses' && (
                    <div className="glass-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 data-i18n="expenses">{translations[currentLanguage].expenses}</h3>
                            <button className="btn btn-primary" onClick={() => { setExpForm({ category: 'rent', amount: '', description: '', date: '' }); setShowExpenseModal(true); }}>
                                {translations[currentLanguage].addExpense}
                            </button>
                        </div>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>{translations[currentLanguage].expenseCat}</th>
                                        <th>{translations[currentLanguage].expenseDesc}</th>
                                        <th>{translations[currentLanguage].expenseDate}</th>
                                        <th>{translations[currentLanguage].expenseAmount}</th>
                                        <th>{translations[currentLanguage].actions}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                {currentLanguage === 'ar' ? 'لا توجد مصروفات مسجلة' : 'No expenses recorded'}
                                            </td>
                                        </tr>
                                    ) : (
                                        expenses.map(exp => (
                                            <tr key={exp.id}>
                                                <td><span className="badge purple">{translations[currentLanguage][exp.category] || exp.category}</span></td>
                                                <td>{exp.description}</td>
                                                <td>{exp.date}</td>
                                                <td>{formatCurrency(exp.amount)}</td>
                                                <td>
                                                    <div className="actions-dropdown">
        <button className="actions-dropdown-btn">
            <i className="ri-settings-4-line"></i> {translations[currentLanguage].actions} <i className="ri-arrow-down-s-line"></i>
        </button>
        <div className="actions-dropdown-content">
            <button onClick={() => { setExpForm(exp); setShowExpenseModal(true); }}>
                <i className="ri-edit-line"></i> {currentLanguage === 'ar' ? 'تعديل' : 'Edit'}
            </button>
            <button className="danger" onClick={() => handleDeleteExpense(exp.id)}>
                <i className="ri-delete-bin-line"></i> {currentLanguage === 'ar' ? 'حذف' : 'Delete'}
            </button>
        </div>
    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB: ORDERS */}
                {activeTab === 'orders' && (
                    <div className="glass-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 data-i18n="orders">{translations[currentLanguage].orders}</h3>
                            <button className="btn btn-primary" onClick={() => { setOrderForm({ customer: '', items: '', total: '', status: 'Pending', date: new Date().toLocaleString() }); setShowOrderModal(true); }}>
                                {currentLanguage === 'ar' ? 'إضافة طلب جديد' : 'Record New Order'}
                            </button>
                        </div>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>{translations[currentLanguage].orderNum}</th>
                                        <th>{translations[currentLanguage].invoiceCustomer}</th>
                                        <th>{translations[currentLanguage].orderItems}</th>
                                        <th>{translations[currentLanguage].invoiceTotal}</th>
                                        <th>{translations[currentLanguage].orderStatus}</th>
                                        <th>{translations[currentLanguage].actions}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                {currentLanguage === 'ar' ? 'لا توجد طلبات جارية' : 'No active orders'}
                                            </td>
                                        </tr>
                                    ) : (
                                        orders.map(ord => (
                                            <tr key={ord.id}>
                                                <td>{ord.id}</td>
                                                <td>{ord.customer}</td>
                                                <td>{ord.items}</td>
                                                <td>{formatCurrency(Number(ord.total) || ord.total)}</td>
                                                <td>
                                                    <span className={`badge ${ord.status === 'Completed' || ord.status === 'Delivered' ? 'green' : ord.status === 'Pending' ? 'danger' : 'gold'}`}>
                                                        {translations[currentLanguage][`status${ord.status}`] || ord.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select className="form-control" style={{ padding: '4px 8px', fontSize: '12px' }} value={ord.status} onChange={e => {
                                                            const updatedStatus = e.target.value;
                                                            fetch(`/api/orders/${ord.id}`, {
                                                                method: 'PUT',
                                                                headers: headers,
                                                                body: JSON.stringify({ status: updatedStatus })
                                                            })
                                                            .then(res => res.json())
                                                            .then(data => {
                                                                setOrders(orders.map(o => o.id === ord.id ? { ...o, status: updatedStatus } : o));
                                                            })
                                                            .catch(() => {
                                                                setOrders(orders.map(o => o.id === ord.id ? { ...o, status: updatedStatus } : o));
                                                            });
                                                        }}>
                                                            <option value="Pending">{translations[currentLanguage].statusPending}</option>
                                                            <option value="Preparing">{translations[currentLanguage].statusPreparing}</option>
                                                            <option value="Ready">{translations[currentLanguage].statusReady}</option>
                                                            <option value="Delivered">{translations[currentLanguage].statusDelivered}</option>
                                                        </select>
            <div className="actions-dropdown">
                <button className="actions-dropdown-btn">
                    <i className="ri-settings-4-line"></i> {translations[currentLanguage].actions} <i className="ri-arrow-down-s-line"></i>
                </button>
                <div className="actions-dropdown-content">
                    <button onClick={() => { setOrderForm(ord); setShowOrderModal(true); }}>
                        <i className="ri-edit-line"></i> {currentLanguage === 'ar' ? 'تعديل' : 'Edit'}
                    </button>
                    <button className="danger" onClick={() => handleDeleteOrder(ord.id)}>
                        <i className="ri-delete-bin-line"></i> {currentLanguage === 'ar' ? 'حذف' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB: USER MANAGEMENT (PERMISSIONS) */}
                {/* TAB: USER MANAGEMENT (PERMISSIONS) */}
                {['permissions', 'userPermissions'].includes(activeTab) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
                        {/* Users Accounts Control Card */}
                        <div className="glass-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div>
                                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-purple)' }}>{currentLanguage === 'ar' ? 'إدارة حسابات المستخدمين' : 'System Users Accounts'}</h3>
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{currentLanguage === 'ar' ? 'إنشاء وتعديل بيانات وحسابات الدخول لموظفي النظام' : 'Manage system login accounts and assign access roles'}</p>
                                </div>
                                {user && user.role === 'Admin' && (
                                    <button className="btn btn-primary" onClick={() => { setUserForm({ username: '', password: '', role: 'Cashier' }); setShowUserModal(true); }}>
                                        <i className="ri-user-add-line"></i> {currentLanguage === 'ar' ? 'إضافة مستخدم جديد' : 'Add New User'}
                                    </button>
                                )}
                            </div>
                            
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{currentLanguage === 'ar' ? 'اسم المستخدم' : 'User Name'}</th>
                                            <th>{currentLanguage === 'ar' ? 'دور الصلاحية' : 'System Role'}</th>
                                            <th>{translations[currentLanguage].actions}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {usersList.map(u => (
                                            <tr key={u.id}>
                                                <td><strong>{u.username}</strong></td>
                                                <td>
                                                    <span className={`badge ${u.role === 'Admin' ? 'purple' : u.role === 'Manager' ? 'cyan' : 'gold'}`}>
                                                        {u.role === 'Admin' ? translations[currentLanguage].roleAdmin : u.role === 'Manager' ? translations[currentLanguage].roleManager : translations[currentLanguage].roleCashier}
                                                    </span>
                                                    {u.isActive === false && (
                                                        <span className="badge" style={{ background: '#f87171', color: '#fff', marginLeft: '8px' }}>
                                                            {currentLanguage === 'ar' ? 'معطل' : 'Inactive'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    {user && user.role === 'Admin' && (
                                                        <div className="actions-dropdown">
        <button className="actions-dropdown-btn">
            <i className="ri-settings-4-line"></i> {translations[currentLanguage].actions} <i className="ri-arrow-down-s-line"></i>
        </button>
        <div className="actions-dropdown-content">
            <button onClick={() => { setUserForm({ ...u, password: '' }); setShowUserModal(true); }}>
                <i className="ri-edit-line"></i> {currentLanguage === 'ar' ? 'تعديل' : 'Edit'}
            </button>
            <button className="danger" onClick={() => handleDeleteUser(u.id)} disabled={u.id === user.id}>
                <i className="ri-delete-bin-line"></i> {currentLanguage === 'ar' ? 'حذف' : 'Delete'}
            </button>
        </div>
    </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Visual Roles & Permissions Feature Matrix Table */}
                        <div className="glass-card">
                            <h3 style={{ marginBottom: '10px', fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
                                <i className="ri-shield-keyhole-line"></i> {currentLanguage === 'ar' ? 'جدول توزيع الصلاحيات المتاحة' : 'Feature Access Permissions Matrix'}
                            </h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                                {currentLanguage === 'ar' ? 'عرض توضيحي للمميزات والصفحات المسموح بالوصول إليها لكل دور وظيفي' : 'Visual breakdown of accessible workspace features by user roles'}
                            </p>
                            
                            <div className="table-container">
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                                            <th style={{ padding: '12px', textAlign: 'left' }}>{currentLanguage === 'ar' ? 'ميزة النظام' : 'Workspace Feature'}</th>
                                            <th style={{ padding: '12px', textAlign: 'center' }}>{currentLanguage === 'ar' ? 'مدير النظام' : 'Administrator'}</th>
                                            <th style={{ padding: '12px', textAlign: 'center' }}>{currentLanguage === 'ar' ? 'مدير التشغيل' : 'Manager'}</th>
                                            <th style={{ padding: '12px', textAlign: 'center' }}>{currentLanguage === 'ar' ? 'صراف كاشير' : 'Cashier'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { en: 'POS & Cashier Interface', ar: 'شاشة كاشير المبيعات الفرعية', admin: true, manager: true, cashier: true },
                                            { en: 'Quotation Management', ar: 'عروض الأسعار والتسعيرات', admin: true, manager: true, cashier: true },
                                            { en: 'Invoices Tracking & Reprint', ar: 'إدارة واستعراض وطباعة الفواتير', admin: true, manager: true, cashier: true },
                                            { en: 'Stock & Inventory Control', ar: 'إدارة المنتجات والمخزون', admin: true, manager: true, cashier: false },
                                            { en: 'Expenses Recording', ar: 'تسجيل وإدارة المصروفات المباشرة', admin: true, manager: true, cashier: false },
                                            { en: 'Customers CRM Database', ar: 'إدارة وسجلات العملاء', admin: true, manager: true, cashier: false },
                                            { en: 'Suppliers CRM Directory', ar: 'إدارة وسجلات الموردين', admin: true, manager: true, cashier: false },
                                            { en: 'Asset Capital Depreciation', ar: 'إدارة الأصول الرأسمالية وإهلاكها', admin: true, manager: true, cashier: false },
                                            { en: 'Tax return reporting', ar: 'تقارير الإقرار الضريبي وضريبة القيمة المضافة', admin: true, manager: true, cashier: false },
                                            { en: 'ZATCA Compliance Integration settings', ar: 'بوابة وإعدادات الربط بهيئة الزكاة', admin: true, manager: false, cashier: false },
                                            { en: 'General System Configurations', ar: 'إعدادات النظام العامة والشعار والاسم', admin: true, manager: false, cashier: false },
                                            { en: 'Users Management & Permissions Matrix', ar: 'إدارة الصلاحيات والمستخدمين الآخرين', admin: true, manager: false, cashier: false },
                                        ].map((feat, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                                <td style={{ padding: '12px' }}>
                                                    <strong>{currentLanguage === 'ar' ? feat.ar : feat.en}</strong>
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    <i className="ri-checkbox-circle-fill" style={{ color: 'var(--accent-success)', fontSize: '20px' }}></i>
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    {feat.manager ? (
                                                        <i className="ri-checkbox-circle-fill" style={{ color: 'var(--accent-success)', fontSize: '20px' }}></i>
                                                    ) : (
                                                        <i className="ri-close-circle-fill" style={{ color: 'var(--accent-danger)', fontSize: '20px' }}></i>
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    {feat.cashier ? (
                                                        <i className="ri-checkbox-circle-fill" style={{ color: 'var(--accent-success)', fontSize: '20px' }}></i>
                                                    ) : (
                                                        <i className="ri-close-circle-fill" style={{ color: 'var(--accent-danger)', fontSize: '20px' }}></i>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                
                
                {/* TAB: QUOTATIONS */}
                {['quotations', 'quotation'].includes(activeTab) && (
                    <div className="glass-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 data-i18n="quotations">{translations[currentLanguage].quotations}</h3>

                        </div>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>{translations[currentLanguage].quotationNum}</th>
                                        <th>{translations[currentLanguage].quotationDate}</th>
                                        <th>{translations[currentLanguage].invoiceCustomer}</th>
                                        <th>{translations[currentLanguage].quotationTotal}</th>
                                        <th>{translations[currentLanguage].actions}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {quotations.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                {currentLanguage === 'ar' ? 'لا توجد عروض أسعار مسجلة' : 'No quotations recorded'}
                                            </td>
                                        </tr>
                                    ) : (
                                        quotations.map(q => (
                                            <tr key={q.id}>
                                                <td>{q.id}</td>
                                                <td>{q.date}</td>
                                                <td>{q.customer}</td>
                                                <td>{formatCurrency(q.total)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button className="btn btn-secondary" onClick={() => { setActiveQuotation(q); setShowQuotationModal(true); }}>
                                                            <i className="ri-printer-line"></i>
                                                        </button>
                                                        <button className="btn btn-secondary" onClick={() => { 
                                                            const itemsText = (q.items || []).map(item => `${item.name} x${item.qty}`).join(', ');
                                                            setQuotationForm({ id: q.id, customer: q.customer, itemsText: itemsText, total: (q.total - (q.vat || 0)).toFixed(2) }); 
                                                            setShowQuotationCrudModal(true); 
                                                        }}>
                                                            <i className="ri-edit-line"></i>
                                                        </button>
                                                        <button className="btn btn-danger" onClick={() => handleDeleteQuotation(q.id)}>
                                                            <i className="ri-delete-bin-line"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB: REPORTS */}
                {['reports', 'dailyReport', 'salesMovement', 'purchasesMovement', 'maintenanceReport', 'itemsMovement', 'financialMovement', 'salesAnalysis', 'accountsDebts', 'profitAnalysis', 'summaryReport', 'taxReport'].includes(activeTab) && <Reports {...props} />}
{activeTab === 'moduleSwitch' && <ModuleSwitcher {...props} />}

                {/* TAB: ZATCA INTEGRATION AND CLEARANCE */}
                {['zatca', 'zatcaIntegration'].includes(activeTab) && (
                    <div className="glass-card">
                        <h3 style={{ marginBottom: '15px' }}>{translations[currentLanguage].zatcaPortal}</h3>
                        <div className="card-grid" style={{ marginBottom: '24px' }}>
                            {/* Shows the real ZATCA mode (it used to always say "Compliant & Active") */}
                            <div className={`glass-card ${zatcaConnected ? 'green' : ''}`}>
                                <div className="card-stat">
                                    <div className="stat-info">
                                        <h3>{currentLanguage === 'ar' ? 'وضع الربط مع هيئة الزكاة' : 'ZATCA mode'}</h3>
                                        <div style={{ color: zatcaConnected ? 'var(--accent-success)' : 'var(--text-secondary)', fontWeight: 'bold' }}>
                                            {zatcaConnected
                                                ? (currentLanguage === 'ar' ? `متصل (${zatcaConn.env || 'sandbox'})` : `Connected (${zatcaConn.env || 'sandbox'})`)
                                                : (currentLanguage === 'ar' ? 'غير متصل: لا تُرسل الفواتير إلى الهيئة' : 'Not connected: invoices are not reported')}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                            {currentLanguage === 'ar' ? 'غيّر الوضع من الإعدادات العامة ← إعدادات هيئة الزكاة' : 'Change it in General Settings → ZATCA Connection Settings'}
                                        </div>
                                    </div>
                                    <div className="stat-icon"><i className={zatcaConnected ? 'ri-checkbox-circle-line' : 'ri-cloud-off-line'}></i></div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div className="glass-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '15px' }}>Submit & Verify XML Schema</h4>
                                <div className="form-group">
                                    <label>{currentLanguage === 'ar' ? 'اختر الفاتورة للربط' : 'Select Invoice'}</label>
                                    <select className="form-control" value={zatcaSelectInvoice} onChange={e => setZatcaSelectInvoice(e.target.value)}>
                                        <option value="">Choose...</option>
                                        {invoices.map(i => <option key={i.id} value={i.id}>{i.id} - {i.customer} ({formatCurrency(i.total)}) [{i.zatcaStatus}]</option>)}
                                    </select>
                                </div>
                                <button className="btn btn-primary" onClick={triggerZatcaPortalClearance} disabled={!zatcaConnected || isReportingZatca || !zatcaSelectInvoice} style={{ width: '100%' }}>
                                    <i className="ri-cloud-upload-line" style={{ marginRight: '8px' }}></i>{currentLanguage === 'ar' ? 'إرسال إلى هيئة الزكاة' : `Submit to ZATCA (${zatcaConn.env || 'sandbox'})`}
                                </button>
                            </div>

                            <div className="glass-card" style={{ background: '#000', color: '#4ade80', fontFamily: 'monospace', height: '240px', overflowY: 'auto' }}>
                                <h4>ZATCA Clear Response Logs</h4>
                                <div style={{ marginTop: '10px', fontSize: '12px' }}>
                                    {zatcaConsole.map((log, idx) => (
                                        <div key={idx} style={{ marginBottom: '4px' }}>
                                            <span style={{ fontWeight: 'bold' }}>[{log.type}]</span> {log.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: SETTINGS & CURRENCY CONFIG */}
                {['settings', 'generalSettings'].includes(activeTab) && <Settings {...props} />}
                    {activeTab === 'programActivation' && (
                        <div className="glass-card" style={{textAlign: 'center', padding: '50px'}}>
                            <h2>{currentLanguage === 'ar' ? 'تفعيل البرنامج' : 'Program Activation'}</h2>
                            <p style={{color: 'var(--text-secondary)', marginTop: '10px'}}>
                                {currentLanguage === 'ar' ? 'يتم تفعيل البرنامج من خلال منصة ساس.' : 'Program activation is managed via the SaaS platform.'}
                            </p>
                        </div>
                    )}
                    {activeTab === 'techSupport' && (
                        <div className="glass-card" style={{textAlign: 'center', padding: '50px'}}>
                            <h2>{currentLanguage === 'ar' ? 'الدعم الفني' : 'Technical Support'}</h2>
                            <p>
                                {currentLanguage === 'ar' ? 'للتواصل مع الدعم الفني، يرجى إرسال بريد إلكتروني إلى support@26i.uk' : 'To contact technical support, please email support@26i.uk'}
                            </p>
                        </div>
                    )}
                    {activeTab === 'storefrontSettings' && <StorefrontSettings {...props} />}
                    {activeTab === 'digitalAssets' && <DigitalAssets {...props} />}

                {/* Version Footer */}
                {activeTab !== 'pos' && (
                    <footer style={{ marginTop: 'auto', padding: '15px 0', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span>CASHIER v1.2.0 - Scaleable Full Stack Integration</span>
                        <span>Saudi Arabia | 2026</span>
                    </footer>
                )}
            </main>

            {/* MODAL: INVOICE PRINT AND VERIFY */}
            {showInvoiceModal && activeInvoice && (
                <div className="modal-overlay">
                    <div className="modal">
                        {/* Modal Header: format indicator / toggle */}
                        {/* Print Layout Area */}
                        {(() => {
                            const activeVat = activeInvoice.vat !== undefined && activeInvoice.vat !== null ? activeInvoice.vat : (activeInvoice.total - (activeInvoice.total / 1.15));
                            const activeSubtotal = activeInvoice.total - activeVat;
                            // Invoice-level discount (coupon): shown before VAT and spread over the lines
                            const docDiscount = Number(activeInvoice.discount) || 0;
                            const docGross = (activeInvoice.items || []).reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0);
                            const activeGross = activeSubtotal + docDiscount;
                            return (
                                <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '20px' }}>
                                <div id="invoicePrintArea" className={invoiceFormat === 'a4' ? 'invoice-a4-layout' : 'invoice-thermal-layout'} style={{ direction: 'ltr', background: 'white', color: 'black' }}>
                                    {invoiceFormat === 'a4' ? (
                                        <div style={{ padding: '16px 24px', color: '#333', background: 'white', fontFamily: 'Cairo, sans-serif' }}>
                                            {/* Standard A4 Header Grid: L: English Details, C: Logo, R: Arabic Details */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 100px 1.2fr', gap: '10px', alignItems: 'start', borderBottom: '2px solid #8b5cf6', paddingBottom: '8px', pageBreakInside: 'avoid' }}>
                                                {/* Left Side: English Info (LTR) */}
                                                <div style={{ textAlign: 'left', fontSize: '10px', direction: 'ltr', lineHeight: '1.3' }}>
                                                    <h2 style={{ fontSize: '15px', margin: '0 0 3px 0', color: '#8b5cf6', fontWeight: 'bold' }}>{settings.businessName}</h2>
                                                    <p style={{ margin: '1px 0', color: '#555' }}><strong>Address:</strong> {formatAddress(settings.businessAddress)}</p>
                                                    <p style={{ margin: '1px 0', color: '#555' }}><strong>VAT No:</strong> {settings.vatNumber}</p>
                                                    <p style={{ margin: '1px 0', color: '#555' }}><strong>CR No:</strong> {settings.crNumber}</p>
                                                    <p style={{ margin: '1px 0', color: '#555' }}><strong>Contact:</strong> {settings.contactNumber}</p>
                                                </div>

                                                {/* Center Side: Logo */}
                                                <div style={{ textAlign: 'center' }}>
                                                    <img src={settings.logo || "/logo.png"} alt="Company Logo" style={{ maxHeight: '90px', maxWidth: '160px', objectFit: 'contain' }} />
                                                </div>

                                                {/* Right Side: Arabic Details (RTL) */}
                                                <div style={{ textAlign: 'right', fontSize: '10px', direction: 'rtl', lineHeight: '1.3' }}>
                                                    <h2 style={{ fontSize: '15px', margin: '0 0 3px 0', color: '#8b5cf6', fontWeight: 'bold' }}>{settings.businessName}</h2>
                                                    <p style={{ margin: '1px 0', color: '#333' }}><strong>العنوان:</strong> {formatAddress(settings.nationalAddress || settings.businessAddress)}</p>
                                                    <p style={{ margin: '1px 0', color: '#333' }}><strong>الرقم الضريبي (VAT):</strong> {settings.vatNumber}</p>
                                                    <p style={{ margin: '1px 0', color: '#333' }}><strong>سجل تجاري (CR):</strong> {settings.crNumber}</p>
                                                    <p style={{ margin: '1px 0', color: '#333' }}><strong>رقم التواصل:</strong> {settings.contactNumber}</p>
                                                </div>
                                            </div>

                                            {/* Invoice Metadata Row (Second Line) */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '6px 12px', marginTop: '10px', background: '#f8fafc', fontSize: '10px', pageBreakInside: 'avoid' }}>
                                                <div style={{ textAlign: 'left', direction: 'ltr', lineHeight: '1.4' }}>
                                                    <p style={{ margin: '1px 0', fontSize: '12px', fontWeight: 'bold', color: '#8b5cf6' }}>Simplified Tax Invoice / فاتورة ضريبية مبسطة</p>
                                                    <p style={{ margin: '1px 0', color: '#555' }}><strong>Invoice ID:</strong> {activeInvoice.id}</p>
                                                    <p style={{ margin: '1px 0', color: '#555' }}><strong>Date:</strong> {activeInvoice.date}</p>
                                                </div>
                                                <div style={{ textAlign: 'right', direction: 'rtl', lineHeight: '1.4' }}>
                                                    <p style={{ margin: '1px 0', color: '#333' }}><strong>العميل / Billed To:</strong> {activeInvoice.customer}</p>
                                                    <p style={{ margin: '1px 0', color: '#333' }}><strong>طريقة الدفع / Payment Method:</strong> {getPaymentMethodLabel(activeInvoice.paymentMethod)}</p>
                                                </div>
                                            </div>

                                            {/* Line Items Table compliant with Saudi Tax Authority standard */}
                                            <h3 style={{ marginTop: '12px', borderBottom: '2px solid #8b5cf6', paddingBottom: '3px', fontSize: '13px', fontWeight: 'bold', direction: currentLanguage === 'ar' ? 'rtl' : 'ltr', textAlign: currentLanguage === 'ar' ? 'right' : 'left' }}>
                                                {currentLanguage === 'ar' ? 'تفاصيل السلع والخدمات / Line Items' : 'Line Items / تفاصيل السلع والخدمات'}
                                            </h3>
                                            <table className="zatca-invoice-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px', fontSize: '10px', direction: currentLanguage === 'ar' ? 'rtl' : 'ltr' }}>
                                                <thead>
                                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                                                        <th style={{ padding: '4px 6px', textAlign: currentLanguage === 'ar' ? 'right' : 'left', fontWeight: '600' }}>Nature of goods or services<br/><span style={{ color: '#666', fontWeight: 'normal', fontSize: '9px' }}>تفاصيل السلع والخدمات</span></th>
                                                        <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '600' }}>Unit price<br/><span style={{ color: '#666', fontWeight: 'normal', fontSize: '9px' }}>سعر الوحدة</span></th>
                                                        <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: '600' }}>Quantity<br/><span style={{ color: '#666', fontWeight: 'normal', fontSize: '9px' }}>الكمية</span></th>
                                                        <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '600' }}>Discount<br/><span style={{ color: '#666', fontWeight: 'normal', fontSize: '9px' }}>خصومات</span></th>
                                                        <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '600' }}>Taxable Amount<br/><span style={{ color: '#666', fontWeight: 'normal', fontSize: '9px' }}>المبلغ الخاضع للضريبة</span></th>
                                                        <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: '600' }}>Tax Rate<br/><span style={{ color: '#666', fontWeight: 'normal', fontSize: '9px' }}>نسبة الضريبة</span></th>
                                                        <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '600' }}>Tax Amount<br/><span style={{ color: '#666', fontWeight: 'normal', fontSize: '9px' }}>مبلغ الضريبة</span></th>
                                                        <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '600' }}>Item Subtotal<br/><span style={{ color: '#666', fontWeight: 'normal', fontSize: '9px' }}>الاجمالي شامل الضريبة</span></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(activeInvoice.items || []).map((item, idx) => {
                                                        const itemQty = item.qty || 1;
                                                        const itemPrice = item.price || 0;
                                                        const rawSubtotal = itemPrice * itemQty;
                                                        const itemDiscount = docGross > 0 ? (docDiscount * rawSubtotal / docGross) : 0;
                                                        const itemTaxableAmount = rawSubtotal - itemDiscount;
                                                        const itemTaxRate = settings.taxRate || 15;
                                                        const itemTaxAmount = itemTaxableAmount * (itemTaxRate / 100);
                                                        const itemSubtotal = itemTaxableAmount + itemTaxAmount;
                                                        return (
                                                            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', pageBreakInside: 'avoid' }}>
                                                                <td style={{ padding: '4px 6px', textAlign: currentLanguage === 'ar' ? 'right' : 'left' }}>{item.name}</td>
                                                                <td style={{ padding: '4px 6px', textAlign: 'right' }}>{formatCurrency(itemPrice)}</td>
                                                                <td style={{ padding: '4px 6px', textAlign: 'center' }}>{itemQty}</td>
                                                                <td style={{ padding: '4px 6px', textAlign: 'right' }}>{formatCurrency(itemDiscount)}</td>
                                                                <td style={{ padding: '4px 6px', textAlign: 'right' }}>{formatCurrency(itemTaxableAmount)}</td>
                                                                <td style={{ padding: '4px 6px', textAlign: 'center' }}>{itemTaxRate}%</td>
                                                                <td style={{ padding: '4px 6px', textAlign: 'right' }}>{formatCurrency(itemTaxAmount)}</td>
                                                                <td style={{ padding: '4px 6px', textAlign: 'right' }}>{formatCurrency(itemSubtotal)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>

                                            {/* Financial Summary Totals and Side-by-Side QR Code */}
                                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: currentLanguage === 'ar' ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px', pageBreakInside: 'avoid' }}>
                                                {/* Left Side: ZATCA Compliant QR Code and Share Button */}
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', width: '160px', textAlign: 'center', flexShrink: 0 }}>
                                                    <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent((activeInvoice.qrCode || generateZatcaQR(settings.businessName, settings.vatNumber, activeInvoice.date, activeInvoice.total, activeVat, activeInvoice.xmlHashBase64 || activeInvoice.xmlHash, activeInvoice.signature, activeInvoice.publicKey, activeInvoice.certSignature)))}`} alt="ZATCA QR" style={{ width: '100px', height: '100px', display: 'block' }} />
                                                    </div>
                                                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#333' }}>فاتورة ضريبية مبسطة رقمية</span>
                                                    <span style={{ fontSize: '8px', color: '#666' }}>ZATCA Compliant E-Invoice QR Code</span>
                                                    
                                                    {/* Share Button (hidden on print) */}
                                                    <button 
                                                        className="btn btn-secondary no-print" 
                                                        style={{ 
                                                            marginTop: '6px', 
                                                            width: '100%', 
                                                            fontSize: '11px', 
                                                            padding: '6px 10px', 
                                                            background: '#8b5cf6', 
                                                            color: 'white', 
                                                            border: 'none', 
                                                            borderRadius: '5px', 
                                                            cursor: 'pointer', 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            justifyContent: 'center', 
                                                            gap: '6px' 
                                                        }}
                                                        onClick={() => {
                                                            const shareText = `Invoice INV-${activeInvoice.id}\nTotal: ${activeInvoice.total.toFixed(2)} SAR\nSeller: ${settings.businessName}\nDate: ${activeInvoice.date}`;
                                                            const el = document.getElementById('invoicePrintArea');
                                                        const h2p = window.html2pdf || (typeof html2pdf !== 'undefined' ? html2pdf : null);
                                                        if (h2p && el) {
                                                            const opt = { margin: [10, 0, 10, 0], filename: `Invoice_${activeInvoice.id}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, windowWidth: 800 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css'] } };
                                                            h2p().set(opt).from(el).output('blob').then(pdfBlob => {
                                                                const file = new File([pdfBlob], `Invoice_${activeInvoice.id}.pdf`, { type: 'application/pdf' });
                                                                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                                                    navigator.share({ title: `Invoice INV-${activeInvoice.id}`, files: [file] }).catch(()=>{});
                                                                } else {
                                                                    const url = URL.createObjectURL(pdfBlob);
                                                                    const a = document.createElement('a');
                                                                    a.href = url;
                                                                    a.download = `Invoice_${activeInvoice.id}.pdf`;
                                                                    a.click();
                                                                    URL.revokeObjectURL(url);
                                                                }
                                                            });
                                                        } else {
                                                            navigator.clipboard.writeText(shareText);
                                                            alert('Copied to clipboard as fallback!');
                                                        }}}
                                                    >
                                                        <i className="ri-share-line"></i> {currentLanguage === 'ar' ? 'مشاركة الفاتورة' : 'Share Invoice'}
                                                    </button>
                                                    {invoiceSource === 'sales' && (
                                                        <button 
                                                            className="btn btn-secondary no-print" 
                                                            onClick={() => setShowEmailModal(true)} 
                                                            style={{ 
                                                                marginTop: '6px', 
                                                                width: '100%', 
                                                                fontSize: '11px', 
                                                                padding: '6px 10px', 
                                                                background: '#f59e0b', 
                                                                color: 'white', 
                                                                border: 'none', 
                                                                borderRadius: '5px', 
                                                                cursor: 'pointer', 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                justifyContent: 'center', 
                                                                gap: '6px' 
                                                            }}>
                                                            <i className="ri-mail-send-line"></i> {currentLanguage === 'ar' ? 'إرسال بالبريد' : 'Email Invoice'}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Financial Totals Table */}
                                                <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end', direction: currentLanguage === 'ar' ? 'rtl' : 'ltr' }}>
                                                    <table style={{ width: '100%', maxWidth: '380px', borderCollapse: 'collapse', fontSize: '10px' }}>
                                                        <tbody>
                                                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                                <td style={{ padding: '4px 6px', fontWeight: 'bold' }}>{currentLanguage === 'ar' ? 'الإجمالي (غير شامل ضريبة القيمة المضافة)' : 'Total (Excluding VAT)'}</td>
                                                                <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(activeGross)}</td>
                                                            </tr>
                                                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                                <td style={{ padding: '4px 6px', fontWeight: 'bold' }}>{currentLanguage === 'ar' ? 'مجموع الخصومات' : 'Discount'}</td>
                                                                <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(activeInvoice.discount || 0)}</td>
                                                            </tr>
                                                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                                <td style={{ padding: '4px 6px', fontWeight: 'bold' }}>{currentLanguage === 'ar' ? 'الإجمالي الخاضع للضريبة' : 'Total Taxable Amount'}</td>
                                                                <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(activeSubtotal)}</td>
                                                            </tr>
                                                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                                <td style={{ padding: '4px 6px', fontWeight: 'bold' }}>{currentLanguage === 'ar' ? 'مجموع ضريبة القيمة المضافة' : 'Total VAT'}</td>
                                                                <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(activeVat)}</td>
                                                            </tr>
                                                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #8b5cf6' }}>
                                                                <td style={{ padding: '6px 8px', fontWeight: 'bold', fontSize: '12px', color: '#8b5cf6' }}>{currentLanguage === 'ar' ? 'إجمالي المبلغ المستحق' : 'Total Amount Due'}</td>
                                                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', fontSize: '12px', color: '#8b5cf6' }}>{formatCurrency(activeInvoice.total)}</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>

                                    ) : (
                                        /* Redesigned Centered Thermal Layout */
                                        <div style={{ padding: '10px', color: 'black', background: 'white', fontFamily: 'Cairo, sans-serif', fontWeight: 'bold', width: '100%', boxSizing: 'border-box' }}>
                                            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                                                <img src={settings.logo || "/logo.png"} alt="Company Logo" style={{ maxHeight: '70px', maxWidth: '120px', objectFit: 'contain' }} />
                                            </div>
                                            <h3 style={{ textAlign: 'center', margin: '0 0 4px 0', fontSize: '18px', fontWeight: '900' }}>{settings.businessName}</h3>
                                            <p style={{ textAlign: 'center', margin: '2px 0', fontSize: '13px', color: '#000', fontWeight: 'bold' }}>{currentLanguage === 'ar' ? 'فاتورة ضريبية مبسطة' : 'Simplified Tax Invoice'}</p>
                                            <p style={{ textAlign: 'center', margin: '2px 0', fontSize: '13px', color: '#000', fontWeight: 'bold' }}>{formatAddress(settings.nationalAddress || settings.businessAddress)}</p>
                                            <p style={{ textAlign: 'center', margin: '2px 0', fontSize: '13px', color: '#000', fontWeight: 'bold' }}>{currentLanguage === 'ar' ? 'الرقم الضريبي:' : 'VAT:'} {settings.vatNumber}</p>
                                            <p style={{ textAlign: 'center', margin: '2px 0', fontSize: '13px', color: '#000', fontWeight: 'bold' }}>{currentLanguage === 'ar' ? 'سجل تجاري:' : 'CR No:'} {settings.crNumber}</p>
                                            <p style={{ textAlign: 'center', margin: '2px 0', fontSize: '13px', color: '#000', fontWeight: 'bold' }}>{currentLanguage === 'ar' ? 'رقم التواصل:' : 'Contact:'} {settings.contactNumber}</p>
                                            
                                            <hr style={{ borderStyle: 'dashed', margin: '10px 0', borderColor: '#ccc' }} />
                                            
                                            {/* Invoice Metadata (Centered) */}
                                            <div style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center', margin: '0 auto 10px auto', lineHeight: '1.6' }}>
                                                <p style={{ margin: '2px 0' }}>{currentLanguage === 'ar' ? 'رقم الفاتورة:' : 'Invoice ID:'} {activeInvoice.id}</p>
                                                <p style={{ margin: '2px 0' }}>{currentLanguage === 'ar' ? 'التاريخ:' : 'Date:'} {activeInvoice.date}</p>
                                                <p style={{ margin: '2px 0' }}>{currentLanguage === 'ar' ? 'العميل:' : 'Customer:'} {activeInvoice.customer}</p>
                                                <p style={{ margin: '2px 0' }}>{currentLanguage === 'ar' ? 'الدفع:' : 'Payment:'} {getPaymentMethodLabel(activeInvoice.paymentMethod, currentLanguage)}</p>
                                            </div>
                                            
                                            <hr style={{ borderStyle: 'dashed', margin: '10px 0', borderColor: '#ccc' }} />
                                            
                                            {/* Items Table */}
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontWeight: 'bold', margin: '10px 0' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '2px solid #000' }}>
                                                        <th style={{ textAlign: 'left', padding: '4px 0' }}>{currentLanguage === 'ar' ? 'السلعة' : 'Item'}</th>
                                                        <th style={{ textAlign: 'center', padding: '4px 0' }}>{currentLanguage === 'ar' ? 'الكمية' : 'Qty'}</th>
                                                        <th style={{ textAlign: 'right', padding: '4px 0' }}>{currentLanguage === 'ar' ? 'الاجمالي' : 'Total'}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(activeInvoice.items || []).map((item, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px dashed #555' }}>
                                                            <td style={{ textAlign: 'left', padding: '6px 0' }}>{item.name}</td>
                                                            <td style={{ textAlign: 'center', padding: '6px 0' }}>{item.qty}</td>
                                                            <td style={{ textAlign: 'right', padding: '6px 0' }}>{formatCurrency(item.price * item.qty)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            
                                            <hr style={{ borderStyle: 'dashed', margin: '10px 0', borderColor: '#ccc' }} />
                                            
                                            {/* Financial Summary */}
                                            <div style={{ fontSize: '13px', fontWeight: 'bold', lineHeight: '1.6', margin: '10px 0' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>{currentLanguage === 'ar' ? 'المجموع (غير شامل الضريبة):' : 'Subtotal (Excl. VAT):'}</span>
                                                    <span>{formatCurrency(activeGross)}</span>
                                                </div>
                                                {activeInvoice.discount > 0 && (
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>{currentLanguage === 'ar' ? 'الخصم:' : 'Discount:'}</span>
                                                        <span>-{formatCurrency(activeInvoice.discount)}</span>
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>{currentLanguage === 'ar' ? 'ضريبة القيمة المضافة (15%):' : 'VAT (15%):'}</span>
                                                    <span>{formatCurrency(activeVat)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '900', borderTop: '2px solid #000', paddingTop: '4px', marginTop: '4px' }}>
                                                    <span>{currentLanguage === 'ar' ? 'المجموع (شامل الضريبة):' : 'Total (Incl. VAT):'}</span>
                                                    <span>{formatCurrency(activeInvoice.total)}</span>
                                                </div>
                                            </div>
                                            
                                            <hr style={{ borderStyle: 'dashed', margin: '10px 0', borderColor: '#ccc' }} />
                                            
                                            {/* QR Code (Centered) */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '10px', gap: '4px', textAlign: 'center' }}>
                                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent((activeInvoice.qrCode || generateZatcaQR(settings.businessName, settings.vatNumber, activeInvoice.date, activeInvoice.total, activeVat, activeInvoice.xmlHashBase64 || activeInvoice.xmlHash, activeInvoice.signature, activeInvoice.publicKey, activeInvoice.certSignature)))}`} alt="ZATCA QR" style={{ width: '110px', height: '110px' }} />
                                                <span style={{ fontSize: '10px', fontWeight: 'bold' }}>فاتورة ضريبية مبسطة رقمية</span>
                                                <span style={{ fontSize: '9px', color: '#666' }}>ZATCA Compliant QR Code</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                </div>
                            );
                        })()}

                        {/* Interactive Buttons */}
                        {zatcaConnected ? (
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                            <button className="btn btn-secondary" style={{ flexGrow: 1, background: '#0284c7', color: 'white' }} onClick={() => downloadXml(activeInvoice)}>
                                <i className="ri-file-code-line"></i> Download ZATCA XML
                            </button>
                            <button className="btn btn-primary" style={{ flexGrow: 1, background: '#16a34a' }} onClick={() => simulateZATCAReporting(activeInvoice.id)}>
                                <i className="ri-cloud-upload-line"></i> Report to ZATCA
                            </button>
                        </div>
                        ) : (
                        <div style={{ marginBottom: '15px', padding: '10px', borderRadius: '6px', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                            <i className="ri-cloud-off-line"></i> {currentLanguage === 'ar' ? 'هيئة الزكاة: غير متصل. هذه الفاتورة لا تُرسل إلى الهيئة.' : 'ZATCA: Not connected. This invoice is not reported to ZATCA.'}
                        </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
                            <button className="btn btn-secondary" onClick={() => setShowInvoiceModal(false)}>{translations[currentLanguage].close}</button>
                            
                            <button className="btn btn-primary" onClick={() => window.print()}>{translations[currentLanguage].print}</button>
                        </div>
                        {showEmailModal && (
                            <div style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                                <h4 style={{ marginBottom: '10px' }}>{currentLanguage === 'ar' ? 'إرسال الفاتورة بالبريد الإلكتروني' : 'Email Invoice'}</h4>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input type="email" className="form-control" placeholder={currentLanguage === 'ar' ? 'البريد الإلكتروني للعميل' : 'Customer Email Address'} value={emailAddress} onChange={e => setEmailAddress(e.target.value)} />
                                    <button className="btn btn-primary" onClick={handleSendEmail} disabled={isEmailSending}>
                                        {isEmailSending ? (currentLanguage === 'ar' ? 'جاري الإرسال...' : 'Sending...') : (currentLanguage === 'ar' ? 'إرسال' : 'Send')}
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => setShowEmailModal(false)}>{translations[currentLanguage].close}</button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}
            {/* MODAL: ADD PRODUCT */}
            {/* MODAL: ADD ASSET */}
            
            {/* MODAL: CREATE QUOTATION CRUD */}
            {showQuotationCrudModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3 style={{ marginBottom: '20px', color: 'var(--accent-primary)' }}>
                            <i className="ri-file-list-3-line"></i> {currentLanguage === 'ar' ? 'إنشاء عرض سعر جديد' : 'Create New Quotation'}
                        </h3>
                        <form onSubmit={handleSaveQuotation}>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'اسم العميل' : 'Customer Name'}</label>
                                <input type="text" className="form-control" value={quotationForm.customer} onChange={e => setQuotationForm({ ...quotationForm, customer: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'المنتجات (مثال: لابتوب x2, ماوس x1)' : 'Items (e.g. Laptop x2, Mouse x1)'}</label>
                                <input type="text" className="form-control" value={quotationForm.itemsText || ''} onChange={e => setQuotationForm({ ...quotationForm, itemsText: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'الإجمالي (غير شامل الضريبة)' : 'Total (Excl. VAT)'}</label>
                                <input type="number" className="form-control" value={quotationForm.total} onChange={e => setQuotationForm({ ...quotationForm, total: e.target.value })} required />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '30px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowQuotationCrudModal(false)}>{translations[currentLanguage].close}</button>
                                <button type="submit" className="btn btn-primary">{translations[currentLanguage].saveSettings || 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
{showAssetModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3 style={{ marginBottom: '20px' }}>{translations[currentLanguage].addAsset}</h3>
                        <form onSubmit={handleSaveAsset}>
                            <div className="form-group">
                                <label>{translations[currentLanguage].assetName}</label>
                                <input type="text" className="form-control" value={assetForm.name} onChange={e => setAssetForm({ ...assetForm, name: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>{translations[currentLanguage].assetCost}</label>
                                <input type="number" className="form-control" value={assetForm.cost} onChange={e => setAssetForm({ ...assetForm, cost: Number(e.target.value) })} required />
                            </div>
                            <div className="form-group">
                                <label>{translations[currentLanguage].assetSalvage}</label>
                                <input type="number" className="form-control" value={assetForm.salvage} onChange={e => setAssetForm({ ...assetForm, salvage: Number(e.target.value) })} required />
                            </div>
                            <div className="form-group">
                                <label>{translations[currentLanguage].assetLife}</label>
                                <input type="number" className="form-control" value={assetForm.life} onChange={e => setAssetForm({ ...assetForm, life: Number(e.target.value) })} required />
                            </div>
                            <div className="form-group">
                                <label>{translations[currentLanguage].assetDate}</label>
                                <input type="date" className="form-control" value={assetForm.date} onChange={e => setAssetForm({ ...assetForm, date: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>{translations[currentLanguage].assignedTo}</label>
                                <select className="form-control" value={assetForm.assignedTo} onChange={e => setAssetForm({ ...assetForm, assignedTo: e.target.value })}>
                                    <option value="unassigned">{translations[currentLanguage].unassigned}</option>
                                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAssetModal(false)}>{translations[currentLanguage].close}</button>
                                <button type="submit" className="btn btn-primary">{translations[currentLanguage].saveAsset}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: ADD / EDIT CUSTOMER */}
            {showCustomerModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3 style={{ marginBottom: '20px' }}>
                            {custForm.id ? (currentLanguage === 'ar' ? 'تعديل بيانات العميل' : 'Edit Customer Details') : translations[currentLanguage].addCustomer}
                        </h3>
                        <form onSubmit={handleSaveCustomer}>
                            <div className="form-group">
                                <label>{translations[currentLanguage].custName}</label>
                                <input type="text" className="form-control" value={custForm.name || ''} onChange={e => setCustForm({ ...custForm, name: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>{translations[currentLanguage].phone}</label>
                                <input type="text" className="form-control" value={custForm.phone || ''} onChange={e => setCustForm({ ...custForm, phone: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>{translations[currentLanguage].email}</label>
                                <input type="email" className="form-control" value={custForm.email || ''} onChange={e => setCustForm({ ...custForm, email: e.target.value })} required />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCustomerModal(false)}>{translations[currentLanguage].close}</button>
                                <button type="submit" className="btn btn-primary">{currentLanguage === 'ar' ? 'حفظ' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: ADD / EDIT USER */}
            {showUserModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3 style={{ marginBottom: '20px' }}>
                            {userForm.id ? (currentLanguage === 'ar' ? 'تعديل بيانات المستخدم' : 'Edit User Credentials') : (currentLanguage === 'ar' ? 'إضافة مستخدم جديد' : 'Add New System User')}
                        </h3>
                        <form onSubmit={handleSaveUser}>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'اسم المستخدم' : 'Username'}</label>
                                <input type="text" className="form-control" value={userForm.username || ''} onChange={e => setUserForm({ ...userForm, username: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'كلمة المرور' : 'Password'} {userForm.id && (currentLanguage === 'ar' ? '(اترك فارغاً للحفاظ على الحالية)' : '(Leave blank to keep current)')}</label>
                                <input type="password" className="form-control" value={userForm.password || ''} onChange={e => setUserForm({ ...userForm, password: e.target.value })} required={!userForm.id} />
                            </div>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'دور الصلاحية' : 'User Role'}</label>
                                <select className="form-control" value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
                                    <option value="Admin">{translations[currentLanguage].roleAdmin}</option>
                                    <option value="Manager">{translations[currentLanguage].roleManager}</option>
                                    <option value="Cashier">{translations[currentLanguage].roleCashier}</option>
                                </select>
                            </div>
                            {userForm.id && userForm.id !== user?.id && (
                                <div className="form-group" style={{ flexDirection: 'row', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
                                    <input type="checkbox" id="userIsActive" checked={userForm.isActive !== false} onChange={e => setUserForm({ ...userForm, isActive: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                    <label htmlFor="userIsActive" style={{ cursor: 'pointer', margin: 0 }}>{currentLanguage === 'ar' ? 'الحساب نشط (يمكنه تسجيل الدخول)' : 'Account is Active (can login)'}</label>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)}>{translations[currentLanguage].close}</button>
                                <button type="submit" className="btn btn-primary">{currentLanguage === 'ar' ? 'حفظ' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: ASSET QR LABEL */}
            {showAssetQrModal && activeAssetForQr && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <h3 style={{ marginBottom: '20px' }}>{currentLanguage === 'ar' ? 'بطاقة تتبع الأصل (بار كود)' : 'Asset Tracking Label (QR)'}</h3>
                        <div id="assetPrintArea" style={{ background: 'white', color: 'black', padding: '20px', borderRadius: '8px', border: '1px solid #ccc', display: 'inline-block', margin: '10px auto' }}>
                            <h4 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>CASHIER ERP</h4>
                            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666' }}>{currentLanguage === 'ar' ? 'نظام إدارة الأصول' : 'Asset Management System'}</p>
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`Asset ID: ${activeAssetForQr.id}\nName: ${activeAssetForQr.name}\nDepartment: ${activeAssetForQr.department || 'Operations'}\nCost: ${activeAssetForQr.cost}`)}`} alt="Asset QR Code" style={{ width: '150px', height: '150px' }} />
                            <h5 style={{ margin: '10px 0 2px 0', fontSize: '14px', fontWeight: 'bold' }}>{activeAssetForQr.name}</h5>
                            <span style={{ fontSize: '11px', fontFamily: 'monospace', background: '#eee', padding: '2px 6px', borderRadius: '4px' }}>{activeAssetForQr.id}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
                            <button className="btn btn-secondary" onClick={() => setShowAssetQrModal(false)}>{translations[currentLanguage].close}</button>
                            <button className="btn btn-primary" onClick={() => window.print()}>{translations[currentLanguage].print}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: QUOTATION PRINT */}
            {showQuotationModal && activeQuotation && (() => {
                const activeVat = activeQuotation.vat !== undefined && activeQuotation.vat !== null ? activeQuotation.vat : (activeQuotation.total - (activeQuotation.total / 1.15));
                const activeSubtotal = activeQuotation.total - activeVat;
                const docDiscount = Number(activeQuotation.discount) || 0;
                const docGross = (activeQuotation.items || []).reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0);
                const activeGross = activeSubtotal + docDiscount;
                return (
                    <div className="modal-overlay">
                        <div className="modal">
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
                                
                            </div>

                            {/* Print Layout Area */}
                            <div id="quotationPrintArea" className="invoice-a4-layout" style={{ direction: 'ltr', background: 'white', color: 'black' }}>
                                {true ? (
                                    <div style={{ padding: '16px 24px', color: '#333', background: 'white', fontFamily: 'Cairo, sans-serif' }}>
                                        {/* Standard A4 Header Grid: L: English Details, C: Logo, R: Arabic Details */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 100px 1.2fr', gap: '10px', alignItems: 'start', borderBottom: '2px solid #8b5cf6', paddingBottom: '8px', pageBreakInside: 'avoid' }}>
                                            {/* Left Side: English Info (LTR) */}
                                            <div style={{ textAlign: 'left', fontSize: '10px', direction: 'ltr', lineHeight: '1.3' }}>
                                                <h2 style={{ fontSize: '15px', margin: '0 0 3px 0', color: '#8b5cf6', fontWeight: 'bold' }}>{settings.businessName}</h2>
                                                <p style={{ margin: '1px 0', color: '#555' }}><strong>Address:</strong> {formatAddress(settings.businessAddress)}</p>
                                                <p style={{ margin: '1px 0', color: '#555' }}><strong>VAT No:</strong> {settings.vatNumber}</p>
                                                <p style={{ margin: '1px 0', color: '#555' }}><strong>CR No:</strong> {settings.crNumber}</p>
                                                <p style={{ margin: '1px 0', color: '#555' }}><strong>Contact:</strong> {settings.contactNumber}</p>
                                            </div>

                                            {/* Center Side: Logo */}
                                            <div style={{ textAlign: 'center' }}>
                                                <img src={settings.logo || "/logo.png"} alt="Company Logo" style={{ maxHeight: '90px', maxWidth: '160px', objectFit: 'contain' }} />
                                            </div>

                                            {/* Right Side: Arabic Details (RTL) */}
                                            <div style={{ textAlign: 'right', fontSize: '10px', direction: 'rtl', lineHeight: '1.3' }}>
                                                <h2 style={{ fontSize: '15px', margin: '0 0 3px 0', color: '#8b5cf6', fontWeight: 'bold' }}>{settings.businessName}</h2>
                                                <p style={{ margin: '1px 0', color: '#333' }}><strong>العنوان:</strong> {formatAddress(settings.nationalAddress || settings.businessAddress)}</p>
                                                <p style={{ margin: '1px 0', color: '#333' }}><strong>الرقم الضريبي (VAT):</strong> {settings.vatNumber}</p>
                                                <p style={{ margin: '1px 0', color: '#333' }}><strong>سجل تجاري (CR):</strong> {settings.crNumber}</p>
                                                <p style={{ margin: '1px 0', color: '#333' }}><strong>رقم التواصل:</strong> {settings.contactNumber}</p>
                                            </div>
                                        </div>

                                        {/* Quotation Metadata Row (Second Line) */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '6px 12px', marginTop: '10px', background: '#f8fafc', fontSize: '10px', pageBreakInside: 'avoid' }}>
                                            <div style={{ textAlign: 'left', direction: 'ltr', lineHeight: '1.4' }}>
                                                <p style={{ margin: '1px 0', fontSize: '12px', fontWeight: 'bold', color: '#8b5cf6' }}>Quotation Document / عرض سعر</p>
                                                <p style={{ margin: '1px 0', color: '#555' }}><strong>Quotation ID:</strong> {activeQuotation.id}</p>
                                                <p style={{ margin: '1px 0', color: '#555' }}><strong>Date:</strong> {activeQuotation.date}</p>
                                            </div>
                                            <div style={{ textAlign: 'right', direction: 'rtl', lineHeight: '1.4' }}>
                                                <p style={{ margin: '1px 0', color: '#333' }}><strong>العميل / Billed To:</strong> {activeQuotation.customer}</p>
                                            </div>
                                        </div>

                                        {/* Line Items Table */}
                                        <h3 style={{ marginTop: '12px', borderBottom: '2px solid #8b5cf6', paddingBottom: '3px', fontSize: '13px', fontWeight: 'bold', direction: currentLanguage === 'ar' ? 'rtl' : 'ltr', textAlign: currentLanguage === 'ar' ? 'right' : 'left' }}>
                                            {currentLanguage === 'ar' ? 'تفاصيل السلع والخدمات / Line Items' : 'Line Items / تفاصيل السلع والخدمات'}
                                        </h3>
                                        <table className="zatca-invoice-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px', fontSize: '10px', direction: currentLanguage === 'ar' ? 'rtl' : 'ltr' }}>
                                            <thead>
                                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                                                    <th style={{ padding: '4px 6px', textAlign: currentLanguage === 'ar' ? 'right' : 'left', fontWeight: '600' }}>Nature of goods or services<br/><span style={{ color: '#666', fontWeight: 'normal', fontSize: '9px' }}>تفاصيل السلع والخدمات</span></th>
                                                    <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '600' }}>Unit price<br/><span style={{ color: '#666', fontWeight: 'normal', fontSize: '9px' }}>سعر الوحدة</span></th>
                                                    <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: '600' }}>Quantity<br/><span style={{ color: '#666', fontWeight: 'normal', fontSize: '9px' }}>الكمية</span></th>
                                                    <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '600' }}>Discount<br/><span style={{ color: '#666', fontWeight: 'normal', fontSize: '9px' }}>خصومات</span></th>
                                                    <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '600' }}>Taxable Amount<br/><span style={{ color: '#666', fontWeight: 'normal', fontSize: '9px' }}>المبلغ الخاضع للضريبة</span></th>
                                                    <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: '600' }}>Tax Rate<br/><span style={{ color: '#666', fontWeight: 'normal', fontSize: '9px' }}>نسبة الضريبة</span></th>
                                                    <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '600' }}>Tax Amount<br/><span style={{ color: '#666', fontWeight: 'normal', fontSize: '9px' }}>مبلغ الضريبة</span></th>
                                                    <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '600' }}>Item Subtotal<br/><span style={{ color: '#666', fontWeight: 'normal', fontSize: '9px' }}>الاجمالي شامل الضريبة</span></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(activeQuotation.items || []).map((item, idx) => {
                                                    const itemQty = item.qty || 1;
                                                    const itemPrice = item.price || 0;
                                                    const itemDiscount = 0; 
                                                    const rawSubtotal = itemPrice * itemQty;
                                                    const itemTaxableAmount = rawSubtotal - itemDiscount;
                                                    const itemTaxRate = settings.taxRate || 15;
                                                    const itemTaxAmount = itemTaxableAmount * (itemTaxRate / 100);
                                                    const itemSubtotal = itemTaxableAmount + itemTaxAmount;
                                                    return (
                                                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', pageBreakInside: 'avoid' }}>
                                                            <td style={{ padding: '4px 6px', textAlign: currentLanguage === 'ar' ? 'right' : 'left' }}>{item.name}</td>
                                                            <td style={{ padding: '4px 6px', textAlign: 'right' }}>{formatCurrency(itemPrice)}</td>
                                                            <td style={{ padding: '4px 6px', textAlign: 'center' }}>{itemQty}</td>
                                                            <td style={{ padding: '4px 6px', textAlign: 'right' }}>{formatCurrency(itemDiscount)}</td>
                                                            <td style={{ padding: '4px 6px', textAlign: 'right' }}>{formatCurrency(itemTaxableAmount)}</td>
                                                            <td style={{ padding: '4px 6px', textAlign: 'center' }}>{itemTaxRate}%</td>
                                                            <td style={{ padding: '4px 6px', textAlign: 'right' }}>{formatCurrency(itemTaxAmount)}</td>
                                                            <td style={{ padding: '4px 6px', textAlign: 'right' }}>{formatCurrency(itemSubtotal)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>

                                        {/* Financial Summary Totals and Side-by-Side QR Code */}
                                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: currentLanguage === 'ar' ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px', pageBreakInside: 'avoid' }}>
                                            {/* Left Side: Quotation QR Code and Share Button */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', width: '160px', textAlign: 'center', flexShrink: 0 }}>
                                                <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                                                     <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(generateZatcaQR(settings.businessName, settings.vatNumber, activeQuotation.date, activeQuotation.total, activeVat))}`} alt="Quotation QR" style={{ width: '100px', height: '100px', display: 'block' }} />
                                                </div>
                                                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#333' }}>عرض سعر رقمي مبسط</span>
                                                <span style={{ fontSize: '8px', color: '#666' }}>Digital Quotation QR Code</span>
                                                
                                                {/* Share Button (hidden on print) */}
                                                <button 
                                                    className="btn btn-secondary no-print" 
                                                    style={{ 
                                                        marginTop: '6px', 
                                                        width: '100%', 
                                                        fontSize: '11px', 
                                                        padding: '6px 10px', 
                                                        background: '#8b5cf6', 
                                                        color: 'white', 
                                                        border: 'none', 
                                                        borderRadius: '5px', 
                                                        cursor: 'pointer', 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center', 
                                                        gap: '6px' 
                                                    }}
                                                    onClick={() => {
                                                        const shareText = `Quotation QT-${activeQuotation.id}\nTotal: ${activeQuotation.total.toFixed(2)} SAR\nSeller: ${settings.businessName}\nDate: ${activeQuotation.date}`;
                                                        const el = document.getElementById('quotationPrintArea');
                                                        const h2p = window.html2pdf || (typeof html2pdf !== 'undefined' ? html2pdf : null);
                                                        if (h2p && el) {
                                                            const opt = { margin: [10, 0, 10, 0], filename: `Quotation_${activeQuotation.id}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, windowWidth: 800 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css'] } };
                                                            h2p().set(opt).from(el).output('blob').then(pdfBlob => {
                                                                const file = new File([pdfBlob], `Quotation_${activeQuotation.id}.pdf`, { type: 'application/pdf' });
                                                                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                                                    navigator.share({ title: `Quotation QT-${activeQuotation.id}`, files: [file] }).catch(()=>{});
                                                                } else {
                                                                    const url = URL.createObjectURL(pdfBlob);
                                                                    const a = document.createElement('a');
                                                                    a.href = url;
                                                                    a.download = `Quotation_${activeQuotation.id}.pdf`;
                                                                    a.click();
                                                                    URL.revokeObjectURL(url);
                                                                }
                                                            });
                                                        } else {
                                                            navigator.clipboard.writeText(shareText);
                                                            alert('Copied to clipboard as fallback!');
                                                        }}}
                                                >
                                                    <i className="ri-share-line"></i> {currentLanguage === 'ar' ? 'مشاركة عرض السعر' : 'Share Quotation'}
                                                </button>
                                            </div>

                                            {/* Financial Totals Table */}
                                            <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end', direction: currentLanguage === 'ar' ? 'rtl' : 'ltr' }}>
                                                <table style={{ width: '100%', maxWidth: '380px', borderCollapse: 'collapse', fontSize: '10px' }}>
                                                    <tbody>
                                                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                            <td style={{ padding: '4px 6px', fontWeight: 'bold' }}>Total (Excluding VAT) / الاجمالي (غير شامل ضريبة القيمة المضافة)</td>
                                                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(activeGross)}</td>
                                                        </tr>
                                                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                            <td style={{ padding: '4px 6px', fontWeight: 'bold' }}>Discount / مجموع الخصومات</td>
                                                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(docDiscount)}</td>
                                                        </tr>
                                                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                            <td style={{ padding: '4px 6px', fontWeight: 'bold' }}>Total Taxable Amount / الاجمالي الخاضع للضريبة</td>
                                                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(activeSubtotal)}</td>
                                                        </tr>
                                                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                            <td style={{ padding: '4px 6px', fontWeight: 'bold' }}>Total VAT / مجموع ضريبة القيمة المضافة</td>
                                                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(activeVat)}</td>
                                                        </tr>
                                                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #8b5cf6' }}>
                                                            <td style={{ padding: '6px 8px', fontWeight: 'bold', fontSize: '12px', color: '#8b5cf6' }}>Total Amount Due / اجمالي المبلغ المستحق</td>
                                                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', fontSize: '12px', color: '#8b5cf6' }}>{formatCurrency(activeQuotation.total)}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ padding: '15px', color: 'black', background: 'white', fontFamily: 'Cairo, sans-serif', width: '100%', boxSizing: 'border-box' }}>
                                        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                                            <img src={settings.logo || "/logo.png"} alt="Company Logo" style={{ maxHeight: '70px', maxWidth: '120px', objectFit: 'contain' }} />
                                        </div>
                                        <h3 style={{ textAlign: 'center', margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>{settings.businessName}</h3>
                                        <p style={{ textAlign: 'center', margin: '2px 0', fontSize: '11px', color: '#555' }}>Quotation / عرض سعر</p>
                                        <p style={{ textAlign: 'center', margin: '2px 0', fontSize: '11px', color: '#333' }}>{formatAddress(settings.nationalAddress || settings.businessAddress)}</p>
                                        <p style={{ textAlign: 'center', margin: '2px 0', fontSize: '11px', color: '#333' }}><strong>الرقم الضريبي / VAT:</strong> {settings.vatNumber}</p>
                                        <p style={{ textAlign: 'center', margin: '2px 0', fontSize: '11px', color: '#333' }}><strong>سجل تجاري / CR No:</strong> {settings.crNumber}</p>
                                        <p style={{ textAlign: 'center', margin: '2px 0', fontSize: '11px', color: '#333' }}><strong>رقم التواصل / Contact:</strong> {settings.contactNumber}</p>
                                        
                                        <hr style={{ borderStyle: 'dashed', margin: '10px 0', borderColor: '#ccc' }} />
                                        
                                        {/* Quotation Metadata */}
                                        <div style={{ fontSize: '11px', textAlign: 'center', margin: '0 auto 10px auto', lineHeight: '1.6' }}>
                                            <p style={{ margin: '2px 0' }}><strong>رقم عرض السعر / Quotation ID:</strong> {activeQuotation.id}</p>
                                            <p style={{ margin: '2px 0' }}><strong>التاريخ / Date:</strong> {activeQuotation.date}</p>
                                            <p style={{ margin: '2px 0' }}><strong>العميل / Customer:</strong> {activeQuotation.customer}</p>
                                        </div>
                                        
                                        <hr style={{ borderStyle: 'dashed', margin: '10px 0', borderColor: '#ccc' }} />
                                        
                                        {/* Items Table */}
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', margin: '10px 0' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid #000' }}>
                                                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Item / السلعة</th>
                                                    <th style={{ textAlign: 'center', padding: '4px 0' }}>Qty / الكمية</th>
                                                    <th style={{ textAlign: 'right', padding: '4px 0' }}>Total / الاجمالي</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(activeQuotation.items || []).map((item, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px dashed #eee' }}>
                                                        <td style={{ textAlign: 'left', padding: '6px 0' }}>{item.name}</td>
                                                        <td style={{ textAlign: 'center', padding: '6px 0' }}>{item.qty}</td>
                                                        <td style={{ textAlign: 'right', padding: '6px 0' }}>{formatCurrency(item.price * item.qty)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        
                                        <hr style={{ borderStyle: 'dashed', margin: '10px 0', borderColor: '#ccc' }} />
                                        
                                        {/* Financial Summary */}
                                        <div style={{ fontSize: '11px', lineHeight: '1.6', margin: '10px 0' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Subtotal / المجموع غير شامل الضريبة:</span>
                                                <span>{formatCurrency(activeGross)}</span>
                                            </div>
                                            {docDiscount > 0 && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>Discount / الخصم:</span>
                                                    <span>-{formatCurrency(docDiscount)}</span>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>VAT (15%) / ضريبة القيمة المضافة:</span>
                                                <span>{formatCurrency(activeVat)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '4px', marginTop: '4px' }}>
                                                <span>Total / المجموع شامل الضريبة:</span>
                                                <span>{formatCurrency(activeQuotation.total)}</span>
                                            </div>
                                        </div>
                                        
                                        <hr style={{ borderStyle: 'dashed', margin: '10px 0', borderColor: '#ccc' }} />
                                        
                                        {/* QR Code (Centered with logo overlay) */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '10px', gap: '4px', textAlign: 'center' }}>
                                            <div style={{ position: 'relative', width: '110px', height: '110px' }}>
                                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(generateZatcaQR(settings.businessName, settings.vatNumber, activeQuotation.date, activeQuotation.total, activeVat))}`} alt="Quotation QR" style={{ width: '110px', height: '110px', display: 'block' }} />

                                            </div>
                                            <span style={{ fontSize: '10px', fontWeight: 'bold' }}>عرض سعر مبسط</span>
                                            <span style={{ fontSize: '9px', color: '#666' }}>Digital Quotation QR Code</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
                                <button className="btn btn-secondary" onClick={() => setShowQuotationModal(false)}>{translations[currentLanguage].close}</button>
                                <button className="btn btn-primary" onClick={() => window.print()}>{translations[currentLanguage].print}</button>
                            </div>
                        </div>
                    </div>
                );
            })()}
            {renderDevToolbar()}
        </div>
    );

    function simulateZATCAReporting(invId) {
        const isAr = currentLanguage === 'ar';
        fetch(`/api/invoices/${invId}/zatca-report`, {
            method: 'POST',
            headers: headers
        })
        .then(res => {
            if (!res.ok) return res.json().then(e => { throw new Error(e.error || 'ZATCA reporting failed'); });
            return res.json();
        })
        .then(data => {
            setInvoices(prev => prev.map(i => i.id === invId ? {
                ...i,
                zatcaStatus: data.zatcaStatus || 'REPORTED',
                xml: data.xml || i.xml,
                xmlHash: data.xmlHash || i.xmlHash,
                xmlHashBase64: data.invoiceHash || i.xmlHashBase64,
                signature: data.signature || i.signature,
                publicKey: data.publicKey || i.publicKey,
                certSignature: data.certSignature || i.certSignature,
                qrCode: data.qrCode || i.qrCode
            } : i));
            setActiveInvoice(prev => prev && prev.id === invId ? {
                ...prev,
                zatcaStatus: data.zatcaStatus || 'REPORTED',
                xml: data.xml || prev.xml,
                xmlHash: data.xmlHash || prev.xmlHash,
                xmlHashBase64: data.invoiceHash || prev.xmlHashBase64,
                signature: data.signature || prev.signature,
                publicKey: data.publicKey || prev.publicKey,
                certSignature: data.certSignature || prev.certSignature,
                qrCode: data.qrCode || prev.qrCode
            } : prev);
            alert(isAr ? "تم توقيع وإرسال الفاتورة وتوثيقها بنجاح لدى هيئة الزكاة (المرحلة الثانية)!" : "Invoice cryptographically signed, submitted, and cleared by ZATCA (Phase 2)!");
            setShowInvoiceModal(false);
        })
        .catch(err => {
            // Not reported: the invoice keeps its status so it can be sent again
            alert((isAr ? 'لم يتم إرسال الفاتورة إلى هيئة الزكاة: ' : 'The invoice was NOT reported to ZATCA: ') + err.message);
        });
    }
}
