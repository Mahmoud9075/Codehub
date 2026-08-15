const { supabase } = require('./supabase');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// بيتحقق إن الطلب جاي من أدمن حقيقي — بالـ PIN، أو بتوكن جوجل، أو بجلسة الأدمن الرئيسي (كود الإيميل)
async function isAuthorized(req) {
  const pin = req.headers['x-admin-pin'];
  /* Lines 228-269 omitted */
  return { ok: false };
}

module.exports = { isAuthorized };
