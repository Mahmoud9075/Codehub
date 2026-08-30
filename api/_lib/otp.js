const crypto = require('crypto');
const { safeEqual } = require('./session');

function pepper() {
  return process.env.OTP_PEPPER || process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function digestOtp(code, context = '') {
  const secret = pepper();
  if (!secret) throw new Error('OTP pepper is not configured');
  const digest = crypto.createHmac('sha256', secret)
    .update(`${String(context)}\0${String(code)}`)
    .digest('hex');
  return `h1:${digest}`;
}

function verifyOtp(stored, code, context = '') {
  const value = String(stored || '');
  if (value.startsWith('h1:')) {
    try { return safeEqual(value, digestOtp(code, context)); }
    catch (error) { return false; }
  }
  // Transitional support for OTPs created before this security upgrade.
  return safeEqual(value, String(code || ''));
}

module.exports = { digestOtp, verifyOtp };
