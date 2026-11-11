import React from 'react';
import { getInvoiceDate } from '../reports/Reports';

const Invoices = (props) => {
    const { 
        invoices, salesSearch, setSalesSearch, salesStartDate, setSalesStartDate, 
        salesEndDate, setSalesEndDate, formatCurrency, setActiveTab, currentLanguage, translations,
        handlePrintInvoice, handleDeleteInvoice, setInvoices,
        setInvoiceFormat, setInvoiceSource, setActiveInvoice, setShowInvoiceModal,
        simulateZATCAReporting, handleRefundInvoice
    } = props;

    {/* TAB: INVOICES & REPRINT (SALES MANAGEMENT) */}
                
                    const activeInvoicesList = invoices.filter(inv => inv.zatcaStatus !== 'REFUNDED');
                    const refundedInvoicesList = invoices.filter(inv => inv.zatcaStatus === 'REFUNDED');
                    const totalSalesVal = activeInvoicesList.reduce((acc, inv) => acc + (inv.total || 0), 0);
                    const totalVatVal = activeInvoicesList.reduce((acc, inv) => acc + (inv.vat || 0), 0);

                    const filteredInvoices = invoices.filter(inv => {
                        const matchesSearch = !salesSearch || 
                            inv.id.toLowerCase().includes(salesSearch.toLowerCase()) || 
                            (inv.customer && inv.customer.toLowerCase().includes(salesSearch.toLowerCase()));
                            
                        const invDateObj = getInvoiceDate(inv);
                        
                        let matchesStartDate = true;
                        if (salesStartDate && invDateObj) {
                            const start = new Date(salesStartDate);
                            start.setHours(0,0,0,0);
                            const comp = new Date(invDateObj);
                            comp.setHours(0,0,0,0);
                            matchesStartDate = comp >= start;
                        }
                        
                        let matchesEndDate = true;
                        if (salesEndDate && invDateObj) {
                            const end = new Date(salesEndDate);
                            end.setHours(23,59,59,999);
                            const comp = new Date(invDateObj);
                            comp.setHours(0,0,0,0);
                            matchesEndDate = comp <= end;
                        }
                        
                        return matchesSearch && matchesStartDate && matchesEndDate;
                    });

                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Stats Grid */}
                            <div className="card-grid">
                                <div className="glass-card purple">
                                    <div className="card-stat">
                                        <div className="stat-info">
                                            <h3>{currentLanguage === 'ar' ? 'إجمالي المبيعات (الصافي)' : 'Net Total Sales'}</h3>
                                            <div className="stat-value">{formatCurrency(totalSalesVal)}</div>
                                        </div>
                                        <div className="stat-icon"><i className="ri-money-dollar-circle-line"></i></div>
                                    </div>
                                </div>
                                <div className="glass-card cyan">
                                    <div className="card-stat">
                                        <div className="stat-info">
                                            <h3>{currentLanguage === 'ar' ? 'إجمالي ضريبة القيمة المضافة' : 'Total VAT Collected'}</h3>
                                            <div className="stat-value">{formatCurrency(totalVatVal)}</div>
                                        </div>
                                        <div className="stat-icon"><i className="ri-percent-line"></i></div>
                                    </div>
                                </div>
                                <div className="glass-card gold">
                                    <div className="card-stat">
                                        <div className="stat-info">
                                            <h3>{currentLanguage === 'ar' ? 'الفواتير النشطة' : 'Active Invoices'}</h3>
                                            <div className="stat-value">{activeInvoicesList.length}</div>
                                        </div>
                                        <div className="stat-icon"><i className="ri-file-paper-line"></i></div>
                                    </div>
                                </div>
                                <div className="glass-card red">
                                    <div className="card-stat">
                                        <div className="stat-info">
                                            <h3>{currentLanguage === 'ar' ? 'الفواتير المسترجعة' : 'Refunded Invoices'}</h3>
                                            <div className="stat-value">{refundedInvoicesList.length}</div>
                                        </div>
                                        <div className="stat-icon"><i className="ri-arrow-go-back-line"></i></div>
                                    </div>
                                </div>
                            </div>

                            {/* Filters Bar */}
                            <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                                <div style={{ display: 'flex', gap: '15px', flexGrow: 1, flexWrap: 'wrap' }}>
                                    <div style={{ minWidth: '220px', flexGrow: 1 }}>
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            placeholder={currentLanguage === 'ar' ? 'ابحث برقم الفاتورة أو اسم العميل...' : 'Search Invoice #, customer...'} 
                                            value={salesSearch} 
                                            onChange={e => setSalesSearch(e.target.value)} 
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{currentLanguage === 'ar' ? 'من:' : 'From:'}</span>
                                        <input 
                                            type="date" 
                                            className="form-control" 
                                            value={salesStartDate} 
                                            onChange={e => setSalesStartDate(e.target.value)} 
                                            style={{ width: '150px' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{currentLanguage === 'ar' ? 'إلى:' : 'To:'}</span>
                                        <input 
                                            type="date" 
                                            className="form-control" 
                                            value={salesEndDate} 
                                            onChange={e => setSalesEndDate(e.target.value)} 
                                            style={{ width: '150px' }}
                                        />
                                    </div>
                                </div>
                                {(salesSearch || salesStartDate || salesEndDate) && (
                                    <button 
                                        className="btn btn-secondary" 
                                        onClick={() => { setSalesSearch(''); setSalesStartDate(''); setSalesEndDate(''); }}
                                        style={{ height: '38px', padding: '0 15px', fontSize: '12px' }}
                                    >
                                        <i className="ri-refresh-line"></i> {currentLanguage === 'ar' ? 'إعادة تعيين الفلاتر' : 'Reset Filters'}
                                    </button>
                                )}
                            </div>

                            {/* Invoices List Table */}
                            <div className="glass-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h3>{currentLanguage === 'ar' ? 'فواتير المبيعات' : 'Sales Invoices'}</h3>
                                    <button className="btn btn-primary" onClick={() => setActiveTab('b2bsale')}>
                                        <i className="ri-add-line"></i> {currentLanguage === 'ar' ? 'إنشاء فاتورة جديدة' : 'Create New Invoice'}
                                    </button>
                                </div>
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>{translations[currentLanguage].invoiceNum}</th>
                                                <th>{translations[currentLanguage].invoiceDate}</th>
                                                <th>{translations[currentLanguage].invoiceCustomer}</th>
                                                <th>{currentLanguage === 'ar' ? 'الفرع' : 'Branch'}</th>
                                                <th>{currentLanguage === 'ar' ? 'المبلغ شامل الضريبة' : 'Total (Inc. VAT)'}</th>
                                                <th>{currentLanguage === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT (15%)'}</th>
                                                <th>{currentLanguage === 'ar' ? 'الحالة' : 'Status'}</th>
                                                <th>{translations[currentLanguage].actions}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredInvoices.length === 0 ? (
                                                <tr>
                                                    <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                        {currentLanguage === 'ar' ? 'لا توجد فواتير مطابقة للبحث' : 'No matching invoices found'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredInvoices.map(inv => {
                                                    let statusBadgeClass = 'blue';
                                                    let statusLabel = inv.zatcaStatus || 'ACTIVE';
                                                    if (inv.zatcaStatus === 'REFUNDED') {
                                                        statusBadgeClass = 'danger';
                                                        statusLabel = currentLanguage === 'ar' ? 'مرتجع' : 'REFUNDED';
                                                    } else if (inv.zatcaStatus === 'REPORTED') {
                                                        statusBadgeClass = 'green';
                                                        statusLabel = currentLanguage === 'ar' ? 'مُرسل للزكاة' : 'REPORTED (ZATCA)';
                                                    } else if (inv.zatcaStatus === 'PENDING') {
                                                        statusBadgeClass = 'gold';
                                                        statusLabel = currentLanguage === 'ar' ? 'معلق الزكاة' : 'PENDING ZATCA';
                                                    } else {
                                                        statusLabel = currentLanguage === 'ar' ? 'نشط' : 'ACTIVE';
                                                    }

                                                    return (
                                                        <tr key={inv.id}>
                                                            <td>{inv.id}</td>
                                                            <td>{inv.date}</td>
                                                            <td>{inv.customer}</td>
                                                            <td>{inv.branch || (currentLanguage === 'ar' ? 'الرئيسي' : 'Main Branch')}</td>
                                                            <td style={{ fontWeight: 'bold' }}>{formatCurrency(inv.total)}</td>
                                                            <td>{formatCurrency(inv.vat || (inv.total - (inv.total / 1.15)))}</td>
                                                            <td>
                                                                <span className={`badge ${statusBadgeClass}`}>{statusLabel}</span>
                                                            </td>
                                                            <td>
                                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                                    <button className="btn btn-secondary" title={currentLanguage === 'ar' ? 'عرض وطباعة بتنسيق A4' : 'View & Print A4 Invoice'} onClick={() => { setInvoiceFormat('a4'); setInvoiceSource('sales'); setActiveInvoice(inv); setShowInvoiceModal(true); }}>
                                                                        <i className="ri-printer-line"></i>
                                                                    </button>
                                                                    {inv.zatcaStatus !== 'REPORTED' && inv.zatcaStatus !== 'REFUNDED' && (
                                                                        <button className="btn btn-secondary" style={{ color: 'var(--accent-cyan)' }} title={currentLanguage === 'ar' ? 'إرسال لهيئة الزكاة' : 'Submit to ZATCA'} onClick={() => {
                                                                            simulateZATCAReporting(inv.id);
                                                                        }}>
                                                                            <i className="ri-cloud-upload-line"></i>
                                                                        </button>
                                                                    )}
                                                                    {inv.zatcaStatus !== 'REFUNDED' && (
                                                                        <button className="btn btn-danger" title={currentLanguage === 'ar' ? 'استرجاع الفاتورة' : 'Refund Invoice'} onClick={() => handleRefundInvoice(inv.id)}>
                                                                            <i className="ri-arrow-go-back-line"></i>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    );
                
};

export default Invoices;
