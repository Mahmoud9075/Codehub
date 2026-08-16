const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { sendStudentOtpEmail } = require('../../_lib/admin-email');

// POST /api/auth/forgot-password   body: { email }
// بيولّد كود من 6 أرقام صالح 15 دقيقة، وبيبعته فعليًا على إيميل الطالب اللي كتبه.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'الإيميل مطلوب' });

  const normalizedEmail = String(email).toLowerCase().trim();

  const { data: student } = await supabase
    .from('students')
    .select('id, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  // برضو بنرجع نفس الرسالة لو الإيميل مش موجود، عشان محدش يعرف إيميلات مسجلة ولا لأ
  if (!student) {
    return res.status(200).json({ ok: true, message: 'لو الإيميل ده مسجل، هيوصله كود التحقق.' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('password_resets')
    .insert({ student_id: student.id, code, expires_at });

  if (error) return res.status(500).json({ error: error.message });

  await sendStudentOtpEmail(student.email, code, 'reset').catch(() => {});

  return res.status(200).json({ ok: true, message: 'لو الإيميل ده مسجل، هيوصله كود التحقق.' });
};
