const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { setAdminSession } = require('../../_lib/admin-auth');
const { verifyOtp } = require('../../_lib/otp');
const { getClientIp, shortHash, tooManyAttempts, recordAttempt } = require('../../_lib/request-security');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const email = String(req.body?.email || '').toLowerCase().trim();
  const code = String(req.body?.code || '').trim();
  if (!email || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'الإيميل والكود مطلوبين' });

  const ip = getClientIp(req);
  const context = `super_chk_${shortHash(email)}`;
  const accountContext = `super_chk_account_${shortHash(email)}`;
  if (await tooManyAttempts({ ip, context, windowMs: 10 * 60 * 1000, limit: 5 }) ||
      await tooManyAttempts({ ip: 'account', context: accountContext, windowMs: 10 * 60 * 1000, limit: 10 })) {
    return res.status(429).json({ error: 'محاولات كتير غلط، حاول تاني بعد شوية.' });
  }

  const { data: otp } = await supabase
    .from('super_admin_otps')
    .select('id, code')
    .eq('email', email)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp || !verifyOtp(otp.code, code, `super:${email}`)) {
    await Promise.allSettled([recordAttempt(ip, context), recordAttempt('account', accountContext)]);
    return res.status(400).json({ error: 'الكود غلط أو منتهي' });
  }

  const { data: superAdmin } = await supabase.from('super_admins').select('email').eq('email', email).maybeSingle();
  if (!superAdmin) return res.status(401).json({ error: 'مش معاك صلاحية' });

  const { data: consumedOtp, error: consumeError } = await supabase
    .from('super_admin_otps')
    .update({ used: true })
    .eq('id', otp.id)
    .eq('used', false)
    .select('id')
    .maybeSingle();
  if (consumeError) return res.status(500).json({ error: 'تعذر التحقق من الكود' });
  if (!consumedOtp) return res.status(400).json({ error: 'الكود غلط أو منتهي' });

  await Promise.allSettled([
    supabase.from('super_admin_otps').update({ used: true }).eq('email', email),
    supabase.from('login_attempts').delete().eq('ip', ip).eq('context', context),
    supabase.from('login_attempts').delete().eq('ip', 'account').eq('context', accountContext),
  ]);
  setAdminSession(res, email, 'super_admin');
  return res.status(200).json({ ok: true, email });
};
