import React, { useState } from 'react';

// Local calendar day as YYYY-MM-DD (toISOString() would give the UTC day,
// which is the previous day between 00:00 and 03:00 in Saudi Arabia).
const localDateKey = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Work out when an invoice was issued. The POS saves `date` with
// toLocaleString(), so its format depends on the browser language. Arabic
// browsers produce Arabic digits and often the Hijri calendar, e.g.
// "٢٠‏/٥‏/١٤٤٨ هـ ١٠:٣٠:٠٠ م", which new Date() cannot parse.
export const getInvoiceDate = (inv) => {
    if (!inv) return null;
    const raw = typeof inv.date === 'string' ? inv.date.trim() : '';

    // 1. ISO dates (YYYY-MM-DD...) are unambiguous.
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const d = new Date(raw.length === 10 ? `${raw}T00:00:00` : raw);
        if (!isNaN(d.getTime())) return d;
    }

    // 2. A MongoDB ObjectId records the exact time the invoice was saved.
    const oid = typeof inv._id === 'string' ? inv._id : inv._id && inv._id.$oid;
    if (typeof oid === 'string' && /^[0-9a-f]{24}$/i.test(oid)) {
        return new Date(parseInt(oid.substring(0, 8), 16) * 1000);
    }

    // 3. Last resort: normalise Arabic digits and markers, then parse.
    if (!raw || raw.includes('هـ')) return null; // Hijri dates can't be parsed here
    const normalised = raw
        .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06F0))
        .replace(/[‎‏؜]/g, '')
        .replace(/،/g, ',')
        .replace(/\sص$/, ' AM')
        .replace(/\sم$/, ' PM');
    const d = new Date(normalised);
    return isNaN(d.getTime()) ? null : d;
};

