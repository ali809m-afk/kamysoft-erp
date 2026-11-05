import React, { useState, useEffect } from 'react';

const STAGES_ORDER = [
    { key: 'Received', labelEn: 'Order Received', labelAr: 'تم استلام الطلب', icon: 'ri-file-list-3-line' },
    { key: 'Cutting', labelEn: 'Fabric Cutting', labelAr: 'قص القماش', icon: 'ri-scissors-cut-line' },
    { key: 'Stitching', labelEn: 'Master Tailoring', labelAr: 'الحياكة والتفصيل', icon: 'ri-t-shirt-2-line' },
    { key: 'Finishing', labelEn: 'Finishing & Pressing', labelAr: 'التشطيب والكوي بالبخار', icon: 'ri-temp-hot-line' },
    { key: 'QC', labelEn: 'Quality Inspection', labelAr: 'فحص الجودة النهائي', icon: 'ri-shield-check-line' },
    { key: 'TrialReady', labelEn: 'Ready for Fitting', labelAr: 'جاهز للبروفة والقياس', icon: 'ri-ruler-2-line' },
    { key: 'ReadyForPickup', labelEn: 'Ready for Pickup', labelAr: 'جاهز للتسليم', icon: 'ri-shopping-bag-3-line' },
    { key: 'Delivered', labelEn: 'Delivered', labelAr: 'تم التسليم', icon: 'ri-checkbox-circle-line' }
];

const GARMENT_SHOWCASE = [
    {
        type: 'Thobe',
        titleEn: 'Royal Saudi Bespoke Thobe',
        titleAr: 'ثوب سعودي ملكي تفصيل خاص',
        priceFrom: 180,
        descEn: 'Precision-cut classic and modern Saudi thobes crafted from premium Japanese & European fabrics with hidden or French cuff finishes.',
        descAr: 'تفصيل ثياب سعودية كلاسيكية وملكية بأجود الأقمشة اليابانية والسويسرية مع خيارات متعددة للقلاب والجبزور والكبك.',
        badgeEn: 'Most Popular',
        badgeAr: 'الأكثر طلباً',
        icon: '👔'
    },
    {
        type: 'Bisht',
        titleEn: 'Hasawi Royal Bisht & Ceremonial Cloak',
        titleAr: 'بشت ملكي حساوي مقصب بالزري',
        priceFrom: 600,
        descEn: 'Hand-embroidered ceremonial bishts with German & French gold Zari threadwork tailored to your exact stature.',
        descAr: 'مشالح وبشوت ملكية مطرزة بالزري الألماني والفرنسي الفاخر للمناسبات الرسمية والأفراح.',
        badgeEn: 'VIP Ceremonial',
        badgeAr: 'فخامة ملكية',
        icon: '🧥'
    },
    {
        type: 'Suit',
        titleEn: 'Italian Bespoke Formal Suit',
        titleAr: 'بدلة رسمية إيطالية تفصيل خاص',
        priceFrom: 850,
        descEn: 'Full-canvas and half-canvas bespoke suits tailored from Super 130s–150s Italian wool and English cashmere.',
        descAr: 'بدل رسمية رجالية مفصلة حسب القياس الشخصي من الصوف الإيطالي والكشمير الإنجليزي الفاخر.',
        badgeEn: 'Sartorial',
        badgeAr: 'تفصيل إيطالي',
        icon: '🕴️'
    },
    {
        type: 'Abaya',
        titleEn: 'Couture Silk & Crepe Abaya',
        titleAr: 'عباية كوتور حرير وكريب فاخر',
        priceFrom: 280,
        descEn: 'Bespoke luxury abayas and jalabiyas with custom hand embroidery, Korean silk crepe, and tailored drape.',
        descAr: 'تفصيل عبايات وجلابيات راقية من الكريب والحرير الكوري والياباني مع تطريز يدوي حسب الطلب.',
        badgeEn: 'Haute Couture',
        badgeAr: 'تصميم خاص',
        icon: '👘'
    }
];

