import React from 'react';

const ModuleSwitcher = ({ settings, setSettings, currentLanguage, translations }) => {
    const modulesList = [
        { id: 'tailoring', label: currentLanguage === 'ar' ? 'الخياطة والتفصيل والمشغل' : 'Bespoke Tailoring & Workshop' },
        { id: 'propertyManagement', label: currentLanguage === 'ar' ? 'إدارة العقارات' : 'Real Estate' },
        { id: 'freshFlowers', label: currentLanguage === 'ar' ? 'الزهور الطبيعية والهدايا' : 'Fresh Flowers & Florist' },
        { id: 'invoices', label: currentLanguage === 'ar' ? 'إدارة المبيعات والفواتير' : 'Sales & Invoices' },
        { id: 'pos', label: currentLanguage === 'ar' ? 'نقطة بيع' : 'POS Cashier' },
        { id: 'inventory', label: currentLanguage === 'ar' ? 'المخزون' : 'Inventory' },
        { id: 'maintenance', label: currentLanguage === 'ar' ? 'الصيانة' : 'Maintenance' },
        { id: 'customers', label: currentLanguage === 'ar' ? 'العملاء' : 'Customers' },
        { id: 'employees', label: currentLanguage === 'ar' ? 'الموظفين' : 'Employees' },
        { id: 'suppliers', label: currentLanguage === 'ar' ? 'الموردين' : 'Suppliers' },
        { id: 'warehouses', label: currentLanguage === 'ar' ? 'المخازن' : 'Warehouses' },
        { id: 'financials', label: currentLanguage === 'ar' ? 'المالية' : 'Financials' },
        { id: 'reports', label: currentLanguage === 'ar' ? 'التقارير' : 'Reports' },
        { id: 'ecommerce', label: currentLanguage === 'ar' ? 'المتجر الإلكتروني' : 'E-Commerce' }
    ];

    const handleToggle = (moduleId) => {
        setSettings(prev => {
            const currentModules = prev.enabledModules || {};
            const defaultOffModules = ['propertyManagement', 'freshFlowers', 'maintenance', 'employees', 'warehouses', 'financials', 'ecommerce'];
            const isCurrentlyEnabled = currentModules[moduleId] !== undefined 
                ? currentModules[moduleId] 
                : !defaultOffModules.includes(moduleId);
            const updatedSettings = {
                ...prev,
                enabledModules: {
                    ...currentModules,
                    [moduleId]: !isCurrentlyEnabled
                }
            };

            const token = localStorage.getItem('token');
            if (token) {
                fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(updatedSettings)
                }).catch(err => console.error('Failed to save module settings:', err));
            }

            return updatedSettings;
        });
    };

    return (
        <div className="glass-card" style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '20px' }}>{translations[currentLanguage].moduleSwitch || 'Module Switcher'}</h2>
            <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
                {currentLanguage === 'ar' 
                    ? 'تفعيل أو تعطيل وحدات النظام حسب احتياجات عملك.' 
                    : 'Enable or disable system modules according to your business needs.'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {modulesList.map(mod => {
                    const defaultOffModules = ['propertyManagement', 'freshFlowers', 'maintenance', 'employees', 'warehouses', 'financials', 'ecommerce'];
                    const isEnabled = settings?.enabledModules?.[mod.id] !== undefined 
                        ? settings.enabledModules[mod.id] 
                        : !defaultOffModules.includes(mod.id);
                    return (
                        <div key={mod.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--glass-bg)' }}>
                            <span style={{ fontWeight: '500' }}>{mod.label}</span>
                            <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
                                <input 
                                    type="checkbox" 
                                    checked={isEnabled} 
                                    onChange={() => handleToggle(mod.id)} 
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span className="slider round" style={{
                                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: isEnabled ? '#10b981' : '#ccc',
                                    transition: '.4s', borderRadius: '34px'
                                }}>
                                    <span style={{
                                        position: 'absolute', content: '""', height: '16px', width: '16px', left: isEnabled ? '22px' : '2px', bottom: '2px',
                                        backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
                                    }} />
                                </span>
                            </label>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ModuleSwitcher;