const Reports = (props) => {
    const {
        invoices,
        reportSubTab,
        setReportSubTab,
        formatCurrency,
        currentLanguage,
        translations,
        activeTab
    } = props;

    const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));

    // Dedicated Daily Report View
    if (activeTab === 'dailyReport') {
        const dayInvoices = (invoices || []).filter(inv => {
            const invD = getInvoiceDate(inv);
            return invD ? localDateKey(invD) === selectedDate : false;
        });

        // Refunded invoices are listed but not counted in the day's totals
        const isRefunded = (inv) => inv.zatcaStatus === 'REFUNDED';
        const activeDayInvoices = dayInvoices.filter(inv => !isRefunded(inv));
        const refundedDayInvoices = dayInvoices.filter(isRefunded);
        const refundedTotal = refundedDayInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

        const totalDailySales = activeDayInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
        const totalDailyVat = activeDayInvoices.reduce((sum, inv) => sum + (Number(inv.vat) || 0), 0);
        const netDailySales = totalDailySales - totalDailyVat;
        // Coupon discounts given on the day's (non-refunded) sales, before VAT
        const totalDailyDiscount = activeDayInvoices.reduce((sum, inv) => sum + (Number(inv.discount) || 0), 0);
        const discountedCount = activeDayInvoices.filter(inv => Number(inv.discount) > 0).length;

        // Breakdown by payment modes
        const paymentBreakdown = {
            cash: 0,
            mada: 0,
            visa: 0,
            mobile: 0,
            stc: 0,
            apple: 0,
            ninja: 0,
            keeta: 0,
            hungerstation: 0,
            tabby: 0,
            tamara: 0,
            split: 0,
            other: 0
        };

        activeDayInvoices.forEach(inv => {
            const method = (inv.paymentMethod || 'cash').toLowerCase();
            const total = Number(inv.total || 0);
            // Split payments are saved as "Split / مجزأ (Cash: 50 SAR, Card: 50 SAR)".
            // Check them first: the text contains "cash", so they used to be counted
            // entirely as cash. Put the cash part under Cash and the card part under
            // Mada (شبكة); if the amounts can't be read, keep the invoice under Split.
            if (method.includes('split')) {
                const cashMatch = method.match(/cash:\s*([\d.]+)/);
                const cardMatch = method.match(/card:\s*([\d.]+)/);
                const cashPart = cashMatch ? parseFloat(cashMatch[1]) : NaN;
                const cardPart = cardMatch ? parseFloat(cardMatch[1]) : NaN;
                if (!isNaN(cashPart) && !isNaN(cardPart) && Math.abs(cashPart + cardPart - total) <= 1) {
                    paymentBreakdown.cash += cashPart;
                    paymentBreakdown.mada += total - cashPart;
                } else {
                    paymentBreakdown.split += total;
                }
                return;
            }
            if (method.includes('cash')) paymentBreakdown.cash += Number(inv.total || 0);
            else if (method.includes('mada')) paymentBreakdown.mada += Number(inv.total || 0);
            else if (method.includes('visa')) paymentBreakdown.visa += Number(inv.total || 0);
            else if (method.includes('mobile')) paymentBreakdown.mobile += Number(inv.total || 0);
            else if (method.includes('stc')) paymentBreakdown.stc += Number(inv.total || 0);
            else if (method.includes('apple')) paymentBreakdown.apple += Number(inv.total || 0);
            else if (method.includes('ninja')) paymentBreakdown.ninja += Number(inv.total || 0);
            else if (method.includes('keeta')) paymentBreakdown.keeta += Number(inv.total || 0);
            else if (method.includes('hunger')) paymentBreakdown.hungerstation += Number(inv.total || 0);
            else if (method.includes('tabby') || method.includes('tabbi')) paymentBreakdown.tabby += Number(inv.total || 0);
            else if (method.includes('tamara')) paymentBreakdown.tamara += Number(inv.total || 0);
            else paymentBreakdown.other += Number(inv.total || 0);
        });

        const deliveryAppsTotal = paymentBreakdown.ninja + paymentBreakdown.keeta + paymentBreakdown.hungerstation;

        return (
            // flexShrink 0 on the page and its sections: the page is a flex item squeezed to
            // the window height, so sections shrank and their hidden overflow cut off the
            // payment breakdown cards. Now the page grows and the main area scrolls.
            <div className="glass-card report-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px', flexShrink: 0 }}>
                {/* Header & Date Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '15px' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
                            <i className="ri-calendar-check-line" style={{ color: 'var(--accent-cyan)', marginRight: currentLanguage === 'ar' ? '0' : '8px', marginLeft: currentLanguage === 'ar' ? '8px' : '0' }}></i>
                            {translations[currentLanguage]?.dailyReport || (currentLanguage === 'ar' ? 'التقرير اليومي للمبيعات' : 'Daily Sales Report')}
                        </h2>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                            {currentLanguage === 'ar' ? 'ملخص مبيعات اليوم وتوزيع طرق الدفع وتطبيقات التوصيل' : 'Daily sales breakdown by payment methods and delivery applications'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                            {currentLanguage === 'ar' ? 'تاريخ التقرير:' : 'Select Date:'}
                        </label>
                        <input 
                            type="date" 
                            className="form-control" 
                            style={{ width: 'auto', padding: '6px 12px' }}
                            value={selectedDate} 
                            onChange={e => setSelectedDate(e.target.value)} 
                        />
                        <button className="btn btn-secondary" onClick={() => window.print()}>
                            <i className="ri-printer-line"></i> {translations[currentLanguage]?.printReport || (currentLanguage === 'ar' ? 'طباعة' : 'Print')}
                        </button>
                    </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="card-grid">
                    <div className="glass-card purple">
                        <div className="card-stat">
                            <div className="stat-info">
                                <h3>{translations[currentLanguage]?.totalSalesTax || (currentLanguage === 'ar' ? 'إجمالي مبيعات اليوم' : 'Total Daily Sales')}</h3>
                                <div className="stat-value">{formatCurrency(totalDailySales)}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    {currentLanguage === 'ar'
                                        ? `الخصومات: ${formatCurrency(totalDailyDiscount)} (${discountedCount} فاتورة)`
                                        : `Discounts: ${formatCurrency(totalDailyDiscount)} (${discountedCount} invoice${discountedCount === 1 ? '' : 's'})`}
                                </div>
                            </div>
                            <div className="stat-icon"><i className="ri-money-dollar-circle-line"></i></div>
                        </div>
                    </div>

                    <div className="glass-card cyan">
                        <div className="card-stat">
                            <div className="stat-info">
                                <h3>{translations[currentLanguage]?.totalVatCollected || (currentLanguage === 'ar' ? 'ضريبة القيمة المضافة (15%)' : 'VAT Collected')}</h3>
                                <div className="stat-value">{formatCurrency(totalDailyVat)}</div>
                            </div>
                            <div className="stat-icon"><i className="ri-percent-line"></i></div>
                        </div>
                    </div>

                    <div className="glass-card gold">
                        <div className="card-stat">
                            <div className="stat-info">
                                <h3>{currentLanguage === 'ar' ? 'تطبيقات التوصيل (هنقر/كيتا/نينجا)' : 'Delivery Apps Total'}</h3>
                                <div className="stat-value">{formatCurrency(deliveryAppsTotal)}</div>
                            </div>
                            <div className="stat-icon"><i className="ri-e-bike-2-line"></i></div>
                        </div>
                    </div>

                    <div className="glass-card green">
                        <div className="card-stat">
                            <div className="stat-info">
                                <h3>{translations[currentLanguage]?.invoiceCount || (currentLanguage === 'ar' ? 'عدد الفواتير' : 'Invoices Count')}</h3>
                                <div className="stat-value">{activeDayInvoices.length}</div>
                                {refundedDayInvoices.length > 0 && (
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                        {currentLanguage === 'ar'
                                            ? `+ ${refundedDayInvoices.length} مسترجعة (${formatCurrency(refundedTotal)}) غير محتسبة`
                                            : `+ ${refundedDayInvoices.length} refunded (${formatCurrency(refundedTotal)}) not counted`}
                                    </div>
                                )}
                            </div>
                            <div className="stat-icon"><i className="ri-file-list-3-line"></i></div>
                        </div>
                    </div>
                </div>

                {/* Payment Methods Breakdown Table & Cards */}
                <div className="glass-card" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>
                        <i className="ri-bank-card-line" style={{ color: 'var(--accent-purple)', marginRight: '6px' }}></i>
                        {currentLanguage === 'ar' ? 'تفصيل طرق الدفع وتطبيقات التوصيل' : 'Payment Methods & Delivery Apps Breakdown'}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                        <div style={{ background: 'var(--glass-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><i className="ri-money-dollar-circle-line"></i> {currentLanguage === 'ar' ? 'كاش / نقداً' : 'Cash'}</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px' }}>{formatCurrency(paymentBreakdown.cash)}</div>
                        </div>
                        <div style={{ background: 'var(--glass-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><i className="ri-bank-card-2-line"></i> {currentLanguage === 'ar' ? 'مدى (شبكة)' : 'Mada'}</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px' }}>{formatCurrency(paymentBreakdown.mada)}</div>
                        </div>
                        <div style={{ background: 'var(--glass-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><i className="ri-e-bike-2-line"></i> {currentLanguage === 'ar' ? 'نينجا Ninja' : 'Ninja'}</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px', color: 'var(--accent-cyan)' }}>{formatCurrency(paymentBreakdown.ninja)}</div>
                        </div>
                        <div style={{ background: 'var(--glass-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><i className="ri-riding-line"></i> {currentLanguage === 'ar' ? 'كيتا Keeta' : 'Keeta'}</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px', color: 'var(--accent-gold)' }}>{formatCurrency(paymentBreakdown.keeta)}</div>
                        </div>
                        <div style={{ background: 'var(--glass-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><i className="ri-restaurant-2-line"></i> {currentLanguage === 'ar' ? 'هنقرستيشن HungerStation' : 'HungerStation'}</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px', color: 'var(--accent-purple)' }}>{formatCurrency(paymentBreakdown.hungerstation)}</div>
                        </div>
                        <div style={{ background: 'var(--glass-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><i className="ri-bank-card-line"></i> {currentLanguage === 'ar' ? 'فيزا / بطاقات' : 'Visa / Cards'}</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px' }}>{formatCurrency(paymentBreakdown.visa)}</div>
                        </div>
                        <div style={{ background: 'var(--glass-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><i className="ri-apple-line"></i> Apple Pay / STC</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px' }}>{formatCurrency(paymentBreakdown.apple + paymentBreakdown.stc + paymentBreakdown.mobile)}</div>
                        </div>
                        <div style={{ background: 'var(--glass-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><i className="ri-split-cells-vertical"></i> {currentLanguage === 'ar' ? 'دفع مجزأ / آجل' : 'Split / Tabby / Tamara'}</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px' }}>{formatCurrency(paymentBreakdown.split + paymentBreakdown.tabby + paymentBreakdown.tamara + paymentBreakdown.other)}</div>
                        </div>
                    </div>
                </div>

                {/* Detailed Invoices of the Day */}
                <div className="table-container">
                    <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>
                        <i className="ri-file-list-line" style={{ color: 'var(--accent-success)', marginRight: '6px' }}></i>
                        {currentLanguage === 'ar' ? `فواتير يوم (${selectedDate})` : `Invoices for (${selectedDate})`}
                    </h3>
                    <table>
                        <thead>
                            <tr>
                                <th>{translations[currentLanguage]?.invoiceNum || 'Invoice #'}</th>
                                <th>{translations[currentLanguage]?.invoiceDate || 'Time/Date'}</th>
                                <th>{translations[currentLanguage]?.invoiceCustomer || 'Customer'}</th>
                                <th>{translations[currentLanguage]?.paymentMethod || 'Payment Method'}</th>
                                <th style={{ textAlign: 'right' }}>{translations[currentLanguage]?.netSalesValue || 'Net Value'}</th>
                                <th style={{ textAlign: 'right' }}>{translations[currentLanguage]?.vat || 'VAT'}</th>
                                <th style={{ textAlign: 'right' }}>{translations[currentLanguage]?.invoiceTotal || 'Total'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dayInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                                        {currentLanguage === 'ar' ? `لا توجد فواتير صادرة بتاريخ ${selectedDate}` : `No invoices recorded on ${selectedDate}`}
                                    </td>
                                </tr>
                            ) : (
                                dayInvoices.map(inv => (
                                    <tr key={inv.id} style={isRefunded(inv) ? { opacity: 0.55, textDecoration: 'line-through' } : undefined}>
                                        <td><strong>{inv.id}</strong></td>
                                        <td>{inv.date}</td>
                                        <td>{inv.customer || (currentLanguage === 'ar' ? 'عميل نقدي' : 'Cash Customer')}</td>
                                        <td>
                                            <span className="status-badge valid" style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                                                {inv.paymentMethod || 'Cash'}
                                            </span>
                                            {isRefunded(inv) && (
                                                <span className="status-badge" style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', marginInlineStart: '4px', textDecoration: 'none' }}>
                                                    {currentLanguage === 'ar' ? 'مسترجعة' : 'Refunded'}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency((Number(inv.total) || 0) - (Number(inv.vat) || 0))}</td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency(Number(inv.vat) || 0)}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{formatCurrency(Number(inv.total) || 0)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // Helper to render the standard sales report table (used for salesMovement)
    const renderSalesReport = (reportInvoices) => (
        <div className="glass-card report-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px', flexShrink: 0 }}>
            {/* Sub Tabs Selection */}
            <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
                <button className={`btn ${reportSubTab === 'daily' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReportSubTab('daily')}>
                    <i className="ri-calendar-event-line"></i> {translations[currentLanguage].dailyReports}
                </button>
                <button className={`btn ${reportSubTab === 'monthly' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReportSubTab('monthly')}>
                    <i className="ri-calendar-todo-line"></i> {translations[currentLanguage].monthlyReports}
                </button>
                <button className={`btn ${reportSubTab === 'annual' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReportSubTab('annual')}>
                    <i className="ri-calendar-line"></i> {translations[currentLanguage].annualReports}
                </button>
                <button className="btn btn-secondary" style={{ marginRight: currentLanguage === 'en' ? 'auto' : '0', marginLeft: currentLanguage === 'ar' ? 'auto' : '0' }} onClick={() => window.print()}>
                    <i className="ri-printer-line"></i> {translations[currentLanguage].printReport}
                </button>
            </div>

            {/* Report Stats Grid */}
            <div className="card-grid">
                <div className="glass-card purple">
                    <div className="card-stat">
                        <div className="stat-info">
                            <h3>{translations[currentLanguage].totalSalesTax}</h3>
                            <div className="stat-value">{formatCurrency(reportInvoices.reduce((sum, inv) => sum + inv.total, 0))}</div>
                        </div>
                        <div className="stat-icon"><i className="ri-money-dollar-circle-line"></i></div>
                    </div>
                </div>
                <div className="glass-card cyan">
                    <div className="card-stat">
                        <div className="stat-info">
                            <h3>{translations[currentLanguage].totalVatCollected}</h3>
                            <div className="stat-value">{formatCurrency(reportInvoices.reduce((sum, inv) => sum + (inv.vat || 0), 0))}</div>
                        </div>
                        <div className="stat-icon"><i className="ri-percent-line"></i></div>
                    </div>
                </div>
                <div className="glass-card gold">
                    <div className="card-stat">
                        <div className="stat-info">
                            <h3>{translations[currentLanguage].netSalesValue}</h3>
                            <div className="stat-value">{formatCurrency(reportInvoices.reduce((sum, inv) => sum + inv.total - (inv.vat || 0), 0))}</div>
                        </div>
                        <div className="stat-icon"><i className="ri-coins-line"></i></div>
                    </div>
                </div>
                <div className="glass-card green">
                    <div className="card-stat">
                        <div className="stat-info">
                            <h3>{translations[currentLanguage].invoiceCount}</h3>
                            <div className="stat-value">{reportInvoices.length}</div>
                        </div>
                        <div className="stat-icon"><i className="ri-file-list-3-line"></i></div>
                    </div>
                </div>
            </div>

            {/* Detailed List */}
            <div className="table-container" style={{ marginTop: '12px' }}>
                <table>
                    <thead>
                        <tr>
                            <th>{translations[currentLanguage].invoiceNum}</th>
                            <th>{translations[currentLanguage].invoiceDate}</th>
                            <th>{translations[currentLanguage].invoiceCustomer}</th>
                            <th style={{ textAlign: 'right' }}>{translations[currentLanguage].netSalesValue}</th>
                            <th style={{ textAlign: 'right' }}>{translations[currentLanguage].vat}</th>
                            <th style={{ textAlign: 'right' }}>{translations[currentLanguage].invoiceTotal}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportInvoices.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    {currentLanguage === 'ar' ? 'لا توجد مبيعات مسجلة لهذه الفترة' : 'No sales recorded for this period'}
                                </td>
                            </tr>
                        ) : (
                            reportInvoices.map(inv => (
                                <tr key={inv.id}>
                                    <td>{inv.id}</td>
                                    <td>{inv.date}</td>
                                    <td>{inv.customer}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(inv.total - (inv.vat || 0))}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(inv.vat || 0)}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(inv.total)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // Determine which report to show based on activeTab
    if (activeTab === 'salesMovement') {
        // Filter invoices according to the selected sub‑tab (daily / monthly / annual)
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const reportInvoices = (invoices || []).filter(inv => {
            const invDate = getInvoiceDate(inv);
            if (!invDate) return false;
            if (reportSubTab === 'daily') return invDate.toDateString() === now.toDateString();
            if (reportSubTab === 'monthly') return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
            if (reportSubTab === 'annual') return invDate.getFullYear() === currentYear;
            return true;
        });
        return renderSalesReport(reportInvoices);
    }

    if (activeTab === 'unpaidInvoices') {
        const unpaid = invoices.filter(inv => inv.paymentMethod === 'Credit');
        return (
            <div className="glass-card" style={{ padding: '24px' }}>
                <h3>{translations[currentLanguage].unpaidInvoices || 'Unpaid Invoices'}</h3>
                {unpaid.length === 0 ? (
                    <p>{currentLanguage === 'ar' ? 'لا توجد فواتير غير مدفوعة' : 'No unpaid invoices found'}</p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>{translations[currentLanguage].invoiceNum}</th>
                                <th>{translations[currentLanguage].invoiceDate}</th>
                                <th>{translations[currentLanguage].invoiceCustomer}</th>
                                <th style={{ textAlign: 'right' }}>{translations[currentLanguage].invoiceTotal}</th>
                                <th>{translations[currentLanguage].status || 'Status'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {unpaid.map(inv => (
                                <tr key={inv.id}>
                                    <td>{inv.id}</td>
                                    <td>{inv.date}</td>
                                    <td>{inv.customer}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(inv.total)}</td>
                                    <td>{inv.zatcaStatus}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        );
    }

    if (activeTab === 'purchasesMovement') {
        const reportExpenses = props.expenses || [];
        return (
            <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>{translations[currentLanguage].purchasesMovement || 'Purchases Movement'}</h3>
                    <button className="btn btn-secondary" onClick={() => window.print()}>
                        <i className="ri-printer-line"></i> {currentLanguage === 'ar' ? 'طباعة' : 'Print'}
                    </button>
                </div>
                {reportExpenses.length === 0 ? (
                    <p>{currentLanguage === 'ar' ? 'لا توجد مشتريات' : 'No purchases found'}</p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>{currentLanguage === 'ar' ? 'التاريخ' : 'Date'}</th>
                                <th>{currentLanguage === 'ar' ? 'الفئة' : 'Category'}</th>
                                <th>{currentLanguage === 'ar' ? 'الوصف' : 'Description'}</th>
                                <th style={{ textAlign: 'right' }}>{currentLanguage === 'ar' ? 'المبلغ' : 'Amount'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportExpenses.map(exp => (
                                <tr key={exp._id || exp.id || Math.random()}>
                                    <td>{exp.date ? new Date(exp.date).toLocaleDateString() : ''}</td>
                                    <td>{exp.category}</td>
                                    <td>{exp.description}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(exp.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        );
    }

    if (activeTab === 'itemsMovement') {
        const items = (props.products || []).map(p => {
            let qtySold = 0;
            (props.invoices || []).forEach(inv => {
                if (inv.items) {
                    inv.items.forEach(i => {
                        if (i.name === p.name || i.productId === p.id) {
                            qtySold += Number(i.qty || 0);
                        }
                    });
                }
            });
            return { ...p, qtySold };
        });

        return (
            <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>{translations[currentLanguage].itemsMovement || 'Items Movement'}</h3>
                    <button className="btn btn-secondary" onClick={() => window.print()}>
                        <i className="ri-printer-line"></i> {currentLanguage === 'ar' ? 'طباعة' : 'Print'}
                    </button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>{currentLanguage === 'ar' ? 'المنتج' : 'Product'}</th>
                            <th style={{ textAlign: 'center' }}>{currentLanguage === 'ar' ? 'المخزون الحالي' : 'Current Stock'}</th>
                            <th style={{ textAlign: 'center' }}>{currentLanguage === 'ar' ? 'الكمية المباعة' : 'Qty Sold'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(item => (
                            <tr key={item.id}>
                                <td>{currentLanguage === 'ar' ? (item.nameAR || item.name) : (item.nameEN || item.name)}</td>
                                <td style={{ textAlign: 'center' }}>{item.stock}</td>
                                <td style={{ textAlign: 'center' }}>{item.qtySold}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    if (activeTab === 'taxReport') {
        const totalOutputVat = (props.invoices || []).reduce((sum, inv) => sum + (inv.vat || 0), 0);
        return (
            <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>{translations[currentLanguage].taxReport || 'Tax Report'}</h3>
                    <button className="btn btn-secondary" onClick={() => window.print()}>
                        <i className="ri-printer-line"></i> {currentLanguage === 'ar' ? 'طباعة' : 'Print'}
                    </button>
                </div>
                <div className="card-grid">
                    <div className="glass-card purple">
                        <div className="card-stat">
                            <div className="stat-info">
                                <h3>{currentLanguage === 'ar' ? 'إجمالي ضريبة المخرجات (المبيعات)' : 'Total Output VAT (Sales)'}</h3>
                                <div className="stat-value">{formatCurrency(totalOutputVat)}</div>
                            </div>
                            <div className="stat-icon"><i className="ri-percent-line"></i></div>
                        </div>
                    </div>
                    <div className="glass-card cyan">
                        <div className="card-stat">
                            <div className="stat-info">
                                <h3>{currentLanguage === 'ar' ? 'صافي الضريبة المستحقة' : 'Net Tax Due'}</h3>
                                <div className="stat-value">{formatCurrency(totalOutputVat)}</div>
                            </div>
                            <div className="stat-icon"><i className="ri-bank-card-line"></i></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (activeTab === 'accountsDebts') {
        const debts = (props.invoices || [])
            .filter(inv => inv.zatcaStatus !== 'REPORTED')
            .reduce((acc, inv) => {
                acc[inv.customer] = (acc[inv.customer] || 0) + (inv.total || 0);
                return acc;
            }, {});
            
        return (
            <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>{translations[currentLanguage].accountsDebts || 'Accounts & Debts'}</h3>
                    <button className="btn btn-secondary" onClick={() => window.print()}>
                        <i className="ri-printer-line"></i> {currentLanguage === 'ar' ? 'طباعة' : 'Print'}
                    </button>
                </div>
                {Object.keys(debts).length === 0 ? (
                    <p>{currentLanguage === 'ar' ? 'لا توجد ديون مسجلة' : 'No debts found'}</p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>{currentLanguage === 'ar' ? 'العميل' : 'Customer'}</th>
                                <th style={{ textAlign: 'right' }}>{currentLanguage === 'ar' ? 'المبلغ المستحق' : 'Amount Due'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(debts).map(([customer, amount]) => (
                                <tr key={customer}>
                                    <td>{customer || 'Cash Customer'}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--accent-danger)' }}>{formatCurrency(amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        );
    }

    if (activeTab === 'profitAnalysis') {
        const totalRevenue = (props.invoices || []).reduce((sum, inv) => sum + ((inv.total || 0) - (inv.vat || 0)), 0);
        const totalExpenses = (props.expenses || []).reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
        const netProfit = totalRevenue - totalExpenses;
        const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0;

        return (
            <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>{translations[currentLanguage].profitAnalysis || 'Profit Analysis'}</h3>
                    <button className="btn btn-secondary" onClick={() => window.print()}>
                        <i className="ri-printer-line"></i> {currentLanguage === 'ar' ? 'طباعة' : 'Print'}
                    </button>
                </div>
                <div className="card-grid">
                    <div className="glass-card cyan">
                        <div className="card-stat">
                            <div className="stat-info">
                                <h3>{currentLanguage === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}</h3>
                                <div className="stat-value">{formatCurrency(totalRevenue)}</div>
                            </div>
                            <div className="stat-icon"><i className="ri-money-dollar-circle-line"></i></div>
                        </div>
                    </div>
                    <div className="glass-card purple">
                        <div className="card-stat">
                            <div className="stat-info">
                                <h3>{currentLanguage === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses'}</h3>
                                <div className="stat-value">{formatCurrency(totalExpenses)}</div>
                            </div>
                            <div className="stat-icon"><i className="ri-wallet-3-line"></i></div>
                        </div>
                    </div>
                    <div className="glass-card gold">
                        <div className="card-stat">
                            <div className="stat-info">
                                <h3>{currentLanguage === 'ar' ? 'صافي الربح' : 'Net Profit'}</h3>
                                <div className="stat-value" style={{ color: netProfit >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>{formatCurrency(netProfit)}</div>
                            </div>
                            <div className="stat-icon"><i className="ri-scales-3-line"></i></div>
                        </div>
                    </div>
                    <div className="glass-card green">
                        <div className="card-stat">
                            <div className="stat-info">
                                <h3>{currentLanguage === 'ar' ? 'هامش الربح' : 'Profit Margin'}</h3>
                                <div className="stat-value">{profitMargin}%</div>
                            </div>
                            <div className="stat-icon"><i className="ri-line-chart-line"></i></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (activeTab === 'maintenanceReport') {
        const mockTickets = [
            { id: 'TKT-001', customer: 'John Doe', device: 'Laptop Dell XPS 15', status: 'Pending', cost: 150, date: '2026-07-10' },
            { id: 'TKT-002', customer: 'Jane Smith', device: 'iPhone 13 Pro', status: 'In Progress', cost: 0, date: '2026-07-11' }
        ];
        return (
            <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>{translations[currentLanguage].maintenanceReport || 'Maintenance Report'}</h3>
                    <button className="btn btn-secondary" onClick={() => window.print()}>
                        <i className="ri-printer-line"></i> {currentLanguage === 'ar' ? 'طباعة' : 'Print'}
                    </button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>{currentLanguage === 'ar' ? 'رقم التذكرة' : 'Ticket ID'}</th>
                            <th>{currentLanguage === 'ar' ? 'العميل' : 'Customer'}</th>
                            <th>{currentLanguage === 'ar' ? 'الجهاز' : 'Device'}</th>
                            <th>{currentLanguage === 'ar' ? 'التاريخ' : 'Date'}</th>
                            <th style={{ textAlign: 'right' }}>{currentLanguage === 'ar' ? 'التكلفة' : 'Cost'}</th>
                            <th>{currentLanguage === 'ar' ? 'الحالة' : 'Status'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mockTickets.map(t => (
                            <tr key={t.id}>
                                <td>{t.id}</td>
                                <td>{t.customer}</td>
                                <td>{t.device}</td>
                                <td>{t.date}</td>
                                <td style={{ textAlign: 'right' }}>{formatCurrency(t.cost)}</td>
                                <td>{t.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    
    if (activeTab === 'financialMovement') {
        const inflows = (props.invoices || []).reduce((sum, inv) => sum + (inv.paymentMethod === 'Credit' ? 0 : inv.total), 0);
        const outflows = (props.expenses || []).reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
        return (
            <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>{translations[currentLanguage].financialMovement || 'Financial Movement'}</h3>
                    <button className="btn btn-secondary" onClick={() => window.print()}>
                        <i className="ri-printer-line"></i> {currentLanguage === 'ar' ? 'طباعة' : 'Print'}
                    </button>
                </div>
                <div className="card-grid">
                    <div className="glass-card green">
                        <div className="card-stat">
                            <div className="stat-info">
                                <h3>{currentLanguage === 'ar' ? 'التدفقات النقدية الداخلة' : 'Cash Inflows'}</h3>
                                <div className="stat-value">{formatCurrency(inflows)}</div>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card purple">
                        <div className="card-stat">
                            <div className="stat-info">
                                <h3>{currentLanguage === 'ar' ? 'التدفقات النقدية الخارجة' : 'Cash Outflows'}</h3>
                                <div className="stat-value">{formatCurrency(outflows)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (activeTab === 'salesAnalysis') {
        const salesByCustomer = (props.invoices || []).reduce((acc, inv) => {
            const customer = inv.customer || (currentLanguage === 'ar' ? 'عميل نقدي' : 'Cash Customer');
            acc[customer] = (acc[customer] || 0) + (inv.total || 0);
            return acc;
        }, {});
        
        return (
            <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>{translations[currentLanguage].salesAnalysis || 'Sales Analysis'}</h3>
                    <button className="btn btn-secondary" onClick={() => window.print()}>
                        <i className="ri-printer-line"></i> {currentLanguage === 'ar' ? 'طباعة' : 'Print'}
                    </button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>{currentLanguage === 'ar' ? 'العميل' : 'Customer'}</th>
                            <th style={{ textAlign: 'right' }}>{currentLanguage === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(salesByCustomer).sort((a, b) => b[1] - a[1]).map(([customer, amount]) => (
                            <tr key={customer}>
                                <td>{customer}</td>
                                <td style={{ textAlign: 'right' }}>{formatCurrency(amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    if (activeTab === 'summaryReport') {
        const totalSales = (props.invoices || []).reduce((sum, inv) => sum + (inv.total || 0), 0);
        const totalPurchases = (props.expenses || []).reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
        const activeCustomers = new Set((props.invoices || []).map(i => i.customer)).size;
        
        return (
            <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>{translations[currentLanguage].summaryReport || 'Summary Report'}</h3>
                    <button className="btn btn-secondary" onClick={() => window.print()}>
                        <i className="ri-printer-line"></i> {currentLanguage === 'ar' ? 'طباعة' : 'Print'}
                    </button>
                </div>
                <div className="card-grid">
                    <div className="glass-card cyan">
                        <div className="card-stat">
                            <div className="stat-info">
                                <h3>{currentLanguage === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</h3>
                                <div className="stat-value">{formatCurrency(totalSales)}</div>
                            </div>
                            <div className="stat-icon"><i className="ri-line-chart-line"></i></div>
                        </div>
                    </div>
                    <div className="glass-card purple">
                        <div className="card-stat">
                            <div className="stat-info">
                                <h3>{currentLanguage === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses'}</h3>
                                <div className="stat-value">{formatCurrency(totalPurchases)}</div>
                            </div>
                            <div className="stat-icon"><i className="ri-shopping-cart-2-line"></i></div>
                        </div>
                    </div>
                    <div className="glass-card gold">
                        <div className="card-stat">
                            <div className="stat-info">
                                <h3>{currentLanguage === 'ar' ? 'عدد العملاء النشطين' : 'Active Customers'}</h3>
                                <div className="stat-value">{activeCustomers}</div>
                            </div>
                            <div className="stat-icon"><i className="ri-group-line"></i></div>
                        </div>
                    </div>
                    <div className="glass-card green">
                        <div className="card-stat">
                            <div className="stat-info">
                                <h3>{currentLanguage === 'ar' ? 'إجمالي الفواتير' : 'Total Invoices'}</h3>
                                <div className="stat-value">{(props.invoices || []).length}</div>
                            </div>
                            <div className="stat-icon"><i className="ri-file-list-3-line"></i></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Placeholder for other reports
    const placeholderTitles = {
        
        customerStatement: translations[currentLanguage].customerStatement || 'Customer Statement',
        supplierStatement: translations[currentLanguage].supplierStatement || 'Supplier Statement',
        
        
    };
    if (placeholderTitles[activeTab]) {
        return (
            <div className="glass-card" style={{ textAlign: 'center', padding: '50px' }}>
                <h3>{placeholderTitles[activeTab]}</h3>
                <p>{currentLanguage === 'ar' ? 'قيد التطوير' : 'Under development'}</p>
            </div>
        );
    }

    // Fallback – nothing matched
    return null;
};

export default Reports;
