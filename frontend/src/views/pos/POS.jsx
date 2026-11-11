import React from 'react';

const POS = (props) => {
    const { 
        products, posFilter, setPosFilter, posSearch, setPosSearch, 
        currentLanguage, translations, formatCurrency, settings,
        addToCart, cart, removeFromCart, updateCartQty,
        activeCustomer, setActiveCustomer, customers, 
        couponInput, setCouponInput, applyCoupon, removeCoupon, activeCoupon,
        manualDiscount, setManualDiscount, getCartDiscount,
        paymentMethod, setPaymentMethod, splitCash, setSplitCash, splitCard, setSplitCard,
        tableNum, setTableNum, serviceDuration, setServiceDuration,
        checkout, processCheckout, handleSaveQuotationFromCart,
        handleHoldTable, handleFireToKitchen
    } = props;

    return (
        
                    <div className="pos-layout">
                        <div className="pos-products">
                            <div className="products-filter">
                                <button className={`filter-chip ${posFilter === 'all' ? 'active' : ''}`} onClick={() => setPosFilter('all')}>{translations[currentLanguage].allCategories}</button>
                                {[...new Set(products.map(p => p.category))].map(cat => {
                                    const catTranslations = {
                                        'Main Course': 'الأطباق الرئيسية',
                                        'Fast Food': 'الوجبات السريعة',
                                        'Pizza': 'البيتزا',
                                        'Appetizers': 'المقبلات',
                                        'Beverages': 'المشروبات',
                                        'Desserts': 'الحلويات',
                                        'Salads': 'السلطات',
                                        'Sides': 'الأطباق الجانبية',
                                        'Sandwiches': 'السندويشات',
                                        'appliances': 'الأجهزة',
                                        'furniture': 'الأثاث',
                                        'spareparts': 'قطع الغيار',
                                        'electronics': 'الإلكترونيات',
                                        'office': 'مكتبية',
                                        'groceries': 'بقالة',
                                        'apparel': 'ملابس'
                                    };
                                    const label = currentLanguage === 'ar' && catTranslations[cat] ? catTranslations[cat] : cat;
                                    return (
                                        <button 
                                            key={cat} 
                                            className={`filter-chip ${posFilter === cat ? 'active' : ''}`} 
                                            onClick={() => setPosFilter(cat)}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>

                            <input type="text" className="form-control" placeholder={translations[currentLanguage].searchPlaceholder} value={posSearch} onChange={e => setPosSearch(e.target.value)} />

                            <div className="products-grid">
                                {products.filter(p => (posFilter === 'all' || p.category === posFilter) && (p.nameAR.includes(posSearch) || p.nameEN.toLowerCase().includes(posSearch.toLowerCase()))).map(prod => (
                                    <div className="product-card" key={prod.id} onClick={() => addToCart(prod)}>
                                        <div className="product-img">{prod.emoji || '📦'}</div>
                                        <div className="product-title">{currentLanguage === 'ar' ? prod.nameAR : prod.nameEN}</div>
                                        <div className="product-stock">{currentLanguage === 'ar' ? `المخزن: ${prod.stock}` : `Stock: ${prod.stock}`}</div>
                                        <div className="product-price">{formatCurrency(prod.price)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Cart Drawer */}
                        <div className="pos-cart">
                            <h3 data-i18n="cartTitle">{translations[currentLanguage].cartTitle}</h3>
                            
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px', marginBottom: '8px' }}>
                                <span>{currentLanguage === 'ar' ? 'الفرع:' : 'Branch:'} {settings.currentBranch || (currentLanguage === 'ar' ? 'الرئيسي' : 'Main Branch')}</span>
                                <span>
                                    {currentLanguage === 'ar' ? 'النشاط:' : 'Type:'}{' '}
                                    {settings.businessType === 'restaurant' ? (currentLanguage === 'ar' ? 'مطعم' : 'Restaurant') :
                                     settings.businessType === 'services' ? (currentLanguage === 'ar' ? 'خدمات' : 'Services') :
                                     settings.businessType === 'appliances' ? (currentLanguage === 'ar' ? 'أجهزة منزلية' : 'Appliances') :
                                     settings.businessType === 'furniture' ? (currentLanguage === 'ar' ? 'أثاث' : 'Furniture') :
                                     settings.businessType === 'spareparts' ? (currentLanguage === 'ar' ? 'قطع غيار' : 'Spare Parts') :
                                     settings.businessType === 'grocery' ? (currentLanguage === 'ar' ? 'مواد غذائية' : 'Grocery') :
                                     settings.businessType === 'apparel' ? (currentLanguage === 'ar' ? 'ملابس وأزياء' : 'Apparel') :
                                     (currentLanguage === 'ar' ? 'تجزئة' : 'Retail')}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{currentLanguage === 'ar' ? 'تحديد العميل' : 'Assign Customer'}</label>
                                    <select className="form-control" value={activeCustomer} onChange={e => setActiveCustomer(e.target.value)}>
                                        <option value="walk-in">{translations[currentLanguage].walkIn}</option>
                                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>

                                {settings.businessType === 'restaurant' && settings.enableTables && (
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{currentLanguage === 'ar' ? 'تحديد الطاولة' : 'Select Table'}</label>
                                        <select className="form-control" value={tableNum} onChange={e => setTableNum(e.target.value)}>
                                            {Array.from({ length: 20 }, (_, i) => (
                                                <option key={i+1} value={(i+1).toString()}>{currentLanguage === 'ar' ? `طاولة ${i+1}` : `Table ${i+1}`}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {settings.businessType === 'services' && settings.enableServiceDuration && (
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{currentLanguage === 'ar' ? 'مدة الجلسة' : 'Session Duration'}</label>
                                        <select className="form-control" value={serviceDuration} onChange={e => setServiceDuration(e.target.value)}>
                                            <option value="30 mins">{currentLanguage === 'ar' ? '٣٠ دقيقة' : '30 mins'}</option>
                                            <option value="60 mins">{currentLanguage === 'ar' ? 'ساعة واحدة' : '60 mins'}</option>
                                            <option value="90 mins">{currentLanguage === 'ar' ? 'ساعة ونصف' : '90 mins'}</option>
                                            <option value="120 mins">{currentLanguage === 'ar' ? 'ساعتين' : '120 mins'}</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="cart-items">
                                {cart.length === 0 ? <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '40px' }}>{translations[currentLanguage].cartEmpty}</p> : 
                                    cart.map(item => (
                                        <div className="cart-item" key={item.product.id}>
                                            <div className="cart-item-info">
                                                <div className="product-title">{currentLanguage === 'ar' ? item.product.nameAR : item.product.nameEN}</div>
                                                {item.product.barcode && (
                                                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                                        {currentLanguage === 'ar' ? 'الرمز:' : 'Code:'} {item.product.barcode}
                                                    </div>
                                                )}
                                                {settings.businessType === 'appliances' && (
                                                    <div style={{ fontSize: '10px', color: 'var(--accent-purple)' }}>
                                                        {currentLanguage === 'ar' ? 'سجل الضمان مفعل (٢ سنة)' : 'Warranty Logs Enabled (2 Yrs)'}
                                                    </div>
                                                )}
                                                {settings.businessType === 'spareparts' && (
                                                    <div style={{ fontSize: '10px', color: 'var(--accent-cyan)' }}>
                                                        {currentLanguage === 'ar' ? 'توافق OEM: معتمد' : 'OEM Compatibility: Certified'}
                                                    </div>
                                                )}
                                                <div style={{ color: 'var(--accent-cyan)' }}>{formatCurrency(item.product.price)}</div>
                                            </div>
                                            <div className="cart-item-qty">
                                                <button className="qty-btn" onClick={() => updateCartQty(item.product.id, -1)}>-</button>
                                                <span>{item.qty}</span>
                                                <button className="qty-btn" onClick={() => updateCartQty(item.product.id, 1)}>+</button>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                <input type="text" className="form-control" placeholder="Coupon KAMY50" value={couponInput} onChange={e => setCouponInput(e.target.value)} />
                                <button className="btn btn-secondary" onClick={applyCoupon}>{translations[currentLanguage].couponLabel}</button>
                            </div>

                            <div className="cart-totals">
                                <div className="total-row">
                                    <span>{translations[currentLanguage].subtotal}</span>
                                    <span>{formatCurrency(cart.reduce((a, b) => a + (b.product.price * b.qty), 0))}</span>
                                </div>
                                {/* Manual discount: type a value and choose % of the subtotal or a fixed Riyal amount */}
                                <div className="total-row" style={{ alignItems: 'center', gap: '8px' }}>
                                    <span>{translations[currentLanguage].discount}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <input
                                            type="number"
                                            min="0"
                                            max={manualDiscount.type === 'percent' ? 100 : undefined}
                                            step="0.01"
                                            className="form-control"
                                            aria-label={currentLanguage === 'ar' ? 'قيمة الخصم' : 'Discount value'}
                                            placeholder="0"
                                            value={manualDiscount.value}
                                            onChange={e => setManualDiscount({ ...manualDiscount, value: e.target.value })}
                                            style={{ width: '88px', padding: '4px 6px', height: '32px', fontSize: '13px', textAlign: 'right' }}
                                        />
                                        <div role="group" aria-label={currentLanguage === 'ar' ? 'نوع الخصم' : 'Discount type'} style={{ display: 'flex', border: '1px solid var(--glass-border)', borderRadius: '4px', overflow: 'hidden' }}>
                                            {[{ id: 'percent', label: '%' }, { id: 'amount', label: '⃁' }].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    aria-pressed={manualDiscount.type === opt.id}
                                                    onClick={() => setManualDiscount({ ...manualDiscount, type: opt.id })}
                                                    style={{ minWidth: '36px', padding: '2px 10px', height: '32px', fontSize: '14px', fontWeight: 'bold', background: manualDiscount.type === opt.id ? 'var(--accent-purple)' : 'transparent', color: manualDiscount.type === opt.id ? '#fff' : 'var(--text-secondary)' }}
                                                >{opt.label}</button>
                                            ))}
                                        </div>
                                        <span style={{ minWidth: '80px', textAlign: 'right' }}>-{formatCurrency(getCartDiscount(cart.reduce((a, b) => a + (b.product.price * b.qty), 0)))}</span>
                                    </div>
                                </div>
                                <div className="total-row">
                                    <span>{translations[currentLanguage].vat}</span>
                                    <span>{formatCurrency((cart.reduce((a, b) => a + (b.product.price * b.qty), 0) - getCartDiscount(cart.reduce((a, b) => a + (b.product.price * b.qty), 0))) * (settings.taxRate / 100))}</span>
                                </div>
                                <div className="total-row grand-total">
                                    <span>{translations[currentLanguage].grandTotal}</span>
                                    <span>{formatCurrency((cart.reduce((a, b) => a + (b.product.price * b.qty), 0) - getCartDiscount(cart.reduce((a, b) => a + (b.product.price * b.qty), 0))) * (1 + settings.taxRate / 100))}</span>
                                </div>
                                {settings.businessType === 'furniture' && cart.length > 0 && (
                                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--glass-border)', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>{currentLanguage === 'ar' ? 'العربون المطلوب (30%)' : 'Required Deposit (30%)'}</span>
                                            <span style={{ color: 'var(--accent-success)', fontWeight: 'bold' }}>{formatCurrency((cart.reduce((a, b) => a + (b.product.price * b.qty), 0) - getCartDiscount(cart.reduce((a, b) => a + (b.product.price * b.qty), 0))) * (1 + settings.taxRate / 100) * 0.3)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>{currentLanguage === 'ar' ? 'المبلغ المتبقي للتحصيل' : 'Remaining Balance Due'}</span>
                                            <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>{formatCurrency((cart.reduce((a, b) => a + (b.product.price * b.qty), 0) - getCartDiscount(cart.reduce((a, b) => a + (b.product.price * b.qty), 0))) * (1 + settings.taxRate / 100) * 0.7)}</span>
                                        </div>
                                    </div>
                                )}
                                {/* Payment Method Selector */}
                                <div style={{ borderTop: '1px dashed var(--glass-border)', marginTop: '12px', paddingTop: '12px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                                        {translations[currentLanguage].paymentMethod}
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
                                        {[
                                            { id: 'cash', label: translations[currentLanguage].paymentCash, icon: 'ri-money-dollar-circle-line' },
                                            { id: 'visa', label: translations[currentLanguage].paymentVisa, icon: 'ri-bank-card-line' },
                                            { id: 'mada', label: translations[currentLanguage].paymentMada, icon: 'ri-bank-card-2-line' },
                                            { id: 'ninja', label: translations[currentLanguage].paymentNinja || 'Ninja', icon: 'ri-e-bike-2-line' },
                                            { id: 'keeta', label: translations[currentLanguage].paymentKeeta || 'Keeta', icon: 'ri-riding-line' },
                                            { id: 'hungerstation', label: translations[currentLanguage].paymentHungerstation || 'HungerStation', icon: 'ri-restaurant-2-line' },
                                            { id: 'mobile', label: translations[currentLanguage].paymentMobile, icon: 'ri-smartphone-line' },
                                            { id: 'stc', label: translations[currentLanguage].paymentStc, icon: 'ri-wallet-3-line' },
                                            { id: 'apple', label: translations[currentLanguage].paymentApplePay, icon: 'ri-apple-line' },
                                            { id: 'tabby', label: translations[currentLanguage].paymentTabby, icon: 'ri-coupon-line' },
                                            { id: 'tamara', label: translations[currentLanguage].paymentTamara, icon: 'ri-coupon-line' },
                                            { id: 'split', label: translations[currentLanguage].paymentSplit, icon: 'ri-split-cells-vertical' }
                                        ].map(m => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => {
                                                    setPaymentMethod(m.id);
                                                    if (m.id === 'split') {
                                                        const totalVal = (cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0) - getCartDiscount(cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0))) * (1 + settings.taxRate / 100);
                                                        setSplitCash((totalVal / 2).toFixed(2));
                                                        setSplitCard((totalVal / 2).toFixed(2));
                                                    }
                                                }}
                                                className={`btn ${paymentMethod === m.id ? 'btn-primary' : 'btn-secondary'}`}
                                                style={{
                                                    padding: '6px 4px',
                                                    fontSize: '10px',
                                                    flexDirection: 'column',
                                                    gap: '4px',
                                                    height: '52px',
                                                    border: paymentMethod === m.id ? '1px solid var(--accent-cyan)' : '1px solid var(--glass-border)',
                                                    background: paymentMethod === m.id ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))' : 'var(--glass-bg)',
                                                    opacity: paymentMethod === m.id ? 1 : 0.85
                                                }}
                                            >
                                                <i className={m.icon} style={{ fontSize: '15px', color: paymentMethod === m.id ? '#fff' : 'var(--accent-cyan)' }}></i>
                                                <span style={{ fontSize: '9px', whiteSpace: 'nowrap' }}>{m.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                    
                                    {paymentMethod === 'split' && (
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', background: 'var(--bg-primary)', padding: '8px', borderRadius: '4px', border: '1px dashed var(--glass-border)' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Cash / نقداً</label>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    style={{ padding: '4px 6px', fontSize: '11px', height: '28px' }}
                                                    value={splitCash}
                                                    onChange={e => {
                                                        const cash = parseFloat(e.target.value) || 0;
                                                        setSplitCash(e.target.value);
                                                        const totalVal = (cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0) - getCartDiscount(cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0))) * (1 + settings.taxRate / 100);
                                                        setSplitCard((Math.max(0, totalVal - cash)).toFixed(2));
                                                    }}
                                                />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Card / شبكة</label>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    style={{ padding: '4px 6px', fontSize: '11px', height: '28px' }}
                                                    value={splitCard}
                                                    onChange={e => {
                                                        const card = parseFloat(e.target.value) || 0;
                                                        setSplitCard(e.target.value);
                                                        const totalVal = (cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0) - getCartDiscount(cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0))) * (1 + settings.taxRate / 100);
                                                        setSplitCash((Math.max(0, totalVal - card)).toFixed(2));
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    {settings.businessType === 'restaurant' && (
                                        <>
                                            <button className="btn btn-secondary" style={{ flexGrow: 1, backgroundColor: 'var(--accent-gold)', color: '#fff', border: 'none' }} onClick={handleHoldTable}>
                                                <i className="ri-pause-circle-line"></i> {currentLanguage === 'ar' ? 'تعليق / حفظ' : 'Hold Table'}
                                            </button>
                                            <button className="btn btn-secondary" style={{ flexGrow: 1, backgroundColor: 'var(--accent-cyan)', color: '#fff', border: 'none' }} onClick={handleFireToKitchen}>
                                                <i className="ri-fire-line"></i> {currentLanguage === 'ar' ? 'إرسال للمطبخ' : 'Fire to KOT'}
                                            </button>
                                        </>
                                    )}
                                    <button className="btn btn-primary" style={{ flexGrow: 2 }} onClick={processCheckout}>{translations[currentLanguage].payCheckout}</button>
                                    
                                </div>
                            </div>
                        </div>
                    </div>
                
    );
};

export default POS;
