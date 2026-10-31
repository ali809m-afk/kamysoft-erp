import React, { useState, useEffect } from 'react';

const STAGES = [
    { key: 'Received', en: '1. Received', ar: '١. مستلم بالمشغل', icon: 'ri-inbox-archive-line', color: '#94a3b8' },
    { key: 'Cutting', en: '2. Fabric Cutting', ar: '٢. القص (خصم القماش)', icon: 'ri-scissors-cut-line', color: '#f59e0b' },
    { key: 'Stitching', en: '3. Stitching', ar: '٣. الخياطة والتفصيل', icon: 'ri-t-shirt-2-line', color: '#8b5cf6' },
    { key: 'Finishing', en: '4. Finishing & Iron', ar: '٤. التطريز والكوي', icon: 'ri-sparkling-line', color: '#06b6d4' },
    { key: 'QC', en: '5. Quality Check', ar: '٥. فحص الجودة', icon: 'ri-shield-check-line', color: '#3b82f6' },
    { key: 'TrialReady', en: '6. Ready for Trial', ar: '٦. جاهز للبروفة', icon: 'ri-user-Voice-line', color: '#ec4899' },
    { key: 'ReadyForPickup', en: '7. Ready on Rack', ar: '٧. جاهز للتسليم (بالرف)', icon: 'ri-price-tag-3-line', color: '#10b981' },
    { key: 'Delivered', en: '8. Delivered', ar: '٨. تم التسليم', icon: 'ri-checkbox-circle-line', color: '#22c55e' }
];

