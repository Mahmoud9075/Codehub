const bcrypt = require('bcryptjs');
const { supabase } = require('../_supabase');
const { validatePassword } = require('./_validators');
const { applyCors } = require('../_cors');

// POST /api/auth/reset-password   body: { phone, code, new_password }
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, code, new_password } = req.body || {};
  if (!phone || !code || !new_password) {
    return res.status(400).json({ error: 'كل الحقول مطلوبة' });
  }
  if (!validatePassword(new_password)) {
    return res.status(400).json({ error: 'الباسورد لازم 8 حروف على الأقل، وفيه حرف كابيتال وحرف سمول ورقم ورمز' });
  }

  const { data: student } = await supabase
    .from('students')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  if (!student) return res.status(400).json({ error: 'الكود غلط أو منتهي' });

  const { data: reset } = await supabase
    .from('password_resets')
    .select('*')
    .eq('student_id', student.id)
    .eq('code', code)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!reset) return res.status(400).json({ error: 'الكود غلط أو منتهي' });

  const password_hash = await bcrypt.hash(new_password, 10);

  const { error: updateErr } = await supabase
    .from('students')
    .update({ password_hash })
    .eq('id', student.id);

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  await supabase.from('password_resets').update({ used: true }).eq('id', reset.id);

  return res.status(200).json({ ok: true });
};
