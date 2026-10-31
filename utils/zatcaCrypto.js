const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Store keys locally for this initial phase
// Use process.env.UPLOADS_DIR if running inside packaged electron app (ASAR read-only), otherwise default keys folder
const KEYS_DIR = process.env.UPLOADS_DIR ? path.join(process.env.UPLOADS_DIR, '..', 'keys') : path.join(__dirname, '..', 'keys');

// Official ZATCA Phase 2 Genesis Previous Invoice Hash (Base64 of SHA-256 hex of "0")
const DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH =
    'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';

const ECDSA_SHA256_URI = 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256';
const C14N11_URI = 'http://www.w3.org/2006/12/xml-c14n11';
const SHA256_DIGEST_URI = 'http://www.w3.org/2001/04/xmlenc#sha256';
const DS_NS = 'http://www.w3.org/2000/09/xmldsig#';
const XADES_NS = 'http://uri.etsi.org/01903/v1.3.2#';

const CERT_TEMPLATE_NAMES = {
    sandbox: 'ZATCA-Code-Signing',
    production: 'ZATCA-Code-Signing',
    simulation: 'PREZATCA-Code-Signing',
};

const CN_PREFIXES = {
    sandbox: 'TST-',
    production: '',
    simulation: 'PREZATCA-',
};

const OID_HEX = {
    '2.5.4.6': '550406', // countryName (C)
    '2.5.4.10': '55040a', // organizationName (O)
    '2.5.4.11': '55040b', // organizationalUnitName (OU)
    '2.5.4.3': '550403', // commonName (CN)
    '2.5.4.4': '550404', // surname (SN) — EGS serial in ZATCA CSR
    '2.5.4.12': '55040c', // title — invoice type in ZATCA CSR
    '2.5.4.26': '55041a', // registeredAddress — location in ZATCA CSR
    '2.5.4.15': '55040f', // businessCategory
    '0.9.2342.19200300.100.1.1': '0992268993f22c640101', // userId (UID / VAT)
    '1.2.840.113549.1.9.14': '2a864886f70d01090e', // extensionRequest
    '1.3.6.1.4.1.311.20.2': '2b0601040182371402', // certificateTemplateName
    '2.5.29.17': '551d11', // subjectAltName
    '1.2.840.10045.4.3.2': '2a8648ce3d040302', // ecdsa-with-SHA256
};

// ============================================================
// Low-level ASN.1 DER & TLV Helpers
// ============================================================

