const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { verifyPassword, hashPassword, needsRehash } = require('../../_lib/password');
const { normalizeEmail, validateEmail, withinMaxLength, MAX_LENGTHS } = require('../../_lib/auth-validators');
const { setStudentSession } = require('../../_lib/student-auth');
const { getClientIp, shortHash, tooManyAttempts, recordAttempt } = require('../../_lib/request-security');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) return res.status(400).json({ error: 'الإيميل والباسورد مطلوبين' });
  if (!validateEmail(normalizedEmail) || !withinMaxLength(normalizedEmail, MAX_LENGTHS.email) || String(password).length > 256) {
    return res.status(401).json({ error: 'الإيميل أو الباسورد غلط' });
  }

  const ip = getClientIp(req);
  const emailContext = `stu_${shortHash(normalizedEmail)}`;
  const accountContext = `stu_account_${shortHash(normalizedEmail)}`;
  const windowMs = 10 * 60 * 1000;
  if (await tooManyAttempts({ ip, context: 'student_login_ip', windowMs, limit: 30 }) ||
      await tooManyAttempts({ ip, context: emailContext, windowMs, limit: 5 }) ||
      await tooManyAttempts({ ip: 'account', context: accountContext, windowMs: 60 * 60 * 1000, limit: 15 })) {
    return res.status(429).json({ error: 'محاولات كتير غلط، حاول تاني بعد شوية.' });
  }

  const { data: student, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, phone, email, avatar_url, phone_verified, password_hash')
    .eq('email', normalizedEmail)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'حصل خطأ في تسجيل الدخول' });

  const match = student ? await verifyPassword(String(password), student.password_hash) : false;
  if (!match) {
    await Promise.allSettled([
      recordAttempt(ip, 'student_login_ip'),
      recordAttempt(ip, emailContext),
      recordAttempt('account', accountContext),
    ]);
    return res.status(401).json({ error: 'الإيميل أو الباسورد غلط' });
  }

  // Upgrade legacy PBKDF2 hashes after a successful login without forcing a password reset.
  if (needsRehash(student.password_hash)) {
    try {
      const upgradedHash = await hashPassword(String(password));
      const { error: upgradeError } = await supabase.from('students').update({ password_hash: upgradedHash }).eq('id', student.id);
      if (!upgradeError) student.password_hash = upgradedHash;
    } catch (error) {}
  }

  setStudentSession(res, student.id, student.password_hash);
  await Promise.allSettled([
    supabase.from('login_attempts').delete().eq('ip', ip).eq('context', 'student_login_ip'),
    supabase.from('login_attempts').delete().eq('ip', ip).eq('context', emailContext),
    supabase.from('login_attempts').delete().eq('ip', 'account').eq('context', accountContext),
  ]);

  delete student.password_hash;
  return res.status(200).json({ student });
};
