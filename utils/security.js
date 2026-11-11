// Central handling of server secrets and sensitive settings fields.
const crypto = require('crypto');

// Values that have been published in this repository (code, docs, k8s, compose).
// They must never be accepted as real secrets.
const PUBLISHED_DEFAULTS = new Set([
    'kamysoft_super_secret_key_2026',
    'kamysoft-saas-admin-2026',
    'mock-secret',
    'fallback_secret',
    'your-secret-admin-key',
    'your-secret-key',
    'development-admin-key'
]);

const isWeakSecret = (value, minLength) =>
    !value || PUBLISHED_DEFAULTS.has(value) || String(value).length < minLength;

let cachedJwtSecret = null;

/**
 * Secret used to sign and verify login tokens.
 * Throws if JWT_SECRET is missing, shorter than 32 characters or a published default,
 * unless ALLOW_DEV_SECRETS=true (local development only), in which case a random
 * secret is generated for this process (logins reset on restart).
 */
function getJwtSecret() {
    if (cachedJwtSecret) return cachedJwtSecret;
    const value = process.env.JWT_SECRET;
    if (!isWeakSecret(value, 32)) {
        cachedJwtSecret = value;
        return cachedJwtSecret;
    }
    if (process.env.ALLOW_DEV_SECRETS === 'true') {
        cachedJwtSecret = crypto.randomBytes(48).toString('hex');
        console.warn('[security] JWT_SECRET not set or weak; using a random development secret (ALLOW_DEV_SECRETS=true). Do not use this in production.');
        return cachedJwtSecret;
    }
    throw new Error('JWT_SECRET is missing, shorter than 32 characters, or a value published in the repository. Set a long random JWT_SECRET (for example: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))").');
}

/** SaaS provider admin key, or null when not configured (admin API is then disabled). */
function getSaasAdminKey() {
    const value = process.env.SAAS_ADMIN_KEY;
    return isWeakSecret(value, 16) ? null : value;
}

/** Constant-time string comparison. */
function safeEqual(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Settings fields that only a logged-in Admin of the store may read.
const SECRET_SETTINGS_FIELDS = [
    ['smtp', 'password'],
    ['smtp', 'sendgridApiKey'],
    ['zatcaConn', 'clientSecret'],
    ['zatcaConn', 'privateKey'],
    ['zatcaConn', 'otp'],
    ['emailVerificationToken'],
    ['licenseKey']
];
// Owner registration details hidden from visitors who are not logged in.
const PRIVATE_SETTINGS_FIELDS = [['email'], ['fullName'], ['mobile'], ['nationalAddress']];

// Fields a store Admin must not change through POST /api/settings.
const PROTECTED_SETTINGS_FIELDS = [
    '_id', '__v', 'tenantId', 'licenseKey', 'licenseStatus', 'licenseExpiresAt',
    'isEmailVerified', 'emailVerificationToken'
];

const deletePath = (obj, pathParts) => {
    let cur = obj;
    for (let i = 0; i < pathParts.length - 1; i++) {
        if (!cur || typeof cur !== 'object') return;
        cur = cur[pathParts[i]];
    }
    if (cur && typeof cur === 'object') delete cur[pathParts[pathParts.length - 1]];
};

/**
 * Copy of the settings safe to send to this viewer.
 * @param {object} settings  Mongoose document or plain object
 * @param {'admin'|'staff'|'public'} audience
 */
function sanitizeSettings(settings, audience) {
    if (!settings) return settings;
    const plain = typeof settings.toObject === 'function'
        ? settings.toObject({ flattenMaps: true })
        : JSON.parse(JSON.stringify(settings));
    if (audience === 'admin') return plain;
    SECRET_SETTINGS_FIELDS.forEach(p => deletePath(plain, p));
    if (audience === 'public') PRIVATE_SETTINGS_FIELDS.forEach(p => deletePath(plain, p));
    return plain;
}

/**
 * Clean an incoming settings update: drop protected fields, and keep the stored
 * secret when the client sends an empty value for it (so a form that never
 * received the secret cannot wipe it).
 */
function sanitizeSettingsUpdate(body, existing) {
    const update = { ...(body || {}) };
    PROTECTED_SETTINGS_FIELDS.forEach(f => delete update[f]);
    const current = existing && typeof existing.toObject === 'function' ? existing.toObject() : (existing || {});
    SECRET_SETTINGS_FIELDS.filter(p => p.length === 2).forEach(([group, key]) => {
        if (update[group] && typeof update[group] === 'object') {
            update[group] = { ...update[group] };
            if (!update[group][key] && current[group] && current[group][key]) {
                update[group][key] = current[group][key];
            }
        }
    });
    return update;
}

module.exports = {
    getJwtSecret,
    getSaasAdminKey,
    safeEqual,
    sanitizeSettings,
    sanitizeSettingsUpdate,
    isWeakSecret
};
