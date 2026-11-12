import React, { useState, useEffect } from 'react';

// Category '*' = fallback printer for every category without its own printer
const FALLBACK = '*';
// Category '__receipt__' = the cashier's printer for customer invoices / receipts
const RECEIPT = '__receipt__';
const emptyForm = { category: '', name: '', station: 'kitchen', ip: '', port: 9100, brand: 'Epson', model: 'epson-generic' };

const PrinterSetup = ({ currentLanguage, translations, headers, products = [], setHasJuicePrinter }) => {
    const ar = currentLanguage === 'ar';
    const [configs, setConfigs] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [status, setStatus] = useState(null); // { ok: boolean, text: string }
    const [testing, setTesting] = useState('');
    const productCategories = [...new Set((products || []).map(p => p.category).filter(Boolean))];
    const categoryLabel = (c) => (c === FALLBACK ? (ar ? 'كل الأصناف الأخرى (افتراضي)' : 'All other items (default)')
        : c === RECEIPT ? (ar ? 'الفواتير / الإيصالات (الكاشير)' : 'Receipts / invoices (cashier)') : c);

    // How tickets reach the printers: 'direct' (this server connects) or 'agent' (print agent on a restaurant PC)
    const [agent, setAgent] = useState(null);
    const [newKey, setNewKey] = useState('');
    const loadAgent = () => {
        fetch('/api/print-agent', { headers })
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data) setAgent(data); })
            .catch(() => {});
    };
    useEffect(() => {
        loadAgent();
        const t = setInterval(loadAgent, 10000);
        return () => clearInterval(t);
    }, []);
    const setMode = (mode) => {
        fetch('/api/print-agent/mode', { method: 'POST', headers, body: JSON.stringify({ mode }) })
            .then(res => res.json().then(d => ({ ok: res.ok, d })))
            .then(({ ok, d }) => { if (!ok) setStatus({ ok: false, text: d.error || 'Failed' }); loadAgent(); })
            .catch(err => setStatus({ ok: false, text: err.message }));
    };
    const createKey = () => {
        if (agent && agent.hasKey && !window.confirm(ar ? 'سيتوقف المفتاح الحالي عن العمل. متابعة؟' : 'The current key will stop working. Continue?')) return;
        fetch('/api/print-agent/key', { method: 'POST', headers })
            .then(res => res.json().then(d => ({ ok: res.ok, d })))
            .then(({ ok, d }) => { if (ok) { setNewKey(d.key); loadAgent(); } else setStatus({ ok: false, text: d.error || 'Failed' }); })
            .catch(err => setStatus({ ok: false, text: err.message }));
    };
    const retryJob = (id) => {
        fetch(`/api/print-agent/jobs/${encodeURIComponent(id)}/retry`, { method: 'POST', headers }).then(loadAgent).catch(() => {});
    };
    const storeUrl = window.location.origin;
    
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
            .then(data => {
                const list = Array.isArray(data) ? data : [];
                setConfigs(list);
                // Show or hide the POS "Send Juices" button
                if (setHasJuicePrinter) setHasJuicePrinter(list.some(p => p.station === 'juice'));
            })
            .catch(err => console.error(err));
    };
    const stationLabel = (s) => (s === 'juice'
        ? (ar ? 'زر العصائر (منفصل)' : 'Juice button (separate)')
        : (ar ? 'زر المطبخ (الرئيسي)' : 'Kitchen button (main)'));

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
                ? (data.queued
                    ? { ok: data.agentOnline !== false, text: (ar ? 'أُرسلت صفحة الاختبار لوكيل الطباعة' : 'Test ticket sent to the print agent') + (data.agentOnline === false ? (ar ? ' (الوكيل غير متصل الآن)' : ' (the agent is offline right now)') : '') }
                    : { ok: true, text: (ar ? 'تمت طباعة صفحة اختبار على ' : 'Test ticket printed on ') + (printer.name || printer.ip) })
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
                    ? 'كل فئة أصناف تُطبع على طابعتها (مثلاً المشويات في المطبخ والمشروبات في البار). أضف طابعة "كل الأصناف الأخرى" لتُطبع عليها أي فئة بدون طابعة. يمكن ربط أكثر من فئة بنفس الطابعة. الطابعات المربوطة بـ"زر المطبخ" تُطبع معاً بضغطة واحدة، وطابعة العصائر تُطبع من زر "إرسال العصائر" المنفصل.'
                    : 'Each product category prints on its own printer (e.g. grills in the kitchen, drinks at the bar). Add an "All other items" printer to catch every category without one. Several categories can share one printer. Printers on the "Kitchen button" all print together with one press; the Juice printer prints only from the separate "Send Juices" button.'}
            </p>

            {/* Printing method: direct (server connects to printers) or print agent (website) */}
            <div className="glass-card" style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '16px' }}>{ar ? 'طريقة الطباعة' : 'Printing method'}</h3>
                <div role="radiogroup" aria-label={ar ? 'طريقة الطباعة' : 'Printing method'} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                    {[
                        { id: 'direct', icon: 'ri-computer-line',
                          title: ar ? 'مباشر' : 'Direct',
                          text: ar ? 'للتطبيق المكتبي أو خادم داخل المطعم: يتصل البرنامج بالطابعات مباشرة.' : 'For the desktop app or a server inside the restaurant: the app connects to the printers itself.' },
                        { id: 'agent', icon: 'ri-router-line',
                          title: ar ? 'وكيل الطباعة (للموقع)' : 'Print agent (for the website)',
                          text: ar ? 'للموقع على الإنترنت: برنامج صغير على جهاز في المطعم يستلم التذاكر والفواتير ويطبعها على كل الطابعات.' : 'For the website: a small program on a restaurant PC receives tickets and invoices and prints them on all your printers.' }
                    ].map(opt => {
                        const selected = ((agent && agent.mode) || 'direct') === opt.id;
                        return (
                            <button key={opt.id} type="button" role="radio" aria-checked={selected} onClick={() => setMode(opt.id)}
                                style={{ textAlign: 'start', padding: '12px', borderRadius: '8px', border: `2px solid ${selected ? 'var(--accent-cyan)' : 'var(--glass-border)'}`, background: selected ? 'rgba(6, 182, 212, 0.08)' : 'transparent' }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <i className={opt.icon}></i> {opt.title} {selected && <i className="ri-check-line" style={{ color: 'var(--accent-cyan)' }}></i>}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{opt.text}</div>
                            </button>
                        );
                    })}
                </div>

                {agent && agent.mode === 'agent' && (
                    <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span className={`badge ${agent.online ? 'green' : 'danger'}`}>
                                {agent.online ? (ar ? 'الوكيل متصل' : 'Agent online') : (ar ? 'الوكيل غير متصل' : 'Agent offline')}
                            </span>
                            {agent.agentInfo && <span style={{ color: 'var(--text-secondary)' }}>{agent.agentInfo}</span>}
                            {agent.lastSeenAt && <span style={{ color: 'var(--text-secondary)' }}>{ar ? 'آخر اتصال: ' : 'Last seen: '}{new Date(agent.lastSeenAt).toLocaleTimeString()}</span>}
                            <span style={{ color: 'var(--text-secondary)' }}>{ar ? 'بانتظار الطباعة: ' : 'Waiting to print: '}{agent.pending || 0}</span>
                        </div>

                        <ol style={{ margin: 0, paddingInlineStart: '18px', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                            <li>{ar ? 'ثبّت Node.js (الإصدار 18 أو أحدث) على جهاز في المطعم متصل بنفس شبكة الطابعات: ' : 'On a PC in the restaurant, on the same network as the printers, install Node.js 18+: '}<a href="https://nodejs.org" target="_blank" rel="noopener noreferrer">nodejs.org</a></li>
                            <li>{ar ? 'نزّل وكيل الطباعة: ' : 'Download the print agent: '}<a href="/print-agent/kamysoft-print-agent.js" download>kamysoft-print-agent.js</a>{' · '}<a href="/print-agent/start-print-agent.bat" download>start-print-agent.bat</a></li>
                            <li>{ar ? 'أنشئ مفتاحاً للوكيل وشغّله بهذا الأمر (أو ضع القيم في ملف ‎.bat‎ وانقر عليه مرتين):' : 'Create an agent key and start it with this command (or put the values in the .bat file and double-click it):'}</li>
                        </ol>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <button type="button" className="btn btn-secondary" onClick={createKey}>
                                <i className="ri-key-2-line"></i> {agent.hasKey ? (ar ? 'إنشاء مفتاح جديد' : 'Create a new key') : (ar ? 'إنشاء مفتاح الوكيل' : 'Create agent key')}
                            </button>
                            {agent.hasKey && !newKey && <span style={{ color: 'var(--text-secondary)' }}>{ar ? 'يوجد مفتاح. لا يُعرض مرة أخرى لأسباب أمنية.' : 'A key exists. It is not shown again for security.'}</span>}
                        </div>
                        {newKey && (
                            <div style={{ padding: '10px', borderRadius: '6px', border: '1px dashed var(--accent-gold)' }}>
                                <div style={{ marginBottom: '6px', color: 'var(--accent-gold)' }}>{ar ? 'انسخ المفتاح الآن، لن يظهر مرة أخرى:' : 'Copy the key now, it will not be shown again:'}</div>
                                <code style={{ display: 'block', wordBreak: 'break-all', fontSize: '12px', direction: 'ltr', textAlign: 'left' }}>
                                    node kamysoft-print-agent.js --url {storeUrl} --key {newKey}
                                </code>
                                <button type="button" className="btn btn-secondary" style={{ marginTop: '8px' }} onClick={() => navigator.clipboard && navigator.clipboard.writeText(`node kamysoft-print-agent.js --url ${storeUrl} --key ${newKey}`)}>
                                    <i className="ri-file-copy-line"></i> {ar ? 'نسخ الأمر' : 'Copy command'}
                                </button>
                            </div>
                        )}

                        {(agent.failed || []).length > 0 && (
                            <div>
                                <div style={{ fontWeight: 'bold', color: 'var(--accent-danger)', marginBottom: '6px' }}>{ar ? 'تذاكر لم تُطبع (آخر ٢٤ ساعة)' : 'Tickets that did not print (last 24 h)'}</div>
                                {agent.failed.map(j => (
                                    <div key={j.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', padding: '4px 0', borderBottom: '1px solid var(--glass-border)' }}>
                                        <span>{new Date(j.createdAt).toLocaleTimeString()}</span>
                                        <span>{j.kind === 'receipt' ? (ar ? 'فاتورة' : 'Invoice') : j.kind === 'test' ? (ar ? 'اختبار' : 'Test') : (ar ? 'مطبخ' : 'Kitchen')}{j.tableNumber ? ` · ${ar ? 'طاولة' : 'Table'} ${j.tableNumber}` : ''}</span>
                                        <span>{j.printer && (j.printer.name || j.printer.ip)}</span>
                                        <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{j.error}</span>
                                        <button type="button" className="btn btn-secondary" onClick={() => retryJob(j.id)}><i className="ri-restart-line"></i> {ar ? 'إعادة الطباعة' : 'Retry'}</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="glass-card" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <select
                        className="form-control"
                        aria-label={ar ? 'الفئة' : 'Category'}
                        value={productCategories.includes(form.category) || form.category === FALLBACK || form.category === RECEIPT || form.category === '' ? form.category : '__custom'}
                        onChange={e => setForm({ ...form, category: e.target.value === '__custom' ? ' ' : e.target.value })}
                        style={{ minWidth: '180px', flex: 1 }}
                    >
                        <option value="">{ar ? '— اختر الفئة —' : '— Choose category —'}</option>
                        {productCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value={FALLBACK}>{categoryLabel(FALLBACK)}</option>
                        <option value={RECEIPT}>{categoryLabel(RECEIPT)}</option>
                        <option value="__custom">{ar ? 'فئة أخرى…' : 'Other category…'}</option>
                    </select>
                    {form.category !== '' && form.category !== FALLBACK && form.category !== RECEIPT && !productCategories.includes(form.category) && (
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
                    <select
                        className="form-control"
                        aria-label={ar ? 'زر الطباعة في نقطة البيع' : 'POS button that prints here'}
                        value={form.station || 'kitchen'}
                        onChange={e => setForm({ ...form, station: e.target.value })}
                        style={{ minWidth: '190px', flex: 1 }}
                    >
                        <option value="kitchen">{stationLabel('kitchen')}</option>
                        <option value="juice">{stationLabel('juice')}</option>
                    </select>
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
                            <th>{ar ? 'الزر' : 'Button'}</th>
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
                                <td>{stationLabel(config.station)}</td>
                                <td>{allModels.find(p => p.id === config.model)?.name || config.model || 'Generic Printer'}</td>
                                <td>{config.ip}</td>
                                <td>{config.port}</td>
                                <td style={{ display: 'flex', gap: '6px' }}>
                                    <button className="action-btn" title={ar ? 'طباعة تجريبية' : 'Test print'} aria-label={ar ? 'طباعة تجريبية' : 'Test print'} onClick={() => handleTest(config)} disabled={!!testing}>
                                        <i className={testing === config.category ? 'ri-loader-4-line' : 'ri-printer-line'}></i>
                                    </button>
                                    <button className="action-btn" title={ar ? 'تعديل' : 'Edit'} aria-label={ar ? 'تعديل' : 'Edit'} onClick={() => setForm({ ...emptyForm, ...config, name: config.name || '', station: config.station || 'kitchen', brand: config.brand || 'Epson', model: config.model || 'epson-generic' })}>
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
                                <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
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
