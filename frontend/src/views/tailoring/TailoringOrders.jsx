import React, { useState, useEffect } from 'react';

const createEmptyJobCard = () => ({
    jobCardId: '',
    garmentType: 'Thobe',
    measurementProfileId: '',
    profileName: '',
    unit: 'inch',
    measurementSnapshot: {
        length: '58', shoulder: '17.5', chest: '22', waist: '21',
        sleeveLength: '25', wrist: '9', neck: '15.5', bottomWidth: '28'
    },
    styleConfig: {
        collarType: 'Mandarin (قلاب صيني)',
        cuffType: 'Plain Sleeve (كم سادة)',
        placketType: 'Hidden Buttons (جبزور مخفي)',
        pocketStyle: 'Classic Chest + 2 Side',
        fitType: 'Regular (عادي مريح)',
        stitchType: 'Single Hidden (خياطة مخفية)',
        embroideryNotes: ''
    },
    fabricSource: 'Shop',
    fabricProductId: '',
    fabricName: '',
    fabricColor: 'White / أبيض',
    fabricMeters: 3.5,
    qty: 1,
    stitchingPrice: 120,
    fabricPrice: 0,
    addOnsPrice: 0,
    unitTotal: 120,
    assignedCutterId: '',
    assignedCutterName: '',
    cutterCommission: 15,
    assignedTailorId: '',
    assignedTailorName: '',
    tailorCommission: 35,
    stage: 'Received',
    rackNumber: '',
    notes: ''
});

