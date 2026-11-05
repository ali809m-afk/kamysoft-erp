import React, { useState } from 'react';
import './Sidebar.css';

const sidebarTranslations = {
    en: {
        dashboard: "Dashboard",
        invoices: "Invoices",
        salesInvoice: "Sales Invoice",
        purchaseInvoice: "Purchase Invoice",
        salesReturn: "Sales Return",
        purchaseReturn: "Purchase Return",
        quotation: "Quotation",
        posCashier: "POS / Cashier",
        tableManagement: "Table Management",
        printerSetup: "Printer Setup",
        maintenance: "Maintenance",
        inventory: "Inventory",
        units: "Units",
        categories: "Categories",
        items: "Items",
        itemsReorder: "Items Below Reorder",
        transferQty: "Transfer Quantities",
        customers: "Customers",
        management: "Management",
        receiptVoucher: "Receipt Voucher",
        employees: "Employees",
        salaryPayment: "Salary Payment",
        salariesReport: "Salaries Report",
        suppliers: "Suppliers",
        paymentVoucher: "Payment Voucher",
        warehouses: "Warehouses",
        addWarehouse: "Add Warehouse",
        stocktaking: "Stocktaking",
        financials: "Financials",
        financialTrans: "Financial Transactions",
        dailyJournal: "Daily Journal Entry",
        chartAccounts: "Chart of Accounts",
        generalLedger: "General Ledger",
        trialBalance: "Trial Balance",
        balanceSheet: "Balance Sheet",
        incomeStatement: "Income Statement",
        cashFlow: "Cash Flow",
        reports: "Reports",
        dailyReport: "Daily Report",
        salesMovement: "Sales Movement",
        unpaidInvoices: "Unpaid Invoices",
        purchasesMovement: "Purchases Movement",
        maintenanceReport: "Maintenance Report",
        itemsMovement: "Items Movement",
        financialMovement: "Financial Movement",
        customerStatement: "Customer Statement",
        supplierStatement: "Supplier Statement",
        salesAnalysis: "Sales Analysis by Items",
        accountsDebts: "Accounts and Debts",
        profitAnalysis: "Profit Analysis Report",
        summaryReport: "Summary Report",
        taxReport: "Tax Report",
        settings: "Settings",
        userPermissions: "User Permissions",
        generalSettings: "General Settings",
        programActivation: "Program Activation",
        techSupport: "Technical Support",
        zatcaIntegration: "ZATCA Integration",
        basicData: "Basic Data",
        light: "Light",
        dark: "Dark",
        moduleSwitch: "Module Switcher",
        propertyManagement: "Real Estate & Hospitality",
        freshFlowers: "Fresh Flowers",
        flowersDashboard: "Dashboard",
        flowersArrangements: "Arrangements",
        flowersDeliveries: "Deliveries",
        propertyProperties: "Properties & Hotels",
        propertyUnits: "Rooms & Units",
        propertyBookings: "Front Desk & Bookings",
        propertyGroupBlocks: "Group Blocks",
        propertyInvoices: "Guest Invoices & Folios",
        propertyServices: "Extra Services & Add-ons",
        propertyPriceRules: "Dynamic Rates & Pricing",
        propertyHousekeeping: "Housekeeping",
        propertyLeasing: "Lease Contracts",
        propertyMaintenance: "Maintenance Tasks",
        propertyOwners: "Property Owners",
        ownerAccounting: "Owner Accounting",
        propertyCrm: "CRM / Leads",
        ecommerce: "E-Commerce",
        storefrontSettings: "Storefront Settings",
        viewStore: "View Online Store",
        digitalAssets: "Digital Assets",
        tailoring: "Tailoring & Bespoke",
        tailoringDashboard: "Tailoring Dashboard",
        tailoringMeasurements: "Customer Measurements",
        tailoringOrders: "Tailoring Orders & Deposits",
        tailoringWorkshop: "Workshop Kanban & Pay",
        tailoringPortal: "Client Web Portal (Atelier)"
    },
    ar: {
        dashboard: "الرئيسية",
        invoices: "الفواتير",
        salesInvoice: "فاتورة بيع",
        purchaseInvoice: "فاتورة شراء",
        salesReturn: "فاتورة مرتجع بيع",
        purchaseReturn: "فاتورة مرتجع شراء",
        quotation: "فاتورة عرض أسعار",
        posCashier: "نقطة بيع",
        tableManagement: "إدارة الطاولات",
        printerSetup: "إعداد الطابعات",
        maintenance: "الصيانة",
        inventory: "الأصناف",
        units: "الوحدات",
        categories: "الفئات",
        items: "الأصناف",
        itemsReorder: "الأصناف تحت حد الطلب",
        transferQty: "تحويل كميات",
        customers: "العملاء",
        management: "إدارة",
        receiptVoucher: "سند قبض",
        employees: "الموظفين",
        salaryPayment: "صرف راتب",
        salariesReport: "تقرير الرواتب",
        suppliers: "الموردين",
        paymentVoucher: "سند صرف",
        warehouses: "المخازن",
        addWarehouse: "إضافة مخزن",
        stocktaking: "جرد المخازن",
        financials: "المالية",
        financialTrans: "حركات المالية",
        dailyJournal: "القيد اليومي",
        chartAccounts: "شجرة الحسابات",
        generalLedger: "دفتر الاستاذ",
        trialBalance: "ميزان المراجعة",
        balanceSheet: "الميزانية العمومية",
        incomeStatement: "قائمة الدخل",
        cashFlow: "التدفقات النقدية",
        reports: "تقارير",
        dailyReport: "التقرير اليومي",
        salesMovement: "حركة المبيعات",
        unpaidInvoices: "الفواتير غير مدفوعة",
        purchasesMovement: "حركة المشتريات",
        maintenanceReport: "تقرير الصيانة",
        itemsMovement: "حركة الأصناف",
        financialMovement: "حركة المالية",
        customerStatement: "كشف حساب عميل",
        supplierStatement: "كشف حساب مورد",
        salesAnalysis: "تحليل مبيعات بالأصناف",
        accountsDebts: "الحسابات والديون",
        profitAnalysis: "تقرير تحليل الأرباح",
        summaryReport: "تقرير ملخص من البداية",
        taxReport: "التقرير الضريبي",
        settings: "الضبط",
        userPermissions: "صلاحيات مستخدمين",
        generalSettings: "إعدادات عامة",
        programActivation: "تفعيل البرنامج",
        techSupport: "الدعم الفني",
        zatcaIntegration: "الربط مع هيئة الزكاة والدخل",
        basicData: "بيانات أساسية",
        light: "نهاري",
        dark: "ليلي",
        propertyManagement: "إدارة العقارات والضيافة",
        freshFlowers: "الزهور الطازجة",
        flowersDashboard: "لوحة القيادة",
        flowersArrangements: "التنسيقات",
        flowersDeliveries: "التوصيل",
        propertyProperties: "العقارات والفنادق",
        propertyUnits: "الغرف والوحدات",
        propertyBookings: "الاستقبال والحجوزات (Front Desk)",
        propertyGroupBlocks: "حجوزات المجموعات (Group Blocks)",
        propertyInvoices: "فواتير النزلاء والإقامة (Invoices)",
        propertyServices: "الخدمات الإضافية",
        propertyPriceRules: "الأسعار والمواسم الديناميكية",
        propertyHousekeeping: "التدبير الفندقي (Housekeeping)",
        propertyLeasing: "عقود الإيجار",
        propertyMaintenance: "مهام الصيانة",
        propertyOwners: "الملاك والمستثمرين",
        ownerAccounting: "حسابات الملاك",
        propertyCrm: "إدارة العملاء المحتملين (CRM)",
        ecommerce: "المتجر الإلكتروني",
        storefrontSettings: "إعدادات المتجر",
        viewStore: "عرض المتجر",
        digitalAssets: "المنتجات الرقمية",
        tailoring: "الخياطة والتفصيل",
        tailoringDashboard: "لوحة القيادة للخياطة",
        tailoringMeasurements: "سجل مقاسات العملاء",
        tailoringOrders: "أوامر التفصيل والعربون",
        tailoringWorkshop: "لوحة المشغل والعمولات",
        tailoringPortal: "بوابة العميل (موقع المشغل)"
    }
};

