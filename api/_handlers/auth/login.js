const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { verifyPassword } = require('../../_lib/password');

// POST /api/auth/login   body: { email, password }
// محمي من التخمين العشوائي: 5 محاولات غلط بس من نفس الجهاز كل 10 دقايق.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'الإيميل والباسورد مطلوبين' });
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: recentAttempts } = await supabase
    .from('login_attempts')
    .select('id')
    .eq('ip', ip)
    .eq('context', 'student_login')
    .gte('attempted_at', tenMinutesAgo);

  if (recentAttempts && recentAttempts.length >= 5) {
    return res.status(429).json({ error: 'محاولات كتير غلط، حاول تاني بعد شوية.' });
  }

  const { data: student, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, phone, email, avatar_url, phone_verified, parent_token, password_hash')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  const match = student ? await verifyPassword(password, student.password_hash) : false;
  if (!match) {
    await supabase.from('login_attempts').insert({ ip, context: 'student_login' });
    return res.status(401).json({ error: 'الإيميل أو الباسورد غلط' });
  }

  delete student.password_hash;
  return res.status(200).json({ student });
};
