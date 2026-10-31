const crypto = require('crypto');

/**
 * Helper to get the correct API base URL based on environment
 */
function getBaseUrl(env) {
    switch (env) {
        case 'simulation':
            return 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation';
        case 'production':
            return 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core';
        case 'sandbox':
        default:
            return 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal';
    }
}

function normalizeHashBase64(hashInput) {
    const trimmed = String(hashInput || '').trim();
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
        return Buffer.from(trimmed, 'hex').toString('base64');
    }
    return trimmed;
}

function extractUuidFromXmlBase64(xmlBase64, explicitUuid) {
    if (explicitUuid) return explicitUuid;
    try {
        const xml = Buffer.from(xmlBase64, 'base64').toString('utf8');
        const match = xml.match(/<cbc:UUID>([^<]+)<\/cbc:UUID>/);
        if (match && match[1]) return match[1].trim();
    } catch {}
    return crypto.randomUUID();
}

function buildBasicAuthHeader(certPemOrToken, secret) {
    const trimmed = String(certPemOrToken || '').trim();
    // ZATCA binarySecurityToken is base64 of the PEM or base64 body
    const tokenStr = trimmed.includes('BEGIN CERTIFICATE')
        ? Buffer.from(trimmed).toString('base64')
        : trimmed;
    return `Basic ${Buffer.from(`${tokenStr}:${secret}`).toString('base64')}`;
}

/**
 * Register the device (Get CCSID)
 * Endpoint: /compliance
 */
async function registerDevice(otp, csrPem, env = 'sandbox') {
    const baseUrl = getBaseUrl(env);

    const response = await fetch(`${baseUrl}/compliance`, {
        method: 'POST',
        headers: {
            'OTP': String(otp || '123456'),
            'Accept-Version': 'V2',
            'Accept-Language': 'en',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ csr: Buffer.from(csrPem).toString('base64') })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || data.errors?.[0]?.message || 'Failed to register device with ZATCA');
    }

    return {
        certificate: Buffer.from(data.binarySecurityToken, 'base64').toString('utf-8'),
        binarySecurityToken: data.binarySecurityToken,
        secret: data.secret,
        requestId: data.requestID || data.requestId
    };
}

/**
 * Clearance API for Standard (B2B) Invoices
 * Endpoint: /invoices/clearance/single
 */
async function clearInvoice(invoiceXmlBase64, invoiceHash, certPem, secret, env = 'sandbox', uuid = null) {
    const baseUrl = getBaseUrl(env);
    const authHeader = buildBasicAuthHeader(certPem, secret);
    const normalizedHash = normalizeHashBase64(invoiceHash);
    const resolvedUuid = extractUuidFromXmlBase64(invoiceXmlBase64, uuid);

    const payload = {
        invoiceHash: normalizedHash,
        uuid: resolvedUuid,
        invoice: invoiceXmlBase64
    };

    const response = await fetch(`${baseUrl}/invoices/clearance/single`, {
        method: 'POST',
        headers: {
            'Authorization': authHeader,
            'Accept-Version': 'V2',
            'Accept-Language': 'en',
            'Clearance-Status': '1',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(`Clearance Failed: ${JSON.stringify(data)}`);
    }

    return data;
}

/**
 * Reporting API for Simplified (B2C) Invoices
 * Endpoint: /invoices/reporting/single
 */
async function reportInvoice(invoiceXmlBase64, invoiceHash, certPem, secret, env = 'sandbox', uuid = null) {
    const baseUrl = getBaseUrl(env);
    const authHeader = buildBasicAuthHeader(certPem, secret);
    const normalizedHash = normalizeHashBase64(invoiceHash);
    const resolvedUuid = extractUuidFromXmlBase64(invoiceXmlBase64, uuid);

    const payload = {
        invoiceHash: normalizedHash,
        uuid: resolvedUuid,
        invoice: invoiceXmlBase64
    };

    const response = await fetch(`${baseUrl}/invoices/reporting/single`, {
        method: 'POST',
        headers: {
            'Authorization': authHeader,
            'Accept-Version': 'V2',
            'Accept-Language': 'en',
            'Clearance-Status': '0',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(`Reporting Failed: ${JSON.stringify(data)}`);
    }

    return data;
}

module.exports = {
    getBaseUrl,
    registerDevice,
    clearInvoice,
    reportInvoice
};
