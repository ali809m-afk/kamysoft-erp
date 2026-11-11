// Content and colours of the public store home page for each business type.
// Each entry: colours, hero text, four highlights, the product section and the main call to action.
// cta: 'menu' scrolls to the menu, 'shop' opens the online store (falls back to 'call'),
//      'book' and 'ask' open WhatsApp (or a phone call when no number is set).

const SECTORS = {
    restaurant: {
        colors: { primary: '#b45309', accent: '#f59e0b', dark: '#1c1917', soft: '#fff7ed' },
        icon: 'ri-restaurant-2-line',
        hero: {
            en: { kicker: 'Restaurant & Café', title: 'Fresh food, cooked to order', text: 'Dine in, take away or order delivery. Every dish is prepared fresh in our kitchen.' },
            ar: { kicker: 'مطعم ومقهى', title: 'أطباق طازجة تُحضّر عند الطلب', text: 'تناول طعامك لدينا، أو خذه معك، أو اطلبه توصيلاً. كل طبق يُحضّر طازجاً في مطبخنا.' }
        },
        features: [
            { icon: 'ri-restaurant-line', en: ['Dine in', 'Comfortable family and individual seating'], ar: ['تناول في المطعم', 'جلسات عائلية وفردية مريحة'] },
            { icon: 'ri-takeaway-line', en: ['Takeaway', 'Order ahead and pick up hot'], ar: ['طلبات خارجية', 'اطلب مسبقاً واستلم طلبك ساخناً'] },
            { icon: 'ri-e-bike-2-line', en: ['Delivery', 'Hot meals brought to your door'], ar: ['توصيل', 'وجبات ساخنة حتى باب منزلك'] },
            { icon: 'ri-leaf-line', en: ['Fresh daily', 'Ingredients prepared every morning'], ar: ['طازج يومياً', 'مكونات تُجهّز كل صباح'] }
        ],
        products: { en: 'Our menu', ar: 'قائمة الطعام', anchor: 'menu', byCategory: true },
        cta: 'menu',
        ctaLabel: { en: 'See the menu', ar: 'عرض القائمة' },
        secondaryCta: 'call',
        secondaryLabel: { en: 'Call to order', ar: 'اتصل للطلب' }
    },
    grocery: {
        colors: { primary: '#15803d', accent: '#84cc16', dark: '#14532d', soft: '#f0fdf4' },
        icon: 'ri-shopping-basket-2-line',
        hero: {
            en: { kicker: 'Supermarket & Grocery', title: 'Your neighbourhood supermarket', text: 'Fresh produce, pantry staples and household needs, at fair prices every day.' },
            ar: { kicker: 'سوبرماركت ومواد غذائية', title: 'سوبرماركت الحي القريب منك', text: 'خضار وفواكه طازجة، ومواد غذائية واحتياجات منزلية بأسعار عادلة كل يوم.' }
        },
        features: [
            { icon: 'ri-plant-line', en: ['Fresh every day', 'Fruit, vegetables and bakery'], ar: ['طازج كل يوم', 'فواكه وخضار ومخبوزات'] },
            { icon: 'ri-store-2-line', en: ['Wide range', 'Everything for the home in one place'], ar: ['تشكيلة واسعة', 'كل احتياجات المنزل في مكان واحد'] },
            { icon: 'ri-truck-line', en: ['Home delivery', 'Order by phone or online'], ar: ['توصيل للمنازل', 'اطلب بالهاتف أو عبر الإنترنت'] },
            { icon: 'ri-price-tag-3-line', en: ['Fair prices', 'Great value every day'], ar: ['أسعار عادلة', 'قيمة مميزة كل يوم'] }
        ],
        products: { en: 'Popular products', ar: 'المنتجات الأكثر طلباً', anchor: 'products' },
        cta: 'shop',
        ctaLabel: { en: 'Shop online', ar: 'تسوّق أونلاين' },
        secondaryCta: 'call',
        secondaryLabel: { en: 'Order by phone', ar: 'اطلب بالهاتف' }
    },
    retail: {
        colors: { primary: '#4338ca', accent: '#818cf8', dark: '#1e1b4b', soft: '#eef2ff' },
        icon: 'ri-shopping-bag-3-line',
        hero: {
            en: { kicker: 'Shop', title: 'Quality products at great prices', text: 'Browse our range in store or online, with friendly service and easy returns.' },
            ar: { kicker: 'متجر', title: 'منتجات عالية الجودة بأسعار مميزة', text: 'تصفّح منتجاتنا في المتجر أو عبر الإنترنت، مع خدمة ودودة واسترجاع سهل.' }
        },
        features: [
            { icon: 'ri-medal-line', en: ['Trusted quality', 'Carefully selected products'], ar: ['جودة موثوقة', 'منتجات مختارة بعناية'] },
            { icon: 'ri-bank-card-line', en: ['Easy payment', 'Mada, Visa, Apple Pay, Tabby, Tamara'], ar: ['دفع سهل', 'مدى، فيزا، Apple Pay، تابي، تمارا'] },
            { icon: 'ri-refresh-line', en: ['Easy returns', 'Hassle-free exchanges'], ar: ['استرجاع سهل', 'استبدال بلا تعقيد'] },
            { icon: 'ri-customer-service-2-line', en: ['Friendly service', 'We are happy to help'], ar: ['خدمة ودودة', 'يسعدنا مساعدتك'] }
        ],
        products: { en: 'Featured products', ar: 'منتجات مميزة', anchor: 'products' },
        cta: 'shop',
        ctaLabel: { en: 'Shop online', ar: 'تسوّق أونلاين' },
        secondaryCta: 'call',
        secondaryLabel: { en: 'Contact us', ar: 'تواصل معنا' }
    },
    apparel: {
        colors: { primary: '#be123c', accent: '#fb7185', dark: '#18181b', soft: '#fff1f2' },
        icon: 'ri-t-shirt-2-line',
        hero: {
            en: { kicker: 'Fashion & Apparel', title: 'New season styles', text: 'Thobes, abayas, casual and formal wear for the whole family.' },
            ar: { kicker: 'أزياء وملابس', title: 'تشكيلة الموسم الجديد', text: 'أثواب وعبايات وملابس كاجوال ورسمية لكل أفراد العائلة.' }
        },
        features: [
            { icon: 'ri-sparkling-line', en: ['New arrivals', 'Fresh styles every week'], ar: ['وصل حديثاً', 'تصاميم جديدة كل أسبوع'] },
            { icon: 'ri-ruler-line', en: ['All sizes', 'Fits for everyone'], ar: ['جميع المقاسات', 'مقاسات تناسب الجميع'] },
            { icon: 'ri-exchange-line', en: ['Easy exchange', 'Swap sizes without fuss'], ar: ['استبدال سهل', 'بدّل المقاس بسهولة'] },
            { icon: 'ri-gift-line', en: ['Gift wrapping', 'Ready to give'], ar: ['تغليف هدايا', 'جاهز للإهداء'] }
        ],
        products: { en: 'Latest collection', ar: 'أحدث التشكيلات', anchor: 'products' },
        cta: 'shop',
        ctaLabel: { en: 'Shop the collection', ar: 'تسوّق التشكيلة' },
        secondaryCta: 'whatsapp',
        secondaryLabel: { en: 'Ask on WhatsApp', ar: 'اسألنا عبر واتساب' }
    },
    appliances: {
        colors: { primary: '#0369a1', accent: '#38bdf8', dark: '#0c4a6e', soft: '#f0f9ff' },
        icon: 'ri-tv-2-line',
        hero: {
            en: { kicker: 'Home Appliances & Electronics', title: 'Appliances you can rely on', text: 'Air conditioners, fridges, washers and more, with official warranty and installation.' },
            ar: { kicker: 'أجهزة منزلية وإلكترونيات', title: 'أجهزة يمكنك الاعتماد عليها', text: 'مكيفات وثلاجات وغسالات وأكثر، مع ضمان رسمي وخدمة تركيب.' }
        },
        features: [
            { icon: 'ri-shield-check-line', en: ['Official warranty', 'Genuine products only'], ar: ['ضمان رسمي', 'منتجات أصلية فقط'] },
            { icon: 'ri-tools-line', en: ['Delivery & installation', 'By trained technicians'], ar: ['توصيل وتركيب', 'بواسطة فنيين مدرّبين'] },
            { icon: 'ri-calendar-check-line', en: ['Pay in instalments', 'Tabby and Tamara available'], ar: ['تقسيط مريح', 'متوفر تابي وتمارا'] },
            { icon: 'ri-customer-service-line', en: ['After-sales service', 'Maintenance and support'], ar: ['خدمة ما بعد البيع', 'صيانة ودعم'] }
        ],
        products: { en: 'Best sellers', ar: 'الأكثر مبيعاً', anchor: 'products' },
        cta: 'shop',
        ctaLabel: { en: 'Browse products', ar: 'تصفّح المنتجات' },
        secondaryCta: 'whatsapp',
        secondaryLabel: { en: 'Ask about installation', ar: 'استفسر عن التركيب' }
    },
    furniture: {
        colors: { primary: '#92400e', accent: '#d6a35c', dark: '#292524', soft: '#faf6f0' },
        icon: 'ri-sofa-line',
        hero: {
            en: { kicker: 'Furniture & Home Décor', title: 'Furniture for every room', text: 'Living rooms, bedrooms and dining sets, delivered and assembled at your home.' },
            ar: { kicker: 'أثاث وديكور منزلي', title: 'أثاث لكل غرفة في منزلك', text: 'مجالس وغرف نوم وطاولات طعام، مع التوصيل والتركيب في منزلك.' }
        },
        features: [
            { icon: 'ri-home-smile-line', en: ['Visit the showroom', 'See and feel the quality'], ar: ['زر المعرض', 'شاهد الجودة بنفسك'] },
            { icon: 'ri-truck-line', en: ['Delivery & assembly', 'Set up by our team'], ar: ['توصيل وتركيب', 'يركّبه فريقنا'] },
            { icon: 'ri-pencil-ruler-2-line', en: ['Custom orders', 'Sizes and colours to fit'], ar: ['طلبات خاصة', 'مقاسات وألوان حسب رغبتك'] },
            { icon: 'ri-calendar-check-line', en: ['Flexible payment', 'Deposit now, the rest on delivery'], ar: ['دفع مرن', 'عربون الآن والباقي عند التسليم'] }
        ],
        products: { en: 'Featured pieces', ar: 'قطع مميزة', anchor: 'products' },
        cta: 'shop',
        ctaLabel: { en: 'Browse the collection', ar: 'تصفّح التشكيلة' },
        secondaryCta: 'call',
        secondaryLabel: { en: 'Book a showroom visit', ar: 'احجز زيارة للمعرض' }
    },
    spareparts: {
        colors: { primary: '#c2410c', accent: '#fb923c', dark: '#0f172a', soft: '#fff7ed' },
        icon: 'ri-settings-5-line',
        hero: {
            en: { kicker: 'Auto, HVAC & Spare Parts', title: 'The right part, first time', text: 'Genuine and aftermarket parts for cars, air conditioning and plumbing.' },
            ar: { kicker: 'قطع غيار سيارات وتكييف وسباكة', title: 'القطعة الصحيحة من أول مرة', text: 'قطع غيار أصلية وتجارية للسيارات والتكييف والسباكة.' }
        },
        features: [
            { icon: 'ri-shield-check-line', en: ['Genuine & OEM', 'Certified compatible parts'], ar: ['أصلي ومعتمد', 'قطع متوافقة ومعتمدة'] },
            { icon: 'ri-search-eye-line', en: ['Compatibility check', 'Send us your model or part number'], ar: ['فحص التوافق', 'أرسل لنا الموديل أو رقم القطعة'] },
            { icon: 'ri-flashlight-line', en: ['Fast availability', 'Common parts kept in stock'], ar: ['توفر سريع', 'القطع الشائعة متوفرة لدينا'] },
            { icon: 'ri-tools-line', en: ['Trade prices', 'For workshops and technicians'], ar: ['أسعار الجملة', 'للورش والفنيين'] }
        ],
        products: { en: 'Popular parts', ar: 'قطع مطلوبة', anchor: 'products' },
        cta: 'ask',
        ctaLabel: { en: 'Ask about a part', ar: 'اسأل عن قطعة' },
        secondaryCta: 'call',
        secondaryLabel: { en: 'Call the counter', ar: 'اتصل بنا' }
    },
    services: {
        colors: { primary: '#0f766e', accent: '#2dd4bf', dark: '#134e4a', soft: '#f0fdfa' },
        icon: 'ri-service-line',
        hero: {
            en: { kicker: 'Professional Services', title: 'Expert care, easy booking', text: 'Book an appointment with our certified specialists at a time that suits you.' },
            ar: { kicker: 'خدمات احترافية', title: 'رعاية متخصصة وحجز سهل', text: 'احجز موعدك مع مختصين معتمدين في الوقت الذي يناسبك.' }
        },
        features: [
            { icon: 'ri-award-line', en: ['Certified specialists', 'Experienced, licensed team'], ar: ['مختصون معتمدون', 'فريق مرخّص وذو خبرة'] },
            { icon: 'ri-calendar-event-line', en: ['Appointments', 'Choose a time that suits you'], ar: ['مواعيد مرنة', 'اختر الوقت المناسب لك'] },
            { icon: 'ri-price-tag-3-line', en: ['Clear pricing', 'No hidden fees'], ar: ['أسعار واضحة', 'بدون رسوم خفية'] },
            { icon: 'ri-heart-pulse-line', en: ['Customer care', 'Follow-up after every visit'], ar: ['عناية بالعملاء', 'متابعة بعد كل زيارة'] }
        ],
        products: { en: 'Our services', ar: 'خدماتنا', anchor: 'services' },
        cta: 'book',
        ctaLabel: { en: 'Book an appointment', ar: 'احجز موعداً' },
        secondaryCta: 'call',
        secondaryLabel: { en: 'Call us', ar: 'اتصل بنا' }
    },
    salon: {
        colors: { primary: '#7e22ce', accent: '#e879f9', dark: '#3b0764', soft: '#faf5ff' },
        icon: 'ri-scissors-cut-line',
        hero: {
            en: { kicker: 'Salon & Beauty', title: 'Look and feel your best', text: 'Hair, grooming and beauty treatments by experienced stylists.' },
            ar: { kicker: 'صالون وتجميل', title: 'إطلالة وإحساس أفضل', text: 'خدمات الشعر والعناية والتجميل على أيدي خبراء.' }
        },
        features: [
            { icon: 'ri-scissors-2-line', en: ['Expert stylists', 'Trained and experienced'], ar: ['خبراء تجميل', 'مدرّبون وذوو خبرة'] },
            { icon: 'ri-time-line', en: ['Book your slot', 'Choose a time that suits you'], ar: ['احجز موعدك', 'اختر الوقت المناسب لك'] },
            { icon: 'ri-drop-line', en: ['Premium products', 'Gentle on hair and skin'], ar: ['منتجات فاخرة', 'لطيفة على الشعر والبشرة'] },
            { icon: 'ri-shield-check-line', en: ['Hygiene first', 'Sterilised tools every visit'], ar: ['النظافة أولاً', 'أدوات معقّمة في كل زيارة'] }
        ],
        products: { en: 'Services & prices', ar: 'الخدمات والأسعار', anchor: 'services' },
        cta: 'book',
        ctaLabel: { en: 'Book now', ar: 'احجز الآن' },
        secondaryCta: 'call',
        secondaryLabel: { en: 'Call us', ar: 'اتصل بنا' }
    },
    freshFlowers: {
        colors: { primary: '#db2777', accent: '#f9a8d4', dark: '#500724', soft: '#fdf2f8' },
        icon: 'ri-flower-line',
        hero: {
            en: { kicker: 'Fresh Flowers & Florist', title: 'Fresh flowers for every occasion', text: 'Bouquets, arrangements and gift boxes, delivered the same day.' },
            ar: { kicker: 'زهور طبيعية وتنسيق', title: 'زهور طازجة لكل مناسبة', text: 'باقات وتنسيقات وبوكسات هدايا مع توصيل في نفس اليوم.' }
        },
        features: [
            { icon: 'ri-e-bike-2-line', en: ['Same-day delivery', 'Order early for delivery today'], ar: ['توصيل نفس اليوم', 'اطلب مبكراً ليصلك اليوم'] },
            { icon: 'ri-heart-3-line', en: ['Weddings & events', 'Bridal bouquets and décor'], ar: ['أعراس ومناسبات', 'مسكات عروس وتنسيق حفلات'] },
            { icon: 'ri-brush-line', en: ['Custom bouquets', 'Your colours, your message'], ar: ['باقات حسب الطلب', 'ألوانك ورسالتك'] },
            { icon: 'ri-gift-2-line', en: ['Gift boxes', 'Flowers with chocolate and more'], ar: ['بوكسات هدايا', 'ورد مع شوكولاتة والمزيد'] }
        ],
        products: { en: 'Bouquets & arrangements', ar: 'الباقات والتنسيقات', anchor: 'products' },
        cta: 'shop',
        ctaLabel: { en: 'Order flowers', ar: 'اطلب الزهور' },
        secondaryCta: 'whatsapp',
        secondaryLabel: { en: 'Custom order on WhatsApp', ar: 'طلب خاص عبر واتساب' }
    }
};

// Business types that share a page
const ALIASES = { cafe: 'restaurant', supermarket: 'grocery', medical: 'services', maintenance: 'services', florist: 'freshFlowers' };

export function getSectorTheme(businessType) {
    const key = ALIASES[businessType] || businessType;
    return SECTORS[key] || SECTORS.retail;
}

export const SECTOR_KEYS = Object.keys(SECTORS);
