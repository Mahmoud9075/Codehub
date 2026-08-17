const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { sendStudentOtpEmail } = require('../../_lib/admin-email');

// POST /api/auth/request-phone-otp   body: { student_id }
// بيولّد كود من 6 أرقام صالح 10 دقايق، وبيبعته فعليًا على إيميل الطالب المسجّل بيه.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id } = req.body || {};
  if (!student_id) return res.status(400).json({ error: 'student_id مطلوب' });

  const { data: student } = await supabase.from('students').select('id, phone, email').eq('id', student_id).maybeSingle();
  if (!student) return res.status(404).json({ error: 'الطالب مش موجود' });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabase.from('phone_otps').insert({ student_id, code, expires_at });
  if (error) return res.status(500).json({ error: error.message });

  const emailResult = await sendStudentOtpEmail(student.email, code, 'verify').catch((e) => ({ sent: false, reason: e.message }));

  return res.status(200).json({
    ok: true,
    message: 'لو الإعداد جاهز، الكود هيوصلك على إيميلك دلوقتي.',
    email_sent: emailResult.sent, // مفيد وقت التجربة عشان تعرف لو الإرسال شغّال فعلاً
  });
};
