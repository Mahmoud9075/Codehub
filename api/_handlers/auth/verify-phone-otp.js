const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { requireStudent } = require('../../_lib/student-auth');
const { verifyOtp } = require('../../_lib/otp');
const { getClientIp, shortHash, tooManyAttempts, recordAttempt } = require('../../_lib/request-security');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await requireStudent(req, res);
  if (!session) return;
  const studentId = session.id;
  const cleanCode = String(req.body?.code || '').trim();
  if (!/^\d{6}$/.test(cleanCode)) return res.status(400).json({ error: 'اكتب كود التحقق المكوّن من 6 أرقام' });

  const ip = getClientIp(req);
  const context = `otp_chk_${shortHash(studentId)}`;
  const accountContext = `otp_chk_account_${shortHash(studentId)}`;
  if (await tooManyAttempts({ ip, context, windowMs: 10 * 60 * 1000, limit: 5 }) ||
      await tooManyAttempts({ ip: 'account', context: accountContext, windowMs: 10 * 60 * 1000, limit: 10 })) {
    return res.status(429).json({ error: 'محاولات كتير غلط، اطلب كود جديد بعد شوية.' });
  }

  const { data: otp, error: otpError } = await supabase
    .from('phone_otps')
    .select('id, code, expires_at')
    .eq('student_id', studentId)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (otpError) return res.status(500).json({ error: 'تعذر التحقق من الكود' });
  if (!otp || !verifyOtp(otp.code, cleanCode, `phone:${studentId}`)) {
    await Promise.allSettled([recordAttempt(ip, context), recordAttempt('account', accountContext)]);
    return res.status(400).json({ error: 'كود التحقق غير صحيح أو انتهت صلاحيته' });
  }

  const { data: consumedOtp, error: consumeError } = await supabase
    .from('phone_otps')
    .delete()
    .eq('id', otp.id)
    .select('id')
    .maybeSingle();
  if (consumeError) return res.status(500).json({ error: 'تعذر التحقق من الكود' });
  if (!consumedOtp) return res.status(400).json({ error: 'كود التحقق غير صحيح أو انتهت صلاحيته' });

  const { data: student, error: updateError } = await supabase
    .from('students')
    .update({ phone_verified: true })
    .eq('id', studentId)
    .select('id, first_name, last_name, phone, email, avatar_url, phone_verified')
    .single();
  if (updateError) return res.status(500).json({ error: 'تعذر تحديث حالة التحقق' });

  await Promise.allSettled([
    supabase.from('phone_otps').delete().eq('student_id', studentId),
    supabase.from('login_attempts').delete().eq('ip', ip).eq('context', context),
    supabase.from('login_attempts').delete().eq('ip', 'account').eq('context', accountContext),
  ]);
  return res.status(200).json({ ok: true, student });
};