function derLength(length) {
    if (length < 0x80) {
        return Buffer.from([length]);
    }
    const hex = length.toString(16);
    const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
    const numBytes = paddedHex.length / 2;
    const header = Buffer.from([0x80 | numBytes]);
    const lenBytes = Buffer.from(paddedHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    return Buffer.concat([header, lenBytes]);
}

function derTLV(tag, value) {
    const tagBuf = Buffer.isBuffer(tag) ? tag : Buffer.from([tag]);
    return Buffer.concat([tagBuf, derLength(value.length), value]);
}

function derInteger(value) {
    if (Buffer.isBuffer(value)) {
        const needsLeadingZero = value[0] & 0x80;
        const content = needsLeadingZero ? Buffer.concat([Buffer.from([0x00]), value]) : value;
        return derTLV(0x02, content);
    }
    const hex = value === 0 ? '00' : value.toString(16).padStart(2, '0');
    const buf = Buffer.from(hex.length % 2 === 0 ? hex : '0' + hex, 'hex');
    return derInteger(buf);
}

function derOid(dotted) {
    const hex = OID_HEX[dotted];
    if (!hex) throw new Error(`Unknown OID: ${dotted}`);
    return derTLV(0x06, Buffer.from(hex, 'hex'));
}

function derPrintableString(value) {
    return derTLV(0x13, Buffer.from(String(value), 'ascii'));
}

function derUtf8String(value) {
    return derTLV(0x0c, Buffer.from(String(value), 'utf8'));
}

function derUtcTime(date) {
    const yy = String(date.getUTCFullYear()).slice(-2);
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const min = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    return derTLV(0x17, Buffer.from(`${yy}${mm}${dd}${hh}${min}${ss}Z`, 'ascii'));
}

function derSequence(...children) {
    return derTLV(0x30, Buffer.concat(children));
}

function derSet(...children) {
    return derTLV(0x31, Buffer.concat(children));
}

function derOctetString(value) {
    return derTLV(0x04, value);
}

function derBitString(value, unusedBits = 0) {
    return derTLV(0x03, Buffer.concat([Buffer.from([unusedBits]), value]));
}

function derExplicitTag(tagNumber, content) {
    return derTLV(0xa0 | tagNumber, content);
}

function derAttributeTypeAndValue(oidDotted, value) {
    return derSequence(derOid(oidDotted), value);
}

function derRdn(atv) {
    return derSet(atv);
}

function toPem(derBytes, label) {
    const b64 = derBytes.toString('base64');
    const lines = (b64.match(/.{1,64}/g) || [b64]).join('\n');
    return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----\n`;
}

function derReadLength(buf, offset) {
    const first = buf[offset];
    if (first < 0x80) return { value: first, bytesUsed: 1 };
    const numBytes = first & 0x7f;
    let length = 0;
    for (let i = 0; i < numBytes; i++) {
        length = (length << 8) | buf[offset + 1 + i];
    }
    return { value: length, bytesUsed: 1 + numBytes };
}

function skipDerElement(buf, offset) {
    const lenInfo = derReadLength(buf, offset + 1);
    return 1 + lenInfo.bytesUsed + lenInfo.value;
}

// Helper to encode BER-TLV for ZATCA QR Code
function toTLV(tag, value) {
    const valueBuffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ''), 'utf8');
    const tagBuffer = Buffer.from([tag]);
    let lengthBuffer;
    if (valueBuffer.length < 128) {
        lengthBuffer = Buffer.from([valueBuffer.length]);
    } else if (valueBuffer.length < 256) {
        lengthBuffer = Buffer.from([0x81, valueBuffer.length]);
    } else {
        lengthBuffer = Buffer.from([0x82, (valueBuffer.length >> 8) & 0xff, valueBuffer.length & 0xff]);
    }
    return Buffer.concat([tagBuffer, lengthBuffer, valueBuffer]);
}

// ============================================================
// Key Pair, CSR, & X.509 CSID Certificate Generation
// ============================================================

function generateECDSAKeyPair() {
    try {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
            namedCurve: 'secp256k1',
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });
        return { privateKey, publicKey };
    } catch {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
            namedCurve: 'prime256v1',
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });
        return { privateKey, publicKey };
    }
}

function normalizeVatNumber(vat) {
    const digits = String(vat || '').replace(/\D/g, '');
    if (digits.length === 15 && digits.startsWith('3') && digits.endsWith('3')) {
        return digits;
    }
    return '310122393500003';
}

function buildZatcaExtensionsBuffer(params, environment = 'sandbox') {
    const certTemplateName = CERT_TEMPLATE_NAMES[environment] || CERT_TEMPLATE_NAMES.sandbox;
    const extTemplate = derSequence(
        derOid('1.3.6.1.4.1.311.20.2'),
        derOctetString(derUtf8String(certTemplateName))
    );

    const invoiceType = params.invoiceType || '1100';
    const loc = params.location || {};
    const locationStr = `${loc.street || 'King Fahd Rd'} ${loc.buildingNumber || '1234'} ${loc.district || 'Al Olaya'}`.trim();
    const businessCategory = params.businessCategory || params.industry || 'Retail';
    const vatNumber = normalizeVatNumber(params.vatNumber);
    const egsSerial = params.egsSerialNumber || '1-26I|2-POS|3-ed22f1d8-e6a2-1118-9b58-d9a8f11e445f';

    const dirName = derSequence(
        derRdn(derAttributeTypeAndValue('2.5.4.4', derUtf8String(egsSerial))),
        derRdn(derAttributeTypeAndValue('0.9.2342.19200300.100.1.1', derUtf8String(vatNumber))),
        derRdn(derAttributeTypeAndValue('2.5.4.12', derUtf8String(invoiceType))),
        derRdn(derAttributeTypeAndValue('2.5.4.26', derUtf8String(locationStr))),
        derRdn(derAttributeTypeAndValue('2.5.4.15', derUtf8String(businessCategory)))
    );
    const generalNames = derSequence(derExplicitTag(4, dirName));
    const extSan = derSequence(derOid('2.5.29.17'), derOctetString(generalNames));

    return Buffer.concat([extTemplate, extSan]);
}

/**
 * Generate a self-signed X.509 v3 CSID Certificate in PEM format for sandbox/local testing
 * so that X509Certificate parsing and XAdES signing work identically to production ZATCA CSIDs.
 */
function generateSelfSignedCSID(params = {}, privateKeyPem, publicKeyPem, environment = 'sandbox') {
    const vatNumber = normalizeVatNumber(params.vatNumber);
    const orgNameEn = params.organizationNameEn || params.organizationNameAr || 'KamySoft ERP';
    const cnPrefix = CN_PREFIXES[environment] !== undefined ? CN_PREFIXES[environment] : 'TST-';
    const baseCn = params.commonName || `26I-${vatNumber}`;
    const prefixedCn = baseCn.startsWith(cnPrefix) ? baseCn : `${cnPrefix}${baseCn}`;
    const commonName = prefixedCn.includes(vatNumber) ? prefixedCn : `${prefixedCn}-${vatNumber}`;

    const issuer = derSequence(
        derRdn(derAttributeTypeAndValue('2.5.4.6', derPrintableString('SA'))),
        derRdn(derAttributeTypeAndValue('2.5.4.10', derUtf8String('ZATCA Sandbox CA'))),
        derRdn(derAttributeTypeAndValue('2.5.4.3', derUtf8String('ZATCA-Code-Signing-CA')))
    );

    const subject = derSequence(
        derRdn(derAttributeTypeAndValue('2.5.4.6', derPrintableString(params.country || 'SA'))),
        derRdn(derAttributeTypeAndValue('2.5.4.11', derUtf8String(params.crNumber || 'Main Branch'))),
        derRdn(derAttributeTypeAndValue('2.5.4.10', derUtf8String(orgNameEn))),
        derRdn(derAttributeTypeAndValue('2.5.4.3', derUtf8String(commonName)))
    );

    const now = new Date(Date.now() - 60 * 1000);
    const validTo = new Date(Date.now() + 365 * 5 * 24 * 60 * 60 * 1000);
    const validity = derSequence(derUtcTime(now), derUtcTime(validTo));

    const spkiDer = crypto.createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
    const sigAlg = derSequence(derOid('1.2.840.10045.4.3.2'));
    const serialBytes = crypto.randomBytes(8);
    serialBytes[0] &= 0x7f;

    const extensionsSeq = derSequence(buildZatcaExtensionsBuffer(params, environment));

    const tbsCertificate = derSequence(
        derExplicitTag(0, derInteger(2)), // v3 (2)
        derInteger(serialBytes),
        sigAlg,
        issuer,
        validity,
        subject,
        spkiDer,
        derExplicitTag(3, extensionsSeq)
    );

    const signer = crypto.createSign('SHA256');
    signer.update(tbsCertificate);
    signer.end();
    const signatureDer = signer.sign(privateKeyPem);

    const certDer = derSequence(tbsCertificate, sigAlg, derBitString(signatureDer));
    return toPem(certDer, 'CERTIFICATE');
}

/**
 * Generate ZATCA Phase 2 PKCS#10 CSR and ECDSA Key Pair
 */
function generateCSR(params = {}, environmentOrPrivKey = 'sandbox', maybePubKey = null) {
    let environment = 'sandbox';
    let privateKey = null;
    let publicKey = null;

    if (typeof environmentOrPrivKey === 'string' && environmentOrPrivKey.includes('PRIVATE KEY')) {
        privateKey = environmentOrPrivKey;
        publicKey = maybePubKey;
    } else if (typeof environmentOrPrivKey === 'string') {
        environment = environmentOrPrivKey;
    }

    if (!privateKey || !publicKey) {
        const pair = generateECDSAKeyPair();
        privateKey = pair.privateKey;
        publicKey = pair.publicKey;
    }

    const vatNumber = normalizeVatNumber(params.vatNumber);
    const orgNameEn = params.organizationNameEn || params.organizationNameAr || 'Test Company';
    const cnPrefix = CN_PREFIXES[environment] !== undefined ? CN_PREFIXES[environment] : 'TST-';
    const baseCn = params.commonName || `26I-${vatNumber}`;
    const commonName = `${cnPrefix}${baseCn}-${vatNumber}`;

    const subject = derSequence(
        derRdn(derAttributeTypeAndValue('2.5.4.6', derPrintableString(params.country || 'SA'))),
        derRdn(derAttributeTypeAndValue('2.5.4.11', derUtf8String(baseCn))),
        derRdn(derAttributeTypeAndValue('2.5.4.10', derUtf8String(orgNameEn))),
        derRdn(derAttributeTypeAndValue('2.5.4.3', derUtf8String(commonName)))
    );

    const spkiDer = crypto.createPublicKey(publicKey).export({ type: 'spki', format: 'der' });
    const extensionsBuf = buildZatcaExtensionsBuffer({ ...params, vatNumber }, environment);
    const attributes = derSequence(
        derOid('1.2.840.113549.1.9.14'),
        derSet(derSequence(extensionsBuf))
    );

    const certRequestInfo = derSequence(
        derInteger(0),
        subject,
        spkiDer,
        derExplicitTag(0, attributes)
    );

    const sign = crypto.createSign('SHA256');
    sign.update(certRequestInfo);
    sign.end();
    const signatureDer = sign.sign(privateKey);

    const signatureAlgorithm = derSequence(derOid('1.2.840.10045.4.3.2'));
    const certificationRequest = derSequence(certRequestInfo, signatureAlgorithm, derBitString(signatureDer));
    const csr = toPem(certificationRequest, 'CERTIFICATE REQUEST');

    const certificate = generateSelfSignedCSID({ ...params, vatNumber }, privateKey, publicKey, environment);

    return {
        csr,
        privateKey,
        publicKey,
        certificate
    };
}

function asCertificatePem(certificate, fallbackPrivateKeyPem = null, fallbackPublicKeyPem = null) {
    if (!certificate || certificate === 'SIMULATED_CERT' || certificate.length < 60) {
        if (fallbackPrivateKeyPem && fallbackPublicKeyPem) {
            return generateSelfSignedCSID({}, fallbackPrivateKeyPem, fallbackPublicKeyPem, 'sandbox');
        }
        return null;
    }
    const trimmed = String(certificate).trim();
    if (trimmed.includes('BEGIN CERTIFICATE')) {
        return trimmed;
    }
    const compact = trimmed.replace(/\s+/g, '');
    try {
        const decoded = Buffer.from(compact, 'base64').toString('utf8').trim();
        if (decoded.includes('BEGIN CERTIFICATE')) {
            return decoded;
        }
        const decodedCompact = decoded.replace(/\s+/g, '');
        if (/^[A-Za-z0-9+/=]+$/.test(decodedCompact) && decodedCompact.length > 100) {
            const nestedDer = Buffer.from(decodedCompact, 'base64');
            if (nestedDer[0] === 0x30) {
                const wrapped = (decodedCompact.match(/.{1,64}/g) || [decodedCompact]).join('\n');
                return `-----BEGIN CERTIFICATE-----\n${wrapped}\n-----END CERTIFICATE-----`;
            }
        }
    } catch {
        // treat as base64 DER
    }
    const wrapped = (compact.match(/.{1,64}/g) || [compact]).join('\n');
    return `-----BEGIN CERTIFICATE-----\n${wrapped}\n-----END CERTIFICATE-----`;
}

function extractCertificateSignature(certificatePem) {
    try {
        const pem = asCertificatePem(certificatePem);
        if (!pem) return Buffer.from('ZATCA-PHASE2-CSID-STAMP').toString('base64');
        const der = Buffer.from(
            pem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\s+/g, ''),
            'base64'
        );
        let offset = 0;
        if (der[offset++] !== 0x30) throw new Error('Invalid certificate DER');
        offset += derReadLength(der, offset).bytesUsed;
        offset += skipDerElement(der, offset); // tbsCertificate
        offset += skipDerElement(der, offset); // signatureAlgorithm
        if (der[offset] !== 0x03) throw new Error('Expected BIT STRING for signatureValue');
        offset++;
        const sigLenInfo = derReadLength(der, offset);
        offset += sigLenInfo.bytesUsed;
        offset++; // unused bits byte
        const signatureBytes = der.slice(offset, offset + sigLenInfo.value - 1);
        return signatureBytes.toString('base64');
    } catch {
        return Buffer.from('ZATCA-PHASE2-CSID-STAMP').toString('base64');
    }
}

function extractSpkiPublicKeyBase64(pemOrKey) {
    try {
        const key = String(pemOrKey).includes('BEGIN CERTIFICATE')
            ? new crypto.X509Certificate(pemOrKey).publicKey
            : crypto.createPublicKey(pemOrKey);
        const spkiDer = key.export({ type: 'spki', format: 'der' });
        return Buffer.from(spkiDer).toString('base64');
    } catch {
        return String(pemOrKey || '')
            .replace(/-----BEGIN PUBLIC KEY-----/g, '')
            .replace(/-----END PUBLIC KEY-----/g, '')
            .replace(/\s+/g, '');
    }
}

/**
 * Generate ECDSA secp256k1 key pair + self-signed CSID and save to local files
 */
function onboardDevice(tenantId = 'default', csrParams = {}, environment = 'sandbox') {
    if (!fs.existsSync(KEYS_DIR)) {
        fs.mkdirSync(KEYS_DIR, { recursive: true });
    }
    const privateKeyPath = path.join(KEYS_DIR, `${tenantId}_private.pem`);
    const publicKeyPath = path.join(KEYS_DIR, `${tenantId}_public.pem`);
    const certPath = path.join(KEYS_DIR, `${tenantId}_cert.pem`);

    const { csr, privateKey, publicKey, certificate } = generateCSR(csrParams, environment);

    fs.writeFileSync(privateKeyPath, privateKey);
    fs.writeFileSync(publicKeyPath, publicKey);
    fs.writeFileSync(certPath, certificate);

    return {
        publicKeyPem: publicKey,
        privateKeyPem: privateKey,
        certificatePem: certificate,
        csrPem: csr
    };
}

/**
 * Load keys if they exist (auto-generates certificate if missing)
 */
function getKeys(tenantId = 'default') {
    const privateKeyPath = path.join(KEYS_DIR, `${tenantId}_private.pem`);
    const publicKeyPath = path.join(KEYS_DIR, `${tenantId}_public.pem`);
    const certPath = path.join(KEYS_DIR, `${tenantId}_cert.pem`);

    if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
        const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
        const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');
        let certificatePem = null;
        if (fs.existsSync(certPath)) {
            certificatePem = fs.readFileSync(certPath, 'utf8');
        } else {
            certificatePem = generateSelfSignedCSID({}, privateKeyPem, publicKeyPem, 'sandbox');
            try { fs.writeFileSync(certPath, certificatePem); } catch {}
        }
        return { privateKeyPem, publicKeyPem, certificatePem };
    }
    return null;
}

// ============================================================
// UBL 2.1 XML Generation (ZATCA Phase 2 Compliant)
// ============================================================

function escapeXml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function parseIssueDateTime(dateInput) {
    if (!dateInput) {
        const now = new Date();
        return {
            issueDate: now.toISOString().slice(0, 10),
            issueTime: now.toISOString().slice(11, 19)
        };
    }
    const str = String(dateInput).trim();
    // Match YYYY-MM-DD and optional HH:mm(:ss)
    const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}(?::\d{2})?))?/);
    if (isoMatch) {
        const issueDate = isoMatch[1];
        let issueTime = isoMatch[2] || '12:00:00';
        if (issueTime.length === 5) issueTime += ':00';
        return { issueDate, issueTime };
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        return {
            issueDate: parsed.toISOString().slice(0, 10),
            issueTime: parsed.toISOString().slice(11, 19)
        };
    }
    const now = new Date();
    return {
        issueDate: now.toISOString().slice(0, 10),
        issueTime: now.toISOString().slice(11, 19)
    };
}

function parseNationalAddress(settings = {}) {
    let building = '1234';
    let street = 'King Fahd Road';
    let district = 'Al Olaya';
    let city = 'Riyadh';
    let postalCode = '12211';

    if (settings.nationalAddress) {
        try {
            const addr = typeof settings.nationalAddress === 'string'
                ? JSON.parse(settings.nationalAddress)
                : settings.nationalAddress;
            if (addr && typeof addr === 'object') {
                building = String(addr.buildingNo || addr.buildingNumber || building).replace(/\D/g, '').padStart(4, '0').slice(-4) || '1234';
                street = addr.street || street;
                district = addr.district || district;
                city = addr.city || city;
                postalCode = String(addr.postalCode || postalCode).replace(/\D/g, '').padStart(5, '0').slice(-5) || '12211';
                return { building, street, district, city, postalCode, countryCode: 'SA' };
            }
        } catch {
            // fallback to string parsing
        }
    }
    const rawAddr = settings.businessAddress || settings.address || '';
    if (rawAddr) {
        const parts = String(rawAddr).split(',').map(s => s.trim()).filter(Boolean);
        if (parts[0]) street = parts[0];
        if (parts[1]) district = parts[1];
        if (parts[2]) city = parts[2];
    }
    return { building, street, district, city, postalCode, countryCode: 'SA' };
}

/**
 * Generate ZATCA Phase 2 UBL 2.1 XML from ERP invoice & settings
 */
function generateZATCAXML(invoice = {}, settings = {}) {
    const { issueDate, issueTime } = parseIssueDateTime(invoice.issueDate ? `${invoice.issueDate} ${invoice.issueTime || ''}` : invoice.date);
    const vatNumber = normalizeVatNumber(settings?.vatNumber || invoice.supplier?.vatNumber);
    const sellerName = settings?.businessName || settings?.companyName || invoice.supplier?.nameAr || invoice.supplier?.nameEn || 'KamySoft ERP';
    const crNumber = String(settings?.crNumber || invoice.supplier?.crNumber || '1010123456').replace(/\D/g, '') || '1010123456';
    const addr = invoice.supplier?.address
        ? {
            street: invoice.supplier.address.street || 'King Fahd Road',
            building: String(invoice.supplier.address.building || invoice.supplier.address.buildingNumber || '1234').replace(/\D/g, '').padStart(4, '0').slice(-4),
            district: invoice.supplier.address.district || 'Al Olaya',
            city: invoice.supplier.address.city || 'Riyadh',
            postalCode: String(invoice.supplier.address.postalCode || '12211').replace(/\D/g, '').padStart(5, '0').slice(-5),
            countryCode: invoice.supplier.address.countryCode || 'SA'
        }
        : parseNationalAddress(settings);

    const taxRate = Number(settings?.taxRate ?? 15);
    const rawItems = invoice.items || invoice.invoiceLines || [];
    const discount = Number(invoice.discount || invoice.allowanceTotalAmount || 0);

    let computedLineExtension = 0;
    const linesXml = rawItems.map((item, idx) => {
        const qty = Number(item.qty ?? item.quantity ?? 1);
        const price = Number(item.price ?? item.priceAmount ?? 0);
        const lineExt = Number((price * qty).toFixed(2));
        computedLineExtension += lineExt;
        const rate = Number(item.taxPercent ?? item.taxRate ?? taxRate);
        const lineTax = Number((lineExt * (rate / 100)).toFixed(2));
        const roundingAmount = Number((lineExt + lineTax).toFixed(2));
        const itemName = item.name || item.itemName || `Item ${idx + 1}`;
        const taxCat = item.taxCategoryId || item.taxCategory || (rate === 0 ? 'Z' : 'S');

        return `  <cac:InvoiceLine>
    <cbc:ID>${idx + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="PCE">${qty.toFixed(2)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="SAR">${lineExt.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="SAR">${lineTax.toFixed(2)}</cbc:TaxAmount>
      <cbc:RoundingAmount currencyID="SAR">${roundingAmount.toFixed(2)}</cbc:RoundingAmount>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${escapeXml(itemName)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${escapeXml(taxCat)}</cbc:ID>
        <cbc:Percent>${rate.toFixed(2)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="SAR">${price.toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
    }).join('\n');

    const lineExtensionAmount = computedLineExtension > 0
        ? computedLineExtension
        : Math.max(0, Number(((invoice.total || 0) - (invoice.vat || 0) + discount).toFixed(2)));
    const taxExclusiveAmount = Math.max(0, Number((lineExtensionAmount - discount).toFixed(2)));
    const totalVat = invoice.vat !== undefined && invoice.vat !== null
        ? Number(Number(invoice.vat).toFixed(2))
        : Number((taxExclusiveAmount * (taxRate / 100)).toFixed(2));
    const taxInclusiveAmount = invoice.total !== undefined && invoice.total !== null
        ? Number(Number(invoice.total).toFixed(2))
        : Number((taxExclusiveAmount + totalVat).toFixed(2));

    const invoiceId = invoice.id || invoice.invoiceNumber || 'INV-100001';
    const uuid = invoice.uuid || crypto.randomUUID();
    const csn = invoice.csn || invoice.invoiceCounter || 1;
    const pih = invoice.pih || invoice.previousInvoiceHash || DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH;

    const isCreditNote = invoice.invoiceTypeCode === '381' || invoice.zatcaStatus === 'REFUNDED';
    const isStandard = invoice.invoiceTypeCodeName === '0100000' || invoice.profileId === 'clearance:1.0';
    const profileId = isStandard ? 'clearance:1.0' : 'reporting:1.0';
    const typeCode = isCreditNote ? '381' : (invoice.invoiceTypeCode || '388');
    const typeCodeName = isStandard ? '0100000' : '0200000';

    const customerName = typeof invoice.customer === 'object'
        ? (invoice.customer?.name || invoice.customer?.nameAr || invoice.customer?.nameEn || 'Walk-in Customer')
        : (invoice.customer || 'Walk-in Customer');

    const billingRefBlock = isCreditNote ? `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${escapeXml(invoice.originalInvoiceId || invoiceId)}</cbc:ID>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>` : '';

    const paymentMeansBlock = isCreditNote ? `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>
    <cbc:InstructionNote>${escapeXml(invoice.refundReason || 'Customer Return / Refund')}</cbc:InstructionNote>
  </cac:PaymentMeans>` : '';

    const allowanceChargeBlock = discount > 0 ? `
  <cac:AllowanceCharge>
    <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
    <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>
    <cbc:Amount currencyID="SAR">${discount.toFixed(2)}</cbc:Amount>
    <cac:TaxCategory>
      <cbc:ID>S</cbc:ID>
      <cbc:Percent>${taxRate.toFixed(2)}</cbc:Percent>
      <cac:TaxScheme>
        <cbc:ID>VAT</cbc:ID>
      </cac:TaxScheme>
    </cac:TaxCategory>
  </cac:AllowanceCharge>` : '';

    const allowanceTotalXml = discount > 0
        ? `\n    <cbc:AllowanceTotalAmount currencyID="SAR">${discount.toFixed(2)}</cbc:AllowanceTotalAmount>`
        : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:ProfileID>${profileId}</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoiceId)}</cbc:ID>
  <cbc:UUID>${escapeXml(uuid)}</cbc:UUID>
  <cbc:IssueDate>${escapeXml(issueDate)}</cbc:IssueDate>
  <cbc:IssueTime>${escapeXml(issueTime)}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${typeCodeName}">${typeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>${billingRefBlock}
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${escapeXml(String(csn))}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${escapeXml(pih)}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:Signature>
    <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
    <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">${escapeXml(crNumber)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(addr.street)}</cbc:StreetName>
        <cbc:BuildingNumber>${escapeXml(addr.building)}</cbc:BuildingNumber>
        <cbc:CitySubdivisionName>${escapeXml(addr.district)}</cbc:CitySubdivisionName>
        <cbc:CityName>${escapeXml(addr.city)}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(addr.postalCode)}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(addr.countryCode)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(sellerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(customerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>${paymentMeansBlock}${allowanceChargeBlock}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${totalVat.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${taxExclusiveAmount.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${totalVat.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${taxRate.toFixed(2)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${totalVat.toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${lineExtensionAmount.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${taxExclusiveAmount.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${taxInclusiveAmount.toFixed(2)}</cbc:TaxInclusiveAmount>${allowanceTotalXml}
    <cbc:PayableAmount currencyID="SAR">${taxInclusiveAmount.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${linesXml}
</Invoice>`;
}

// ============================================================
// Canonicalization, Hashing, XAdES Signing & QR Code
// ============================================================

/**
 * Strip UBLExtensions, cac:Signature, and QR AdditionalDocumentReference per ZATCA XPath transforms,
 * then canonicalize for SHA-256 invoice hashing.
 */
function canonicalizeForHash(xmlString, stripQR = true) {
    let cleaned = String(xmlString || '')
        .replace(/<\?xml[^?]*\?>\s*/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\r\n/g, '\n');

    cleaned = cleaned.replace(/<ext:UBLExtensions\b[\s\S]*?<\/ext:UBLExtensions>/g, '');
    cleaned = cleaned.replace(/<cac:Signature\b[\s\S]*?<\/cac:Signature>/g, '');
    if (stripQR) {
        cleaned = cleaned.replace(
            /<cac:AdditionalDocumentReference>\s*<cbc:ID>QR<\/cbc:ID>[\s\S]*?<\/cac:AdditionalDocumentReference>/g,
            ''
        );
    }
    const canonical = cleaned.trim();
    const hashBytes = crypto.createHash('sha256').update(canonical, 'utf8').digest();
    return {
        canonical,
        hash: hashBytes.toString('hex'),
        hashBase64: hashBytes.toString('base64')
    };
}

function computeInvoiceHash(xmlString) {
    return canonicalizeForHash(xmlString).hash;
}

/**
 * Generate ZATCA Phase 2 TLV QR Code (Base64) — supports both object and positional arguments.
 * Per ZATCA Phase 2 SDK:
 * - Tag 1: Seller Name (UTF-8)
 * - Tag 2: VAT Registration Number (UTF-8)
 * - Tag 3: Timestamp ISO 8601 (UTF-8)
 * - Tag 4: Invoice Total with VAT (UTF-8)
 * - Tag 5: VAT Total (UTF-8)
 * - Tag 6: XML Hash (Base64 string bytes or 32-byte SHA-256 digest)
 * - Tag 7: ECDSA Signature (Base64 string bytes)
 * - Tag 8: ECDSA Public Key (Raw DER SPKI bytes)
 * - Tag 9: CSID Certificate Signature (Raw DER signature bytes)
 */
function generatePhase2TLV(data) {
    const sellerName = String(data.sellerName || 'Unknown').trim();
    const vatNumber = normalizeVatNumber(data.vatNumber);
    const { issueDate, issueTime } = parseIssueDateTime(data.timestamp);
    const timestamp = data.timestamp && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(String(data.timestamp))
        ? String(data.timestamp).trim()
        : `${issueDate}T${issueTime}Z`;
    const totalWithVat = Number(data.totalWithVat ?? data.invoiceTotal ?? 0).toFixed(2);
    const vatTotal = Number(data.vatTotal ?? 0).toFixed(2);

    let invoiceHashBase64 = String(data.invoiceHash || data.xmlHashBase64 || '').trim();
    if (!invoiceHashBase64 && data.xmlHashHex) {
        invoiceHashBase64 = Buffer.from(String(data.xmlHashHex), 'hex').toString('base64');
    } else if (/^[0-9a-fA-F]{64}$/.test(invoiceHashBase64)) {
        invoiceHashBase64 = Buffer.from(invoiceHashBase64, 'hex').toString('base64');
    }
    if (!invoiceHashBase64) {
        invoiceHashBase64 = DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH;
    }

    let signatureBase64 = String(data.signatureValue || data.ecdsaSignature || data.signatureBase64 || '').trim();
    if (!signatureBase64 && data.signatureHex) {
        signatureBase64 = Buffer.from(String(data.signatureHex), 'hex').toString('base64');
    } else if (/^[0-9a-fA-F]{64,}$/.test(signatureBase64) && signatureBase64.length % 2 === 0) {
        signatureBase64 = Buffer.from(signatureBase64, 'hex').toString('base64');
    }
    if (!signatureBase64) {
        signatureBase64 = Buffer.from('ZATCA-PHASE2-ECDSA-SIG').toString('base64');
    }

    const pkBase64 = extractSpkiPublicKeyBase64(data.publicKey || data.ecdsaPublicKey || data.publicKeyPem || '');
    const pkBytes = pkBase64 ? Buffer.from(pkBase64, 'base64') : Buffer.from('ZATCA-PHASE2-PUBKEY');

    let certSigBytes;
    if (data.certificateSignature) {
        certSigBytes = Buffer.from(String(data.certificateSignature).trim(), 'base64');
    } else if (data.certificatePem) {
        certSigBytes = Buffer.from(extractCertificateSignature(data.certificatePem), 'base64');
    } else {
        certSigBytes = Buffer.from('ZATCA-PHASE2-CSID-STAMP', 'utf8');
    }

    const qrBuffer = Buffer.concat([
        toTLV(1, Buffer.from(sellerName, 'utf8')),
        toTLV(2, Buffer.from(vatNumber, 'utf8')),
        toTLV(3, Buffer.from(timestamp, 'utf8')),
        toTLV(4, Buffer.from(totalWithVat, 'utf8')),
        toTLV(5, Buffer.from(vatTotal, 'utf8')),
        toTLV(6, Buffer.from(invoiceHashBase64, 'utf8')),
        toTLV(7, Buffer.from(signatureBase64, 'utf8')),
        toTLV(8, pkBytes),
        toTLV(9, certSigBytes)
    ]);

    return qrBuffer.toString('base64');
}

function generateZatcaQR(
    sellerNameOrObj,
    vatNumber,
    timestamp,
    invoiceTotal,
    vatTotal,
    xmlHashHexOrBase64,
    signatureHexOrBase64,
    publicKeyPem,
    certSignatureBase64
) {
    try {
        if (sellerNameOrObj && typeof sellerNameOrObj === 'object') {
            return generatePhase2TLV(sellerNameOrObj);
        }
        return generatePhase2TLV({
            sellerName: sellerNameOrObj,
            vatNumber,
            timestamp,
            totalWithVat: invoiceTotal,
            vatTotal,
            invoiceHash: xmlHashHexOrBase64,
            signatureValue: signatureHexOrBase64,
            publicKey: publicKeyPem,
            certificateSignature: certSignatureBase64
        });
    } catch (e) {
        console.error('QR Gen error:', e);
        return null;
    }
}

/**
 * Sign UBL 2.1 Invoice XML with ECDSA-SHA256 and embed XAdES signature + Phase 2 QR Code.
 * Supports both:
 *   signInvoice(xmlString, privateKeyPem)
 * and:
 *   signInvoice({ xml, privateKeyPem, certificatePem, qrData })
 */
function signInvoice(xmlOrParams, maybePrivateKeyPem = null) {
    let xml;
    let privateKeyPem = null;
    let certificatePem = null;
    let qrData = null;

    if (typeof xmlOrParams === 'object' && xmlOrParams !== null) {
        xml = xmlOrParams.xml;
        privateKeyPem = xmlOrParams.privateKeyPem;
        certificatePem = xmlOrParams.certificatePem;
        qrData = xmlOrParams.qrData;
    } else {
        xml = xmlOrParams;
        if (typeof maybePrivateKeyPem === 'string' && maybePrivateKeyPem.includes('PRIVATE KEY')) {
            privateKeyPem = maybePrivateKeyPem;
        }
    }

    if (!privateKeyPem) {
        const defaultKeys = getKeys('default') || onboardDevice('default');
        privateKeyPem = defaultKeys.privateKeyPem;
        certificatePem = certificatePem || defaultKeys.certificatePem;
    }

    const publicKeyObj = crypto.createPublicKey(privateKeyPem);
    const publicKeyPem = publicKeyObj.export({ type: 'spki', format: 'pem' });
    const publicKeyBase64 = extractSpkiPublicKeyBase64(publicKeyPem);

    const normalizedCertPem = asCertificatePem(certificatePem, privateKeyPem, publicKeyPem);
    const certBase64 = normalizedCertPem
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\s+/g, '');

    let issuerName = 'CN=ZATCA-Code-Signing-CA, O=ZATCA Sandbox CA, C=SA';
    let serialNumber = '100001';
    try {
        const x509 = new crypto.X509Certificate(normalizedCertPem);
        issuerName = x509.issuer.split('\n').reverse().join(', ');
        serialNumber = BigInt(`0x${x509.serialNumber}`).toString(10);
    } catch {}

    const certDigestHex = crypto.createHash('sha256').update(certBase64, 'utf8').digest('hex');
    const certDigestBase64 = Buffer.from(certDigestHex, 'utf8').toString('base64');
    const certSignatureBase64 = extractCertificateSignature(normalizedCertPem);

    const { hash: xmlHashHex, hashBase64: invoiceHashBase64 } = canonicalizeForHash(xml);
    const signingTime = new Date().toISOString().replace(/\.\d{3}Z$/, '');

    const sdkSignedPropsXml = `<xades:SignedProperties xmlns:xades="${XADES_NS}" Id="xadesSignedProperties"><xades:SignedSignatureProperties><xades:SigningTime>${signingTime}</xades:SigningTime><xades:SigningCertificate><xades:Cert><xades:CertDigest><ds:DigestMethod xmlns:ds="${DS_NS}" Algorithm="${SHA256_DIGEST_URI}"/><ds:DigestValue xmlns:ds="${DS_NS}">${certDigestBase64}</ds:DigestValue></xades:CertDigest><xades:IssuerSerial><ds:X509IssuerName xmlns:ds="${DS_NS}">${issuerName}</ds:X509IssuerName><ds:X509SerialNumber xmlns:ds="${DS_NS}">${serialNumber}</ds:X509SerialNumber></xades:IssuerSerial></xades:Cert></xades:SigningCertificate></xades:SignedSignatureProperties></xades:SignedProperties>`;
    const signedPropsDigestHex = crypto.createHash('sha256').update(sdkSignedPropsXml, 'utf8').digest('hex');
    const signedPropsDigestBase64 = Buffer.from(signedPropsDigestHex, 'utf8').toString('base64');

    const signedInfoXml = `<ds:SignedInfo xmlns:ds="${DS_NS}" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><ds:CanonicalizationMethod Algorithm="${C14N11_URI}"/><ds:SignatureMethod Algorithm="${ECDSA_SHA256_URI}"/><ds:Reference Id="invoiceSignedData" URI=""><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116"><ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath></ds:Transform><ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116"><ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath></ds:Transform><ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116"><ds:XPath>not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])</ds:XPath></ds:Transform><ds:Transform Algorithm="${C14N11_URI}"/></ds:Transforms><ds:DigestMethod Algorithm="${SHA256_DIGEST_URI}"/><ds:DigestValue>${invoiceHashBase64}</ds:DigestValue></ds:Reference><ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties"><ds:DigestMethod Algorithm="${SHA256_DIGEST_URI}"/><ds:DigestValue>${signedPropsDigestBase64}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;

    const signer = crypto.createSign('SHA256');
    signer.update(signedInfoXml, 'utf8');
    signer.end();
    const signatureBuf = signer.sign(privateKeyPem);
    const signatureBase64 = signatureBuf.toString('base64');
    const signatureHex = signatureBuf.toString('hex');

    const signedPropertiesBody = `<xades:SignedProperties Id="xadesSignedProperties"><xades:SignedSignatureProperties><xades:SigningTime>${signingTime}</xades:SigningTime><xades:SigningCertificate><xades:Cert><xades:CertDigest><ds:DigestMethod Algorithm="${SHA256_DIGEST_URI}"/><ds:DigestValue>${certDigestBase64}</ds:DigestValue></xades:CertDigest><xades:IssuerSerial><ds:X509IssuerName>${issuerName}</ds:X509IssuerName><ds:X509SerialNumber>${serialNumber}</ds:X509SerialNumber></xades:IssuerSerial></xades:Cert></xades:SigningCertificate></xades:SignedSignatureProperties></xades:SignedProperties>`;
    const signatureXml = `<ds:Signature xmlns:ds="${DS_NS}" Id="signature">${signedInfoXml}<ds:SignatureValue>${signatureBase64}</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>${certBase64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo><ds:Object><xades:QualifyingProperties xmlns:xades="${XADES_NS}" Target="signature">${signedPropertiesBody}</xades:QualifyingProperties></ds:Object></ds:Signature>`;

    const ublSignatureBlock = `  <ext:UBLExtension>
      <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
      <ext:ExtensionContent>
        <sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2"
                                   xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2"
                                   xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2"
                                   xmlns:ds="${DS_NS}">
          <sac:SignatureInformation>
            <cbc:ID xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">urn:oasis:names:specification:ubl:signature:1</cbc:ID>
            <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
            ${signatureXml}
          </sac:SignatureInformation>
        </sig:UBLDocumentSignatures>
      </ext:ExtensionContent>
    </ext:UBLExtension>`;

    let signedXml = String(xml).replace(
        /<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/,
        `<ext:UBLExtensions>\n  ${ublSignatureBlock}\n  </ext:UBLExtensions>`
    );

    // Extract fields from XML if qrData was not explicitly passed
    const sellerMatch = signedXml.match(/<cac:AccountingSupplierParty>[\s\S]*?<cbc:RegistrationName>([^<]+)<\/cbc:RegistrationName>/);
    const vatMatch = signedXml.match(/<cac:AccountingSupplierParty>[\s\S]*?<cbc:CompanyID>([^<]+)<\/cbc:CompanyID>/);
    const dateMatch = signedXml.match(/<cbc:IssueDate>([^<]+)<\/cbc:IssueDate>/);
    const timeMatch = signedXml.match(/<cbc:IssueTime>([^<]+)<\/cbc:IssueTime>/);
    const totalMatch = signedXml.match(/<cbc:TaxInclusiveAmount[^>]*>([^<]+)<\/cbc:TaxInclusiveAmount>/);
    const taxMatch = signedXml.match(/<cac:TaxTotal>\s*<cbc:TaxAmount[^>]*>([^<]+)<\/cbc:TaxAmount>/);

    const qrPayload = {
        sellerName: qrData?.sellerName || (sellerMatch ? sellerMatch[1] : 'KamySoft ERP'),
        vatNumber: qrData?.vatNumber || (vatMatch ? vatMatch[1] : '310122393500003'),
        timestamp: qrData?.timestamp || `${dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10)}T${timeMatch ? timeMatch[1] : '12:00:00'}Z`,
        totalWithVat: qrData?.totalWithVat || (totalMatch ? totalMatch[1] : '0.00'),
        vatTotal: qrData?.vatTotal || (taxMatch ? taxMatch[1] : '0.00'),
        invoiceHash: invoiceHashBase64,
        signatureValue: signatureBase64,
        publicKey: publicKeyBase64,
        certificateSignature: qrData?.certificateSignature || certSignatureBase64
    };

    const qrCodeBase64 = generatePhase2TLV(qrPayload);

    const qrDocRef = `  <cac:AdditionalDocumentReference>
    <cbc:ID>QR</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${qrCodeBase64}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>\n`;

    const withoutExistingQr = signedXml.replace(
        /<cac:AdditionalDocumentReference>\s*<cbc:ID>QR<\/cbc:ID>[\s\S]*?<\/cac:AdditionalDocumentReference>\s*/g,
        ''
    );
    const sigAnchor = withoutExistingQr.indexOf('  <cac:Signature>');
    if (sigAnchor !== -1) {
        signedXml = withoutExistingQr.slice(0, sigAnchor) + qrDocRef + withoutExistingQr.slice(sigAnchor);
    }

    const uuidMatch = signedXml.match(/<cbc:UUID>([^<]+)<\/cbc:UUID>/);
    const extractedUuid = uuidMatch ? uuidMatch[1] : crypto.randomUUID();

    return {
        uuid: extractedUuid,
        signedXml,
        invoiceHash: invoiceHashBase64,
        invoiceHashBase64,
        invoiceHashHex: xmlHashHex,
        xmlHashBase64: invoiceHashBase64,
        xmlHashHex,
        signatureValue: signatureBase64,
        signatureBase64,
        signatureHex,
        publicKeyPem,
        publicKeyBase64,
        certificateSignature: certSignatureBase64,
        certSignatureBase64,
        qrCodeBase64
    };
}

function sha256Hex(str) {
    return crypto.createHash('sha256').update(String(str ?? ''), 'utf8').digest('hex');
}

module.exports = {
    DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH,
    INITIAL_PIH: DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH,
    sha256Hex,
    generateECDSAKeyPair,
    generateCSR,
    generateSelfSignedCSID,
    extractCertificateSignature,
    extractSpkiPublicKeyBase64,
    onboardDevice,
    getKeys,
    generateZATCAXML,
    generateInvoiceXml: generateZATCAXML,
    canonicalizeForHash,
    computeInvoiceHash,
    signInvoice,
    generatePhase2TLV,
    generateZatcaQR
};
