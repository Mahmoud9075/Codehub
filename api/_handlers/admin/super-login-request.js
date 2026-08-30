const crypto = require('crypto');
const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { sendOtpEmail } = require('../../_lib/admin-email');
const { getClientIp, shortHash, tooManyAttempts, recordAttempt } = require('../../_lib/request-security');
const { digestOtp } = require('../../_lib/otp');

const GENERIC = 'لو الإيميل مسجل كأدمن، هيوصله كود التحقق.';

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(200).json({ ok: true, message: GENERIC });
  }

  const ip = getClientIp(req);
  const context = `super_req_${shortHash(email)}`;
  const accountContext = `super_account_${shortHash(email)}`;
  if (await tooManyAttempts({ ip, context, windowMs: 10 * 60 * 1000, limit: 3 }) ||
      await tooManyAttempts({ ip: 'account', context: accountContext, windowMs: 60 * 60 * 1000, limit: 10 })) {
    return res.status(429).json({ error: 'طلبت أكواد كتير. استنى شوية وحاول تاني.' });
  }
  await Promise.allSettled([recordAttempt(ip, context), recordAttempt('account', accountContext)]);

  const { data: superAdmin } = await supabase.from('super_admins').select('email').eq('email', email).maybeSingle();
  if (!superAdmin) return res.status(200).json({ ok: true, message: GENERIC });

  const code = String(crypto.randomInt(100000, 1000000));
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await supabase.from('super_admin_otps').update({ used: true }).eq('email', email).eq('used', false);
  const { data: created, error } = await supabase
    .from('super_admin_otps')
    .insert({ email, code: digestOtp(code, `super:${email}`), expires_at })
    .select('id')
    .single();
  if (error) return res.status(500).json({ error: 'تعذر إنشاء كود الدخول' });

  const emailResult = await sendOtpEmail(email, code).catch(() => ({ sent: false }));
  if (!emailResult.sent) {
    if (created?.id) await supabase.from('super_admin_otps').update({ used: true }).eq('id', created.id);
    return res.status(503).json({ error: 'تعذر إرسال كود الدخول حاليًا' });
  }

  return res.status(200).json({ ok: true, message: GENERIC });
};