const WorkshopKanban = ({ employees = [], currentLanguage, formatCurrency, setProducts }) => {
    const isAr = currentLanguage === 'ar';
    const [subView, setSubView] = useState('kanban'); // 'kanban' | 'commissions'
    const [orders, setOrders] = useState([]);
    const [commissions, setCommissions] = useState([]);
    const [search, setSearch] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('ALL');
    const [toastMessage, setToastMessage] = useState('');

    const fetchWorkshopData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };
            const [ordRes, commRes] = await Promise.all([
                fetch('/api/tailoring/orders', { headers }),
                fetch('/api/tailoring/commissions', { headers })
            ]);
            if (ordRes.ok) setOrders(await ordRes.json());
            if (commRes.ok) setCommissions(await commRes.json());
        } catch (err) {
            console.error('Error fetching workshop data:', err);
        }
    };

    useEffect(() => {
        fetchWorkshopData();
    }, []);

    const handleStageUpdate = async (orderId, jobCardId, newStage, extra = {}) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/tailoring/orders/${orderId}/jobcard/${jobCardId}/stage`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ stage: newStage, ...extra })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.fabricDeductedNow && data.updatedProduct) {
                    if (setProducts) {
                        setProducts(prev => prev.map(p => p.id === data.updatedProduct.id ? data.updatedProduct : p));
                    }
                    setToastMessage(
                        isAr
                            ? `تم خصم القماش تلقائياً من المخزون لبطاقة العمل ${jobCardId} (المتبقي: ${data.updatedProduct.stock} متر)`
                            : `Fabric meters automatically deducted from inventory for ${jobCardId} (Remaining stock: ${data.updatedProduct.stock}m)`
                    );
                    setTimeout(() => setToastMessage(''), 5000);
                }
                fetchWorkshopData();
            }
        } catch (err) {
            console.error('Failed to update job card stage:', err);
        }
    };

    const allCards = orders.flatMap(ord =>
        (ord.items || []).map(jc => ({
            ...jc,
            orderId: ord.id,
            customerName: ord.customerName,
            customerPhone: ord.customerPhone,
            deliveryDate: ord.deliveryDate,
            priority: ord.priority
        }))
    );

    const filteredCards = allCards.filter(jc => {
        const matchEmp = filterEmployee === 'ALL' || jc.assignedCutterId === filterEmployee || jc.assignedTailorId === filterEmployee || jc.assignedCutterName === filterEmployee || jc.assignedTailorName === filterEmployee;
        const q = search.toLowerCase();
        const matchSearch = !q ||
            (jc.jobCardId || '').toLowerCase().includes(q) ||
            (jc.orderId || '').toLowerCase().includes(q) ||
            (jc.customerName || '').toLowerCase().includes(q) ||
            (jc.rackNumber || '').toLowerCase().includes(q);
        return matchEmp && matchSearch;
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Bar */}
            <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="ri-kanban-view" style={{ color: 'var(--accent-purple)' }}></i>
                        {isAr ? 'لوحة إنتاج المشغل وعمولات الخياطين والقصاصين' : 'Workshop Production Kanban & Tailor Piece-Rate Commissions'}
                    </h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {isAr
                            ? 'تحريك بطاقات العمل بين القص والخياطة والكوي، خصم القماش تلقائياً عند القص، وتحديد رقم الرف (الشماعة)'
                            : 'Move job cards across stages, auto-deduct fabric roll meters upon Cutting, assign pickup racks, and track piece-rate pay'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className={`btn ${subView === 'kanban' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSubView('kanban')}
                    >
                        <i className="ri-layout-column-line"></i> {isAr ? 'مراحل المشغل (Kanban)' : 'Production Kanban'}
                    </button>
                    <button
                        className={`btn ${subView === 'commissions' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSubView('commissions')}
                    >
                        <i className="ri-award-line"></i> {isAr ? 'عمولات القطعة (القصاصين والخياطين)' : 'Tailor Piece-Rate Commissions'}
                    </button>
                </div>
            </div>

            {toastMessage && (
                <div className="glass-card" style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--accent-success)', color: 'var(--accent-success)', fontWeight: 'bold' }}>
                    <i className="ri-checkbox-circle-line" style={{ marginRight: '8px' }}></i>
                    {toastMessage}
                </div>
            )}

            {subView === 'kanban' ? (
                <>
                    {/* Search & Tailor Filter */}
                    <div className="glass-card" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                            type="text"
                            className="form-control"
                            style={{ flex: '1 1 250px' }}
                            placeholder={isAr ? 'بحث برقم بطاقة العمل، العميل، أو رقم الرف...' : 'Search by Job Card #, customer, or rack #...'}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        <select className="form-control" style={{ maxWidth: '240px' }} value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
                            <option value="ALL">{isAr ? 'جميع القصاصين والخياطين' : 'All Cutters & Tailors'}</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Kanban Columns */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(245px, 1fr))', gap: '14px', alignItems: 'start' }}>
                        {STAGES.map((st, stIdx) => {
                            const stageCards = filteredCards.filter(c => c.stage === st.key);
                            return (
                                <div key={st.key} className="glass-card" style={{ padding: '14px', borderTop: `3px solid ${st.color}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <span style={{ fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <i className={st.icon} style={{ color: st.color }}></i>
                                            {isAr ? st.ar : st.en}
                                        </span>
                                        <span className="badge" style={{ background: st.color, color: '#fff' }}>{stageCards.length}</span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '120px' }}>
                                        {stageCards.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '24px 8px', fontSize: '12px', color: 'var(--text-secondary)', opacity: 0.6 }}>
                                                {isAr ? 'لا توجد قطع' : 'No garments'}
                                            </div>
                                        ) : (
                                            stageCards.map(card => (
                                                <div
                                                    key={card.jobCardId}
                                                    style={{
                                                        background: 'rgba(255,255,255,0.04)',
                                                        border: '1px solid var(--glass-border)',
                                                        borderRadius: '8px',
                                                        padding: '10px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '6px',
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <strong style={{ color: 'var(--accent-cyan)' }}>{card.jobCardId}</strong>
                                                        {card.priority !== 'Normal' && (
                                                            <span className={`badge ${card.priority === 'VIP' ? 'purple' : 'danger'}`} style={{ fontSize: '9px' }}>
                                                                {card.priority}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div><strong>{card.customerName}</strong></div>
                                                    <div style={{ color: 'var(--text-secondary)' }}>
                                                        {card.garmentType} × {card.qty} • {card.fabricName || card.fabricSource} ({card.fabricMeters}m)
                                                    </div>

                                                    {card.fabricDeducted && (
                                                        <div style={{ fontSize: '10px', color: 'var(--accent-success)' }}>
                                                            <i className="ri-check-line"></i> {isAr ? 'تم خصم القماش من المخزون' : 'Fabric deducted from stock'}
                                                        </div>
                                                    )}

                                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                        <div><i className="ri-scissors-line"></i> {isAr ? 'القصاص:' : 'Cutter:'} {card.assignedCutterName || (isAr ? 'غير محدد' : 'Unassigned')}</div>
                                                        <div><i className="ri-user-star-line"></i> {isAr ? 'الخياط:' : 'Tailor:'} {card.assignedTailorName || (isAr ? 'غير محدد' : 'Unassigned')}</div>
                                                        <div><i className="ri-calendar-line"></i> {isAr ? 'التسليم:' : 'Due:'} {card.deliveryDate}</div>
                                                    </div>

                                                    {/* Rack Number Input when in QC / TrialReady / ReadyForPickup */}
                                                    {['QC', 'TrialReady', 'ReadyForPickup'].includes(card.stage) && (
                                                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                                            <input
                                                                type="text"
                                                                className="form-control"
                                                                style={{ padding: '4px 6px', fontSize: '11px' }}
                                                                placeholder={isAr ? 'رقم الرف / الشماعة (مثال: A-12)' : 'Rack / Hanger # (e.g. A-12)'}
                                                                defaultValue={card.rackNumber || ''}
                                                                onBlur={e => {
                                                                    if (e.target.value !== card.rackNumber) {
                                                                        handleStageUpdate(card.orderId, card.jobCardId, card.stage, { rackNumber: e.target.value });
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Stage Navigation Buttons */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--glass-border)' }}>
                                                        {stIdx > 0 && (
                                                            <button
                                                                className="btn btn-secondary"
                                                                style={{ padding: '3px 8px', fontSize: '11px' }}
                                                                onClick={() => handleStageUpdate(card.orderId, card.jobCardId, STAGES[stIdx - 1].key)}
                                                            >
                                                                {isAr ? 'السابق' : '← Prev'}
                                                            </button>
                                                        )}
                                                        {stIdx < STAGES.length - 1 && (
                                                            <button
                                                                className="btn btn-primary"
                                                                style={{ padding: '3px 10px', fontSize: '11px', marginLeft: 'auto' }}
                                                                onClick={() => handleStageUpdate(card.orderId, card.jobCardId, STAGES[stIdx + 1].key)}
                                                            >
                                                                {isAr ? `نقل إلى: ${STAGES[stIdx + 1].ar.split('. ')[1]}` : `Next: ${STAGES[stIdx + 1].en.split('. ')[1]} →`}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                /* TAILOR & CUTTER PIECE-RATE COMMISSIONS VIEW */
                <div className="glass-card">
                    <h3 style={{ marginTop: 0, marginBottom: '12px' }}>
                        <i className="ri-award-line" style={{ color: 'var(--accent-gold)', marginRight: '8px' }}></i>
                        {isAr ? 'تقرير عمولات الإنتاج بالقطعة (القصاصين والخياطين)' : 'Piece-Rate Production Commissions (Cutters & Master Tailors)'}
                    </h3>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>{isAr ? 'الموظف / الفني' : 'Employee Name'}</th>
                                    <th>{isAr ? 'الدور بالمشغل' : 'Workshop Role'}</th>
                                    <th>{isAr ? 'عدد القطع المقصوصة' : 'Garments Cut'}</th>
                                    <th>{isAr ? 'عمولة القص' : 'Cutting Commission'}</th>
                                    <th>{isAr ? 'عدد القطع المخيطة' : 'Garments Stitched'}</th>
                                    <th>{isAr ? 'عمولة الخياطة' : 'Stitching Commission'}</th>
                                    <th>{isAr ? 'إجمالي العمولة المستحقة' : 'Total Earned Commission'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {commissions.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                                            {isAr ? 'لا توجد عمولات مسجلة بعد (تُحتسب العمولة تلقائياً عند إتمام مرحلة القص أو الخياطة)' : 'No completed piece-rate commissions yet (commissions accrue automatically as garments complete Cutting and Stitching stages).'}
                                        </td>
                                    </tr>
                                ) : (
                                    commissions.map(c => (
                                        <tr key={c.employeeId}>
                                            <td><strong>{c.employeeName}</strong></td>
                                            <td><span className="badge purple">{c.role}</span></td>
                                            <td>{c.cutsCompleted}</td>
                                            <td>{formatCurrency ? formatCurrency(c.cuttingCommission) : `${c.cuttingCommission.toFixed(2)} SAR`}</td>
                                            <td>{c.stitchesCompleted}</td>
                                            <td>{formatCurrency ? formatCurrency(c.stitchingCommission) : `${c.stitchingCommission.toFixed(2)} SAR`}</td>
                                            <td style={{ fontWeight: 'bold', color: 'var(--accent-success)', fontSize: '15px' }}>
                                                {formatCurrency ? formatCurrency(c.totalCommission) : `${c.totalCommission.toFixed(2)} SAR`}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkshopKanban;
