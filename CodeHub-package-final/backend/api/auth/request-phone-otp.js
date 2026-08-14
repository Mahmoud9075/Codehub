const { supabase } = require('../_supabase');
const { applyCors } = require('../_cors');

// POST /api/auth/request-phone-otp   body: { student_id }
// بيولّد كود من 6 أرقام صالح 10 دقايق.
//
// ⚠️ ملحوظة: الكود لسه مش بيتبعت SMS فعليًا — محتاج ربط بخدمة زي Twilio (لها رصيد مجاني بسيط للتجربة).
// لحد ما نعملها، الكود بيتسجل في جدول phone_otps بس.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id } = req.body || {};
  if (!student_id) return res.status(400).json({ error: 'student_id مطلوب' });

  const { data: student } = await supabase.from('students').select('id, phone').eq('id', student_id).maybeSingle();
  if (!student) return res.status(404).json({ error: 'الطالب مش موجود' });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabase.from('phone_otps').insert({ student_id, code, expires_at });
  if (error) return res.status(500).json({ error: error.message });

  // TODO: اربط هنا خدمة إرسال SMS
  // مثال (Twilio): await twilioClient.messages.create({ to: student.phone, from: '...', body: `كود Code Hub: ${code}` });

  return res.status(200).json({ ok: true, message: 'الكود اتبعت (أو هيبان في السجل لحد ما يتفعّل الإرسال الآلي).' });
};
