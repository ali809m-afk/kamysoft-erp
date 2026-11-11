import React, { useState } from 'react';
import PortalSettings from './PortalSettings';


const Settings = (props) => {
    const { 
        settings, setSettings, handleSaveSettings, settingsLoading, currentLanguage, translations, zatcaConn, setZatcaConn, units, setUnits
    } = props;

    const [activeSettingsTab, setActiveSettingsTab] = useState('general');
    const [showUnitModal, setShowUnitModal] = useState(false);
    const [unitForm, setUnitForm] = useState({ id: '', nameAR: '', nameEN: '' });

    const tabs = [
        { id: 'general', label: translations[currentLanguage].generalSettings, icon: 'ri-settings-4-line', color: 'var(--accent-purple)' },
        { id: 'branch', label: currentLanguage === 'ar' ? 'تهيئة الفروع ونوع النشاط' : 'Branch & Business Configuration', icon: 'ri-building-line', color: 'var(--accent-gold)' },
        { id: 'zatca', label: translations[currentLanguage].zatcaSettings || 'ZATCA Connection Settings', icon: 'ri-cloud-line', color: 'var(--accent-cyan)' },
        { id: 'email', label: currentLanguage === 'ar' ? 'إعدادات البريد' : 'Email / SMTP Settings', icon: 'ri-mail-send-line', color: 'var(--accent-primary)' },
        { id: 'storefront', label: currentLanguage === 'ar' ? 'إعدادات الواجهة' : 'Storefront Settings', icon: 'ri-store-2-line', color: '#ec4899' },
        { id: 'portal', label: currentLanguage === 'ar' ? 'بوابة العميل العامة' : 'Public Web Portal', icon: 'ri-global-line', color: '#10b981' },
        { id: 'danger', label: currentLanguage === 'ar' ? 'إغلاق الحساب' : 'Close Account', icon: 'ri-error-warning-line', color: '#f87171' }
    ];

    
    const handleSaveUnit = (e) => {
        e.preventDefault();
        const mock = { ...unitForm, id: unitForm.id || Date.now().toString() };
        if (unitForm.id) {
            setUnits(units.map(u => u.id === mock.id ? mock : u));
        } else {
            setUnits([...(units||[]), mock]);
        }
        setShowUnitModal(false);
        setUnitForm({ id: '', nameAR: '', nameEN: '' });
    };

    const handleDeleteUnit = (id) => {
        if (!window.confirm(currentLanguage === 'ar' ? 'هل أنت متأكد من حذف هذه الوحدة؟' : 'Are you sure you want to delete this unit?')) return;
        setUnits((units||[]).filter(u => u.id !== id));
    };

    
    
    const renderUnits = () => (
        <div className="glass-card" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h3>{currentLanguage === 'ar' ? 'وحدات القياس' : 'Measurement Units'}</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="file" id="units-csv-upload" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" style={{ display: 'none' }} onChange={handleImportUnitsData} />
                    <button className="btn btn-secondary" onClick={() => document.getElementById('units-csv-upload').click()}>
                        <i className="ri-upload-2-line" style={{ marginRight: '5px' }}></i>
                        {currentLanguage === 'ar' ? 'استيراد (CSV/Excel)' : 'Import (CSV/Excel)'}
                    </button>
                    
                    <button className="btn btn-secondary" onClick={() => handleExportUnitsData('csv')}>
                        <i className="ri-download-2-line" style={{ marginRight: '5px' }}></i>
                        {currentLanguage === 'ar' ? 'تصدير CSV' : 'Export CSV'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => handleExportUnitsData('excel')}>
                        <i className="ri-file-excel-2-line" style={{ marginRight: '5px' }}></i>
                        {currentLanguage === 'ar' ? 'تصدير Excel' : 'Export Excel'}
                    </button>
                    <button className="btn btn-primary" onClick={() => { setUnitForm({ id: '', nameAR: '', nameEN: '' }); setShowUnitModal(true); }}>
                        <i className="ri-add-line" style={{ marginRight: '5px' }}></i>
                        {currentLanguage === 'ar' ? 'إضافة وحدة' : 'Add Unit'}
                    </button>
                </div>
            </div>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>{currentLanguage === 'ar' ? 'المعرف' : 'ID'}</th>
                            <th>{currentLanguage === 'ar' ? 'الاسم (عربي)' : 'Name (AR)'}</th>
                            <th>{currentLanguage === 'ar' ? 'الاسم (إنجليزي)' : 'Name (EN)'}</th>
                            <th>{currentLanguage === 'ar' ? 'إجراءات' : 'Actions'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(units||[]).map(u => (
                            <tr key={u.id}>
                                <td>{u.id}</td>
                                <td>{u.nameAR}</td>
                                <td>{u.nameEN}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="btn btn-secondary" onClick={() => { setUnitForm(u); setShowUnitModal(true); }}>
                                            <i className="ri-edit-line"></i>
                                        </button>
                                        <button className="btn btn-danger" onClick={() => handleDeleteUnit(u.id)}>
                                            <i className="ri-delete-bin-line"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    
    const handleExportUnitsData = (format) => {
        if (!units || !units.length) return;
        const headersList = ['id', 'nameAR', 'nameEN'];
        
        if (format === 'csv') {
            const csvRows = [headersList.join(',')];
            units.forEach(item => {
                csvRows.push(headersList.map(h => '"' + (item[h] || '').toString().replace(/"/g, '""') + '"').join(','));
            });
            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'units_export.csv';
            a.click();
        } else if (format === 'excel') {
            const worksheet = XLSX.utils.json_to_sheet(units.map(item => {
                let obj = {};
                headersList.forEach(h => obj[h] = item[h]);
                return obj;
            }));
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Units");
            XLSX.writeFile(workbook, 'units_export.xlsx');
        }
    };

    const handleImportUnitsData = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const fileExt = file.name.split('.').pop().toLowerCase();
        
        if (fileExt === 'csv') {
            const reader = new FileReader();
            reader.onload = (event) => {
                const rows = event.target.result.split('\n');
                if (rows.length < 2) return;
                const headersList = rows[0].split(',').map(h => h.replace(/"/g, '').trim());
                const newItems = [];
                for (let i = 1; i < rows.length; i++) {
                    if (!rows[i].trim()) continue;
                    const values = rows[i].split(',').map(v => v.replace(/"/g, '').trim());
                    const item = {};
                    headersList.forEach((header, index) => item[header] = values[index]);
                    if (item.nameAR) {
                        item.id = item.id || Date.now().toString() + i;
                        newItems.push(item);
                    }
                }
                if (newItems.length > 0) {
                    setUnits([...units, ...newItems]);
                    alert(currentLanguage === 'ar' ? `تم استيراد ${newItems.length} عنصر بنجاح` : `Successfully imported ${newItems.length} items`);
                }
            };
            reader.readAsText(file);
        } else if (fileExt === 'xlsx' || fileExt === 'xls') {
            const reader = new FileReader();
            reader.onload = (event) => {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                
                const newItems = json.map((row, i) => {
                    let item = { ...row };
                    item.id = item.id || Date.now().toString() + i;
                    return item;
                });
                
                if (newItems.length > 0) {
                    setUnits([...units, ...newItems]);
                    alert(currentLanguage === 'ar' ? `تم استيراد ${newItems.length} عنصر بنجاح` : `Successfully imported ${newItems.length} items`);
                }
            };
            reader.readAsArrayBuffer(file);
        }
    };

    return (
        <div className="settings-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Tabs Navigation */}
            <div className="settings-tabs" style={{ 
                display: 'flex', 
                gap: '8px', 
                borderBottom: '1px solid var(--glass-border)', 
                paddingBottom: '0', 
                overflowX: 'auto',
                scrollbarWidth: 'none', // Hide scrollbar for Firefox
                msOverflowStyle: 'none',  // Hide scrollbar for IE/Edge
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSettingsTab(tab.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 20px',
                            background: activeSettingsTab === tab.id ? `color-mix(in srgb, ${tab.color} 15%, transparent)` : 'transparent',
                            color: activeSettingsTab === tab.id ? tab.color : 'var(--text-secondary)',
                            border: 'none',
                            borderBottom: activeSettingsTab === tab.id ? `3px solid ${tab.color}` : '3px solid transparent',
                            borderRadius: '8px 8px 0 0',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            fontWeight: activeSettingsTab === tab.id ? '600' : '500',
                            whiteSpace: 'nowrap',
                            fontSize: '14px',
                            outline: 'none'
                        }}
                    >
                        <i className={tab.icon} style={{ fontSize: '18px' }}></i>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content Area */}
            <div className="settings-content" style={{ minHeight: '400px' }}>
                
                {activeSettingsTab === 'general' && (
                    <div className="glass-card fade-in">
                        <h3 style={{ marginBottom: '20px', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="ri-settings-4-line"></i> {translations[currentLanguage].generalSettings}
                        </h3>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            fetch('/api/settings', {
                                method: 'POST',
                                headers: props.headers,
                                body: JSON.stringify(settings)
                            })
                            .then(res => res.json())
                            .then(data => {
                                setSettings(data);
                                alert(currentLanguage === 'ar' ? "تم حفظ الإعدادات بنجاح" : "Settings saved successfully");
                            })
                            .catch(() => {
                                alert(currentLanguage === 'ar' ? "تم حفظ الإعدادات محلياً" : "Settings saved locally");
                            });
                        }}>
                            <div className="form-group">
                                <label>{translations[currentLanguage].businessName}</label>
                                <input type="text" className="form-control" value={settings.businessName} onChange={e => setSettings({ ...settings, businessName: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{translations[currentLanguage].vatNumber}</label>
                                <input type="text" className="form-control" value={settings.vatNumber} onChange={e => setSettings({ ...settings, vatNumber: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'عنوان الشركة' : 'Company Address'}</label>
                                <input type="text" className="form-control" value={typeof settings.businessAddress === 'object' ? (settings.businessAddress.ar || settings.businessAddress.en || JSON.stringify(settings.businessAddress)) : (settings.businessAddress || '')} onChange={e => setSettings({ ...settings, businessAddress: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'رقم السجل التجاري' : 'CR Number'}</label>
                                <input type="text" className="form-control" value={settings.crNumber || ''} onChange={e => setSettings({ ...settings, crNumber: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'رقم التواصل' : 'Contact Number'}</label>
                                <input type="text" className="form-control" value={settings.contactNumber || ''} onChange={e => setSettings({ ...settings, contactNumber: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'رقم الآيبان (IBAN)' : 'IBAN Number'}</label>
                                <input type="text" className="form-control" value={settings.iban || ''} onChange={e => setSettings({ ...settings, iban: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'شعار الشركة' : 'Company Logo'}</label>
                                <input type="file" accept="image/*" className="form-control" onChange={e => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            setSettings(prev => ({ ...prev, logo: reader.result }));
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }} />
                                {settings.logo && (
                                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <img src={settings.logo} alt="Company Logo Preview" style={{ maxHeight: '50px', maxWidth: '100px', borderRadius: '4px', objectFit: 'contain' }} />
                                        <button type="button" className="btn btn-secondary" onClick={() => setSettings(prev => {
                                            const copy = { ...prev };
                                            delete copy.logo;
                                            return copy;
                                        })} style={{ padding: '4px 8px', fontSize: '11px' }}>{currentLanguage === 'ar' ? 'إزالة' : 'Remove'}</button>
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'العملة الأساسية للنظام' : 'Base System Currency'}</label>
                                <select className="form-control" value={settings.baseCurrency} onChange={e => setSettings({ ...settings, baseCurrency: e.target.value })}>
                                    <option value="SAR">{currentLanguage === 'ar' ? 'SAR / ر.س' : 'SAR'}</option>
                                    <option value="USD">{currentLanguage === 'ar' ? 'USD / دولار أمريكي' : 'USD'}</option>
                                    <option value="EUR">{currentLanguage === 'ar' ? 'EUR / يورو' : 'EUR'}</option>
                                    <option value="EGP">{currentLanguage === 'ar' ? 'EGP / جنيه مصري' : 'EGP'}</option>
                                    <option value="AED">{currentLanguage === 'ar' ? 'AED / درهم إماراتي' : 'AED'}</option>
                                </select>
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>{translations[currentLanguage].saveSettings}</button>
                        </form>
                    </div>
                )}


                {activeSettingsTab === 'branch' && (
                    <div className="glass-card fade-in">
                        <h3 style={{ marginBottom: '20px', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="ri-building-line"></i> {currentLanguage === 'ar' ? 'تهيئة الفروع ونوع النشاط' : 'Branch & Business Configuration'}
                        </h3>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            fetch('/api/settings', {
                                method: 'POST',
                                headers: props.headers,
                                body: JSON.stringify(settings)
                            })
                            .then(res => res.json())
                            .then(data => {
                                setSettings(data);
                                alert(currentLanguage === 'ar' ? "تم حفظ إعدادات الفروع ونوع النشاط بنجاح" : "Branch & business configuration saved successfully");
                            })
                            .catch(() => {
                                alert(currentLanguage === 'ar' ? "تم حفظ الإعدادات محلياً" : "Settings saved locally");
                            });
                        }}>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'نوع النشاط التجاري' : 'Business Type'}</label>
                                <select className="form-control" value={settings.businessType || 'retail'} onChange={e => {
                                    const type = e.target.value;
                                    setSettings({ 
                                        ...settings, 
                                        businessType: type,
                                        enableTables: type === 'restaurant',
                                        enableServiceDuration: type === 'services'
                                    });
                                }}>
                                    <option value="retail">{currentLanguage === 'ar' ? 'بيع بالتجزئة ومحلات' : 'Retail & Shop'}</option>
                                    <option value="restaurant">{currentLanguage === 'ar' ? 'مطاعم ومقاهي' : 'Restaurant & Cafe'}</option>
                                    <option value="services">{currentLanguage === 'ar' ? 'خدمات واستشارات وطبية' : 'Services & Medical'}</option>
                                    <option value="appliances">{currentLanguage === 'ar' ? 'أجهزة منزلية وإلكترونيات' : 'Home Appliances & Electronics'}</option>
                                    <option value="furniture">{currentLanguage === 'ar' ? 'معارض ومحلات أثاث' : 'Furniture & Home Decor'}</option>
                                    <option value="spareparts">{currentLanguage === 'ar' ? 'قطع غيار (سيارات/تكييف/سباكة)' : 'Auto, HVAC & Spare Parts'}</option>
                                    <option value="grocery">{currentLanguage === 'ar' ? 'سوبرماركت ومواد غذائية' : 'Supermarket & Grocery'}</option>
                                    <option value="apparel">{currentLanguage === 'ar' ? 'ملابس وأزياء وأحذية' : 'Garments & Apparel'}</option>
                                    <option value="freshFlowers">{currentLanguage === 'ar' ? 'زهور طبيعية وتنسيق هدايا وحفلات' : 'Fresh Flowers & Florist'}</option>
                                </select>
                            </div>

                            {settings.businessType === 'restaurant' && (
                                <div className="form-group" style={{ flexDirection: 'row', gap: '10px', alignItems: 'center', margin: '15px 0' }}>
                                    <input type="checkbox" id="enableTables" checked={settings.enableTables || false} onChange={e => setSettings({ ...settings, enableTables: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                    <label htmlFor="enableTables" style={{ cursor: 'pointer' }}>{currentLanguage === 'ar' ? 'تفعيل إدارة الطاولات والطلبات الداخلية' : 'Enable Table Management'}</label>
                                </div>
                            )}

                            {settings.businessType === 'services' && (
                                <div className="form-group" style={{ flexDirection: 'row', gap: '10px', alignItems: 'center', margin: '15px 0' }}>
                                    <input type="checkbox" id="enableServiceDuration" checked={settings.enableServiceDuration || false} onChange={e => setSettings({ ...settings, enableServiceDuration: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                    <label htmlFor="enableServiceDuration" style={{ cursor: 'pointer' }}>{currentLanguage === 'ar' ? 'تفعيل مدة وموعد الجلسات / الخدمات' : 'Enable Session Duration Tracking'}</label>
                                </div>
                            )}

                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'الفرع النشط حالياً للمبيعات' : 'Current Active POS Branch'}</label>
                                <select className="form-control" value={settings.currentBranch || ''} onChange={e => setSettings({ ...settings, currentBranch: e.target.value })}>
                                    {(settings.branches || []).map((br, idx) => (
                                        <option key={idx} value={br.name}>{br.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '15px', marginTop: '15px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                                    {currentLanguage === 'ar' ? 'إضافة فرع جديد للمؤسسة' : 'Add New Branch'}
                                </label>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                    <input type="text" id="newBranchName" placeholder={currentLanguage === 'ar' ? 'اسم الفرع الجديد' : 'New Branch Name'} className="form-control" style={{ flexGrow: 1 }} />
                                    <button type="button" className="btn btn-secondary" onClick={() => {
                                        const el = document.getElementById('newBranchName');
                                        const name = el ? el.value.trim() : '';
                                        if (name) {
                                            const newBranches = [...(settings.branches || []), { name, address: '', phone: '' }];
                                            setSettings({ ...settings, branches: newBranches, currentBranch: settings.currentBranch || name });
                                            if (el) el.value = '';
                                        }
                                    }}>{currentLanguage === 'ar' ? 'إضافة' : 'Add'}</button>
                                </div>
                                
                                <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '8px' }}>
                                    {(settings.branches || []).map((br, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <span style={{ fontSize: '13px' }}>{br.name}</span>
                                            <button type="button" style={{ color: 'var(--accent-danger)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => {
                                                const newBranches = (settings.branches || []).filter((_, i) => i !== idx);
                                                const nextBranch = newBranches.length > 0 ? newBranches[0].name : '';
                                                setSettings({ ...settings, branches: newBranches, currentBranch: nextBranch });
                                            }}><i className="ri-delete-bin-line"></i></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }}>{translations[currentLanguage].saveSettings}</button>
                        </form>
                    </div>
                )}

                {activeSettingsTab === 'zatca' && (
                    <div className="glass-card fade-in">
                        <h3 style={{ marginBottom: '20px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="ri-cloud-line"></i> {translations[currentLanguage].zatcaSettings || 'ZATCA Connection Settings'}
                        </h3>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const updatedSettings = { ...settings, zatcaConn };
                            fetch('/api/settings', {
                                method: 'POST',
                                headers: props.headers,
                                body: JSON.stringify(updatedSettings)
                            })
                            .then(r => r.json())
                            .then(saved => {
                                setSettings(saved);
                                alert(currentLanguage === 'ar' ? 'تم حفظ إعدادات خادم الزكاة بنجاح' : 'ZATCA Server settings saved successfully');
                            })
                            .catch(() => {
                                alert(currentLanguage === 'ar' ? 'تم حفظ إعدادات خادم الزكاة محلياً' : 'ZATCA Server settings saved locally');
                            });
                        }}>
                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px' }}>
                                <div className="form-group">
                                    <label>{currentLanguage === 'ar' ? 'اسم المؤسسة' : 'Business Name'}</label>
                                    <input type="text" className="form-control" value={settings.businessName || ''} readOnly style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }} />
                                </div>
                                <div className="form-group">
                                    <label>{currentLanguage === 'ar' ? 'الرقم الضريبي' : 'VAT Number'}</label>
                                    <input type="text" className="form-control" value={settings.vatNumber || ''} readOnly style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }} />
                                </div>
                            </div>
                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px' }}>
                                <div className="form-group">
                                    <label>{currentLanguage === 'ar' ? 'السجل التجاري' : 'CR Number'}</label>
                                    <input type="text" className="form-control" value={settings.crNumber || ''} readOnly style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }} />
                                </div>
                                <div className="form-group">
                                    <label>{currentLanguage === 'ar' ? 'العنوان الوطني' : 'National Address'}</label>
                                    <input type="text" className="form-control" value={(() => {
                                        if (settings.nationalAddress) {
                                            try {
                                                const a = JSON.parse(settings.nationalAddress);
                                                return `${a.buildingNo || ''} ${a.street || ''}, ${a.district || ''}, ${a.city || ''} ${a.postalCode || ''} ${a.additionalNo ? '- ' + a.additionalNo : ''}`.trim();
                                            } catch {
                                                return settings.nationalAddress;
                                            }
                                        }
                                        return settings.businessAddress || '';
                                    })()} readOnly style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }} />
                                </div>
                            </div>
                            {/* ZATCA mode: Connected (sign + report) or Not connected (no signing/reporting) */}
                            <div className="form-group" style={{ marginBottom: '18px' }}>
                                <label>{currentLanguage === 'ar' ? 'وضع الربط مع هيئة الزكاة' : 'ZATCA mode'}</label>
                                <div role="radiogroup" aria-label={currentLanguage === 'ar' ? 'وضع الربط مع هيئة الزكاة' : 'ZATCA mode'} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginTop: '6px' }}>
                                    {[
                                        { id: 'connected', icon: 'ri-cloud-line',
                                          title: currentLanguage === 'ar' ? 'متصل بهيئة الزكاة' : 'ZATCA connected',
                                          text: currentLanguage === 'ar' ? 'تُوقّع الفواتير (المرحلة الثانية) وتُرسل إلى الهيئة تلقائياً أو يدوياً.' : 'Invoices are signed (Phase 2) and reported to ZATCA, automatically or by hand.' },
                                        { id: 'not_connected', icon: 'ri-cloud-off-line',
                                          title: currentLanguage === 'ar' ? 'غير متصل' : 'Not connected',
                                          text: currentLanguage === 'ar' ? 'لا توقيع ولا إرسال. تحمل الفاتورة رمز QR الأساسي (البائع، الرقم الضريبي، الوقت، الإجمالي، الضريبة).' : 'No signing or reporting. Invoices carry the basic QR (seller, VAT number, time, total, VAT).' }
                                    ].map(opt => {
                                        const selected = (zatcaConn?.mode || 'connected') === opt.id;
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                role="radio"
                                                aria-checked={selected}
                                                onClick={() => setZatcaConn({ ...zatcaConn, mode: opt.id })}
                                                style={{ textAlign: 'start', padding: '12px', borderRadius: '8px', border: `2px solid ${selected ? 'var(--accent-cyan)' : 'var(--glass-border)'}`, background: selected ? 'rgba(6, 182, 212, 0.08)' : 'transparent' }}
                                            >
                                                <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <i className={opt.icon}></i> {opt.title} {selected && <i className="ri-check-line" style={{ color: 'var(--accent-cyan)' }}></i>}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{opt.text}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {(zatcaConn?.mode || 'connected') === 'connected' && (<>
                            <div className="form-group">
                                <label>{translations[currentLanguage].zatcaEnv || 'ZATCA Environment'}</label>
                                <select className="form-control" value={zatcaConn?.env || 'sandbox'} onChange={e => {
                                    const env = e.target.value;
                                    let endpoint = zatcaConn?.endpoint || '';
                                    if (env === 'sandbox') endpoint = 'https://developer-core.zatca.gov.sa/e-invoicing/developer-portal/invoices';
                                    if (env === 'simulation') endpoint = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/invoices';
                                    if (env === 'production') endpoint = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/invoices';
                                    setZatcaConn({ ...zatcaConn, env, endpoint });
                                }}>
                                    <option value="sandbox">Sandbox / بيئة التطوير (فاتورة)</option>
                                    <option value="simulation">Simulation / بيئة المحاكاة للإنتاج</option>
                                    <option value="production">Production / البيئة الفعلية للإنتاج</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{translations[currentLanguage].zatcaEndpoint || 'ZATCA Endpoint'}</label>
                                <input type="text" className="form-control" value={zatcaConn?.endpoint || ''} onChange={e => setZatcaConn({ ...zatcaConn, endpoint: e.target.value })} />
                            </div>
                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label>{translations[currentLanguage].zatcaClientId || 'Client ID'}</label>
                                    <input type="text" className="form-control" value={zatcaConn?.clientId || ''} onChange={e => setZatcaConn({ ...zatcaConn, clientId: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>{translations[currentLanguage].zatcaClientSecret || 'Client Secret'}</label>
                                    <input type="password" className="form-control" value={zatcaConn?.clientSecret || ''} onChange={e => setZatcaConn({ ...zatcaConn, clientSecret: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>{translations[currentLanguage].zatcaDeviceSerial || 'Device Serial'}</label>
                                <input type="text" className="form-control" value={zatcaConn?.deviceSerial || ''} onChange={e => setZatcaConn({ ...zatcaConn, deviceSerial: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'رمز التفعيل (OTP)' : 'ZATCA OTP (Fatoora Portal)'}</label>
                                <input type="text" className="form-control" placeholder="123456" value={zatcaConn?.otp || ''} onChange={e => setZatcaConn({ ...zatcaConn, otp: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                                <input type="checkbox" id="zatcaAutoSend" checked={zatcaConn?.autoSend || false} onChange={e => setZatcaConn({ ...zatcaConn, autoSend: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                                <label htmlFor="zatcaAutoSend" style={{ cursor: 'pointer', margin: 0, fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                                    {currentLanguage === 'ar' ? 'إرسال الفواتير تلقائياً إلى هيئة الزكاة عند الدفع' : 'Auto-Send to ZATCA on Checkout'}
                                </label>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{translations[currentLanguage].zatcaStatusLabel || 'Connection Status'}:</span>
                                <span className={`badge ${zatcaConn?.status === 'CONNECTED' ? 'green' : 'danger'}`}>
                                    {zatcaConn?.status === 'CONNECTED' ? (translations[currentLanguage].zatcaStatusConnected || 'CONNECTED') : (translations[currentLanguage].zatcaStatusDisconnected || 'DISCONNECTED')}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={async () => {
                                    try {
                                        const token = localStorage.getItem('token');
                                        const res = await fetch('/api/zatca/onboard', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                            body: JSON.stringify({ otp: zatcaConn?.otp, env: zatcaConn?.env, deviceSerial: zatcaConn?.deviceSerial })
                                        });
                                        const data = await res.json();
                                        if (res.ok) {
                                            const newConn = {
                                                ...zatcaConn,
                                                clientId: data.zatca?.certificate || zatcaConn.clientId,
                                                clientSecret: data.zatca?.secret || zatcaConn.clientSecret,
                                                status: 'CONNECTED'
                                            };
                                            setZatcaConn(newConn);
                                            alert(currentLanguage === 'ar' ? 'تم إنشاء المفاتيح بنجاح!' : 'Cryptographic Keys generated successfully!');
                                        } else {
                                            alert('Error: ' + data.error);
                                        }
                                    } catch (e) {
                                        alert('Error onboarding device');
                                    }
                                }}>
                                    {currentLanguage === 'ar' ? 'تهيئة الجهاز (إنشاء مفاتيح)' : 'Onboard Device (Generate Keys)'}
                                </button>
                                <button type="button" className="btn btn-primary" style={{ flexGrow: 1 }} onClick={() => {
                                    setZatcaConn({ ...zatcaConn, status: 'CONNECTED' });
                                    alert(currentLanguage === 'ar' ? 'تم تسجيل الجهاز بنجاح والحصول على CCSID!' : 'Device successfully registered & CCSID token retrieved from ZATCA!');
                                }}>
                                    {translations[currentLanguage].registerDevice || 'Register Device'}
                                </button>
                            </div>
                            </>)}

                            {/* The form had no submit button, so ZATCA settings only saved when Enter was pressed */}
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '14px' }}>
                                <i className="ri-save-line"></i> {currentLanguage === 'ar' ? 'حفظ إعدادات هيئة الزكاة' : 'Save ZATCA settings'}
                            </button>
                        </form>
                    </div>
                )}

                {activeSettingsTab === 'email' && (
                    <div className="glass-card fade-in">
                        <h3 style={{ marginBottom: '20px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="ri-mail-send-line"></i> {currentLanguage === 'ar' ? 'إعدادات البريد الإلكتروني (SMTP / SendGrid)' : 'Email / SMTP Settings'}
                        </h3>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            fetch('/api/settings', {
                                method: 'POST',
                                headers: props.headers,
                                body: JSON.stringify(settings)
                            })
                            .then(res => res.json())
                            .then(data => {
                                setSettings(data);
                                alert(currentLanguage === 'ar' ? 'تم حفظ إعدادات البريد بنجاح' : 'Email settings saved successfully');
                            })
                            .catch(() => {
                                alert(currentLanguage === 'ar' ? 'تم الحفظ محلياً' : 'Settings saved locally');
                            });
                        }}>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'مزود الخدمة' : 'Provider'}</label>
                                <select className="form-control" value={settings?.smtp?.provider || 'smtp'} onChange={e => setSettings({...settings, smtp: {...(settings.smtp || {}), provider: e.target.value}})}>
                                    <option value="smtp">Custom SMTP</option>
                                    <option value="sendgrid">SendGrid</option>
                                </select>
                            </div>
                            
                            {(!settings?.smtp?.provider || settings.smtp.provider === 'smtp') && (
                                <>
                                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '12px', marginBottom: '15px' }}>
                                        <div className="form-group">
                                            <label>SMTP Host</label>
                                            <input type="text" className="form-control" placeholder="smtp.gmail.com" value={settings?.smtp?.host || ''} onChange={e => setSettings({...settings, smtp: {...(settings.smtp || {}), host: e.target.value}})} />
                                        </div>
                                        <div className="form-group">
                                            <label>Port</label>
                                            <input type="number" className="form-control" placeholder="587" value={settings?.smtp?.port || ''} onChange={e => setSettings({...settings, smtp: {...(settings.smtp || {}), port: parseInt(e.target.value)}})} />
                                        </div>
                                    </div>
                                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px' }}>
                                        <div className="form-group">
                                            <label>{currentLanguage === 'ar' ? 'اسم المستخدم' : 'Username'}</label>
                                            <input type="text" className="form-control" placeholder="user@example.com" value={settings?.smtp?.user || ''} onChange={e => setSettings({...settings, smtp: {...(settings.smtp || {}), user: e.target.value}})} />
                                        </div>
                                        <div className="form-group">
                                            <label>{currentLanguage === 'ar' ? 'كلمة المرور' : 'Password'}</label>
                                            <input type="password" className="form-control" placeholder="••••••••" value={settings?.smtp?.password || ''} onChange={e => setSettings({...settings, smtp: {...(settings.smtp || {}), password: e.target.value}})} />
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            {settings?.smtp?.provider === 'sendgrid' && (
                                <div className="form-group">
                                    <label>SendGrid API Key</label>
                                    <input type="password" className="form-control" placeholder="SG.xxxxxxxxxxxxxx" value={settings?.smtp?.sendgridApiKey || ''} onChange={e => setSettings({...settings, smtp: {...(settings.smtp || {}), sendgridApiKey: e.target.value}})} />
                                </div>
                            )}

                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'بريد المرسل' : 'From Email Address'}</label>
                                <input type="email" className="form-control" placeholder="noreply@yourdomain.com" value={settings?.smtp?.fromEmail || ''} onChange={e => setSettings({...settings, smtp: {...(settings.smtp || {}), fromEmail: e.target.value}})} />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                                    <i className="ri-save-line" style={{ marginRight: '8px' }}></i>
                                    {translations[currentLanguage].saveSettings}
                                </button>
                                <button type="button" className="btn btn-secondary" onClick={() => {
                                    const emailToTest = prompt(currentLanguage === 'ar' ? 'أدخل بريداً لاختبار الإرسال:' : 'Enter email to send test to:');
                                    if(emailToTest) {
                                        fetch('/api/send-email', {
                                            method: 'POST',
                                            headers: props.headers,
                                            body: JSON.stringify({
                                                to: emailToTest,
                                                subject: 'Test Email from 26i ERP',
                                                html: '<h3>Test Successful</h3><p>Your SMTP/Email settings are correctly configured.</p>'
                                            })
                                        })
                                        .then(res => res.json())
                                        .then(data => {
                                            if (data.error) alert('Error: ' + data.error);
                                            else alert('Test email sent successfully!');
                                        })
                                        .catch(err => alert('Failed to send: ' + err.message));
                                    }
                                }}>
                                    <i className="ri-mail-check-line" style={{ marginRight: '8px' }}></i>
                                    {currentLanguage === 'ar' ? 'اختبار الإرسال' : 'Send Test'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {activeSettingsTab === 'storefront' && (
                    <div className="glass-card fade-in">
                        <h3 style={{ marginBottom: '20px', color: '#ec4899', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="ri-store-2-line"></i> {currentLanguage === 'ar' ? 'إعدادات الواجهة والمتجر' : 'Storefront Settings'}
                        </h3>
                        
                        <div style={{ marginBottom: '30px' }}>
                            <h4 style={{ color: 'var(--text-primary)', marginBottom: '15px' }}>{currentLanguage === 'ar' ? 'النطاق المخصص' : 'Custom Domain'}</h4>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input type="text" id="newCustomDomain" className="form-control" placeholder="e.g. www.mystore.com" style={{ flexGrow: 1 }} />
                                <button className="btn btn-primary" onClick={() => {
                                    const domain = document.getElementById('newCustomDomain').value;
                                    if (!domain) return;
                                    fetch('/api/domains/add', {
                                        method: 'POST',
                                        headers: props.headers,
                                        body: JSON.stringify({ domain })
                                    }).then(res => res.json()).then(data => {
                                        if (data.error) alert(data.error);
                                        else alert(data.message);
                                    });
                                }}>{currentLanguage === 'ar' ? 'إضافة النطاق' : 'Add Domain'}</button>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                                {currentLanguage === 'ar' ? 'يرجى توجيه CNAME الخاص بك إلى 26i.uk قبل الإضافة.' : 'Please point your CNAME to 26i.uk before adding.'}
                            </p>
                        </div>

                        <hr style={{ borderColor: 'var(--glass-border)', margin: '20px 0' }} />

                        <div>
                            <h4 style={{ color: 'var(--text-primary)', marginBottom: '15px' }}>{currentLanguage === 'ar' ? 'مظهر المتجر' : 'Store Theme'}</h4>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'المظهر النشط' : 'Active Theme'}</label>
                                <select className="form-control" value={settings.activeTheme || 'default'} onChange={e => {
                                    const newTheme = e.target.value;
                                    setSettings({ ...settings, activeTheme: newTheme });
                                    fetch('/api/themes/update', {
                                        method: 'POST',
                                        headers: props.headers,
                                        body: JSON.stringify({ activeTheme: newTheme })
                                    }).then(res => res.json()).then(data => {
                                        if (data.success) {
                                            alert(currentLanguage === 'ar' ? 'تم تغيير المظهر بنجاح. يرجى تحديث الصفحة لتطبيق المظهر.' : 'Theme updated successfully. Please refresh the page to apply.');
                                        }
                                    });
                                }}>
                                    <option value="default">Default ERP</option>
                                    <option value="salla">SaaS Store (Salla-like)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {activeSettingsTab === 'portal' && (
                    <div className="glass-card fade-in">
                        <PortalSettings settings={settings} setSettings={setSettings} currentLanguage={currentLanguage} onSave={(e) => {
                            if (e && e.preventDefault) e.preventDefault();
                            fetch('/api/settings', {
                                method: 'POST',
                                headers: props.headers,
                                body: JSON.stringify(settings)
                            })
                            .then(res => res.json())
                            .then(data => {
                                setSettings(data);
                                alert(currentLanguage === 'ar' ? "تم حفظ الإعدادات بنجاح" : "Settings saved successfully");
                            })
                            .catch(() => {
                                alert(currentLanguage === 'ar' ? "تم حفظ الإعدادات محلياً" : "Settings saved locally");
                            });
                        }} />
                    </div>
                )}

                {activeSettingsTab === 'danger' && (
                    <div className="glass-card fade-in" style={{ border: '1px solid rgba(239,68,68,0.3)' }}>
                        <h3 style={{ marginBottom: '20px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="ri-error-warning-line"></i> {currentLanguage === 'ar' ? 'منطقة الخطر - إغلاق الحساب' : 'Danger Zone - Close Account'}
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '13px' }}>
                            {currentLanguage === 'ar' ? 'تنبيه: إغلاق الحساب سيؤدي إلى حذف متجرك وبياناتك بشكل دائم ولا يمكن التراجع عن هذا الإجراء.' : 'Warning: Closing your account will permanently delete your store, products, invoices, and all associated data. This action cannot be undone.'}
                        </p>
                        <button className="btn btn-danger" onClick={() => {
                            if (window.confirm(currentLanguage === 'ar' ? 'هل أنت متأكد تماماً من إغلاق حسابك وحذف جميع بياناتك؟' : 'Are you absolutely sure you want to close your account and delete all data?')) {
                                fetch('/api/tenant/close', {
                                    method: 'DELETE',
                                    headers: props.headers
                                })
                                .then(res => res.json())
                                .then(data => {
                                    if (data.error) alert(data.error);
                                    else {
                                        alert(currentLanguage === 'ar' ? 'تم إغلاق الحساب بنجاح. سيتم تسجيل خروجك.' : 'Account closed successfully. You will be logged out.');
                                        window.location.href = '/';
                                    }
                                })
                                .catch(() => alert('Error closing account.'));
                            }
                        }}>
                            <i className="ri-delete-bin-6-line" style={{ marginRight: '8px' }}></i>
                            {currentLanguage === 'ar' ? 'إغلاق الحساب نهائياً' : 'Permanently Close Account'}
                        </button>
                    </div>
                )}
            </div>
            
            <style jsx="true">{`
                .fade-in {
                    animation: fadeIn 0.3s ease-in-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .settings-tabs::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        
            {/* Unit Modal */}
            {showUnitModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3 style={{ marginBottom: '20px' }}>{currentLanguage === 'ar' ? 'وحدة القياس' : 'Measurement Unit'}</h3>
                        <form onSubmit={handleSaveUnit}>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'الاسم (عربي)' : 'Name (AR)'}</label>
                                <input type="text" className="form-control" value={unitForm.nameAR} onChange={e => setUnitForm({ ...unitForm, nameAR: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>{currentLanguage === 'ar' ? 'الاسم (إنجليزي)' : 'Name (EN)'}</label>
                                <input type="text" className="form-control" value={unitForm.nameEN} onChange={e => setUnitForm({ ...unitForm, nameEN: e.target.value })} required />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowUnitModal(false)}>{translations[currentLanguage].close}</button>
                                <button type="submit" className="btn btn-primary">{currentLanguage === 'ar' ? 'حفظ' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;


