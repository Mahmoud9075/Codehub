const crypto = require('crypto');
const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { sendOtpWhatsApp } = require('../../_lib/whatsapp');
const { requireStudent } = require('../../_lib/student-auth');
const { getClientIp, shortHash, tooManyAttempts, recordAttempt } = require('../../_lib/request-security');
const { digestOtp } = require('../../_lib/otp');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await requireStudent(req, res);
  if (!session) return;
  const studentId = session.id;
  const ip = getClientIp(req);
  const context = `otp_req_${shortHash(studentId)}`;
  const accountContext = `otp_account_${shortHash(studentId)}`;
  if (await tooManyAttempts({ ip, context, windowMs: 10 * 60 * 1000, limit: 3 }) ||
      await tooManyAttempts({ ip: 'account', context: accountContext, windowMs: 60 * 60 * 1000, limit: 6 })) {
    return res.status(429).json({ error: 'طلبت أكواد كتير. استنى شوية وحاول تاني.' });
  }

  const { data: student } = await supabase
    .from('students')
    .select('id, phone, phone_verified')
    .eq('id', studentId)
    .maybeSingle();
  if (!student) return res.status(404).json({ error: 'الطالب مش موجود' });
  if (student.phone_verified) return res.status(200).json({ ok: true, message: 'رقمك متحقق منه بالفعل.' });

  const code = String(crypto.randomInt(100000, 1000000));
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await supabase.from('phone_otps').delete().eq('student_id', studentId);
  const { error } = await supabase.from('phone_otps').insert({ student_id: studentId, code: digestOtp(code, `phone:${studentId}`), expires_at });
  if (error) return res.status(500).json({ error: 'تعذر إنشاء كود التحقق' });

  const delivery = await sendOtpWhatsApp(student.phone, code).catch(() => ({ sent: false }));
  await Promise.allSettled([recordAttempt(ip, context), recordAttempt('account', accountContext)]);
  if (!delivery.sent) {
    await supabase.from('phone_otps').delete().eq('student_id', studentId);
    return res.status(503).json({ error: 'تعذر إرسال كود التحقق للموبايل دلوقتي. حاول تاني بعد شوية.' });
  }

  return res.status(200).json({ ok: true, message: 'تم إرسال كود التحقق إلى رقم الموبايل.' });
};