const TailoringWebPortal = ({ tenantId, currentLanguage, setLanguage, initialSettings }) => {
    const isAr = currentLanguage === 'ar';
    const [settings, setSettings] = useState(initialSettings || null);
    const [fabrics, setFabrics] = useState([]);

    // Order Tracker State
    const [trackQuery, setTrackQuery] = useState('');
    const [trackResults, setTrackResults] = useState(null);
    const [trackingLoading, setTrackingLoading] = useState(false);

    // Booking / Custom Order Modal State
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(null);
    const [submittingBooking, setSubmittingBooking] = useState(false);
    const [bookingForm, setBookingForm] = useState({
        customerName: '',
        customerPhone: '',
        garmentType: 'Thobe',
        fabricProductId: '',
        fabricName: '',
        preferredDate: '',
        collarType: 'Mandarin (قلاب صيني)',
        cuffType: 'French Cufflinks (كبك فرنسي مزدوج)',
        fitType: 'Regular (عادي مريح)',
        notes: '',
        includeMeasurements: false,
        measurements: {
            length: '',
            shoulder: '',
            chest: '',
            waist: '',
            sleeveLength: '',
            neck: '',
            wrist: ''
        }
    });

    const formatAddress = (addressStr) => {
        if (!addressStr) return '';
        try {
            const a = typeof addressStr === 'string' ? JSON.parse(addressStr) : addressStr;
            if (a && typeof a === 'object') {
                return `${a.buildingNo || ''} ${a.street || ''}, ${a.district || ''}, ${a.city || ''} ${a.postalCode || ''}`.trim();
            }
        } catch (e) {}
        return addressStr;
    };

    useEffect(() => {
        fetch('/api/settings', { headers: { 'x-tenant-id': tenantId || 'default' } })
            .then(res => res.json())
            .then(data => {
                if (data && !data.error) setSettings(data);
            })
            .catch(() => {});

        fetch('/api/public/tailoring/fabrics', { headers: { 'x-tenant-id': tenantId || 'default' } })
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setFabrics(data);
            })
            .catch(() => {});
    }, [tenantId]);

    const businessName = settings?.businessName || (tenantId ? `${tenantId.toUpperCase()} ATELIER` : (isAr ? 'دار الأناقة للخياطة والتفصيل' : 'Royal Bespoke Tailoring & Atelier'));

    const handleTrackOrder = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!trackQuery.trim()) return;
        setTrackingLoading(true);
        try {
            const res = await fetch(`/api/public/tailoring/track?q=${encodeURIComponent(trackQuery.trim())}`, {
                headers: { 'x-tenant-id': tenantId || 'default' }
            });
            const data = await res.json();
            setTrackResults(Array.isArray(data) ? data : []);
        } catch {
            setTrackResults([]);
        } finally {
            setTrackingLoading(false);
        }
    };

    const openBookingWithPreset = (preset = {}) => {
        setBookingSuccess(null);
        setBookingForm(prev => ({
            ...prev,
            garmentType: preset.garmentType || prev.garmentType || 'Thobe',
            fabricProductId: preset.fabricProductId || '',
            fabricName: preset.fabricName || ''
        }));
        setShowBookingModal(true);
    };

    const handleBookingSubmit = async (e) => {
        e.preventDefault();
        setSubmittingBooking(true);
        try {
            const payload = {
                customerName: bookingForm.customerName,
                customerPhone: bookingForm.customerPhone,
                garmentType: bookingForm.garmentType,
                fabricProductId: bookingForm.fabricProductId,
                fabricName: bookingForm.fabricName,
                preferredDate: bookingForm.preferredDate,
                collarType: bookingForm.collarType,
                cuffType: bookingForm.cuffType,
                fitType: bookingForm.fitType,
                notes: bookingForm.notes,
                measurements: bookingForm.includeMeasurements ? bookingForm.measurements : {}
            };
            const res = await fetch('/api/public/tailoring/booking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': tenantId || 'default'
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.orderId) {
                setBookingSuccess(data.orderId);
            } else {
                alert(data.error || (isAr ? 'حدث خطأ أثناء إرسال الطلب' : 'Failed to submit request'));
            }
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmittingBooking(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0c0f17', color: '#f8fafc', fontFamily: 'Cairo, Inter, system-ui, sans-serif' }} dir={isAr ? 'rtl' : 'ltr'}>
            {/* Top Navigation Header */}
            <header style={{ padding: '18px 40px', backgroundColor: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(212, 175, 55, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {settings?.logoUrl ? (
                        <img src={settings.logoUrl} alt="Logo" style={{ height: '44px', objectFit: 'contain' }} />
                    ) : (
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #d4af37, #9a7b1c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', fontSize: '22px', fontWeight: 'bold' }}>
                            <i className="ri-scissors-cut-line"></i>
                        </div>
                    )}
                    <div>
                        <h1 style={{ margin: 0, fontSize: '20px', color: '#f8fafc', fontWeight: '800', letterSpacing: '-0.3px' }}>
                            {businessName}
                        </h1>
                        <span style={{ fontSize: '11px', color: '#d4af37', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                            {isAr ? 'دار الخياطة والتفصيل الملكي' : 'Bespoke Tailoring & Sartorial Atelier'}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <a href="#track-order" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px', fontWeight: '500', padding: '6px 10px' }}>
                        <i className="ri-radar-line" style={{ color: '#d4af37', marginInlineEnd: '5px' }}></i>
                        {isAr ? 'تتبع طلبك' : 'Track Order'}
                    </a>
                    <a href="#fabrics-catalog" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '14px', fontWeight: '500', padding: '6px 10px' }}>
                        <i className="ri-Pantone-line" style={{ color: '#d4af37', marginInlineEnd: '5px' }}></i>
                        {isAr ? 'كتالوج الأقمشة' : 'Fabrics'}
                    </a>
                    <button
                        onClick={() => openBookingWithPreset({})}
                        style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #d4af37, #b48a1e)', color: '#0f172a', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}
                    >
                        <i className="ri-ruler-2-line" style={{ marginInlineEnd: '6px' }}></i>
                        {isAr ? 'حجز موعد قياس / تفصيل' : 'Book Fitting / Order'}
                    </button>
                    <button
                        onClick={() => setLanguage(isAr ? 'en' : 'ar')}
                        style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', fontWeight: '600', color: '#f8fafc', fontSize: '13px' }}
                    >
                        <i className="ri-translate-2"></i> {isAr ? 'English' : 'عربي'}
                    </button>
                    <a
                        href={`/login${window.location.search}`}
                        style={{ textDecoration: 'none', color: '#d4af37', fontWeight: '600', fontSize: '13px', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(212, 175, 55, 0.35)', background: 'rgba(212, 175, 55, 0.08)' }}
                    >
                        <i className="ri-shield-user-line" style={{ marginInlineEnd: '5px' }}></i>
                        {isAr ? 'دخول المشغل والإدارة' : 'Atelier Staff Login'}
                    </a>
                </div>
            </header>

            {/* Hero Banner */}
            <section style={{ position: 'relative', minHeight: '78vh', display: 'flex', alignItems: 'center', overflow: 'hidden', borderBottom: '1px solid rgba(212, 175, 55, 0.15)' }}>
                <img
                    src={settings?.portalImages?.[0] || 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=1920'}
                    alt="Bespoke Tailoring"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.32 }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(12,15,23,0.55) 0%, rgba(12,15,23,0.94) 100%)' }}></div>

                <div style={{ position: 'relative', zIndex: 10, maxWidth: '1200px', margin: '0 auto', padding: '80px 24px', width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '48px', alignItems: 'center' }}>
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '999px', background: 'rgba(212, 175, 55, 0.14)', border: '1px solid rgba(212, 175, 55, 0.4)', color: '#d4af37', fontSize: '12px', fontWeight: '700', marginBottom: '20px' }}>
                            <i className="ri-vip-crown-2-line"></i>
                            <span>{isAr ? 'تفصيل ملكي خاص • أقمشة عالمية فاخرة' : 'Bespoke Craftsmanship • Luxury Fabrics'}</span>
                        </div>
                        <h2 style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.8rem)', lineHeight: 1.15, fontWeight: '800', margin: '0 0 20px', color: '#fff' }}>
                            {isAr ? 'أناقة تُفصّل على مقاس حضورك' : 'Master Tailoring Crafted to Your Exact Measure'}
                        </h2>
                        <p style={{ fontSize: '17px', lineHeight: 1.8, color: 'rgba(248, 250, 252, 0.78)', marginBottom: '32px', maxWidth: '580px' }}>
                            {isAr
                                ? 'نجمع بين دقة القياس الرقمي، وأرقى الأقمشة اليابانية والإيطالية والإنجليزية، ومهارة أمهر الخياطين لنقدم لك ثياباً وبشوتاً وبدلاً تعكس شخصيتك.'
                                : 'Experience bespoke Saudi thobes, ceremonial bishts, Italian suits, and couture abayas. Digitally profiled measurements, master cutters, and real-time workshop tracking.'}
                        </p>
                        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => openBookingWithPreset({})}
                                style={{ padding: '14px 28px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #d4af37, #b48a1e)', color: '#0f172a', fontWeight: '800', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 10px 25px -5px rgba(212, 175, 55, 0.4)' }}
                            >
                                <i className="ri-scissors-cut-line"></i>
                                <span>{isAr ? 'ابدأ طلب تفصيل أو احجز موعد قياس' : 'Book Measurement & Bespoke Order'}</span>
                            </button>
                            <a
                                href="#fabrics-catalog"
                                style={{ padding: '14px 24px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: '600', fontSize: '15px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <span>{isAr ? 'استعراض الأقمشة والأسعار' : 'Explore Fabrics & Styles'}</span>
                            </a>
                        </div>
                    </div>

                    {/* Live Order Status Tracker Card */}
                    <div id="track-order" style={{ background: 'rgba(15, 23, 42, 0.88)', border: '1px solid rgba(212, 175, 55, 0.35)', borderRadius: '20px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(212, 175, 55, 0.15)', color: '#d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                <i className="ri-radar-line"></i>
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#fff' }}>
                                    {isAr ? 'تتبع حالة ثوبك في المشغل مباشرة' : 'Live Workshop Order Tracker'}
                                </h3>
                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                    {isAr ? 'أدخل رقم الفاتورة / أمر التفصيل (مثل TLR-1001) أو رقم الجوال' : 'Enter Order ID (e.g. TLR-1001) or your mobile number'}
                                </span>
                            </div>
                        </div>

                        <form onSubmit={handleTrackOrder} style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                            <input
                                type="text"
                                value={trackQuery}
                                onChange={(e) => setTrackQuery(e.target.value)}
                                placeholder={isAr ? 'رقم الطلب (TLR-1001) أو الجوال (0501234567)' : 'Order # (TLR-1001) or Phone (0501234567)'}
                                style={{ flex: 1, padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', outline: 'none' }}
                            />
                            <button
                                type="submit"
                                disabled={trackingLoading}
                                style={{ padding: '0 20px', borderRadius: '10px', border: 'none', background: '#d4af37', color: '#0f172a', fontWeight: '700', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}
                            >
                                {trackingLoading ? (isAr ? 'جاري البحث...' : 'Checking...') : (isAr ? 'تتبع الآن' : 'Track')}
                            </button>
                        </form>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{isAr ? 'جرّب أمثلة سريعة:' : 'Try sample orders:'}</span>
                            {['TLR-1001', 'TLR-1002', '0501234567'].map(sample => (
                                <button
                                    key={sample}
                                    type="button"
                                    onClick={() => { setTrackQuery(sample); }}
                                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}
                                >
                                    {sample}
                                </button>
                            ))}
                        </div>

                        {/* Track Results */}
                        {trackResults !== null && (
                            <div style={{ marginTop: '18px', maxHeight: '320px', overflowY: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '14px' }}>
                                {trackResults.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#f87171', fontSize: '13px', padding: '12px' }}>
                                        {isAr ? 'لم يتم العثور على طلب مطابق. تأكد من رقم الطلب أو رقم الجوال.' : 'No matching tailoring order found. Please check your Order ID or phone number.'}
                                    </div>
                                ) : (
                                    trackResults.map(order => (
                                        <div key={order.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px', marginBottom: '12px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                                                <strong style={{ color: '#d4af37', fontSize: '15px' }}>{order.id} — {order.customerName}</strong>
                                                <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontWeight: '600' }}>
                                                    {isAr ? `موعد التسليم: ${order.deliveryDate}` : `Delivery: ${order.deliveryDate}`}
                                                </span>
                                            </div>
                                            {(order.items || []).map(jc => {
                                                const currentStageIdx = STAGES_ORDER.findIndex(s => s.key === jc.stage);
                                                const stageObj = STAGES_ORDER[currentStageIdx] || STAGES_ORDER[0];
                                                const progressPct = Math.max(12, Math.round(((currentStageIdx + 1) / STAGES_ORDER.length) * 100));
                                                return (
                                                    <div key={jc.jobCardId} style={{ marginTop: '10px', padding: '10px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                                                            <span><strong>{jc.garmentType}</strong> ({jc.profileName || jc.fabricName})</span>
                                                            <span style={{ color: '#d4af37', fontWeight: '700' }}>
                                                                <i className={stageObj.icon} style={{ marginInlineEnd: '4px' }}></i>
                                                                {isAr ? stageObj.labelAr : stageObj.labelEn}
                                                            </span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #d4af37, #10b981)', transition: 'width 0.3s ease' }}></div>
                                                        </div>
                                                        {jc.rackNumber && (
                                                            <div style={{ fontSize: '11px', color: '#34d399', marginTop: '6px' }}>
                                                                <i className="ri-Price-tag-3-line"></i> {isAr ? `رقم الرف بالمشغل: ${jc.rackNumber}` : `Workshop Rack: ${jc.rackNumber}`}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                                                <span>{isAr ? `الإجمالي: ${order.totalAmount} ر.س` : `Total: ${order.totalAmount} SAR`}</span>
                                                <span>{isAr ? `المدفوع: ${order.depositPaid} ر.س | المتبقي: ${order.balanceDue} ر.س` : `Paid: ${order.depositPaid} SAR | Balance: ${order.balanceDue} SAR`}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Bespoke Garment Services Showcase */}
            <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '70px 24px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                    <span style={{ color: '#d4af37', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        {isAr ? 'خدمات التفصيل الراقية' : 'Bespoke Sartorial Services'}
                    </span>
                    <h2 style={{ fontSize: '32px', fontWeight: '800', margin: '8px 0 12px', color: '#fff' }}>
                        {isAr ? 'اختر نوع التفصيل وخصص أدق التفاصيل' : 'Tailored Garments & Customizations'}
                    </h2>
                    <p style={{ color: '#94a3b8', maxWidth: '640px', margin: '0 auto', fontSize: '15px' }}>
                        {isAr
                            ? 'نحتفظ بملف مقاساتك الرقمي لكل عميل ولأفراد العائلة لسهولة الطلب في كل موسم دون عناء إعادة القياس.'
                            : 'We maintain individual digital measurement profiles for you and your family members so reordering for Eid or special occasions takes seconds.'}
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(265px, 1fr))', gap: '24px' }}>
                    {GARMENT_SHOWCASE.map(item => (
                        <div key={item.type} style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '26px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s, border-color 0.2s' }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <span style={{ fontSize: '36px' }}>{item.icon}</span>
                                    <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '999px', background: 'rgba(212, 175, 55, 0.15)', color: '#d4af37', fontWeight: '700' }}>
                                        {isAr ? item.badgeAr : item.badgeEn}
                                    </span>
                                </div>
                                <h3 style={{ fontSize: '19px', fontWeight: '700', color: '#fff', margin: '0 0 10px' }}>
                                    {isAr ? item.titleAr : item.titleEn}
                                </h3>
                                <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.7, marginBottom: '20px' }}>
                                    {isAr ? item.descAr : item.descEn}
                                </p>
                            </div>
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>{isAr ? 'يبدأ التفصيل من' : 'Tailoring from'}</span>
                                    <strong style={{ fontSize: '20px', color: '#d4af37' }}>{item.priceFrom} {isAr ? 'ر.س' : 'SAR'}</strong>
                                </div>
                                <button
                                    onClick={() => openBookingWithPreset({ garmentType: item.type })}
                                    style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid rgba(212, 175, 55, 0.4)', background: 'rgba(212, 175, 55, 0.12)', color: '#d4af37', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}
                                >
                                    {isAr ? 'اطلب تفصيل' : 'Customize'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Luxury Fabrics Catalog */}
            <section id="fabrics-catalog" style={{ background: 'rgba(15, 23, 42, 0.5)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '70px 24px' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '36px', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                            <span style={{ color: '#d4af37', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' }}>
                                {isAr ? 'تشكيلة الأقمشة الفاخرة' : 'Curated Textile Library'}
                            </span>
                            <h2 style={{ fontSize: '28px', fontWeight: '800', margin: '6px 0 0', color: '#fff' }}>
                                {isAr ? 'الأقمشة المتوفرة بالمشغل حالياً' : 'Available Luxury Fabrics & Accessories'}
                            </h2>
                        </div>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                            {isAr ? 'يتم احتساب القماش بالمتر (متوسط الثوب ٣.٥ متر)' : 'Priced per meter (Standard adult thobe requires ~3.5m)'}
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                        {fabrics.map(fab => (
                            <div key={fab.id} style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '28px' }}>{fab.emoji || '🧵'}</span>
                                        <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.12)', color: '#34d399' }}>
                                            {isAr ? `متوفر (${fab.stock} م)` : `In Stock (${fab.stock}m)`}
                                        </span>
                                    </div>
                                    <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#f8fafc', margin: '0 0 8px' }}>
                                        {isAr ? (fab.nameAR || fab.nameEN) : (fab.nameEN || fab.nameAR)}
                                    </h4>
                                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 16px' }}>
                                        {isAr ? `التصنيف: ${fab.category === 'Fabrics' ? 'أقمشة رجالية ونسائية فاخرة' : fab.category}` : `Category: ${fab.category}`}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
                                    <div>
                                        <strong style={{ fontSize: '18px', color: '#d4af37' }}>{fab.price} {isAr ? 'ر.س' : 'SAR'}</strong>
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}> / {isAr ? 'للمتر' : 'meter'}</span>
                                    </div>
                                    <button
                                        onClick={() => openBookingWithPreset({
                                            fabricProductId: fab.id,
                                            fabricName: isAr ? (fab.nameAR || fab.nameEN) : (fab.nameEN || fab.nameAR)
                                        })}
                                        style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#d4af37', color: '#0f172a', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
                                    >
                                        {isAr ? 'اختر هذا القماش' : 'Select Fabric'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How Our Atelier Works */}
            <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '70px 24px', width: '100%' }}>
                <h3 style={{ textAlign: 'center', fontSize: '26px', fontWeight: '800', marginBottom: '40px', color: '#fff' }}>
                    {isAr ? 'رحلة تفصيل ثوبك من القياس حتى التسليم' : 'Your Bespoke Journey in 4 Steps'}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '20px' }}>
                    {[
                        { step: '01', icon: 'ri-ruler-2-line', titleEn: 'Digital Measurement Profile', titleAr: 'أخذ المقاسات وحفظها رقمياً', descEn: 'Visit our atelier or submit your saved measurements online.', descAr: 'زيارة المشغل أو إدخال مقاساتك المعتمدة ليتم حفظها في سجلك الدائم.' },
                        { step: '02', icon: 'ri-scissors-cut-line', titleEn: 'Fabric & Collar Styling', titleAr: 'اختيار القماش وتفاصيل الموديل', descEn: 'Choose Japanese/Italian fabrics, collar, cufflinks, and stitching.', descAr: 'اختيار القماش ونوع القلاب والكبك والجبزور والخياطة المفضلة.' },
                        { step: '03', icon: 'ri-t-shirt-2-line', titleEn: 'Master Cutting & Stitching', titleAr: 'القص والحياكة وفحص الجودة', descEn: 'Track every stage live from cutting and stitching to steam pressing.', descAr: 'متابعة مراحل القص والخياطة والكوي وفحص الجودة مباشرة عبر الموقع.' },
                        { step: '04', icon: 'ri-checkbox-circle-line', titleEn: 'Fitting & Delivery', titleAr: 'البروفة والاستلام النهائي', descEn: 'Try on your garment at our fitting room and receive your ZATCA invoice.', descAr: 'تجربة القياس النهائي واستلام طلبك جاهزاً مع فاتورة ضريبية معتمدة.' }
                    ].map(s => (
                        <div key={s.step} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <span style={{ fontSize: '24px', color: '#d4af37' }}><i className={s.icon}></i></span>
                                <span style={{ fontSize: '22px', fontWeight: '900', color: 'rgba(212, 175, 55, 0.25)' }}>{s.step}</span>
                            </div>
                            <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', margin: '0 0 8px' }}>{isAr ? s.titleAr : s.titleEn}</h4>
                            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>{isAr ? s.descAr : s.descEn}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Booking / Custom Tailoring Request Modal */}
            {showBookingModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', background: '#0f172a', border: '1px solid rgba(212, 175, 55, 0.35)', borderRadius: '20px', padding: '28px', color: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#d4af37' }}>
                                <i className="ri-scissors-cut-line" style={{ marginInlineEnd: '8px' }}></i>
                                {isAr ? 'حجز موعد قياس أو طلب تفصيل جديد' : 'Book Fitting Appointment / Bespoke Order'}
                            </h3>
                            <button onClick={() => setShowBookingModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '22px', cursor: 'pointer' }}>
                                <i className="ri-close-line"></i>
                            </button>
                        </div>

                        {bookingSuccess ? (
                            <div style={{ textAlign: 'center', padding: '24px 10px' }}>
                                <div style={{ fontSize: '56px', color: '#10b981', marginBottom: '12px' }}>
                                    <i className="ri-checkbox-circle-line"></i>
                                </div>
                                <h4 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px' }}>
                                    {isAr ? 'تم استلام طلب التفصيل بنجاح!' : 'Your Bespoke Request is Confirmed!'}
                                </h4>
                                <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
                                    {isAr
                                        ? 'تم تسجيل طلبك في لوحة المشغل. يمكنك تتبع حالة الطلب في أي وقت باستخدام رقم الطلب أدناه:'
                                        : 'Your request has been sent directly to our master tailor workshop. Save your Order ID below to track progress:'}
                                </p>
                                <div style={{ display: 'inline-block', padding: '12px 24px', borderRadius: '10px', background: 'rgba(212, 175, 55, 0.15)', border: '1px solid #d4af37', color: '#d4af37', fontSize: '20px', fontWeight: '800', letterSpacing: '1px', marginBottom: '24px' }}>
                                    {bookingSuccess}
                                </div>
                                <div>
                                    <button
                                        onClick={() => {
                                            setTrackQuery(bookingSuccess);
                                            setShowBookingModal(false);
                                        }}
                                        style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', background: '#d4af37', color: '#0f172a', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                        {isAr ? 'تتبع حالة الطلب الآن' : 'Track This Order Now'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cbd5e1' }}>{isAr ? 'الاسم الكامل *' : 'Full Name *'}</label>
                                        <input
                                            type="text"
                                            required
                                            value={bookingForm.customerName}
                                            onChange={e => setBookingForm({ ...bookingForm, customerName: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cbd5e1' }}>{isAr ? 'رقم الجوال *' : 'Mobile Number *'}</label>
                                        <input
                                            type="tel"
                                            required
                                            placeholder="05XXXXXXXX"
                                            value={bookingForm.customerPhone}
                                            onChange={e => setBookingForm({ ...bookingForm, customerPhone: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cbd5e1' }}>{isAr ? 'نوع القطعة المطلوبة' : 'Garment Type'}</label>
                                        <select
                                            value={bookingForm.garmentType}
                                            onChange={e => setBookingForm({ ...bookingForm, garmentType: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: '#1e293b', color: '#fff' }}
                                        >
                                            <option value="Thobe">{isAr ? 'ثوب رجالي (Thobe)' : 'Saudi Thobe'}</option>
                                            <option value="Bisht">{isAr ? 'بشت / مشلح ملكي (Bisht)' : 'Royal Bisht'}</option>
                                            <option value="Suit">{isAr ? 'بدلة رسمية (Suit)' : 'Bespoke Suit'}</option>
                                            <option value="Abaya">{isAr ? 'عباية / جلابية (Abaya)' : 'Couture Abaya'}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cbd5e1' }}>{isAr ? 'تاريخ القياس / البروفة المفضل' : 'Preferred Fitting Date'}</label>
                                        <input
                                            type="date"
                                            value={bookingForm.preferredDate}
                                            onChange={e => setBookingForm({ ...bookingForm, preferredDate: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cbd5e1' }}>{isAr ? 'اختيار القماش (اختياري)' : 'Preferred Fabric (Optional)'}</label>
                                    <select
                                        value={bookingForm.fabricProductId}
                                        onChange={e => {
                                            const fab = fabrics.find(f => f.id === e.target.value);
                                            setBookingForm({
                                                ...bookingForm,
                                                fabricProductId: e.target.value,
                                                fabricName: fab ? (isAr ? (fab.nameAR || fab.nameEN) : (fab.nameEN || fab.nameAR)) : ''
                                            });
                                        }}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: '#1e293b', color: '#fff' }}
                                    >
                                        <option value="">{isAr ? '-- أختار القماش عند زيارة المشغل --' : '-- Decide at Atelier Fitting --'}</option>
                                        {fabrics.map(f => (
                                            <option key={f.id} value={f.id}>
                                                {isAr ? (f.nameAR || f.nameEN) : (f.nameEN || f.nameAR)} ({f.price} SAR/m)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#cbd5e1' }}>{isAr ? 'نوع القلاب / الياقة' : 'Collar Style'}</label>
                                        <select
                                            value={bookingForm.collarType}
                                            onChange={e => setBookingForm({ ...bookingForm, collarType: e.target.value })}
                                            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: '#1e293b', color: '#fff', fontSize: '12px' }}
                                        >
                                            <option value="Mandarin (قلاب صيني)">Mandarin / قلاب صيني</option>
                                            <option value="Classic Shirt (قلاب رسمي)">Classic / قلاب رسمي</option>
                                            <option value="Round Collar (سادة دائري)">Round / سادة دائري</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#cbd5e1' }}>{isAr ? 'نوع الكم / الكبك' : 'Cuff Style'}</label>
                                        <select
                                            value={bookingForm.cuffType}
                                            onChange={e => setBookingForm({ ...bookingForm, cuffType: e.target.value })}
                                            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: '#1e293b', color: '#fff', fontSize: '12px' }}
                                        >
                                            <option value="French Cufflinks (كبك فرنسي مزدوج)">French Cuff / كبك</option>
                                            <option value="Plain Sleeve (كم سادة)">Plain Sleeve / كم سادة</option>
                                            <option value="Single Button (كم بزرار)">Buttoned / كم بزرار</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#cbd5e1' }}>{isAr ? 'القصة والاتساع' : 'Fit Preference'}</label>
                                        <select
                                            value={bookingForm.fitType}
                                            onChange={e => setBookingForm({ ...bookingForm, fitType: e.target.value })}
                                            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: '#1e293b', color: '#fff', fontSize: '12px' }}
                                        >
                                            <option value="Regular (عادي مريح)">Regular / عادي مريح</option>
                                            <option value="Slim Fit (مفصل)">Slim / مفصل</option>
                                            <option value="Loose Comfort (واسع)">Loose / واسع</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Optional Self-Measurements */}
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#d4af37' }}>
                                        <input
                                            type="checkbox"
                                            checked={bookingForm.includeMeasurements}
                                            onChange={e => setBookingForm({ ...bookingForm, includeMeasurements: e.target.checked })}
                                        />
                                        <span>{isAr ? 'لدي مقاساتي جاهزة بالإنش وأرغب بإرفاقها الآن' : 'I already know my measurements (in inches) and want to attach them'}</span>
                                    </label>

                                    {bookingForm.includeMeasurements && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginTop: '12px' }}>
                                            {[
                                                { key: 'length', labelEn: 'Length', labelAr: 'الطول الكلي' },
                                                { key: 'shoulder', labelEn: 'Shoulder', labelAr: 'الكتف' },
                                                { key: 'chest', labelEn: 'Chest', labelAr: 'الصدر' },
                                                { key: 'waist', labelEn: 'Waist', labelAr: 'الوسط' },
                                                { key: 'sleeveLength', labelEn: 'Sleeve', labelAr: 'طول الكم' },
                                                { key: 'neck', labelEn: 'Neck', labelAr: 'الرقبة' },
                                                { key: 'wrist', labelEn: 'Wrist', labelAr: 'المعصم' }
                                            ].map(m => (
                                                <div key={m.key}>
                                                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '3px' }}>{isAr ? m.labelAr : m.labelEn}</label>
                                                    <input
                                                        type="text"
                                                        placeholder="in"
                                                        value={bookingForm.measurements[m.key]}
                                                        onChange={e => setBookingForm({
                                                            ...bookingForm,
                                                            measurements: { ...bookingForm.measurements, [m.key]: e.target.value }
                                                        })}
                                                        style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px' }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cbd5e1' }}>{isAr ? 'ملاحظات إضافية للخياط' : 'Special Instructions / Notes'}</label>
                                    <textarea
                                        rows={2}
                                        value={bookingForm.notes}
                                        onChange={e => setBookingForm({ ...bookingForm, notes: e.target.value })}
                                        placeholder={isAr ? 'مثال: خياطة مخفية، تطريز خفيف على الياقة...' : 'e.g. Hidden placket stitch, subtle collar embroidery...'}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submittingBooking}
                                    style={{ padding: '14px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #d4af37, #b48a1e)', color: '#0f172a', fontWeight: '800', fontSize: '15px', cursor: 'pointer', marginTop: '6px' }}
                                >
                                    {submittingBooking ? (isAr ? 'جاري إرسال الطلب...' : 'Submitting...') : (isAr ? 'تأكيد حجز الموعد / إرسال طلب التفصيل' : 'Confirm Fitting & Bespoke Request')}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer style={{ marginTop: 'auto', padding: '40px 24px', backgroundColor: '#07090e', borderTop: '1px solid rgba(212, 175, 55, 0.15)', color: '#94a3b8', fontSize: '13px' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <strong style={{ color: '#f8fafc', fontSize: '16px', display: 'block', marginBottom: '6px' }}>{businessName}</strong>
                        <span>
                            <i className="ri-map-pin-line" style={{ color: '#d4af37', marginInlineEnd: '6px' }}></i>
                            {formatAddress(settings?.contactAddress || settings?.businessAddress || (isAr ? 'الرياض، المملكة العربية السعودية' : 'Riyadh, Kingdom of Saudi Arabia'))}
                        </span>
                        {(settings?.contactPhone || settings?.contactNumber) && (
                            <span style={{ marginInlineStart: '16px' }}>
                                <i className="ri-phone-line" style={{ color: '#d4af37', marginInlineEnd: '6px' }}></i>
                                {settings.contactPhone || settings.contactNumber}
                            </span>
                        )}
                    </div>
                    <div>
                        &copy; {new Date().getFullYear()} {businessName}. {isAr ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default TailoringWebPortal;
