const crypto = require('crypto');
const { supabase } = require('./supabase');
const { OAuth2Client } = require('google-auth-library');
const { signPayload, verifyPayload, parseCookies, setCookie, clearCookie, safeEqual } = require('./session');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const COOKIE_NAME = 'ch_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;

function adminSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.SUPER_ADMIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function pinVersion() {
  return crypto.createHash('sha256').update(String(process.env.ADMIN_PIN || '')).digest('hex').slice(0, 24);
}

function setAdminSession(res, identity, via) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    typ: 'admin',
    sub: String(identity || ''),
    via: String(via || 'admin'),
    iat: now,
    exp: now + SESSION_SECONDS,
  };
  if (via === 'pin') payload.pv = pinVersion();
  const token = signPayload(payload, adminSecret());
  setCookie(res, COOKIE_NAME, token, { maxAge: SESSION_SECONDS, httpOnly: true, sameSite: 'Strict' });
}

function clearAdminSession(res) {
  clearCookie(res, COOKIE_NAME, { httpOnly: true, sameSite: 'Strict' });
}

async function authorizeCookie(req) {
  const payload = verifyPayload(parseCookies(req)[COOKIE_NAME], adminSecret());
  if (!payload || payload.typ !== 'admin' || !payload.sub || !payload.via) return null;

  if (payload.via === 'pin') {
    if (!process.env.ADMIN_PIN || !safeEqual(payload.pv, pinVersion())) return null;
    return { ok: true, via: 'pin', identity: 'PIN' };
  }

  if (payload.via === 'super_admin') {
    const { data } = await supabase.from('super_admins').select('email').eq('email', payload.sub).maybeSingle();
    return data ? { ok: true, via: 'super_admin', identity: data.email, email: data.email } : null;
  }

  if (payload.via === 'google') {
    const { data } = await supabase.from('admin_emails').select('email').eq('email', payload.sub).maybeSingle();
    return data ? { ok: true, via: 'google', identity: data.email, email: data.email } : null;
  }

  return null;
}

async function isAuthorized(req) {
  const cookieAuth = await authorizeCookie(req);
  if (cookieAuth) return cookieAuth;

  // Google ID tokens remain supported for compatibility. PINs and static super-admin
  // signatures are intentionally not accepted on protected endpoints anymore.
  const googleToken = req.headers['x-admin-google-token'];
  if (googleToken && process.env.GOOGLE_CLIENT_ID) {
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: googleToken, audience: process.env.GOOGLE_CLIENT_ID });
      const email = String(ticket.getPayload()?.email || '').toLowerCase().trim();
      if (email) {
        const { data } = await supabase.from('admin_emails').select('email').eq('email', email).maybeSingle();
        if (data) return { ok: true, via: 'google', identity: email, email };
      }
    } catch (error) {}
  }

  return { ok: false };
}

module.exports = { isAuthorized, setAdminSession, clearAdminSession };
