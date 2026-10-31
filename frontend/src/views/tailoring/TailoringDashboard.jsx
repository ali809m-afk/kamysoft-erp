import React, { useState, useEffect } from 'react';

const TailoringDashboard = ({ settings, currentLanguage, setActiveTab, formatCurrency }) => {
    const isAr = currentLanguage === 'ar';
    const [orders, setOrders] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [commissions, setCommissions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };
            const [ordRes, profRes, commRes] = await Promise.all([
                fetch('/api/tailoring/orders', { headers }),
                fetch('/api/tailoring/measurements', { headers }),
                fetch('/api/tailoring/commissions', { headers })
            ]);
            if (ordRes.ok) setOrders(await ordRes.json());
            if (profRes.ok) setProfiles(await profRes.json());
            if (commRes.ok) setCommissions(await commRes.json());
        } catch (err) {
            console.error('Failed to load tailoring dashboard:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const handleSeedSampleData = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/tailoring/seed', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchDashboardData();
            }
        } catch (err) {
            console.error('Failed to seed sample tailoring data:', err);
        }
    };

    const allJobCards = orders.flatMap(o => (o.items || []).map(jc => ({ ...jc, orderId: o.id, customerName: o.customerName, customerPhone: o.customerPhone, deliveryDate: o.deliveryDate, priority: o.priority })));
    const activeJobCards = allJobCards.filter(jc => jc.stage !== 'Delivered');
    const readyForPickup = allJobCards.filter(jc => jc.stage === 'ReadyForPickup');
    const totalDeposits = orders.reduce((acc, o) => acc + (Number(o.depositPaid) || 0), 0);
    const totalBalanceDue = orders.reduce((acc, o) => acc + (Number(o.balanceDue) || 0), 0);

    const stageLabels = {
        Received: isAr ? 'مستلم' : 'Received',
        Cutting: isAr ? 'القص' : 'Cutting',
        Stitching: isAr ? 'الخياطة' : 'Stitching',
        Finishing: isAr ? 'التشطيب والكوي' : 'Finishing & Ironing',
        QC: isAr ? 'فحص الجودة' : 'Quality Check',
        TrialReady: isAr ? 'جاهز للبروفة' : 'Ready for Trial',
        ReadyForPickup: isAr ? 'جاهز للتسليم' : 'Ready for Pickup',
        Delivered: isAr ? 'تم التسليم' : 'Delivered'
    };

    const stageCounts = ['Received', 'Cutting', 'Stitching', 'Finishing', 'QC', 'TrialReady', 'ReadyForPickup', 'Delivered'].map(st => ({
        stage: st,
        label: stageLabels[st],
        count: allJobCards.filter(jc => jc.stage === st).length
    }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Banner */}
            <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="ri-scissors-cut-line" style={{ color: 'var(--accent-purple)' }}></i>
                        {isAr ? 'إدارة الخياطة والتفصيل الرجالي والنسائي' : 'Bespoke Tailoring & Workshop Management'}
                    </h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {isAr
                            ? 'متابعة المقاسات، أوامر التفصيل، مراحل المشغل (القص والخياطة)، والعربون والمتبقي'
                            : 'Track customer measurements, bespoke garment orders, workshop production stages, and deposits'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={() => setActiveTab && setActiveTab('tailoring_orders')}>
                        <i className="ri-add-circle-line"></i> {isAr ? 'أمر تفصيل جديد (عربون)' : 'New Tailoring Order'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setActiveTab && setActiveTab('tailoring_measurements')}>
                        <i className="ri-ruler-2-line"></i> {isAr ? 'سجل المقاسات' : 'Measurements'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setActiveTab && setActiveTab('tailoring_workshop')}>
                        <i className="ri-kanban-view"></i> {isAr ? 'لوحة المشغل والإنتاج' : 'Workshop Kanban'}
                    </button>
                    <button className="btn btn-secondary" onClick={handleSeedSampleData} title={isAr ? 'إعادة تحميل البيانات التجريبية' : 'Load / Reset Sample Data'}>
                        <i className="ri-database-2-line"></i> {isAr ? 'تحميل بيانات تجريبية' : 'Load Sample Data'}
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="card-grid">
                <div className="glass-card purple" style={{ cursor: 'pointer' }} onClick={() => setActiveTab && setActiveTab('tailoring_workshop')}>
                    <div className="card-stat">
                        <div className="stat-info">
                            <h3>{isAr ? 'قطع قيد التنفيذ بالمشغل' : 'Garments in Workshop'}</h3>
                            <div className="stat-value">{activeJobCards.length}</div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {isAr ? `من إجمالي ${orders.length} طلب تفصيل` : `Across ${orders.length} tailoring orders`}
                            </span>
                        </div>
                        <div className="stat-icon"><i className="ri-t-shirt-2-line"></i></div>
                    </div>
                </div>

                <div className="glass-card cyan" style={{ cursor: 'pointer' }} onClick={() => setActiveTab && setActiveTab('tailoring_measurements')}>
                    <div className="card-stat">
                        <div className="stat-info">
                            <h3>{isAr ? 'ملفات المقاسات المحفوظة' : 'Saved Measurement Profiles'}</h3>
                            <div className="stat-value">{profiles.length}</div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {isAr ? 'ثوب، بدلة، عباية، زي موحد' : 'Thobe, Suit, Abaya, Uniform'}
                            </span>
                        </div>
                        <div className="stat-icon"><i className="ri-ruler-line"></i></div>
                    </div>
                </div>

                <div className="glass-card green" style={{ cursor: 'pointer' }} onClick={() => setActiveTab && setActiveTab('tailoring_orders')}>
                    <div className="card-stat">
                        <div className="stat-info">
                            <h3>{isAr ? 'العربون والمدفوعات المستلمة' : 'Deposits & Collected'}</h3>
                            <div className="stat-value">{formatCurrency ? formatCurrency(totalDeposits) : `${totalDeposits.toFixed(2)} SAR`}</div>
                            <span style={{ fontSize: '11px', color: 'var(--accent-success)' }}>
                                {isAr ? `جاهز للتسليم: ${readyForPickup.length} قطعة` : `Ready for Pickup: ${readyForPickup.length} items`}
                            </span>
                        </div>
                        <div className="stat-icon"><i className="ri-hand-coin-line"></i></div>
                    </div>
                </div>

                <div className="glass-card gold" style={{ cursor: 'pointer' }} onClick={() => setActiveTab && setActiveTab('tailoring_orders')}>
                    <div className="card-stat">
                        <div className="stat-info">
                            <h3>{isAr ? 'المتبقي عند التسليم (ذمم تفصيل)' : 'Pending Balance on Pickup'}</h3>
                            <div className="stat-value">{formatCurrency ? formatCurrency(totalBalanceDue) : `${totalBalanceDue.toFixed(2)} SAR`}</div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {isAr ? 'يُحصّل عند استلام العميل' : 'Collected upon garment delivery'}
                            </span>
                        </div>
                        <div className="stat-icon"><i className="ri-wallet-3-line"></i></div>
                    </div>
                </div>
            </div>

            {/* Workshop Stage Pipeline Strip */}
            <div className="glass-card">
                <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="ri-flow-chart" style={{ color: 'var(--accent-cyan)' }}></i>
                    {isAr ? 'توزيع القطع حسب مراحل المشغل' : 'Workshop Production Stage Pipeline'}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '10px' }}>
                    {stageCounts.map(s => (
                        <div
                            key={s.stage}
                            onClick={() => setActiveTab && setActiveTab('tailoring_workshop')}
                            style={{
                                padding: '12px',
                                borderRadius: '10px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid var(--glass-border)',
                                textAlign: 'center',
                                cursor: 'pointer'
                            }}
                        >
                            <div style={{ fontSize: '22px', fontWeight: 'bold', color: s.stage === 'ReadyForPickup' ? 'var(--accent-success)' : 'var(--accent-cyan)' }}>
                                {s.count}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                {s.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Two Columns: Ready for Pickup Racks & Upcoming Deliveries */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>
                            <i className="ri-price-tag-3-line" style={{ color: 'var(--accent-success)', marginRight: '6px' }}></i>
                            {isAr ? 'القطع الجاهزة للتسليم وأرقام الرفوف (الشماعات)' : 'Ready for Pickup & Rack Numbers'}
                        </h3>
                    </div>
                    {readyForPickup.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-secondary)' }}>
                            <i className="ri-t-shirt-air-line" style={{ fontSize: '32px', opacity: 0.5, marginBottom: '8px', display: 'block' }}></i>
                            <p style={{ margin: 0 }}>{isAr ? 'لا توجد قطع جاهزة للتسليم حالياً' : 'No garments waiting on pickup racks.'}</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>{isAr ? 'بطاقة العمل' : 'Job Card'}</th>
                                        <th>{isAr ? 'العميل' : 'Customer'}</th>
                                        <th>{isAr ? 'القطعة' : 'Garment'}</th>
                                        <th>{isAr ? 'الرف / الشماعة' : 'Rack #'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {readyForPickup.slice(0, 6).map(jc => (
                                        <tr key={jc.jobCardId}>
                                            <td><strong>{jc.jobCardId}</strong></td>
                                            <td>{jc.customerName}</td>
                                            <td>{jc.garmentType} (x{jc.qty})</td>
                                            <td>
                                                <span className="badge green">{jc.rackNumber || (isAr ? 'رف رئيسي' : 'Main Rack')}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>
                            <i className="ri-calendar-check-line" style={{ color: 'var(--accent-gold)', marginRight: '6px' }}></i>
                            {isAr ? 'أحدث أوامر التفصيل ومواعيد التسليم' : 'Recent Tailoring Orders & Delivery Dates'}
                        </h3>
                    </div>
                    {orders.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-secondary)' }}>
                            <i className="ri-scissors-line" style={{ fontSize: '32px', opacity: 0.5, marginBottom: '8px', display: 'block' }}></i>
                            <p style={{ margin: 0 }}>{isAr ? 'لم يتم تسجيل أوامر تفصيل بعد' : 'No tailoring orders recorded yet.'}</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>{isAr ? 'رقم الطلب' : 'Order #'}</th>
                                        <th>{isAr ? 'العميل' : 'Customer'}</th>
                                        <th>{isAr ? 'موعد التسليم' : 'Delivery'}</th>
                                        <th>{isAr ? 'المتبقي' : 'Balance Due'}</th>
                                        <th>{isAr ? 'الحالة' : 'Status'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.slice(0, 6).map(ord => (
                                        <tr key={ord.id}>
                                            <td><strong>{ord.id}</strong></td>
                                            <td>{ord.customerName}</td>
                                            <td>{ord.deliveryDate}</td>
                                            <td style={{ color: ord.balanceDue > 0 ? 'var(--accent-gold)' : 'var(--accent-success)', fontWeight: '600' }}>
                                                {formatCurrency ? formatCurrency(ord.balanceDue) : `${Number(ord.balanceDue || 0).toFixed(2)} SAR`}
                                            </td>
                                            <td>
                                                <span className={`badge ${ord.status === 'Delivered' ? 'green' : ord.status === 'Ready' ? 'cyan' : 'purple'}`}>
                                                    {ord.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TailoringDashboard;
