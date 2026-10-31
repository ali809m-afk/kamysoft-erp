import React, { useState } from 'react';

const SECTOR_LABELS = {
    'retail': 'General Retail / تجارة تجزئة عامة',
    'grocery': 'Supermarket & Grocery / سوبرماركت ومواد غذائية',
    'restaurant': 'Restaurant & Cafe / مطعم ومقهى',
    'apparel': 'Apparel & Garments / ملابس وأزياء',
    'appliances': 'Home Appliances & Electronics / أجهزة منزلية وإلكترونيات',
    'furniture': 'Furniture & Home Decor / معرض أثاث ومفروشات',
    'spareparts': 'Spare Parts / قطع غيار',
    'realestate': 'Real Estate Management / إدارة أملاك وعقارات',
    'freshFlowers': 'Fresh Flowers & Florist / زهور طبيعية وتنسيق حفلات',
    'tailoring': 'Bespoke Tailoring & Workshop / خياطة وتفصيل ومشغل'
};

const StoreCreationModal = ({ isOpen, onClose, baseDomain = 'kamysoft.com', isRtl = false, onSuccess }) => {
    const [registerForm, setRegisterForm] = useState({
        tenantId: '',
        email: '',
        mobile: '',
        fullName: '',
        businessName: '',
        businessType: 'retail',
        nationalAddressObj: { buildingNo: '', street: '', district: '', city: '', postalCode: '', additionalNo: '' },
        vatNumber: '',
        crNumber: '',
        adminUsername: '',
        password: ''
    });
    const [registerStatus, setRegisterStatus] = useState(null); // 'submitting', 'success', 'error'
    const [registerError, setRegisterError] = useState('');
    const [registeredTenantId, setRegisteredTenantId] = useState('');
    const [generatedLicenseKey, setGeneratedLicenseKey] = useState(null);

    const handleRegisterChange = (e) => {
        const { name, value } = e.target;
        if (name === 'tenantId') {
            const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
            setRegisterForm(prev => ({ ...prev, [name]: sanitized }));
        } else {
            setRegisterForm(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setRegisterStatus('submitting');
        setRegisterError('');

        try {
            const cleanTenantId = registerForm.tenantId.trim().toLowerCase();
            if (!cleanTenantId || cleanTenantId.length < 3) {
                setRegisterError(isRtl ? 'اسم المتجر يجب أن يكون 3 أحرف على الأقل' : 'Store Subdomain must be at least 3 characters');
                setRegisterStatus('error');
                return;
            }

            const payload = {
                ...registerForm,
                tenantId: cleanTenantId,
                billingCycle: 'monthly'
            };
            if (registerForm.nationalAddressObj) {
                payload.nationalAddress = JSON.stringify(registerForm.nationalAddressObj);
            }

            const response = await fetch('/api/auth/register-tenant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            
            if (response.ok && data.success !== false) {
                setRegisterStatus('success');
                setRegisteredTenantId(cleanTenantId);
                localStorage.setItem('lastRegisteredUsername', registerForm.adminUsername);
                if (data.licenseKey) {
                    setGeneratedLicenseKey(data.licenseKey);
                }
                if (onSuccess) onSuccess(data);
            } else {
                setRegisterStatus('error');
                setRegisterError(data.error || (isRtl ? 'حدث خطأ أثناء الإنشاء' : 'Error creating store'));
            }
        } catch (err) {
            setRegisterStatus('error');
            setRegisterError(isRtl ? 'خطأ في الاتصال بالخادم' : 'Server connection failed');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={() => registerStatus !== 'submitting' && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, animation: 'fadeIn 0.3s ease-out' }}>
            <div className="modal glass-card" onClick={(e) => e.stopPropagation()} style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', width: '520px', maxWidth: '95vw', borderRadius: '12px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'slideUp 0.4s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#fff' }}>
                        {registerStatus === 'success' 
                            ? (isRtl ? 'تم تهيئة المتجر بنجاح!' : 'Store Provisioned!') 
                            : (isRtl ? 'أنشئ متجرك السحابي الخاص' : 'Create Your Cloud Store')}
                    </h3>
                    {registerStatus !== 'submitting' && (
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'rgba(255,255,255,0.5)' }}>
                            <i className="ri-close-line"></i>
                        </button>
                    )}
                </div>

                {registerStatus === 'success' ? (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        <div style={{ fontSize: '64px', color: '#10b981', marginBottom: '16px' }}>
                            <i className="ri-checkbox-circle-line"></i>
                        </div>
                        <h4 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px', color: '#fff' }}>
                            {isRtl ? 'تم إنشاء متجرك وتخصيصه!' : 'Your Store is Ready!'}
                        </h4>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
                            {isRtl 
                                ? `تم إنشاء قاعدة بيانات معزولة لمتجرك وتعبئته بالمنتجات التجريبية.`
                                : `Your isolated database workspace is ready and loaded with demo products.`}
                        </p>
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
                                {isRtl ? 'اسم مستخدم المدير:' : 'Admin Username:'} <strong style={{ color: '#fff' }}>{registerForm.adminUsername}</strong>
                        </div>
                        <div style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '8px', padding: '10px 16px', marginBottom: '12px', fontFamily: 'monospace', fontSize: '14px', color: '#a78bfa', wordBreak: 'break-all' }}>
                            https://{registerForm.tenantId.toLowerCase()}.{baseDomain}
                        </div>

                        {generatedLicenseKey && (
                            <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
                                <div style={{ fontSize: '12px', color: '#34d399', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>{isRtl ? 'حالة المتجر' : 'Store Status'}</div>
                                <div style={{ fontFamily: 'sans-serif', fontSize: '18px', color: '#10b981', fontWeight: 'bold' }}>{isRtl ? 'تجربة مجانية لمدة 14 يومًا' : '14-Day Free Trial Active'}</div>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button 
                                onClick={() => {
                                    onClose();
                                    window.location.href = `http://${registeredTenantId || registerForm.tenantId.toLowerCase()}.${baseDomain}/login`;
                                }}
                                style={{ flex: 1, padding: '12px', fontSize: '15px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}
                            >
                                <i className="ri-login-box-line" style={{ marginRight: '8px' }}></i>
                                <span>{isRtl ? 'الانتقال لصفحة الدخول' : 'Go to Login Page'}</span>
                            </button>
                            <button 
                                onClick={onClose}
                                style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '14px' }}
                            >
                                {isRtl ? 'إغلاق' : 'Close'}
                            </button>
                        </div>
                    </div>

                ) : (
                    <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: isRtl ? 'right' : 'left' }} dir={isRtl ? 'rtl' : 'ltr'}>
                        {registerStatus === 'error' && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '4px', padding: '10px 14px', color: '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="ri-error-warning-line"></i>
                                <span>{registerError}</span>
                            </div>
                        )}
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>
                                {isRtl ? 'رابط المتجر الفرعي (الأحرف اللاتينية والأرقام والشرطة فقط)' : 'Store Subdomain (Alphanumeric/hyphen only)'}
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                                <input 
                                    type="text" 
                                    name="tenantId"
                                    value={registerForm.tenantId}
                                    onChange={handleRegisterChange}
                                    required
                                    placeholder="my-store"
                                    style={{ flexGrow: 1, background: 'none', border: 'none', outline: 'none', padding: '10px 12px', color: '#fff', fontSize: '14px' }}
                                />
                                <span style={{ padding: '0 12px', fontSize: '13px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.02)', borderLeft: isRtl ? 'none' : '1px solid rgba(255,255,255,0.1)', borderRight: isRtl ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>.{baseDomain}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>
                                {isRtl ? 'البريد الإلكتروني' : 'Email Address'}
                            </label>
                            <input 
                                type="email" 
                                name="email"
                                value={registerForm.email}
                                onChange={handleRegisterChange}
                                required
                                placeholder="owner@mystore.com"
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', outline: 'none', padding: '10px 12px', color: '#fff', fontSize: '14px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>
                                {isRtl ? 'رقم الجوال' : 'Mobile Number'}
                            </label>
                            <input 
                                type="tel" 
                                name="mobile"
                                value={registerForm.mobile}
                                onChange={handleRegisterChange}
                                required
                                placeholder="+966 5X XXX XXXX"
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', outline: 'none', padding: '10px 12px', color: '#fff', fontSize: '14px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>
                                {isRtl ? 'الاسم الكامل للمالك' : 'Owner Full Name'}
                            </label>
                            <input 
                                type="text" 
                                name="fullName"
                                value={registerForm.fullName}
                                onChange={handleRegisterChange}
                                required
                                placeholder={isRtl ? 'خليل الغامدي' : 'Khalil Al-Ghamdi'}
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>
                                {isRtl ? 'اسم المتجر / المنشأة' : 'Store / Business Name'}
                            </label>
                            <input 
                                type="text" 
                                name="businessName"
                                value={registerForm.businessName}
                                onChange={handleRegisterChange}
                                required
                                placeholder={isRtl ? 'معرض الأمل للأجهزة' : 'Al-Amal Store'}
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>
                                {isRtl ? 'نوع النشاط التجاري' : 'Business Sector'}
                            </label>
                            <select 
                                name="businessType"
                                value={registerForm.businessType}
                                onChange={handleRegisterChange}
                                style={{ background: '#0a0a12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none', width: '100%' }}
                            >
                                {Object.entries(SECTOR_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>
                                {isRtl ? 'العنوان الوطني' : 'National Address'}
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <input type="text" placeholder={isRtl ? 'رقم المبنى (4 أرقام)' : 'Building No (4 digits)'} 
                                    value={registerForm.nationalAddressObj.buildingNo}
                                    onChange={e => setRegisterForm({ ...registerForm, nationalAddressObj: { ...registerForm.nationalAddressObj, buildingNo: e.target.value } })}
                                    required pattern="\d{4}" maxLength="4" title="4 digits"
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                                <input type="text" placeholder={isRtl ? 'اسم الشارع' : 'Street Name'} 
                                    value={registerForm.nationalAddressObj.street}
                                    onChange={e => setRegisterForm({ ...registerForm, nationalAddressObj: { ...registerForm.nationalAddressObj, street: e.target.value } })}
                                    required
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                                <input type="text" placeholder={isRtl ? 'الحي' : 'District'} 
                                    value={registerForm.nationalAddressObj.district}
                                    onChange={e => setRegisterForm({ ...registerForm, nationalAddressObj: { ...registerForm.nationalAddressObj, district: e.target.value } })}
                                    required
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                                <input type="text" placeholder={isRtl ? 'المدينة' : 'City'} 
                                    value={registerForm.nationalAddressObj.city}
                                    onChange={e => setRegisterForm({ ...registerForm, nationalAddressObj: { ...registerForm.nationalAddressObj, city: e.target.value } })}
                                    required
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                                <input type="text" placeholder={isRtl ? 'الرمز البريدي (5 أرقام)' : 'Postal Code (5 digits)'} 
                                    value={registerForm.nationalAddressObj.postalCode}
                                    onChange={e => setRegisterForm({ ...registerForm, nationalAddressObj: { ...registerForm.nationalAddressObj, postalCode: e.target.value } })}
                                    required pattern="\d{5}" maxLength="5" title="5 digits"
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                                <input type="text" placeholder={isRtl ? 'الرقم الإضافي (اختياري)' : 'Additional No'} 
                                    value={registerForm.nationalAddressObj.additionalNo}
                                    onChange={e => setRegisterForm({ ...registerForm, nationalAddressObj: { ...registerForm.nationalAddressObj, additionalNo: e.target.value } })}
                                    pattern="\d{4}" maxLength="4" title="4 digits"
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>
                                    {isRtl ? 'الرقم الضريبي (VAT)' : 'VAT Number'}
                                </label>
                                <input 
                                    type="text" 
                                    name="vatNumber"
                                    value={registerForm.vatNumber}
                                    onChange={handleRegisterChange}
                                    required
                                    placeholder="310..."
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>
                                    {isRtl ? 'السجل التجاري (CR)' : 'CR Number'}
                                </label>
                                <input 
                                    type="text" 
                                    name="crNumber"
                                    value={registerForm.crNumber}
                                    onChange={handleRegisterChange}
                                    required
                                    placeholder="1010..."
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>
                                    {isRtl ? 'اسم مستخدم المدير' : 'Admin Username'}
                                </label>
                                <input 
                                    type="text" 
                                    name="adminUsername"
                                    value={registerForm.adminUsername}
                                    onChange={handleRegisterChange}
                                    required
                                    placeholder="admin"
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>
                                    {isRtl ? 'كلمة المرور' : 'Password'}
                                </label>
                                <input 
                                    type="password" 
                                    name="password"
                                    value={registerForm.password}
                                    onChange={handleRegisterChange}
                                    required
                                    placeholder="Enter strong password"
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none' }}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={registerStatus === 'submitting'}
                            style={{ marginTop: '12px', padding: '12px', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', width: '100%', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', opacity: registerStatus === 'submitting' ? 0.7 : 1 }}
                        >
                            {registerStatus === 'submitting' ? (
                                <>
                                    <span style={{ width: '16px', height: '16px', border: '2px solid', borderRightColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.75s linear infinite' }}></span>
                                    <span>{isRtl ? 'جاري تهيئة النظام...' : 'Provisioning store...'}</span>
                                </>
                            ) : (
                                <>
                                    <i className="ri-checkbox-circle-line"></i>
                                    <span>{isRtl ? 'إنشاء متجري وتفعيله' : 'Create & Activate My Store'}</span>
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default StoreCreationModal;
