const crypto = require('crypto');
const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { sendStudentOtpEmail } = require('../../_lib/admin-email');
const { normalizeEmail, validateEmail, withinMaxLength, MAX_LENGTHS } = require('../../_lib/auth-validators');
const { getClientIp, shortHash, tooManyAttempts, recordAttempt } = require('../../_lib/request-security');
const { digestOtp } = require('../../_lib/otp');

const GENERIC = 'لو الإيميل ده مسجل، هيوصله كود التحقق.';

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const normalizedEmail = normalizeEmail(req.body?.email);
  if (!normalizedEmail || !validateEmail(normalizedEmail) || !withinMaxLength(normalizedEmail, MAX_LENGTHS.email)) {
    return res.status(200).json({ ok: true, message: GENERIC });
  }

  const ip = getClientIp(req);
  const context = `pwd_req_${shortHash(normalizedEmail)}`;
  const accountContext = `pwd_account_${shortHash(normalizedEmail)}`;
  if (await tooManyAttempts({ ip, context, windowMs: 15 * 60 * 1000, limit: 3 }) ||
      await tooManyAttempts({ ip: 'account', context: accountContext, windowMs: 60 * 60 * 1000, limit: 6 })) {
    return res.status(429).json({ error: 'طلبت أكواد كتير. استنى شوية وحاول تاني.' });
  }
  await Promise.allSettled([recordAttempt(ip, context), recordAttempt('account', accountContext)]);

  const { data: student } = await supabase.from('students').select('id, email').eq('email', normalizedEmail).maybeSingle();
  if (!student) return res.status(200).json({ ok: true, message: GENERIC });

  const code = String(crypto.randomInt(100000, 1000000));
  const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await supabase.from('password_resets').update({ used: true }).eq('student_id', student.id).eq('used', false);
  const { data: created, error } = await supabase
    .from('password_resets')
    .insert({ student_id: student.id, code: digestOtp(code, `reset:${student.id}`), expires_at })
    .select('id')
    .single();
  if (error) return res.status(200).json({ ok: true, message: GENERIC });

  const sent = await sendStudentOtpEmail(student.email, code, 'reset').catch(() => ({ sent: false }));
  if (!sent.sent && created?.id) await supabase.from('password_resets').update({ used: true }).eq('id', created.id);
  return res.status(200).json({ ok: true, message: GENERIC });
};
