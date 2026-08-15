const { supabase } = require('./supabase');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// بيتحقق إن الطلب جاي من أدمن حقيقي — بالـ PIN، أو بتوكن جوجل، أو بجلسة الأدمن الرئيسي (كود الإيميل)
async function isAuthorized(req) {
  const pin = req.headers['x-admin-pin'];
  if (pin && pin === process.env.ADMIN_PIN) {
    return { ok: true, via: 'pin', identity: 'PIN' };
  }

  const googleToken = req.headers['x-admin-google-token'];
  if (googleToken) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const email = ticket.getPayload().email;

      const { data, error } = await supabase
        .from('admin_emails')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (!error && data) {
        return { ok: true, via: 'google', identity: email, email };
      }
    } catch (e) {
      // توكن غير صالح أو منتهي
    }
  }

  // جلسة الأدمن الرئيسي (بعد ما يتحقق بكود الإيميل، بيبعت هيدر بالإيميل + توقيع الجلسة)
  const superEmail = req.headers['x-super-admin-email'];
  const superSig = req.headers['x-super-admin-sig'];
  if (superEmail && superSig && process.env.SUPER_ADMIN_SECRET) {
    const expected = crypto
      .createHmac('sha256', process.env.SUPER_ADMIN_SECRET)
      .update(superEmail)
      .digest('hex');
    if (expected === superSig) {
      const { data } = await supabase.from('super_admins').select('email').eq('email', superEmail).maybeSingle();
      if (data) return { ok: true, via: 'super_admin', identity: superEmail, email: superEmail };
    }
  }

  return { ok: false };
}

module.exports = { isAuthorized };