const menuConfig = [
    { id: 'dashboard', icon: 'ri-home-line', labelKey: 'dashboard' },
    {
        id: 'tailoring', icon: 'ri-scissors-cut-line', labelKey: 'tailoring',
        submenu: [
            { id: 'tailoring_dashboard', labelKey: 'tailoringDashboard' },
            { id: 'tailoring_measurements', labelKey: 'tailoringMeasurements' },
            { id: 'tailoring_orders', labelKey: 'tailoringOrders' },
            { id: 'tailoring_workshop', labelKey: 'tailoringWorkshop' },
            { id: 'tailoring_portal', labelKey: 'tailoringPortal' }
        ]
    },
    { 
        id: 'invoices', icon: 'ri-receipt-line', labelKey: 'invoices',
        submenu: [
            { id: 'salesInvoice', labelKey: 'salesInvoice' },
            { id: 'purchaseInvoice', labelKey: 'purchaseInvoice' },
            { id: 'salesReturn', labelKey: 'salesReturn' },
            { id: 'purchaseReturn', labelKey: 'purchaseReturn' },
            { id: 'quotation', labelKey: 'quotation' }
        ]
    },
    {
        id: 'posGroup', icon: 'ri-shopping-cart-line', labelKey: 'posCashier',
        submenu: [
            { id: 'pos', labelKey: 'posCashier' },
            { id: 'tableManagement', labelKey: 'tableManagement', requireRestaurant: true },
            { id: 'printerSetup', labelKey: 'printerSetup', requireRestaurant: true }
        ]
    },
    {
        id: 'propertyManagement', icon: 'ri-building-line', labelKey: 'propertyManagement',
        submenu: [
            { id: 'property_properties', labelKey: 'propertyProperties' },
            { id: 'property_units', labelKey: 'propertyUnits' },
            { id: 'property_bookings', labelKey: 'propertyBookings' },
            { id: 'property_groupblocks', labelKey: 'propertyGroupBlocks' },
            { id: 'property_invoices', labelKey: 'propertyInvoices' },
            { id: 'property_services', labelKey: 'propertyServices' },
            { id: 'property_pricerules', labelKey: 'propertyPriceRules' },
            { id: 'property_housekeeping', labelKey: 'propertyHousekeeping' },
            { id: 'property_leasing', labelKey: 'propertyLeasing' },
            { id: 'property_crm', labelKey: 'propertyCrm' },
            { id: 'property_owners', labelKey: 'propertyOwners' },
            { id: 'property_owner_accounting', labelKey: 'ownerAccounting' }
        ]
    },
    {
        id: 'freshFlowers', icon: 'ri-leaf-line', labelKey: 'freshFlowers',
        submenu: [
            { id: 'flowers_dashboard', labelKey: 'flowersDashboard' },
            { id: 'flowers_arrangements', labelKey: 'flowersArrangements' },
            { id: 'flowers_deliveries', labelKey: 'flowersDeliveries' }
        ]
    },
    { id: 'maintenance', icon: 'ri-tools-line', labelKey: 'maintenance' },
    {
        id: 'inventory', icon: 'ri-shopping-bag-3-line', labelKey: 'inventory',
        submenu: [
            { id: 'units', labelKey: 'units' },
            { id: 'categories', labelKey: 'categories' },
            { id: 'items', labelKey: 'items' },
            { id: 'itemsReorder', labelKey: 'itemsReorder' },
            { id: 'transferQty', labelKey: 'transferQty' }
        ]
    },
    {
        id: 'customers', icon: 'ri-user-smile-line', labelKey: 'customers',
        submenu: [
            { id: 'customersManagement', labelKey: 'management' }
        ]
    },
    {
        id: 'employees', icon: 'ri-user-star-line', labelKey: 'employees',
        submenu: [
            { id: 'employeesManagement', labelKey: 'management' },
            { id: 'salaryPayment', labelKey: 'salaryPayment' },
            { id: 'salariesReport', labelKey: 'salariesReport' }
        ]
    },
    {
        id: 'suppliers', icon: 'ri-truck-line', labelKey: 'suppliers',
        submenu: [
            { id: 'suppliersManagement', labelKey: 'management' }
        ]
    },
    {
        id: 'warehouses', icon: 'ri-store-2-line', labelKey: 'warehouses',
        submenu: [
            { id: 'addWarehouse', labelKey: 'addWarehouse' },
            { id: 'stocktaking', labelKey: 'stocktaking' }
        ]
    },
    {
        id: 'financials', icon: 'ri-money-dollar-circle-line', labelKey: 'financials',
        submenu: [
            { id: 'receiptVoucher', labelKey: 'receiptVoucher' },
            { id: 'paymentVoucher', labelKey: 'paymentVoucher' },
            { id: 'financialTrans', labelKey: 'financialTrans' },
            { id: 'dailyJournal', labelKey: 'dailyJournal' },
            { id: 'chartAccounts', labelKey: 'chartAccounts' },
            { id: 'generalLedger', labelKey: 'generalLedger' },
            { id: 'trialBalance', labelKey: 'trialBalance' },
            { id: 'balanceSheet', labelKey: 'balanceSheet' },
            { id: 'incomeStatement', labelKey: 'incomeStatement' },
            { id: 'cashFlow', labelKey: 'cashFlow' }
        ]
    },
    {
        id: 'reports', icon: 'ri-bar-chart-box-line', labelKey: 'reports',
        submenu: [
            { id: 'dailyReport', labelKey: 'dailyReport' },
            { id: 'salesMovement', labelKey: 'salesMovement' },
            { id: 'unpaidInvoices', labelKey: 'unpaidInvoices' },
            { id: 'purchasesMovement', labelKey: 'purchasesMovement' },
            { id: 'maintenanceReport', labelKey: 'maintenanceReport' },
            { id: 'itemsMovement', labelKey: 'itemsMovement' },
            { id: 'financialMovement', labelKey: 'financialMovement' },
            { id: 'customerStatement', labelKey: 'customerStatement' },
            { id: 'supplierStatement', labelKey: 'supplierStatement' },
            { id: 'salesAnalysis', labelKey: 'salesAnalysis' },
            { id: 'accountsDebts', labelKey: 'accountsDebts' },
            { id: 'profitAnalysis', labelKey: 'profitAnalysis' },
            { id: 'summaryReport', labelKey: 'summaryReport' },
            { id: 'taxReport', labelKey: 'taxReport' }
        ]
    },
    {
        id: 'ecommerce', icon: 'ri-shopping-bag-3-line', labelKey: 'ecommerce',
        submenu: [
            { id: 'storefrontSettings', labelKey: 'storefrontSettings' },
            { id: 'digitalAssets', labelKey: 'digitalAssets' },
            { id: 'viewStore', labelKey: 'viewStore' }
        ]
    },
    {
        id: 'settings', icon: 'ri-settings-4-line', labelKey: 'settings',
        submenu: [
            { id: 'userPermissions', labelKey: 'userPermissions' },
            { id: 'generalSettings', labelKey: 'generalSettings' },
            { id: 'programActivation', labelKey: 'programActivation' },
            { id: 'techSupport', labelKey: 'techSupport' },
            { id: 'zatcaIntegration', labelKey: 'zatcaIntegration' },
            { id: 'moduleSwitch', labelKey: 'moduleSwitch' }
        ]
    }
];

