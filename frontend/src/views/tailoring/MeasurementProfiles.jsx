import React, { useState, useEffect } from 'react';

const GARMENT_TYPES = [
    { value: 'Thobe', labelEn: 'Saudi Thobe (ثوب رجالي)', labelAr: 'ثوب رجالي' },
    { value: 'Suit', labelEn: 'Formal Suit (بدلة رسمية)', labelAr: 'بدلة رسمية' },
    { value: 'Shirt', labelEn: 'Dress Shirt (قميص)', labelAr: 'قميص' },
    { value: 'Trouser', labelEn: 'Trouser / Pants (بنطلون)', labelAr: 'بنطلون' },
    { value: 'Abaya', labelEn: 'Abaya (عباءة نسائية)', labelAr: 'عباءة نسائية' },
    { value: 'Dress', labelEn: 'Evening Dress (فستان)', labelAr: 'فستان' },
    { value: 'Uniform', labelEn: 'Corporate Uniform (زي موحد)', labelAr: 'زي موحد' }
];

const MEASUREMENT_FIELDS = [
    { key: 'length', en: 'Full Length (الطول الكلي)', ar: 'الطول الكلي' },
    { key: 'shoulder', en: 'Shoulder Width (الكتف)', ar: 'عرض الكتف' },
    { key: 'chest', en: 'Chest / Bust (الصدر)', ar: 'وسع الصدر' },
    { key: 'waist', en: 'Waist (الخصر / الوسط)', ar: 'وسع الوسط' },
    { key: 'hips', en: 'Hips / Seat (الأرداف / الورك)', ar: 'وسع الورك' },
    { key: 'sleeveLength', en: 'Sleeve Length (طول الكم)', ar: 'طول الكم' },
    { key: 'wrist', en: 'Wrist / Cuff (المعصم / الكبك)', ar: 'وسع المعصم / الكبك' },
    { key: 'neck', en: 'Neck / Collar (الرقبة / القلاب)', ar: 'مقاس الرقبة / القلاب' },
    { key: 'armhole', en: 'Armhole / Bicep (حفرة الإبط / العضد)', ar: 'وسع الكم العلوي (حفرة الإبط)' },
    { key: 'bottomWidth', en: 'Bottom Hem Width (وسع الخطوة / الأسفل)', ar: 'وسع الخطوة (أسفل الثوب)' },
    { key: 'trouserLength', en: 'Trouser Length (طول البنطلون)', ar: 'طول البنطلون / السروال' },
    { key: 'inseam', en: 'Inseam (الحجر / السرج)', ar: 'طول الحجر' }
];

const STYLE_OPTIONS = {
    collarType: [
        'Mandarin (قلاب صيني)',
        'Classic Pointed (قلاب رسمي)',
        'Round Collar (قلاب دائري)',
        'Double Button Collar (قلاب زرارين)',
        'Collarless / Open (سادة بدون قلاب)'
    ],
    cuffType: [
        'Plain Sleeve (كم سادة)',
        'Single Button Cuff (كبك زرار)',
        'French Cufflinks (كبك فرنسي مزدوج)',
        'Embroidered Cuff (كم مطرز)'
    ],
    placketType: [
        'Hidden Buttons (جبزور مخفي)',
        'Visible Buttons (جبزور ظاهر)',
        'Hidden Zipper (سحاب مخفي)',
        'Snap Buttons (طقطق معدن)'
    ],
    pocketStyle: [
        'Classic Chest + 2 Side (جيب علوي + ٢ جانبي)',
        'Slanted Chest + Coin Pocket (جيب مائل + جيب جوال)',
        'Hidden Side Pockets Only (جيوب جانبية مخفية فقط)'
    ],
    fitType: [
        'Regular (عادي مريح)',
        'Slim Fit (مخصر)',
        'Loose / Comfort (واسع تقليدي)'
    ],
    stitchType: [
        'Single Hidden (خياطة مخفية)',
        'Double Edge Stitch (تدريز مزدوج)',
        'Hand Pick Stitch (غرزة يدوية)'
    ]
};

