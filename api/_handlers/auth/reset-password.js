const { supabase } = require('../../_lib/supabase');
const { validatePassword, normalizeEmail, validateEmail } = require('../../_lib/auth-validators');
const { applyCors } = require('../../_lib/cors');
const { hashPassword } = require('../../_lib/password');
const { clearStudentSession } = require('../../_lib/student-auth');
const { verifyOtp } = require('../../_lib/otp');
const { getClientIp, shortHash, tooManyAttempts, recordAttempt } = require('../../_lib/request-security');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const normalizedEmail = normalizeEmail(req.body?.email);
  const cleanCode = String(req.body?.code || '').trim();
  const newPassword = String(req.body?.new_password || '');
  if (!normalizedEmail || !cleanCode || !newPassword) return res.status(400).json({ error: 'كل الحقول مطلوبة' });
  if (!validateEmail(normalizedEmail) || !/^\d{6}$/.test(cleanCode)) return res.status(400).json({ error: 'الكود غلط أو منتهي' });
  if (!validatePassword(newPassword) || newPassword.length > 256) return res.status(400).json({ error: 'الباسورد لازم 8 حروف على الأقل، وفيه حرف كابيتال وحرف سمول ورقم ورمز' });

  const ip = getClientIp(req);
  const context = `pwd_chk_${shortHash(normalizedEmail)}`;
  const accountContext = `pwd_chk_account_${shortHash(normalizedEmail)}`;
  if (await tooManyAttempts({ ip, context, windowMs: 15 * 60 * 1000, limit: 5 }) ||
      await tooManyAttempts({ ip: 'account', context: accountContext, windowMs: 15 * 60 * 1000, limit: 10 })) {
    return res.status(429).json({ error: 'محاولات كتير غلط، حاول تاني بعد شوية.' });
  }

  const { data: student } = await supabase.from('students').select('id').eq('email', normalizedEmail).maybeSingle();
  if (!student) {
    await Promise.allSettled([recordAttempt(ip, context), recordAttempt('account', accountContext)]);
    return res.status(400).json({ error: 'الكود غلط أو منتهي' });
  }

  const { data: reset } = await supabase
    .from('password_resets')
    .select('id, code')
    .eq('student_id', student.id)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!reset || !verifyOtp(reset.code, cleanCode, `reset:${student.id}`)) {
    await Promise.allSettled([recordAttempt(ip, context), recordAttempt('account', accountContext)]);
    return res.status(400).json({ error: 'الكود غلط أو منتهي' });
  }

  const { data: consumedReset, error: consumeError } = await supabase
    .from('password_resets')
    .update({ used: true })
    .eq('id', reset.id)
    .eq('used', false)
    .select('id')
    .maybeSingle();
  if (consumeError) return res.status(500).json({ error: 'تعذر التحقق من الكود' });
  if (!consumedReset) return res.status(400).json({ error: 'الكود غلط أو منتهي' });

  const password_hash = await hashPassword(newPassword);
  const { error: updateErr } = await supabase.from('students').update({ password_hash }).eq('id', student.id);
  if (updateErr) return res.status(500).json({ error: 'تعذر تغيير الباسورد' });

  await Promise.allSettled([
    supabase.from('password_resets').update({ used: true }).eq('student_id', student.id),
    supabase.from('login_attempts').delete().eq('ip', ip).eq('context', context),
    supabase.from('login_attempts').delete().eq('ip', 'account').eq('context', accountContext),
  ]);
  clearStudentSession(res);
  return res.status(200).json({ ok: true });
};
