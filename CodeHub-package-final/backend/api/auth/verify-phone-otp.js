const { supabase } = require('../_supabase');
const { applyCors } = require('../_cors');

// POST /api/auth/verify-phone-otp   body: { student_id, code }
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id, code } = req.body || {};
  if (!student_id || !code) return res.status(400).json({ error: 'البيانات ناقصة' });

  const { data: otp } = await supabase
    .from('phone_otps')
    .select('*')
    .eq('student_id', student_id)
    .eq('code', code)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) return res.status(400).json({ error: 'الكود غلط أو منتهي' });

  await supabase.from('phone_otps').update({ used: true }).eq('id', otp.id);

  const { data: student, error } = await supabase
    .from('students')
    .update({ phone_verified: true })
    .eq('id', student_id)
    .select('id, first_name, last_name, phone, email, avatar_url, phone_verified, parent_token')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true, student });
};
