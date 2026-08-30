const crypto = require('crypto');

function base64urlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64urlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function signPayload(payload, secret) {
  if (!secret) throw new Error('Session secret is not configured');
  const encoded = base64urlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyPayload(token, secret) {
  if (!token || !secret) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(base64urlDecode(encoded));
    if (!payload || typeof payload !== 'object') return null;
    if (!Number.isFinite(payload.exp) || Date.now() >= payload.exp * 1000) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

function parseCookies(req) {
  const header = String(req.headers?.cookie || '');
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx <= 0) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) return;
    try { out[key] = decodeURIComponent(value); }
    catch (error) { out[key] = value; }
  });
  return out;
}

function shouldUseSecureCookie() {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value || '')}`, `Path=${options.path || '/'}`];
  if (options.httpOnly !== false) parts.push('HttpOnly');
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  if (options.secure ?? shouldUseSecureCookie()) parts.push('Secure');
  if (Number.isFinite(options.maxAge)) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options.expires instanceof Date) parts.push(`Expires=${options.expires.toUTCString()}`);
  return parts.join('; ');
}

function appendSetCookie(res, value) {
  const current = res.getHeader ? res.getHeader('Set-Cookie') : null;
  if (!current) {
    res.setHeader('Set-Cookie', value);
  } else if (Array.isArray(current)) {
    res.setHeader('Set-Cookie', [...current, value]);
  } else {
    res.setHeader('Set-Cookie', [current, value]);
  }
}

function setCookie(res, name, value, options = {}) {
  appendSetCookie(res, serializeCookie(name, value, options));
}

function clearCookie(res, name, options = {}) {
  appendSetCookie(res, serializeCookie(name, '', {
    ...options,
    maxAge: 0,
    expires: new Date(0),
  }));
}

module.exports = {
  safeEqual,
  signPayload,
  verifyPayload,
  parseCookies,
  setCookie,
  clearCookie,
};