const emptyProfile = {
    customerId: '',
    customerName: '',
    customerPhone: '',
    profileName: '',
    garmentType: 'Thobe',
    unit: 'inch',
    measurements: {
        length: '58',
        shoulder: '17.5',
        chest: '22',
        waist: '21',
        hips: '23',
        sleeveLength: '25',
        wrist: '9',
        neck: '15.5',
        armhole: '10',
        bottomWidth: '28',
        trouserLength: '',
        inseam: ''
    },
    stylePreferences: {
        collarType: STYLE_OPTIONS.collarType[0],
        cuffType: STYLE_OPTIONS.cuffType[0],
        placketType: STYLE_OPTIONS.placketType[0],
        pocketStyle: STYLE_OPTIONS.pocketStyle[0],
        fitType: STYLE_OPTIONS.fitType[0],
        stitchType: STYLE_OPTIONS.stitchType[0],
        buttonStyle: 'Standard Pearl',
        embroideryNotes: ''
    },
    postureNotes: ''
};

const MeasurementProfiles = ({ customers = [], currentLanguage, settings, setActiveTab }) => {
    const isAr = currentLanguage === 'ar';
    const [profiles, setProfiles] = useState([]);
    const [search, setSearch] = useState('');
    const [filterGarment, setFilterGarment] = useState('ALL');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyProfile);
    const [printProfile, setPrintProfile] = useState(null);

    const fetchProfiles = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/tailoring/measurements', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setProfiles(await res.json());
            }
        } catch (err) {
            console.error('Error loading measurement profiles:', err);
        }
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    const handleCustomerSelect = (custId) => {
        const cust = customers.find(c => c.id === custId);
        if (cust) {
            setForm(prev => ({
                ...prev,
                customerId: cust.id,
                customerName: cust.name,
                customerPhone: cust.phone || '',
                profileName: prev.profileName || `${cust.name} - ${prev.garmentType}`
            }));
        } else {
            setForm(prev => ({ ...prev, customerId: custId }));
        }
    };

    const handleOpenNew = () => {
        setEditingId(null);
        setForm(emptyProfile);
        setShowModal(true);
    };

    const handleOpenEdit = (prof) => {
        setEditingId(prof.id);
        setForm({
            ...emptyProfile,
            ...prof,
            measurements: { ...emptyProfile.measurements, ...(prof.measurements || {}) },
            stylePreferences: { ...emptyProfile.stylePreferences, ...(prof.stylePreferences || {}) }
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.customerName || !form.profileName) {
            alert(isAr ? 'يرجى إدخال اسم العميل واسم ملف المقاس' : 'Please enter customer name and profile name');
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const url = editingId ? `/api/tailoring/measurements/${editingId}` : '/api/tailoring/measurements';
            const method = editingId ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(form)
            });
            if (res.ok) {
                setShowModal(false);
                fetchProfiles();
            }
        } catch (err) {
            console.error('Failed to save measurement profile:', err);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(isAr ? 'هل أنت متأكد من حذف ملف المقاسات؟' : 'Delete this measurement profile?')) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/tailoring/measurements/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) fetchProfiles();
        } catch (err) {
            console.error('Delete measurement error:', err);
        }
    };

    const filteredProfiles = profiles.filter(p => {
        const matchesGarment = filterGarment === 'ALL' || p.garmentType === filterGarment;
        const q = search.toLowerCase();
        const matchesSearch = !q ||
            (p.customerName || '').toLowerCase().includes(q) ||
            (p.customerPhone || '').toLowerCase().includes(q) ||
            (p.profileName || '').toLowerCase().includes(q) ||
            (p.id || '').toLowerCase().includes(q);
        return matchesGarment && matchesSearch;
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header */}
            <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="ri-ruler-2-line" style={{ color: 'var(--accent-cyan)' }}></i>
                        {isAr ? 'سجل مقاسات العملاء وتفضيلات التصميم' : 'Customer Measurement Profiles & Style Preferences'}
                    </h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {isAr
                            ? 'حفظ مقاسات متعددة لكل عميل وأفراد العائلة مع خيارات الياقة، الكبك، الجبزور، والتطريز'
                            : 'Manage multiple body measurement templates and collar/cuff/placket preferences per customer'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-primary" onClick={handleOpenNew}>
                        <i className="ri-add-line"></i> {isAr ? 'إضافة ملف مقاس جديد' : 'New Measurement Profile'}
                    </button>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="glass-card" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: '1 1 260px' }}>
                    <input
                        type="text"
                        className="form-control"
                        placeholder={isAr ? 'بحث باسم العميل، رقم الجوال، أو اسم المقاس...' : 'Search by customer name, phone, or profile...'}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                        className={`btn ${filterGarment === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilterGarment('ALL')}
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                        {isAr ? 'الكل' : 'All'} ({profiles.length})
                    </button>
                    {GARMENT_TYPES.map(gt => (
                        <button
                            key={gt.value}
                            className={`btn ${filterGarment === gt.value ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilterGarment(gt.value)}
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                            {isAr ? gt.labelAr : gt.value}
                        </button>
                    ))}
                </div>
            </div>

            {/* Profiles Cards Grid */}
            {filteredProfiles.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-secondary)' }}>
                    <i className="ri-ruler-line" style={{ fontSize: '42px', opacity: 0.4, display: 'block', marginBottom: '10px' }}></i>
                    <p>{isAr ? 'لا توجد ملفات مقاسات مطابقة. اضغط على "إضافة ملف مقاس جديد" للبدء.' : 'No measurement profiles found. Click "New Measurement Profile" to create one.'}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                    {filteredProfiles.map(prof => {
                        const m = prof.measurements || {};
                        const s = prof.stylePreferences || {};
                        return (
                            <div key={prof.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <span className="badge cyan" style={{ marginBottom: '6px', display: 'inline-block' }}>
                                            {prof.garmentType} • {prof.unit === 'cm' ? 'CM' : 'INCH'}
                                        </span>
                                        <h3 style={{ margin: 0, fontSize: '16px' }}>{prof.profileName}</h3>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                            <i className="ri-user-line"></i> {prof.customerName} {prof.customerPhone ? `• ${prof.customerPhone}` : ''}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{prof.id}</span>
                                </div>

                                {/* Key Measurements Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                                    {[
                                        { k: 'length', lbl: isAr ? 'الطول' : 'Length' },
                                        { k: 'shoulder', lbl: isAr ? 'الكتف' : 'Shoulder' },
                                        { k: 'chest', lbl: isAr ? 'الصدر' : 'Chest' },
                                        { k: 'waist', lbl: isAr ? 'الوسط' : 'Waist' },
                                        { k: 'sleeveLength', lbl: isAr ? 'الكم' : 'Sleeve' },
                                        { k: 'wrist', lbl: isAr ? 'المعصم' : 'Wrist' },
                                        { k: 'neck', lbl: isAr ? 'الرقبة' : 'Neck' },
                                        { k: 'bottomWidth', lbl: isAr ? 'الخطوة' : 'Hem' }
                                    ].map(item => (
                                        <div key={item.k} style={{ textAlign: 'center', padding: '4px' }}>
                                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{item.lbl}</div>
                                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                                                {m[item.k] || '-'}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Style Preferences Summary */}
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                    <div><strong>{isAr ? 'القلاب / الياقة:' : 'Collar:'}</strong> {s.collarType}</div>
                                    <div><strong>{isAr ? 'الأكمام / الكبك:' : 'Cuff:'}</strong> {s.cuffType}</div>
                                    <div><strong>{isAr ? 'الجبزور:' : 'Placket:'}</strong> {s.placketType} ({s.fitType})</div>
                                    {prof.postureNotes && (
                                        <div style={{ marginTop: '4px', color: 'var(--accent-cyan)' }}>
                                            <i className="ri-Sticky-note-line"></i> {prof.postureNotes}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--glass-border)' }}>
                                    <button
                                        className="btn btn-primary"
                                        style={{ flex: 1, fontSize: '12px', padding: '6px 10px' }}
                                        onClick={() => {
                                            localStorage.setItem('selectedTailoringProfileId', prof.id);
                                            if (setActiveTab) setActiveTab('tailoring_orders');
                                        }}
                                    >
                                        <i className="ri-scissors-cut-line"></i> {isAr ? 'تفصيل بهذا المقاس' : 'New Order'}
                                    </button>
                                    <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => setPrintProfile(prof)} title={isAr ? 'طباعة بطاقة المقاس' : 'Print Measurement Card'}>
                                        <i className="ri-printer-line"></i>
                                    </button>
                                    <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => handleOpenEdit(prof)}>
                                        <i className="ri-edit-line"></i>
                                    </button>
                                    <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDelete(prof.id)}>
                                        <i className="ri-delete-bin-line"></i>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create / Edit Measurement Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '820px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0 }}>
                                <i className="ri-ruler-2-line" style={{ color: 'var(--accent-cyan)', marginRight: '8px' }}></i>
                                {editingId ? (isAr ? 'تعديل ملف المقاسات' : 'Edit Measurement Profile') : (isAr ? 'إنشاء ملف مقاسات جديد' : 'New Customer Measurement Profile')}
                            </h3>
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Customer & Garment Info */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{isAr ? 'اختر من العملاء المسجلين' : 'Select Existing Customer'}</label>
                                    <select className="form-control" value={form.customerId} onChange={e => handleCustomerSelect(e.target.value)}>
                                        <option value="">{isAr ? '-- أو أدخل عميل يدوياً --' : '-- Or type customer below --'}</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name} ({c.phone || 'No Phone'})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{isAr ? 'اسم العميل *' : 'Customer Name *'}</label>
                                    <input type="text" className="form-control" required value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{isAr ? 'رقم الجوال' : 'Mobile Phone'}</label>
                                    <input type="text" className="form-control" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr', gap: '12px' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{isAr ? 'تسمية ملف المقاس * (مثال: ثوب شتوي - أحمد)' : 'Profile Label * (e.g. Winter Thobe - Ahmed)'}</label>
                                    <input type="text" className="form-control" required value={form.profileName} onChange={e => setForm({ ...form, profileName: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{isAr ? 'نوع القطعة' : 'Garment Type'}</label>
                                    <select className="form-control" value={form.garmentType} onChange={e => setForm({ ...form, garmentType: e.target.value })}>
                                        {GARMENT_TYPES.map(g => (
                                            <option key={g.value} value={g.value}>{isAr ? g.labelAr : g.labelEn}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{isAr ? 'وحدة القياس' : 'Measurement Unit'}</label>
                                    <select className="form-control" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                                        <option value="inch">{isAr ? 'إنش (Inch)' : 'Inches (in)'}</option>
                                        <option value="cm">{isAr ? 'سنتيمتر (CM)' : 'Centimeters (cm)'}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Body Measurements Section */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                                <h4 style={{ margin: '0 0 12px 0', color: 'var(--accent-gold)', fontSize: '14px' }}>
                                    <i className="ri-Compass-3-line"></i> {isAr ? `قياسات الجسم (${form.unit === 'cm' ? 'سم' : 'إنش'})` : `Body Measurements (${form.unit.toUpperCase()})`}
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '10px' }}>
                                    {MEASUREMENT_FIELDS.map(f => (
                                        <div key={f.key} className="form-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '11px' }}>{isAr ? f.ar : f.en}</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="0.0"
                                                value={form.measurements[f.key] || ''}
                                                onChange={e => setForm({
                                                    ...form,
                                                    measurements: { ...form.measurements, [f.key]: e.target.value }
                                                })}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Style & Design Preferences */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                                <h4 style={{ margin: '0 0 12px 0', color: 'var(--accent-purple)', fontSize: '14px' }}>
                                    <i className="ri-palette-line"></i> {isAr ? 'تفضيلات الموديل والتصميم (القلاب، الكبك، الجبزور)' : 'Garment Style & Customization Preferences'}
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '12px' }}>{isAr ? 'نوع القلاب / الياقة' : 'Collar Style'}</label>
                                        <select className="form-control" value={form.stylePreferences.collarType} onChange={e => setForm({ ...form, stylePreferences: { ...form.stylePreferences, collarType: e.target.value } })}>
                                            {STYLE_OPTIONS.collarType.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '12px' }}>{isAr ? 'نوع الكم / الكبك' : 'Cuff / Sleeve Style'}</label>
                                        <select className="form-control" value={form.stylePreferences.cuffType} onChange={e => setForm({ ...form, stylePreferences: { ...form.stylePreferences, cuffType: e.target.value } })}>
                                            {STYLE_OPTIONS.cuffType.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '12px' }}>{isAr ? 'نوع الجبزور (فتحة الصدر)' : 'Front Placket Style'}</label>
                                        <select className="form-control" value={form.stylePreferences.placketType} onChange={e => setForm({ ...form, stylePreferences: { ...form.stylePreferences, placketType: e.target.value } })}>
                                            {STYLE_OPTIONS.placketType.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '12px' }}>{isAr ? 'تفصيل الجيوب' : 'Pocket Configuration'}</label>
                                        <select className="form-control" value={form.stylePreferences.pocketStyle} onChange={e => setForm({ ...form, stylePreferences: { ...form.stylePreferences, pocketStyle: e.target.value } })}>
                                            {STYLE_OPTIONS.pocketStyle.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '12px' }}>{isAr ? 'درجة الوسع / القصة' : 'Fit Type'}</label>
                                        <select className="form-control" value={form.stylePreferences.fitType} onChange={e => setForm({ ...form, stylePreferences: { ...form.stylePreferences, fitType: e.target.value } })}>
                                            {STYLE_OPTIONS.fitType.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '12px' }}>{isAr ? 'نوع الخياطة والتدريز' : 'Stitching Type'}</label>
                                        <select className="form-control" value={form.stylePreferences.stitchType} onChange={e => setForm({ ...form, stylePreferences: { ...form.stylePreferences, stitchType: e.target.value } })}>
                                            {STYLE_OPTIONS.stitchType.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '12px' }}>{isAr ? 'ملاحظات التطريز / الأزرار' : 'Embroidery & Button Notes'}</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder={isAr ? 'مثال: تطريز ذهبي خفيف على الأطراف...' : 'e.g. Gold monogram on cuff...'}
                                            value={form.stylePreferences.embroideryNotes || ''}
                                            onChange={e => setForm({ ...form, stylePreferences: { ...form.stylePreferences, embroideryNotes: e.target.value } })}
                                        />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '12px' }}>{isAr ? 'ملاحظات القوام والوقفة (للقصاص)' : 'Body Posture Notes (for Cutter)'}</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder={isAr ? 'مثال: الكتف الأيمن نازل قليلاً...' : 'e.g. Slight right shoulder slope...'}
                                            value={form.postureNotes || ''}
                                            onChange={e => setForm({ ...form, postureNotes: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    {isAr ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    <i className="ri-save-line"></i> {isAr ? 'حفظ ملف المقاسات' : 'Save Measurement Profile'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Printable Measurement Card Modal */}
            {printProfile && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '520px', width: '95%' }}>
                        <div style={{ background: '#fff', color: '#111', padding: '20px', borderRadius: '8px', fontFamily: 'Cairo, sans-serif' }}>
                            <div style={{ textAlign: 'center', borderBottom: '2px dashed #333', paddingBottom: '10px', marginBottom: '12px' }}>
                                <h3 style={{ margin: 0 }}>{settings?.businessName || '26i Bespoke Tailoring'}</h3>
                                <div style={{ fontSize: '12px', color: '#555' }}>Customer Measurement Card / بطاقة مقاس العميل</div>
                                <div style={{ fontWeight: 'bold', marginTop: '4px' }}>{printProfile.id} — {printProfile.profileName}</div>
                            </div>
                            <div style={{ fontSize: '13px', marginBottom: '12px' }}>
                                <div><strong>Customer / العميل:</strong> {printProfile.customerName} ({printProfile.customerPhone || 'N/A'})</div>
                                <div><strong>Garment / القطعة:</strong> {printProfile.garmentType} ({printProfile.unit.toUpperCase()})</div>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '12px' }}>
                                <tbody>
                                    {MEASUREMENT_FIELDS.filter(f => printProfile.measurements?.[f.key]).map(f => (
                                        <tr key={f.key} style={{ borderBottom: '1px solid #ddd' }}>
                                            <td style={{ padding: '5px', fontWeight: 'bold' }}>{f.en}</td>
                                            <td style={{ padding: '5px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>
                                                {printProfile.measurements[f.key]} {printProfile.unit}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ fontSize: '12px', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                                <div><strong>Collar / القلاب:</strong> {printProfile.stylePreferences?.collarType}</div>
                                <div><strong>Cuff / الكبك:</strong> {printProfile.stylePreferences?.cuffType}</div>
                                <div><strong>Placket / الجبزور:</strong> {printProfile.stylePreferences?.placketType}</div>
                                <div><strong>Pocket / الجيوب:</strong> {printProfile.stylePreferences?.pocketStyle}</div>
                                <div><strong>Fit / القصة:</strong> {printProfile.stylePreferences?.fitType}</div>
                                {printProfile.postureNotes && <div><strong>Notes / ملاحظات:</strong> {printProfile.postureNotes}</div>}
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                            <button className="btn btn-secondary" onClick={() => setPrintProfile(null)}>{isAr ? 'إغلاق' : 'Close'}</button>
                            <button className="btn btn-primary" onClick={() => window.print()}>
                                <i className="ri-printer-line"></i> {isAr ? 'طباعة' : 'Print'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MeasurementProfiles;