const TailoringOrders = ({
    customers = [],
    products = [],
    employees = [],
    settings,
    currentLanguage,
    formatCurrency,
    setInvoices,
    setActiveInvoice,
    setShowInvoiceModal
}) => {
    const isAr = currentLanguage === 'ar';
    const [orders, setOrders] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [showNewOrderModal, setShowNewOrderModal] = useState(false);
    const [settleOrder, setSettleOrder] = useState(null);
    const [settleAmount, setSettleAmount] = useState(0);
    const [settleMethod, setSettleMethod] = useState('Cash');
    const [settleDeliver, setSettleDeliver] = useState(true);
    const [settleRack, setSettleRack] = useState('');
    const [printJobCard, setPrintJobCard] = useState(null);

    const [orderForm, setOrderForm] = useState({
        customerId: '',
        customerName: '',
        customerPhone: '',
        orderDate: new Date().toISOString().slice(0, 10),
        trialDate: '',
        deliveryDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        priority: 'Normal',
        discount: 0,
        depositPaid: 0,
        paymentMethod: 'Cash',
        isAlteration: false,
        originalOrderId: '',
        notes: '',
        items: [createEmptyJobCard()]
    });

    const fetchAll = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };
            const [ordRes, profRes] = await Promise.all([
                fetch('/api/tailoring/orders', { headers }),
                fetch('/api/tailoring/measurements', { headers })
            ]);
            if (ordRes.ok) setOrders(await ordRes.json());
            if (profRes.ok) {
                const profList = await profRes.json();
                setProfiles(profList);
                // Check if navigated from MeasurementProfiles with a preselected profile
                const preId = localStorage.getItem('selectedTailoringProfileId');
                if (preId) {
                    localStorage.removeItem('selectedTailoringProfileId');
                    const found = profList.find(p => p.id === preId);
                    if (found) {
                        const jc = createEmptyJobCard();
                        jc.measurementProfileId = found.id;
                        jc.profileName = found.profileName;
                        jc.garmentType = found.garmentType || 'Thobe';
                        jc.unit = found.unit || 'inch';
                        jc.measurementSnapshot = { ...(found.measurements || {}) };
                        jc.styleConfig = { ...(found.stylePreferences || {}) };
                        setOrderForm(prev => ({
                            ...prev,
                            customerId: found.customerId || '',
                            customerName: found.customerName || '',
                            customerPhone: found.customerPhone || '',
                            items: [jc]
                        }));
                        setShowNewOrderModal(true);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to load tailoring orders:', err);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const handleCustomerChange = (custId) => {
        const cust = customers.find(c => c.id === custId);
        if (cust) {
            const custProfiles = profiles.filter(p => p.customerId === cust.id || p.customerPhone === cust.phone);
            const firstProf = custProfiles[0];
            setOrderForm(prev => ({
                ...prev,
                customerId: cust.id,
                customerName: cust.name,
                customerPhone: cust.phone || '',
                items: prev.items.map((it, idx) => idx === 0 && firstProf ? {
                    ...it,
                    measurementProfileId: firstProf.id,
                    profileName: firstProf.profileName,
                    garmentType: firstProf.garmentType || it.garmentType,
                    unit: firstProf.unit || 'inch',
                    measurementSnapshot: { ...(firstProf.measurements || {}) },
                    styleConfig: { ...(firstProf.stylePreferences || {}) }
                } : it)
            }));
        } else {
            setOrderForm(prev => ({ ...prev, customerId: custId }));
        }
    };

    const handleItemProfileSelect = (idx, profId) => {
        const prof = profiles.find(p => p.id === profId);
        setOrderForm(prev => {
            const items = [...prev.items];
            if (prof) {
                items[idx] = {
                    ...items[idx],
                    measurementProfileId: prof.id,
                    profileName: prof.profileName,
                    garmentType: prof.garmentType || items[idx].garmentType,
                    unit: prof.unit || 'inch',
                    measurementSnapshot: { ...(prof.measurements || {}) },
                    styleConfig: { ...(prof.stylePreferences || {}) }
                };
            } else {
                items[idx] = { ...items[idx], measurementProfileId: '' };
            }
            return { ...prev, items };
        });
    };

    const handleFabricSelect = (idx, prodId) => {
        const prod = products.find(p => p.id === prodId);
        setOrderForm(prev => {
            const items = [...prev.items];
            const item = { ...items[idx], fabricProductId: prodId };
            if (prod) {
                item.fabricName = isAr ? prod.nameAR : prod.nameEN;
                const meters = Number(item.fabricMeters || 3.5);
                item.fabricPrice = +(Number(prod.price || 0) * meters).toFixed(2);
            } else {
                item.fabricName = '';
                item.fabricPrice = 0;
            }
            item.unitTotal = +(Number(item.stitchingPrice || 0) + Number(item.fabricPrice || 0) + Number(item.addOnsPrice || 0)).toFixed(2);
            items[idx] = item;
            return { ...prev, items };
        });
    };

    const updateJobCardField = (idx, field, value) => {
        setOrderForm(prev => {
            const items = [...prev.items];
            const item = { ...items[idx], [field]: value };

            if (field === 'fabricMeters' && item.fabricSource === 'Shop' && item.fabricProductId) {
                const prod = products.find(p => p.id === item.fabricProductId);
                if (prod) {
                    item.fabricPrice = +(Number(prod.price || 0) * Number(value || 0)).toFixed(2);
                }
            }
            if (field === 'fabricSource' && value === 'Customer') {
                item.fabricProductId = '';
                item.fabricPrice = 0;
            }
            if (field === 'assignedCutterId') {
                const emp = employees.find(e => e.id === value);
                item.assignedCutterName = emp ? emp.name : '';
            }
            if (field === 'assignedTailorId') {
                const emp = employees.find(e => e.id === value);
                item.assignedTailorName = emp ? emp.name : '';
            }

            item.unitTotal = +(Number(item.stitchingPrice || 0) + Number(item.fabricPrice || 0) + Number(item.addOnsPrice || 0)).toFixed(2);
            items[idx] = item;
            return { ...prev, items };
        });
    };

    const rawSubtotal = orderForm.items.reduce((acc, it) => acc + (Number(it.unitTotal || 0) * Number(it.qty || 1)), 0);
    const netAfterDiscount = Math.max(0, rawSubtotal - (Number(orderForm.discount) || 0));
    const vatRate = settings?.taxRate || 15;
    const vatAmount = +(netAfterDiscount * (vatRate / 100)).toFixed(2);
    const grandTotal = +(netAfterDiscount + vatAmount).toFixed(2);
    const balanceRemaining = Math.max(0, +(grandTotal - (Number(orderForm.depositPaid) || 0)).toFixed(2));

    const handleCreateOrder = async (e) => {
        e.preventDefault();
        if (!orderForm.customerName) {
            alert(isAr ? 'يرجى إدخال اسم العميل' : 'Please enter customer name');
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const payload = {
                ...orderForm,
                subtotal: +netAfterDiscount.toFixed(2),
                vat: vatAmount,
                totalAmount: grandTotal
            };
            const res = await fetch('/api/tailoring/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const data = await res.json();
                setShowNewOrderModal(false);
                fetchAll();
                if (data.invoice) {
                    if (setInvoices) setInvoices(prev => [data.invoice, ...prev]);
                    if (setActiveInvoice && setShowInvoiceModal) {
                        setActiveInvoice(data.invoice);
                        setShowInvoiceModal(true);
                    }
                }
            }
        } catch (err) {
            console.error('Error creating tailoring order:', err);
        }
    };

    const handleSettleSubmit = async (e) => {
        e.preventDefault();
        if (!settleOrder) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/tailoring/orders/${settleOrder.id}/settle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    amountPaid: settleAmount,
                    paymentMethod: settleMethod,
                    markDelivered: settleDeliver,
                    rackNumber: settleRack
                })
            });
            if (res.ok) {
                const data = await res.json();
                setSettleOrder(null);
                fetchAll();
                if (data.invoice) {
                    if (setInvoices) setInvoices(prev => [data.invoice, ...prev]);
                    if (setActiveInvoice && setShowInvoiceModal) {
                        setActiveInvoice(data.invoice);
                        setShowInvoiceModal(true);
                    }
                }
            }
        } catch (err) {
            console.error('Settle balance error:', err);
        }
    };

    const handleDeleteOrder = async (id) => {
        if (!window.confirm(isAr ? 'هل أنت متأكد من حذف أمر التفصيل؟' : 'Delete this tailoring order?')) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/tailoring/orders/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) fetchAll();
        } catch (err) {
            console.error(err);
        }
    };

    const filteredOrders = orders.filter(o => {
        const matchStatus = filterStatus === 'ALL' || o.status === filterStatus || o.paymentStatus === filterStatus;
        const q = search.toLowerCase();
        const matchSearch = !q ||
            (o.id || '').toLowerCase().includes(q) ||
            (o.customerName || '').toLowerCase().includes(q) ||
            (o.customerPhone || '').toLowerCase().includes(q);
        return matchStatus && matchSearch;
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header */}
            <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="ri-scissors-2-line" style={{ color: 'var(--accent-gold)' }}></i>
                        {isAr ? 'أوامر التفصيل، العربون، وتسليم القطع' : 'Tailoring Orders, Deposits & Pickup Settlement'}
                    </h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {isAr
                            ? 'إنشاء أمر تفصيل مع اختيار القماش بالمتر أو قماش خارجي، تحصيل العربون بفاتورة ضريبية، وتسوية المتبقي عند الاستلام'
                            : 'Create bespoke garment orders with fractional fabric consumption, ZATCA advance deposit invoices, and balance settlement'}
                    </p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => {
                        setOrderForm({
                            customerId: '',
                            customerName: '',
                            customerPhone: '',
                            orderDate: new Date().toISOString().slice(0, 10),
                            trialDate: '',
                            deliveryDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
                            priority: 'Normal',
                            discount: 0,
                            depositPaid: 0,
                            paymentMethod: 'Cash',
                            isAlteration: false,
                            originalOrderId: '',
                            notes: '',
                            items: [createEmptyJobCard()]
                        });
                        setShowNewOrderModal(true);
                    }}
                >
                    <i className="ri-add-circle-line"></i> {isAr ? 'أمر تفصيل جديد (POS)' : 'New Bespoke Order'}
                </button>
            </div>

            {/* Filters */}
            <div className="glass-card" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    type="text"
                    className="form-control"
                    style={{ flex: '1 1 260px' }}
                    placeholder={isAr ? 'بحث برقم الطلب، اسم العميل، أو الجوال...' : 'Search by order #, customer, or phone...'}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                        { k: 'ALL', l: isAr ? 'الكل' : 'All' },
                        { k: 'InProduction', l: isAr ? 'قيد التنفيذ' : 'In Production' },
                        { k: 'Ready', l: isAr ? 'جاهز للتسليم' : 'Ready for Pickup' },
                        { k: 'Delivered', l: isAr ? 'تم التسليم' : 'Delivered' },
                        { k: 'DepositPaid', l: isAr ? 'عربون (متبقي ذمم)' : 'Deposit Paid (Balance Due)' }
                    ].map(f => (
                        <button
                            key={f.k}
                            className={`btn ${filterStatus === f.k ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => setFilterStatus(f.k)}
                        >
                            {f.l}
                        </button>
                    ))}
                </div>
            </div>

            {/* Orders Table */}
            <div className="glass-card">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>{isAr ? 'رقم الطلب' : 'Order #'}</th>
                                <th>{isAr ? 'العميل' : 'Customer'}</th>
                                <th>{isAr ? 'القطع وبطاقات العمل' : 'Garments & Job Cards'}</th>
                                <th>{isAr ? 'موعد التسليم' : 'Delivery Date'}</th>
                                <th>{isAr ? 'الإجمالي' : 'Total'}</th>
                                <th>{isAr ? 'العربون المدفوع' : 'Paid / Deposit'}</th>
                                <th>{isAr ? 'المتبقي' : 'Balance Due'}</th>
                                <th>{isAr ? 'حالة الطلب' : 'Status'}</th>
                                <th>{isAr ? 'إجراءات' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                                        {isAr ? 'لا توجد أوامر تفصيل مطابقة' : 'No tailoring orders found'}
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map(ord => (
                                    <tr key={ord.id}>
                                        <td>
                                            <strong>{ord.id}</strong>
                                            {ord.priority !== 'Normal' && (
                                                <span className={`badge ${ord.priority === 'VIP' ? 'purple' : 'danger'}`} style={{ marginLeft: '6px', fontSize: '10px' }}>
                                                    {ord.priority}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div><strong>{ord.customerName}</strong></div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{ord.customerPhone}</div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {(ord.items || []).map(jc => (
                                                    <div key={jc.jobCardId} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                                        <span className="badge cyan" style={{ fontSize: '10px' }}>{jc.jobCardId}</span>
                                                        <span>{jc.garmentType} x{jc.qty} ({jc.stage})</span>
                                                        {jc.rackNumber && <span className="badge green" style={{ fontSize: '10px' }}>{jc.rackNumber}</span>}
                                                        <button
                                                            className="btn btn-secondary"
                                                            style={{ padding: '2px 6px', fontSize: '10px' }}
                                                            title={isAr ? 'طباعة بطاقة المشغل' : 'Print Workshop Job Card'}
                                                            onClick={() => setPrintJobCard({ ...jc, orderId: ord.id, customerName: ord.customerName, customerPhone: ord.customerPhone, deliveryDate: ord.deliveryDate, priority: ord.priority })}
                                                        >
                                                            <i className="ri-printer-line"></i>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td>
                                            <div>{ord.deliveryDate}</div>
                                            {ord.trialDate && <div style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>{isAr ? 'بروفة:' : 'Trial:'} {ord.trialDate}</div>}
                                        </td>
                                        <td><strong>{formatCurrency ? formatCurrency(ord.totalAmount) : `${Number(ord.totalAmount).toFixed(2)} SAR`}</strong></td>
                                        <td style={{ color: 'var(--accent-success)' }}>
                                            {formatCurrency ? formatCurrency(ord.depositPaid) : `${Number(ord.depositPaid).toFixed(2)} SAR`}
                                        </td>
                                        <td style={{ color: ord.balanceDue > 0 ? 'var(--accent-gold)' : 'var(--text-secondary)', fontWeight: 'bold' }}>
                                            {formatCurrency ? formatCurrency(ord.balanceDue) : `${Number(ord.balanceDue).toFixed(2)} SAR`}
                                        </td>
                                        <td>
                                            <span className={`badge ${ord.status === 'Delivered' ? 'green' : ord.status === 'Ready' ? 'cyan' : 'purple'}`}>
                                                {ord.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {(ord.balanceDue > 0 || ord.status !== 'Delivered') && (
                                                    <button
                                                        className="btn btn-primary"
                                                        style={{ padding: '5px 10px', fontSize: '11px' }}
                                                        onClick={() => {
                                                            setSettleOrder(ord);
                                                            setSettleAmount(ord.balanceDue);
                                                            setSettleMethod('Cash');
                                                            setSettleDeliver(true);
                                                            setSettleRack((ord.items?.[0]?.rackNumber) || '');
                                                        }}
                                                    >
                                                        <i className="ri-check-double-line"></i> {isAr ? 'تسوية وتسليم' : 'Settle & Deliver'}
                                                    </button>
                                                )}
                                                <button className="btn btn-danger" style={{ padding: '5px 8px', fontSize: '11px' }} onClick={() => handleDeleteOrder(ord.id)}>
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

            {/* MODAL: NEW BESPOKE TAILORING ORDER */}
            {showNewOrderModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '960px', width: '96%', maxHeight: '92vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                            <h3 style={{ margin: 0 }}>
                                <i className="ri-scissors-cut-line" style={{ color: 'var(--accent-gold)', marginRight: '8px' }}></i>
                                {isAr ? 'أمر تفصيل جديد وحساب العربون' : 'New Bespoke Tailoring Order & Deposit Checkout'}
                            </h3>
                            <button className="btn btn-secondary" onClick={() => setShowNewOrderModal(false)}>✕</button>
                        </div>

                        <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Customer & Dates Row */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{isAr ? 'اختر عميل مسجل' : 'Select Customer'}</label>
                                    <select className="form-control" value={orderForm.customerId} onChange={e => handleCustomerChange(e.target.value)}>
                                        <option value="">{isAr ? '-- عميل جديد / نقدي --' : '-- Walk-in / Manual --'}</option>
                                        {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{isAr ? 'اسم العميل *' : 'Customer Name *'}</label>
                                    <input type="text" className="form-control" required value={orderForm.customerName} onChange={e => setOrderForm({ ...orderForm, customerName: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{isAr ? 'رقم الجوال' : 'Phone'}</label>
                                    <input type="text" className="form-control" value={orderForm.customerPhone} onChange={e => setOrderForm({ ...orderForm, customerPhone: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{isAr ? 'تاريخ البروفة (اختياري)' : 'Trial / Fitting Date'}</label>
                                    <input type="date" className="form-control" value={orderForm.trialDate} onChange={e => setOrderForm({ ...orderForm, trialDate: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{isAr ? 'تاريخ التسليم النهائي *' : 'Delivery Date *'}</label>
                                    <input type="date" className="form-control" required value={orderForm.deliveryDate} onChange={e => setOrderForm({ ...orderForm, deliveryDate: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{isAr ? 'الأولوية' : 'Priority'}</label>
                                    <select className="form-control" value={orderForm.priority} onChange={e => setOrderForm({ ...orderForm, priority: e.target.value })}>
                                        <option value="Normal">{isAr ? 'عادي (Normal)' : 'Normal'}</option>
                                        <option value="Express">{isAr ? 'مستعجل 24 ساعة (Express)' : 'Express (Rush)'}</option>
                                        <option value="VIP">{isAr ? 'كبار العملاء (VIP)' : 'VIP'}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Job Cards / Garment Items */}
                            {orderForm.items.map((item, idx) => (
                                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h4 style={{ margin: 0, color: 'var(--accent-cyan)' }}>
                                            <i className="ri-t-shirt-line"></i> {isAr ? `القطعة / بطاقة العمل #${idx + 1}` : `Garment Job Card #${idx + 1}`}
                                        </h4>
                                        {orderForm.items.length > 1 && (
                                            <button
                                                type="button"
                                                className="btn btn-danger"
                                                style={{ padding: '4px 10px', fontSize: '12px' }}
                                                onClick={() => setOrderForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))}
                                            >
                                                {isAr ? 'حذف القطعة' : 'Remove'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Row 1: Measurement Profile, Garment Type, Qty */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.8fr', gap: '12px' }}>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '12px' }}>{isAr ? 'تحميل مقاس محفوظ للعميل' : 'Load Saved Measurement Profile'}</label>
                                            <select className="form-control" value={item.measurementProfileId} onChange={e => handleItemProfileSelect(idx, e.target.value)}>
                                                <option value="">{isAr ? '-- إدخال المقاس يدوياً أدناه --' : '-- Enter measurements manually below --'}</option>
                                                {profiles.map(p => (
                                                    <option key={p.id} value={p.id}>{p.profileName} ({p.customerName} - {p.garmentType})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '12px' }}>{isAr ? 'نوع القطعة' : 'Garment Type'}</label>
                                            <select className="form-control" value={item.garmentType} onChange={e => updateJobCardField(idx, 'garmentType', e.target.value)}>
                                                <option value="Thobe">{isAr ? 'ثوب رجالي (Thobe)' : 'Saudi Thobe'}</option>
                                                <option value="Suit">{isAr ? 'بدلة رسمية (Suit)' : 'Formal Suit'}</option>
                                                <option value="Shirt">{isAr ? 'قميص (Shirt)' : 'Dress Shirt'}</option>
                                                <option value="Trouser">{isAr ? 'بنطلون (Trouser)' : 'Trouser'}</option>
                                                <option value="Abaya">{isAr ? 'عباءة (Abaya)' : 'Abaya'}</option>
                                                <option value="Uniform">{isAr ? 'زي موحد (Uniform)' : 'Uniform'}</option>
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '12px' }}>{isAr ? 'العدد (الكمية)' : 'Quantity'}</label>
                                            <input type="number" min="1" className="form-control" value={item.qty} onChange={e => updateJobCardField(idx, 'qty', Number(e.target.value))} />
                                        </div>
                                    </div>

                                    {/* Row 2: Quick Measurements Snapshot */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                                        {[
                                            { k: 'length', l: isAr ? 'الطول' : 'Length' },
                                            { k: 'shoulder', l: isAr ? 'الكتف' : 'Shoulder' },
                                            { k: 'chest', l: isAr ? 'الصدر' : 'Chest' },
                                            { k: 'waist', l: isAr ? 'الوسط' : 'Waist' },
                                            { k: 'sleeveLength', l: isAr ? 'الكم' : 'Sleeve' },
                                            { k: 'wrist', l: isAr ? 'المعصم' : 'Wrist' },
                                            { k: 'neck', l: isAr ? 'الرقبة' : 'Neck' },
                                            { k: 'bottomWidth', l: isAr ? 'الخطوة' : 'Bottom' }
                                        ].map(mField => (
                                            <div key={mField.k}>
                                                <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>{mField.l}</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    style={{ padding: '4px 6px', fontSize: '12px' }}
                                                    value={item.measurementSnapshot?.[mField.k] || ''}
                                                    onChange={e => {
                                                        const snap = { ...(item.measurementSnapshot || {}), [mField.k]: e.target.value };
                                                        updateJobCardField(idx, 'measurementSnapshot', snap);
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Row 3: Fabric Source & Fractional Meter Calculation */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '10px' }}>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '12px' }}>{isAr ? 'مصدر القماش' : 'Fabric Source'}</label>
                                            <select className="form-control" value={item.fabricSource} onChange={e => updateJobCardField(idx, 'fabricSource', e.target.value)}>
                                                <option value="Shop">{isAr ? 'من مخزون المحل (بالمتر)' : 'Shop Fabric Inventory (By Meter)'}</option>
                                                <option value="Customer">{isAr ? 'قماش خارجي من العميل (تفصيل فقط)' : "Customer's Own Fabric (Stitching Only)"}</option>
                                            </select>
                                        </div>

                                        {item.fabricSource === 'Shop' ? (
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label style={{ fontSize: '12px' }}>{isAr ? 'اختر القماش من المخزون' : 'Select Shop Fabric Roll'}</label>
                                                <select className="form-control" value={item.fabricProductId} onChange={e => handleFabricSelect(idx, e.target.value)}>
                                                    <option value="">{isAr ? '-- اختر القماش --' : '-- Choose Fabric --'}</option>
                                                    {products.map(p => (
                                                        <option key={p.id} value={p.id}>
                                                            {isAr ? p.nameAR : p.nameEN} ({p.price} SAR/m • {isAr ? 'المتوفر:' : 'Stock:'} {p.stock}m)
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label style={{ fontSize: '12px' }}>{isAr ? 'وصف القماش الخارجي ولونه' : 'Customer Fabric Description'}</label>
                                                <input type="text" className="form-control" placeholder={isAr ? 'مثال: قماش أبيض ياباني من العميل' : 'e.g. Customer white linen'} value={item.fabricName} onChange={e => updateJobCardField(idx, 'fabricName', e.target.value)} />
                                            </div>
                                        )}

                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '12px' }}>{isAr ? 'الأمتار للقطعة الواحدة (متر)' : 'Meters per Garment (m)'}</label>
                                            <input type="number" step="0.25" min="0.5" className="form-control" value={item.fabricMeters} onChange={e => updateJobCardField(idx, 'fabricMeters', Number(e.target.value))} />
                                        </div>

                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '12px' }}>{isAr ? 'القصاص (Cutter)' : 'Assign Cutter'}</label>
                                            <select className="form-control" value={item.assignedCutterId} onChange={e => updateJobCardField(idx, 'assignedCutterId', e.target.value)}>
                                                <option value="">{isAr ? '-- اختر القصاص --' : '-- Select Cutter --'}</option>
                                                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                                            </select>
                                        </div>

                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '12px' }}>{isAr ? 'الخياط (Master Tailor)' : 'Assign Master Tailor'}</label>
                                            <select className="form-control" value={item.assignedTailorId} onChange={e => updateJobCardField(idx, 'assignedTailorId', e.target.value)}>
                                                <option value="">{isAr ? '-- اختر الخياط --' : '-- Select Tailor --'}</option>
                                                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Row 4: Pricing Breakdown */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', borderTop: '1px solid var(--glass-border)', paddingTop: '10px' }}>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '11px' }}>{isAr ? 'سعر الخياطة والتفصيل' : 'Stitching Fee (Ex. VAT)'}</label>
                                            <input type="number" min="0" step="0.01" className="form-control" value={item.stitchingPrice} onChange={e => updateJobCardField(idx, 'stitchingPrice', Number(e.target.value))} />
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '11px' }}>{isAr ? 'قيمة القماش للقطعة' : 'Fabric Cost per Unit'}</label>
                                            <input type="number" min="0" step="0.01" className="form-control" value={item.fabricPrice} onChange={e => updateJobCardField(idx, 'fabricPrice', Number(e.target.value))} />
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '11px' }}>{isAr ? 'إضافات (تطريز / مستعجل)' : 'Add-ons (Embroidery/Rush)'}</label>
                                            <input type="number" min="0" step="0.01" className="form-control" value={item.addOnsPrice} onChange={e => updateJobCardField(idx, 'addOnsPrice', Number(e.target.value))} />
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '11px' }}>{isAr ? 'إجمالي القطعة × العدد' : 'Line Total (Ex. VAT)'}</label>
                                            <div className="form-control" style={{ fontWeight: 'bold', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center' }}>
                                                {((item.unitTotal || 0) * (item.qty || 1)).toFixed(2)} SAR
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setOrderForm(prev => ({ ...prev, items: [...prev.items, createEmptyJobCard()] }))}
                                >
                                    <i className="ri-add-line"></i> {isAr ? 'إضافة قطعة أخرى لنفس الطلب' : 'Add Another Garment to Order'}
                                </button>
                            </div>

                            {/* Financial Summary & Advance Deposit (عربون) Box */}
                            <div className="glass-card" style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid var(--accent-success)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '14px', alignItems: 'end' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>{isAr ? 'الخصم (SAR)' : 'Discount (SAR)'}</label>
                                        <input type="number" min="0" step="0.01" className="form-control" value={orderForm.discount} onChange={e => setOrderForm({ ...orderForm, discount: Number(e.target.value) })} />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ color: 'var(--accent-success)', fontWeight: 'bold' }}>
                                            {isAr ? 'العربون المدفوع الآن (شامل الضريبة)' : 'Advance Deposit Paid Now (Inc. VAT)'}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max={grandTotal}
                                            step="0.01"
                                            className="form-control"
                                            value={orderForm.depositPaid}
                                            onChange={e => setOrderForm({ ...orderForm, depositPaid: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>{isAr ? 'طريقة دفع العربون' : 'Payment Method'}</label>
                                        <select className="form-control" value={orderForm.paymentMethod} onChange={e => setOrderForm({ ...orderForm, paymentMethod: e.target.value })}>
                                            <option value="Cash">{isAr ? 'نقدي (Cash)' : 'Cash'}</option>
                                            <option value="Card">{isAr ? 'شبكة / مدى (Card)' : 'Mada / Card'}</option>
                                            <option value="Bank Transfer">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                                        </select>
                                    </div>
                                    <div style={{ textAlign: isAr ? 'left' : 'right' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            {isAr ? 'الإجمالي شامل ضريبة 15%:' : 'Total (Inc. 15% VAT):'} <strong>{grandTotal.toFixed(2)} SAR</strong>
                                        </div>
                                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent-gold)', marginTop: '4px' }}>
                                            {isAr ? 'المتبقي عند الاستلام:' : 'Balance Due on Pickup:'} {balanceRemaining.toFixed(2)} SAR
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowNewOrderModal(false)}>
                                    {isAr ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    <i className="ri-check-double-line"></i> {isAr ? 'اعتماد أمر التفصيل وإصدار فاتورة العربون' : 'Confirm Order & Issue ZATCA Deposit Invoice'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: SETTLE BALANCE & DELIVER */}
            {settleOrder && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '480px', width: '95%' }}>
                        <h3 style={{ marginTop: 0 }}>
                            <i className="ri-hand-coin-line" style={{ color: 'var(--accent-success)', marginRight: '8px' }}></i>
                            {isAr ? `تسوية المتبقي وتسليم الطلب (${settleOrder.id})` : `Settle Balance & Deliver (${settleOrder.id})`}
                        </h3>
                        <form onSubmit={handleSettleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6' }}>
                                <div><strong>{isAr ? 'العميل:' : 'Customer:'}</strong> {settleOrder.customerName}</div>
                                <div><strong>{isAr ? 'إجمالي الطلب:' : 'Order Total:'}</strong> {settleOrder.totalAmount} SAR</div>
                                <div><strong>{isAr ? 'المدفوع سابقاً (العربون):' : 'Previously Paid:'}</strong> {settleOrder.depositPaid} SAR</div>
                                <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '15px' }}>
                                    {isAr ? 'المبلغ المتبقي المستحق:' : 'Remaining Balance Due:'} {settleOrder.balanceDue} SAR
                                </div>
                            </div>

                            <div className="form-group" style={{ margin: 0 }}>
                                <label>{isAr ? 'المبلغ المستلم الآن (SAR)' : 'Amount Collected Now (SAR)'}</label>
                                <input type="number" step="0.01" min="0" max={settleOrder.balanceDue} className="form-control" value={settleAmount} onChange={e => setSettleAmount(Number(e.target.value))} />
                            </div>

                            <div className="form-group" style={{ margin: 0 }}>
                                <label>{isAr ? 'طريقة الدفع' : 'Payment Method'}</label>
                                <select className="form-control" value={settleMethod} onChange={e => setSettleMethod(e.target.value)}>
                                    <option value="Cash">{isAr ? 'نقدي (Cash)' : 'Cash'}</option>
                                    <option value="Card">{isAr ? 'شبكة / مدى (Card)' : 'Mada / Card'}</option>
                                    <option value="Bank Transfer">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ margin: 0 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={settleDeliver} onChange={e => setSettleDeliver(e.target.checked)} />
                                    <span>{isAr ? 'تحديث حالة جميع القطع إلى (تم التسليم للعميل)' : 'Mark all garments in this order as Delivered'}</span>
                                </label>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setSettleOrder(null)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                                <button type="submit" className="btn btn-primary">
                                    <i className="ri-printer-line"></i> {isAr ? 'تأكيد الاستلام وإصدار فاتورة التسوية' : 'Confirm & Issue Final ZATCA Invoice'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: PRINT WORKSHOP JOB CARD / GARMENT TAG (NO PRICES) */}
            {printJobCard && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '460px', width: '95%' }}>
                        <div style={{ background: '#fff', color: '#000', padding: '18px', borderRadius: '8px', fontFamily: 'Cairo, sans-serif' }}>
                            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0, fontSize: '16px' }}>WORKSHOP JOB CARD / بطاقة تشغيل مشغل</h3>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px' }}>
                                    {printJobCard.jobCardId} ({printJobCard.priority})
                                </div>
                                <div style={{ fontSize: '11px' }}>Order: {printJobCard.orderId} • Delivery: {printJobCard.deliveryDate}</div>
                            </div>

                            <div style={{ fontSize: '12px', marginBottom: '10px', lineHeight: '1.5' }}>
                                <div><strong>Customer / العميل:</strong> {printJobCard.customerName} ({printJobCard.customerPhone})</div>
                                <div><strong>Garment / القطعة:</strong> {printJobCard.garmentType} × {printJobCard.qty}</div>
                                <div><strong>Fabric / القماش:</strong> {printJobCard.fabricName || printJobCard.fabricSource} ({printJobCard.fabricMeters}m)</div>
                                <div><strong>Cutter / القصاص:</strong> {printJobCard.assignedCutterName || '-'} | <strong>Tailor / الخياط:</strong> {printJobCard.assignedTailorName || '-'}</div>
                                {printJobCard.rackNumber && <div><strong>Rack / الشماعة:</strong> {printJobCard.rackNumber}</div>}
                            </div>

                            <div style={{ border: '1px solid #000', borderRadius: '4px', padding: '8px', marginBottom: '10px' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '12px', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '6px' }}>
                                    Measurements ({printJobCard.unit || 'inch'}) / المقاسات
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', fontSize: '11px', textAlign: 'center' }}>
                                    {Object.entries(printJobCard.measurementSnapshot || {}).filter(([_, v]) => v).map(([k, v]) => (
                                        <div key={k} style={{ border: '1px solid #ddd', padding: '3px' }}>
                                            <div style={{ fontSize: '9px', color: '#555', textTransform: 'uppercase' }}>{k}</div>
                                            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ fontSize: '11px', background: '#f5f5f5', padding: '8px', borderRadius: '4px', marginBottom: '10px' }}>
                                <div><strong>Collar / القلاب:</strong> {printJobCard.styleConfig?.collarType}</div>
                                <div><strong>Cuff / الكبك:</strong> {printJobCard.styleConfig?.cuffType}</div>
                                <div><strong>Placket / الجبزور:</strong> {printJobCard.styleConfig?.placketType}</div>
                                <div><strong>Pocket / الجيوب:</strong> {printJobCard.styleConfig?.pocketStyle}</div>
                                <div><strong>Fit / القصة:</strong> {printJobCard.styleConfig?.fitType}</div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(`JC:${printJobCard.jobCardId}|ORD:${printJobCard.orderId}|CUST:${printJobCard.customerName}`)}`}
                                    alt="Job Card QR"
                                    style={{ width: '85px', height: '85px' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                            <button className="btn btn-secondary" onClick={() => setPrintJobCard(null)}>{isAr ? 'إغلاق' : 'Close'}</button>
                            <button className="btn btn-primary" onClick={() => window.print()}>
                                <i className="ri-printer-line"></i> {isAr ? 'طباعة بطاقة المشغل' : 'Print Tag'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TailoringOrders;
