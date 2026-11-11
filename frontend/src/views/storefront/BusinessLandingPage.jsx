import React, { useEffect, useMemo, useState } from 'react';
import { getSectorTheme } from './sectorThemes';

// Public home page of a store (store.26i.uk/), styled and worded for its business type.
// Shows the store's own menu/products (public fields only) and contact details.
const BusinessLandingPage = ({ tenantId, currentLanguage, setLanguage, initialSettings }) => {
    const isAr = currentLanguage === 'ar';
    const lang = isAr ? 'ar' : 'en';
    const [settings, setSettings] = useState(initialSettings || null);
    const [products, setProducts] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [category, setCategory] = useState('all');

    useEffect(() => {
        const headers = { 'x-tenant-id': tenantId || 'default' };
        fetch('/api/settings', { headers })
            .then(res => res.json())
            .then(data => { if (data && !data.error) setSettings(data); })
            .catch(() => {});
        fetch('/api/storefront/products', { headers })
            .then(res => res.json())
            .then(data => setProducts(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setLoaded(true));
    }, [tenantId]);

    // ?sector=restaurant etc. previews another business type's design (demos)
    const sectorPreview = new URLSearchParams(window.location.search).get('sector');
    const theme = getSectorTheme(sectorPreview || settings?.businessType || 'retail');
    const c = theme.colors;
    const hero = theme.hero[lang];
    const businessName = settings?.businessName || (tenantId ? tenantId.replace(/-/g, ' ') : '');
    const description = (isAr ? settings?.portalDescriptionAr : settings?.portalDescription) || hero.text;

    // Contact details (public settings only)
    const phone = settings?.contactPhone || settings?.contactNumber || '';
    const phoneDigits = phone.replace(/[^\d+]/g, '');
    const whatsappNumber = phoneDigits.replace(/^\+/, '').replace(/^0(?=5)/, '966');
    const email = settings?.contactEmail || '';
    const address = (isAr ? settings?.contactAddressAr : settings?.contactAddress) || settings?.businessAddress || '';
    const social = settings?.socialLinks || {};
    const shopEnabled = !!settings?.enabledModules?.ecommerce;
    const query = window.location.search || '';

    const formatPrice = (amount) => {
        const code = settings?.baseCurrency || 'SAR';
        const value = Number(amount || 0).toFixed(2);
        return code === 'SAR' ? `${value} ⃁` : `${value} ${code}`;
    };

    const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))], [products]);
    const visibleProducts = category === 'all' ? products : products.filter(p => p.category === category);
    const shownProducts = theme.products.byCategory ? visibleProducts : visibleProducts.slice(0, 12);

    // Where each call to action goes
    const actionHref = (kind) => {
        if (kind === 'menu') return `#${theme.products.anchor}`;
        if (kind === 'shop' && shopEnabled) return `/store${query}`;
        if ((kind === 'book' || kind === 'ask' || kind === 'whatsapp') && whatsappNumber) {
            const msg = kind === 'book'
                ? (isAr ? 'مرحباً، أرغب في حجز موعد' : 'Hello, I would like to book an appointment')
                : (isAr ? 'مرحباً، لدي استفسار' : 'Hello, I have a question');
            return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`;
        }
        if (phoneDigits) return `tel:${phoneDigits}`;
        return `#contact`;
    };
    const isExternal = (href) => href.startsWith('https://wa.me');
    // "Shop online" only when the store's online shop is switched on; otherwise the
    // main button takes visitors to the product list on this page
    const primaryKind = theme.cta === 'shop' && !shopEnabled ? 'menu' : theme.cta;
    const primaryLabel = primaryKind === theme.cta ? theme.ctaLabel[lang] : (isAr ? 'تصفّح منتجاتنا' : 'See our products');

    const t = {
        about: isAr ? 'من نحن' : 'About',
        contact: isAr ? 'تواصل معنا' : 'Contact',
        staff: isAr ? 'دخول الموظفين' : 'Staff login',
        all: isAr ? 'الكل' : 'All',
        soldOut: isAr ? 'نفد' : 'Sold out',
        empty: isAr ? 'سيتم إضافة المنتجات قريباً.' : 'Products will be added soon.',
        loading: isAr ? 'جارٍ التحميل…' : 'Loading…',
        phone: isAr ? 'الهاتف' : 'Phone',
        whatsapp: isAr ? 'واتساب' : 'WhatsApp',
        email: isAr ? 'البريد الإلكتروني' : 'Email',
        address: isAr ? 'العنوان' : 'Address',
        vat: isAr ? 'الرقم الضريبي' : 'VAT number',
        rights: isAr ? 'جميع الحقوق محفوظة' : 'All rights reserved',
        visit: isAr ? 'نسعد بزيارتكم وخدمتكم' : 'We look forward to serving you'
    };

    // Until the store's settings arrive, show a neutral screen instead of flashing
    // another business type's design
    if (!settings && !sectorPreview) {
        return (
            <div dir={isAr ? 'rtl' : 'ltr'} role="status" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#fff', color: '#6b7280', fontFamily: "'Outfit', 'Cairo', system-ui, sans-serif" }}>
                {t.loading}
            </div>
        );
    }

    return (
        <div className="blp" dir={isAr ? 'rtl' : 'ltr'} style={{
            '--blp-primary': c.primary, '--blp-accent': c.accent, '--blp-dark': c.dark, '--blp-soft': c.soft
        }}>
            <style>{`
                .blp { min-height: 100vh; background: #fff; color: #1f2937; font-family: ${isAr ? "'Cairo'" : "'Outfit'"}, 'Cairo', 'SaudiRiyal', system-ui, sans-serif; }
                .blp a { color: inherit; }
                .blp-wrap { max-width: 1160px; margin: 0 auto; padding: 0 20px; }
                .blp-header { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,0.94); backdrop-filter: blur(8px); border-bottom: 1px solid #eef0f3; }
                .blp-header .blp-wrap { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 64px; flex-wrap: wrap; }
                .blp-brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 20px; color: var(--blp-dark); text-decoration: none; }
                .blp-brand-icon { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; background: var(--blp-primary); color: #fff; font-size: 20px; }
                .blp-brand img { height: 38px; width: auto; border-radius: 8px; }
                .blp-nav { display: flex; align-items: center; gap: 16px; font-size: 14px; flex-wrap: wrap; }
                .blp-nav a { text-decoration: none; color: #4b5563; font-weight: 600; }
                .blp-nav a:hover { color: var(--blp-primary); }
                .blp-pill { border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 999px; padding: 6px 12px; font-weight: 600; color: #374151; cursor: pointer; font: inherit; font-size: 13px; }
                .blp-hero { background: linear-gradient(135deg, var(--blp-dark) 0%, var(--blp-primary) 100%); color: #fff; position: relative; overflow: hidden; }
                .blp-hero .blp-wrap { display: grid; grid-template-columns: 1.3fr 1fr; gap: 32px; align-items: center; padding-top: 64px; padding-bottom: 64px; }
                .blp-kicker { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.14); border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600; }
                .blp-hero h1 { font-size: clamp(30px, 5vw, 50px); line-height: 1.15; margin: 16px 0 12px; font-weight: 800; }
                .blp-hero p { font-size: 17px; line-height: 1.7; opacity: 0.92; max-width: 560px; margin: 0 0 26px; }
                .blp-ctas { display: flex; gap: 12px; flex-wrap: wrap; }
                .blp-btn { display: inline-flex; align-items: center; gap: 8px; padding: 13px 22px; border-radius: 12px; font-weight: 700; text-decoration: none; font-size: 15px; }
                .blp-btn-primary { background: #fff; color: var(--blp-dark) !important; }
                .blp-btn-ghost { border: 1.5px solid rgba(255,255,255,0.6); color: #fff !important; }
                .blp-btn:hover { transform: translateY(-1px); }
                .blp-hero-art { justify-self: center; width: min(320px, 80%); aspect-ratio: 1; border-radius: 50%; background: rgba(255,255,255,0.1); display: grid; place-items: center; box-shadow: inset 0 0 0 18px rgba(255,255,255,0.06); }
                .blp-hero-art i { font-size: clamp(90px, 14vw, 150px); color: var(--blp-accent); }
                .blp-features { background: var(--blp-soft); }
                .blp-features .blp-wrap { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; padding-top: 32px; padding-bottom: 32px; }
                .blp-feature { background: #fff; border-radius: 14px; padding: 18px; display: flex; gap: 14px; align-items: flex-start; border: 1px solid #f0f0f0; }
                .blp-feature i { font-size: 24px; color: var(--blp-primary); background: var(--blp-soft); border-radius: 10px; padding: 8px; }
                .blp-feature h3 { margin: 0 0 4px; font-size: 16px; color: var(--blp-dark); }
                .blp-feature p { margin: 0; font-size: 13.5px; color: #6b7280; line-height: 1.5; }
                .blp-section { padding: 56px 0; }
                .blp-section h2 { font-size: clamp(24px, 3.4vw, 32px); margin: 0 0 8px; color: var(--blp-dark); font-weight: 800; }
                .blp-section-sub { color: #6b7280; margin: 0 0 22px; }
                .blp-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 22px; }
                .blp-chip { border: 1px solid #e5e7eb; background: #fff; border-radius: 999px; padding: 8px 16px; cursor: pointer; font: inherit; font-size: 14px; font-weight: 600; color: #374151; }
                .blp-chip[aria-pressed="true"] { background: var(--blp-primary); border-color: var(--blp-primary); color: #fff; }
                .blp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px; }
                .blp-card { border: 1px solid #eef0f3; border-radius: 16px; overflow: hidden; background: #fff; display: flex; flex-direction: column; }
                .blp-card-media { aspect-ratio: 4 / 3; background: var(--blp-soft); display: grid; place-items: center; font-size: 56px; }
                .blp-card-media img { width: 100%; height: 100%; object-fit: cover; }
                .blp-card-body { padding: 14px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
                .blp-card-cat { font-size: 12px; color: var(--blp-primary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
                .blp-card-name { font-weight: 700; font-size: 15.5px; color: #111827; line-height: 1.35; }
                .blp-card-foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
                .blp-price { font-weight: 800; color: var(--blp-dark); font-size: 17px; }
                .blp-soldout { font-size: 12px; background: #f3f4f6; color: #6b7280; border-radius: 999px; padding: 3px 10px; }
                .blp-menu-group { margin-bottom: 30px; }
                .blp-menu-group h3 { font-size: 19px; color: var(--blp-primary); margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid var(--blp-soft); }
                .blp-menu-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px 28px; }
                .blp-menu-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px dashed #e5e7eb; }
                .blp-menu-emoji { font-size: 30px; width: 46px; height: 46px; display: grid; place-items: center; background: var(--blp-soft); border-radius: 12px; flex-shrink: 0; }
                .blp-menu-name { flex: 1; font-weight: 700; color: #111827; }
                .blp-empty { color: #6b7280; padding: 24px; border: 1px dashed #e5e7eb; border-radius: 14px; text-align: center; }
                .blp-about { background: #fafafa; }
                .blp-about p { font-size: 16px; line-height: 1.8; color: #374151; max-width: 820px; margin: 0; }
                .blp-contact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; }
                .blp-contact { display: flex; gap: 12px; align-items: flex-start; padding: 16px; border: 1px solid #eef0f3; border-radius: 14px; text-decoration: none; }
                .blp-contact i { font-size: 22px; color: var(--blp-primary); }
                .blp-contact small { display: block; color: #6b7280; font-size: 12.5px; margin-bottom: 2px; }
                .blp-contact span { font-weight: 700; color: #111827; word-break: break-word; }
                .blp-social { display: flex; gap: 10px; margin-top: 18px; }
                .blp-social a { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--blp-soft); color: var(--blp-primary); font-size: 19px; text-decoration: none; }
                .blp-footer { background: var(--blp-dark); color: rgba(255,255,255,0.8); font-size: 13.5px; }
                .blp-footer .blp-wrap { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 22px; padding-bottom: 22px; }
                .blp-footer a { color: #fff; }
                @media (max-width: 760px) {
                    .blp-hero .blp-wrap { grid-template-columns: 1fr; padding-top: 40px; padding-bottom: 44px; }
                    .blp-hero-art { display: none; }
                    .blp-nav .blp-nav-link { display: none; }
                    .blp-menu-list { grid-template-columns: 1fr; }
                    .blp-section { padding: 40px 0; }
                }
            `}</style>

            <header className="blp-header">
                <div className="blp-wrap">
                    <a className="blp-brand" href={`/${query}`}>
                        {settings?.logo
                            ? <img src={settings.logo} alt="" />
                            : <span className="blp-brand-icon"><i className={theme.icon}></i></span>}
                        <span>{businessName}</span>
                    </a>
                    <nav className="blp-nav" aria-label={isAr ? 'التنقل' : 'Main'}>
                        <a className="blp-nav-link" href={`#${theme.products.anchor}`}>{theme.products[lang]}</a>
                        <a className="blp-nav-link" href="#about">{t.about}</a>
                        <a className="blp-nav-link" href="#contact">{t.contact}</a>
                        <button type="button" className="blp-pill" onClick={() => setLanguage(isAr ? 'en' : 'ar')}>
                            <i className="ri-translate-2"></i> {isAr ? 'English' : 'عربي'}
                        </button>
                        <a href={`/admin${query}`} style={{ fontSize: '13px' }}>{t.staff}</a>
                    </nav>
                </div>
            </header>

            <section className="blp-hero">
                <div className="blp-wrap">
                    <div>
                        <span className="blp-kicker"><i className={theme.icon}></i> {hero.kicker}</span>
                        <h1>{hero.title}</h1>
                        <p>{description}</p>
                        <div className="blp-ctas">
                            {(() => { const href = actionHref(primaryKind); return (
                                <a className="blp-btn blp-btn-primary" href={href} {...(isExternal(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                                    {primaryLabel} <i className={isAr ? 'ri-arrow-left-line' : 'ri-arrow-right-line'}></i>
                                </a>); })()}
                            {(() => { const href = actionHref(theme.secondaryCta); return (
                                <a className="blp-btn blp-btn-ghost" href={href} {...(isExternal(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                                    <i className={theme.secondaryCta === 'whatsapp' ? 'ri-whatsapp-line' : 'ri-phone-line'}></i> {theme.secondaryLabel[lang]}
                                </a>); })()}
                        </div>
                    </div>
                    <div className="blp-hero-art" aria-hidden="true"><i className={theme.icon}></i></div>
                </div>
            </section>

            <section className="blp-features" aria-label={isAr ? 'مميزاتنا' : 'Why choose us'}>
                <div className="blp-wrap">
                    {theme.features.map(f => (
                        <div className="blp-feature" key={f.icon}>
                            <i className={f.icon} aria-hidden="true"></i>
                            <div><h3>{f[lang][0]}</h3><p>{f[lang][1]}</p></div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="blp-section" id={theme.products.anchor}>
                <div className="blp-wrap">
                    <h2>{theme.products[lang]}</h2>
                    <p className="blp-section-sub">{businessName}</p>

                    {!loaded && <div className="blp-empty">{t.loading}</div>}
                    {loaded && products.length === 0 && <div className="blp-empty">{t.empty}</div>}

                    {loaded && products.length > 0 && categories.length > 1 && (
                        <div className="blp-chips" role="group" aria-label={isAr ? 'الفئات' : 'Categories'}>
                            {['all', ...categories].map(cat => (
                                <button key={cat} type="button" className="blp-chip" aria-pressed={category === cat} onClick={() => setCategory(cat)}>
                                    {cat === 'all' ? t.all : cat}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Restaurants: a menu grouped by category */}
                    {loaded && theme.products.byCategory && (category === 'all' ? categories : [category]).map(cat => {
                        const items = shownProducts.filter(p => p.category === cat);
                        if (items.length === 0) return null;
                        return (
                            <div className="blp-menu-group" key={cat}>
                                <h3>{cat}</h3>
                                <div className="blp-menu-list">
                                    {items.map(p => (
                                        <div className="blp-menu-item" key={p.id}>
                                            <span className="blp-menu-emoji" aria-hidden="true">{p.emoji || '🍽️'}</span>
                                            <span className="blp-menu-name">{isAr ? (p.nameAR || p.nameEN) : (p.nameEN || p.nameAR)}</span>
                                            {p.inStock === false ? <span className="blp-soldout">{t.soldOut}</span> : <span className="blp-price">{formatPrice(p.price)}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {/* Everyone else: product / service cards */}
                    {loaded && !theme.products.byCategory && shownProducts.length > 0 && (
                        <div className="blp-grid">
                            {shownProducts.map(p => (
                                <article className="blp-card" key={p.id}>
                                    <div className="blp-card-media" aria-hidden="true">
                                        {p.image ? <img src={p.image} alt="" loading="lazy" /> : (p.emoji || <i className={theme.icon} style={{ color: 'var(--blp-primary)' }}></i>)}
                                    </div>
                                    <div className="blp-card-body">
                                        <span className="blp-card-cat">{p.category}</span>
                                        <span className="blp-card-name">{isAr ? (p.nameAR || p.nameEN) : (p.nameEN || p.nameAR)}</span>
                                        <div className="blp-card-foot">
                                            <span className="blp-price">{formatPrice(p.price)}</span>
                                            {p.inStock === false && <span className="blp-soldout">{t.soldOut}</span>}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}

                    {loaded && !theme.products.byCategory && theme.cta === 'shop' && shopEnabled && products.length > 0 && (
                        <div style={{ marginTop: '22px' }}>
                            <a className="blp-btn" href={`/store${query}`} style={{ background: 'var(--blp-primary)', color: '#fff' }}>
                                {theme.ctaLabel[lang]} <i className={isAr ? 'ri-arrow-left-line' : 'ri-arrow-right-line'}></i>
                            </a>
                        </div>
                    )}
                </div>
            </section>

            <section className="blp-section blp-about" id="about">
                <div className="blp-wrap">
                    <h2>{t.about}</h2>
                    <p>{(isAr ? settings?.portalDescriptionAr : settings?.portalDescription) || `${businessName}: ${hero.text} ${t.visit}.`}</p>
                </div>
            </section>

            <section className="blp-section" id="contact">
                <div className="blp-wrap">
                    <h2>{t.contact}</h2>
                    <p className="blp-section-sub">{t.visit}</p>
                    <div className="blp-contact-grid">
                        {phone && (
                            <a className="blp-contact" href={`tel:${phoneDigits}`}>
                                <i className="ri-phone-line" aria-hidden="true"></i>
                                <div><small>{t.phone}</small><span dir="ltr">{phone}</span></div>
                            </a>
                        )}
                        {whatsappNumber && (
                            <a className="blp-contact" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">
                                <i className="ri-whatsapp-line" aria-hidden="true"></i>
                                <div><small>{t.whatsapp}</small><span dir="ltr">+{whatsappNumber}</span></div>
                            </a>
                        )}
                        {email && (
                            <a className="blp-contact" href={`mailto:${email}`}>
                                <i className="ri-mail-line" aria-hidden="true"></i>
                                <div><small>{t.email}</small><span>{email}</span></div>
                            </a>
                        )}
                        {address && (
                            <a className="blp-contact" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer">
                                <i className="ri-map-pin-line" aria-hidden="true"></i>
                                <div><small>{t.address}</small><span>{address}</span></div>
                            </a>
                        )}
                    </div>
                    {(social.instagram || social.twitter || social.facebook) && (
                        <div className="blp-social">
                            {social.instagram && <a href={social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><i className="ri-instagram-line"></i></a>}
                            {social.twitter && <a href={social.twitter} target="_blank" rel="noopener noreferrer" aria-label="X"><i className="ri-twitter-x-line"></i></a>}
                            {social.facebook && <a href={social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><i className="ri-facebook-line"></i></a>}
                        </div>
                    )}
                </div>
            </section>

            <footer className="blp-footer">
                <div className="blp-wrap">
                    <span>© {new Date().getFullYear()} {businessName}. {t.rights}.</span>
                    {settings?.vatNumber && <span>{t.vat}: <span dir="ltr">{settings.vatNumber}</span></span>}
                </div>
            </footer>
        </div>
    );
};

export default BusinessLandingPage;
