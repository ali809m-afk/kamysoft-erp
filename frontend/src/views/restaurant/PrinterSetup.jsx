import React, { useState, useEffect } from 'react';

// Category '*' = fallback printer for every category without its own printer
const FALLBACK = '*';
const emptyForm = { category: '', name: '', ip: '', port: 9100, brand: 'Epson', model: 'epson-generic' };

const PrinterSetup = ({ currentLanguage, translations, headers, products = [] }) => {
    const ar = currentLanguage === 'ar';
    const [configs, setConfigs] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [status, setStatus] = useState(null); // { ok: boolean, text: string }
    const [testing, setTesting] = useState('');
    const productCategories = [...new Set((products || []).map(p => p.category).filter(Boolean))];
    const categoryLabel = (c) => (c === FALLBACK ? (ar ? 'كل الأصناف الأخرى (افتراضي)' : 'All other items (default)') : c);
    
    const printerBrands = [
        {
            brand: 'Epson',
            models: [
                { id: 'epson-tm-t88vi', name: 'Epson TM-T88VI' },
                { id: 'epson-tm-t88v', name: 'Epson TM-T88V' },
                { id: 'epson-tm-m30', name: 'Epson TM-m30' },
                { id: 'epson-tm-u220', name: 'Epson TM-U220' },
                { id: 'epson-tm-t20iii', name: 'Epson TM-T20III' },
                { id: 'epson-generic', name: 'Epson Generic (ESC/POS)' }
            ]
        },
        {
            brand: 'TA (Saudi)',
            models: [
                { id: 'ta-80', name: 'TA-80 Thermal' },
                { id: 'ta-pos80', name: 'TA-POS80' },
                { id: 'ta-generic', name: 'TA Generic' }
            ]
        },
        {
            brand: 'ZPOS',
            models: [
                { id: 'zpos-80', name: 'ZPOS 80mm' },
                { id: 'zpos-58', name: 'ZPOS 58mm' },
                { id: 'zpos-generic', name: 'ZPOS Generic' }
            ]
        },
        {
            brand: 'Star Micronics',
            models: [
                { id: 'star-tsp100', name: 'Star TSP100III' },
                { id: 'star-tsp654', name: 'Star TSP654II' },
                { id: 'star-mcprint3', name: 'Star mC-Print3' },
                { id: 'star-generic', name: 'Star Generic' }
            ]
        },
        {
            brand: 'XPrinter',
            models: [
                { id: 'xprinter-xp80c', name: 'XPrinter XP-80C' },
                { id: 'xprinter-xpq800', name: 'XPrinter XP-Q800' },
                { id: 'xprinter-xpn160i', name: 'XPrinter XP-N160I' },
                { id: 'xprinter-generic', name: 'XPrinter Generic' }
            ]
        },
        {
            brand: 'Rongta',
            models: [
                { id: 'rongta-rp326', name: 'Rongta RP326' },
                { id: 'rongta-rp80', name: 'Rongta RP80' },
                { id: 'rongta-generic', name: 'Rongta Generic' }
            ]
        },
        {
            brand: 'Bixolon',
            models: [
                { id: 'bixolon-srp330', name: 'Bixolon SRP-330II' },
                { id: 'bixolon-srp350', name: 'Bixolon SRP-350plusIII' },
                { id: 'bixolon-generic', name: 'Bixolon Generic' }
            ]
        },
        {
            brand: 'Zebra',
            models: [
                { id: 'zebra-zd410', name: 'Zebra ZD410' },
                { id: 'zebra-zd420', name: 'Zebra ZD420' },
                { id: 'zebra-generic', name: 'Zebra Generic' }
            ]
        },
        {
            brand: 'Other',
            models: [
                { id: 'generic-network', name: 'Generic Network Printer (Raw 9100)' }
            ]
        }
    ];

    // Flatten for easy lookup in the table
    const allModels = printerBrands.flatMap(b => b.models);

    const fetchConfigs = () => {
        fetch('/api/printers', { headers })
            .then(res => res.json())
            .then(data => setConfigs(Array.isArray(data) ? data : []))
            .catch(err => console.error(err));
    };

    useEffect(() => {
        fetchConfigs();
    }, []);

    const handleSave = () => {
        if (!form.category || !form.ip) {
            setStatus({ ok: false, text: ar ? 'اختر الفئة وأدخل عنوان IP' : 'Choose a category and enter the IP address' });
            return;
        }
        fetch('/api/printers', {
            method: 'POST',
            headers,
            body: JSON.stringify(form)
        })
        .then(res => res.json().then(data => ({ ok: res.ok, data })))
        .then(({ ok, data }) => {
            if (!ok) { setStatus({ ok: false, text: data.error || 'Save failed' }); return; }
            setStatus({ ok: true, text: ar ? 'تم حفظ الطابعة' : 'Printer saved' });
            fetchConfigs();
            setForm(emptyForm);
        })
        .catch(err => setStatus({ ok: false, text: err.message }));
    };

    // Prints a short test ticket so staff can confirm the IP/port and which printer is which
    const handleTest = (printer) => {
        if (!printer.ip) { setStatus({ ok: false, text: ar ? 'أدخل عنوان IP أولاً' : 'Enter the IP address first' }); return; }
        setTesting(printer.category || printer.ip);
        fetch('/api/printers/test', { method: 'POST', headers, body: JSON.stringify(printer) })
            .then(res => res.json())
            .then(data => setStatus(data.success
                ? { ok: true, text: (ar ? 'تمت طباعة صفحة اختبار على ' : 'Test ticket printed on ') + (printer.name || printer.ip) }
                : { ok: false, text: (ar ? 'فشل الاختبار: ' : 'Test failed: ') + (data.error || '') }))
            .catch(err => setStatus({ ok: false, text: err.message }))
            .finally(() => setTesting(''));
    };

    const handleDelete = (category) => {
        fetch(`/api/printers/${encodeURIComponent(category)}`, { method: 'DELETE', headers })
            .then(() => fetchConfigs())
            .catch(err => console.error(err));
    };

    return (
        <div className="view-content active">
            <h2>{ar ? 'إعدادات طابعات المطبخ' : 'Kitchen Printer Setup'}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '6px 0 14px' }}>
                {ar
                    ? 'كل فئة أصناف تُطبع على طابعتها (مثلاً المشويات في المطبخ والمشروبات في البار). أضف طابعة "كل الأصناف الأخرى" لتُطبع عليها أي فئة بدون طابعة. يمكن ربط أكثر من فئة بنفس الطابعة.'
                    : 'Each product category prints on its own printer (e.g. grills in the kitchen, drinks at the bar). Add an "All other items" printer to catch every category without one. Several categories can share one printer.'}
            </p>

            <div className="glass-card" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <select
                        className="form-control"
                        aria-label={ar ? 'الفئة' : 'Category'}
                        value={productCategories.includes(form.category) || form.category === FALLBACK || form.category === '' ? form.category : '__custom'}
                        onChange={e => setForm({ ...form, category: e.target.value === '__custom' ? ' ' : e.target.value })}
                        style={{ minWidth: '180px', flex: 1 }}
                    >
                        <option value="">{ar ? '— اختر الفئة —' : '— Choose category —'}</option>
                        {productCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value={FALLBACK}>{categoryLabel(FALLBACK)}</option>
                        <option value="__custom">{ar ? 'فئة أخرى…' : 'Other category…'}</option>
                    </select>
                    {form.category !== '' && form.category !== FALLBACK && !productCategories.includes(form.category) && (
                        <input
                            type="text"
                            placeholder={ar ? 'اسم الفئة كما في المنتجات' : 'Category name as on the products'}
                            className="form-control"
                            value={form.category.trim() === '' ? '' : form.category}
                            onChange={e => setForm({ ...form, category: e.target.value || ' ' })}
                            style={{ flex: 1, minWidth: '160px' }}
                        />
                    )}
                    <input
                        type="text"
                        placeholder={ar ? 'اسم الطابعة (مثل: البار)' : 'Printer name (e.g., Bar)'}
                        className="form-control"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        style={{ flex: 1, minWidth: '140px' }}
                    />
                    <input 
                        type="text" 
                        placeholder="IP Address (e.g., 192.168.1.100)" 
                        className="form-control" 
                        value={form.ip} 
                        onChange={e => setForm({...form, ip: e.target.value})} 
                    />
                    <input 
                        type="number" 
                        placeholder="Port (9100)" 
                        className="form-control" 
                        value={form.port} 
                        onChange={e => setForm({...form, port: parseInt(e.target.value) || ''})}
                        style={{ width: '100px' }}
                    />
                    <select 
                        className="form-control" 
                        value={form.brand} 
                        onChange={e => {
                            const newBrand = e.target.value;
                            const brandGroup = printerBrands.find(b => b.brand === newBrand);
                            setForm({...form, brand: newBrand, model: brandGroup ? brandGroup.models[0].id : ''});
                        }}
                    >
                        {printerBrands.map(brandGroup => (
                            <option key={brandGroup.brand} value={brandGroup.brand}>
                                {brandGroup.brand}
                            </option>
                        ))}
                    </select>
                    <select 
                        className="form-control" 
                        value={form.model} 
                        onChange={e => setForm({...form, model: e.target.value})}
                    >
                        {printerBrands.find(b => b.brand === form.brand)?.models.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <button className="btn btn-secondary" onClick={() => handleTest({ ...form, category: form.category.trim() })} disabled={!!testing}>
                        <i className="ri-printer-line"></i> {ar ? 'طباعة تجريبية' : 'Test print'}
                    </button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        <i className="ri-save-line"></i> {translations[currentLanguage]?.saveBtn || (ar ? 'حفظ' : 'Save')}
                    </button>
                </div>
                {status && (
                    <div role="status" style={{ marginTop: '10px', fontSize: '13px', color: status.ok ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                        {status.text}
                    </div>
                )}
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>{ar ? 'الفئة' : 'Category'}</th>
                            <th>{ar ? 'الطابعة' : 'Printer'}</th>
                            <th>{ar ? 'الطراز' : 'Model'}</th>
                            <th>{ar ? 'عنوان IP' : 'IP Address'}</th>
                            <th>{ar ? 'المنفذ' : 'Port'}</th>
                            <th>{ar ? 'إجراء' : 'Action'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {configs.map(config => (
                            <tr key={config.category}>
                                <td>{categoryLabel(config.category)}</td>
                                <td>{config.name || '-'}</td>
                                <td>{allModels.find(p => p.id === config.model)?.name || config.model || 'Generic Printer'}</td>
                                <td>{config.ip}</td>
                                <td>{config.port}</td>
                                <td style={{ display: 'flex', gap: '6px' }}>
                                    <button className="action-btn" title={ar ? 'طباعة تجريبية' : 'Test print'} aria-label={ar ? 'طباعة تجريبية' : 'Test print'} onClick={() => handleTest(config)} disabled={!!testing}>
                                        <i className={testing === config.category ? 'ri-loader-4-line' : 'ri-printer-line'}></i>
                                    </button>
                                    <button className="action-btn" title={ar ? 'تعديل' : 'Edit'} aria-label={ar ? 'تعديل' : 'Edit'} onClick={() => setForm({ ...emptyForm, ...config, name: config.name || '', brand: config.brand || 'Epson', model: config.model || 'epson-generic' })}>
                                        <i className="ri-edit-line"></i>
                                    </button>
                                    <button className="action-btn delete" title={ar ? 'حذف' : 'Delete'} aria-label={ar ? 'حذف' : 'Delete'} onClick={() => handleDelete(config.category)}>
                                        <i className="ri-delete-bin-line"></i>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {configs.length === 0 && (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    {ar ? 'لا توجد طابعات مضافة' : 'No printers configured'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PrinterSetup;