const Sidebar = ({ handleLogout, settings, mobileMenuOpen, setMobileMenuOpen, currentLanguage, setCurrentLanguage, theme, setTheme, activeTab, setActiveTab }) => {
    const [expandedMenu, setExpandedMenu] = useState(null);
    const t = sidebarTranslations[currentLanguage];

    const handleMenuClick = (menuItem) => {
        if (menuItem.submenu) {
            setExpandedMenu(expandedMenu === menuItem.id ? null : menuItem.id);
        } else {
            setActiveTab(menuItem.id);
            setExpandedMenu(null);
            setMobileMenuOpen(false);
        }
    };

    const handleSubMenuClick = (subMenuItemId) => {
        if (subMenuItemId === 'viewStore') {
            window.open('/store' + window.location.search, '_blank');
            return;
        }
        if (subMenuItemId === 'tailoring_portal') {
            window.open('/tailoring-portal' + window.location.search, '_blank');
            return;
        }
        setActiveTab(subMenuItemId);
        setMobileMenuOpen(false);
    };

    return (
        <>
            {mobileMenuOpen && <div className="modern-sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} />}
            <aside className={`modern-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
                <div className="modern-sidebar-controls">
                    <button 
                        className="modern-control-btn" 
                        onClick={() => setCurrentLanguage(currentLanguage === 'ar' ? 'en' : 'ar')} 
                    >
                        <i className="ri-translate"></i>
                        <span>{currentLanguage === 'ar' ? 'English' : 'العربية'}</span>
                    </button>
                    <button 
                        className="modern-control-btn" 
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
                    >
                        <i className={theme === 'dark' ? 'ri-sun-line' : 'ri-moon-line'}></i>
                        <span>{theme === 'dark' ? t.light : t.dark}</span>
                    </button>
                </div>
                
                <div className="modern-brand">
                    <img src="/logo.png" alt="26i ERP" style={{ height: '32px', width: 'auto', marginRight: '8px', objectFit: 'contain' }} />
                </div>
                
                <div className="modern-nav-container">
                    <ul className="modern-nav-links">
                        {menuConfig.map((item) => {
                            const defaultOffModules = ['propertyManagement', 'freshFlowers', 'maintenance', 'employees', 'warehouses', 'financials', 'ecommerce'];
                            
                            // Check if module is enabled by SaaS Admin (default logic applies if undefined)
                            if (item.id !== 'dashboard' && item.id !== 'settings') {
                                const isEnabled = settings?.enabledModules && settings.enabledModules[item.id] !== undefined
                                    ? settings.enabledModules[item.id]
                                    : !defaultOffModules.includes(item.id);
                                if (!isEnabled) return null;
                            }

                            // Hide if Tenant disabled it locally
                            if (item.id !== 'dashboard' && item.id !== 'settings' && settings?.visibleModules && settings.visibleModules[item.id] === false) return null;

                            const isExpanded = expandedMenu === item.id;
                            const isActive = activeTab === item.id || (item.submenu && item.submenu.some(sub => sub.id === activeTab));
                            
                            return (
                                <li key={item.id} className="modern-nav-item-wrapper">
                                    <button 
                                        className={`modern-nav-item ${isActive ? 'active' : ''} ${isExpanded ? 'expanded' : ''}`} 
                                        onClick={() => handleMenuClick(item)}
                                    >
                                        <div className="nav-item-content">
                                            <i className={item.icon}></i>
                                            <span>{t[item.labelKey]}</span>
                                        </div>
                                        {item.submenu && (
                                            <i className={`ri-arrow-down-s-line submenu-arrow ${isExpanded ? 'rotated' : ''}`}></i>
                                        )}
                                    </button>
                                    
                                    {item.submenu && (
                                        <ul className={`modern-submenu ${isExpanded ? 'open' : ''}`}>
                                            {item.submenu.map(subItem => {
                                                if (subItem.requireRestaurant && settings?.businessType !== 'restaurant') {
                                                    return null;
                                                }
                                                return (
                                                    <li key={subItem.id}>
                                                        <button 
                                                            className={`modern-submenu-item ${activeTab === subItem.id ? 'active' : ''}`}
                                                            onClick={() => handleSubMenuClick(subItem.id)}
                                                        >
                                                            <i className="ri-arrow-drop-right-line"></i>
                                                            <span>{t[subItem.labelKey]}</span>
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
                
                <div className="modern-sidebar-footer">
                    <div className="user-profile">
                        <div className="avatar">A</div>
                        <div className="user-info">
                            <span className="user-name">Admin User</span>
                            <span className="user-role">Super Admin</span>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>
                        <i className="ri-logout-circle-r-line"></i>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;


