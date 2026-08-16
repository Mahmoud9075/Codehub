const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { sendOtpWhatsApp } = require('../../_lib/whatsapp');

// POST /api/auth/forgot-password   body: { phone }
// بيولّد كود من 6 أرقام صالح 15 دقيقة، وبيبعته فعليًا على واتساب الطالب (لو الإعداد مظبوط).
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'رقم الموبايل مطلوب' });

  const { data: student } = await supabase
    .from('students')
    .select('id, phone')
    .eq('phone', phone)
    .maybeSingle();

  // برضو بنرجع نفس الرسالة لو الرقم مش موجود، عشان محدش يعرف أرقام مسجلة ولا لأ
  if (!student) {
    return res.status(200).json({ ok: true, message: 'لو الرقم ده مسجل، هيوصله كود التحقق.' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('password_resets')
    .insert({ student_id: student.id, code, expires_at });

  if (error) return res.status(500).json({ error: error.message });

  await sendOtpWhatsApp(student.phone, code).catch(() => {});

  return res.status(200).json({ ok: true, message: 'لو الرقم ده مسجل، هيوصله كود التحقق.' });
};
