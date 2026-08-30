const crypto = require('crypto');
const { supabase } = require('../../_lib/supabase');
const { validateName, validateEmail, validatePassword, validatePhone, normalizeEmail, isDisposableEmail, withinMaxLength, MAX_LENGTHS } = require('../../_lib/auth-validators');
const { applyCors } = require('../../_lib/cors');
const { hashPassword } = require('../../_lib/password');
const { setStudentSession } = require('../../_lib/student-auth');
const { getClientIp, tooManyAttempts, recordAttempt } = require('../../_lib/request-security');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  if (await tooManyAttempts({ ip, context: 'student_register', windowMs: 60 * 60 * 1000, limit: 10 })) {
    return res.status(429).json({ error: 'محاولات تسجيل كتير، حاول تاني بعد شوية.' });
  }

  let { first_name, last_name, phone, email, password } = req.body || {};
  first_name = String(first_name || '').trim();
  last_name = String(last_name || '').trim();
  phone = String(phone || '').trim();
  email = normalizeEmail(email);

  if (!first_name || !last_name || !phone || !email || !password) return res.status(400).json({ error: 'كل الحقول مطلوبة' });
  if (!withinMaxLength(first_name, MAX_LENGTHS.name) || !withinMaxLength(last_name, MAX_LENGTHS.name)) return res.status(400).json({ error: 'الاسم طويل قوي' });
  if (!validateName(first_name) || !validateName(last_name)) return res.status(400).json({ error: 'الاسم يقبل حروف عربي أو إنجليزي بس، من غير أرقام أو رموز' });
  if (!validatePhone(phone)) return res.status(400).json({ error: 'اكتب رقم موبايل مصري صحيح (11 رقم، يبدأ بـ 010 أو 011 أو 012 أو 015)' });
  if (!withinMaxLength(email, MAX_LENGTHS.email) || !validateEmail(email)) return res.status(400).json({ error: 'اكتب إيميل صحيح' });
  if (isDisposableEmail(email)) return res.status(400).json({ error: 'من فضلك استخدم إيميل حقيقي، مش إيميل مؤقت' });
  if (!validatePassword(password) || String(password).length > 256) return res.status(400).json({ error: 'الباسورد لازم 8 حروف على الأقل، وفيه حرف كابيتال وحرف سمول ورقم ورمز' });

  // Count every valid registration attempt so successful/duplicate requests cannot bypass the hourly cap.
  await recordAttempt(ip, 'student_register').catch(() => {});

  const [{ data: byPhone }, { data: byEmail }] = await Promise.all([
    supabase.from('students').select('id').eq('phone', phone).maybeSingle(),
    supabase.from('students').select('id').eq('email', email).maybeSingle(),
  ]);
  if (byPhone || byEmail) return res.status(409).json({ error: 'الرقم أو الإيميل ده مسجل قبل كده' });

  const password_hash = await hashPassword(password);
  const parent_token = crypto.randomBytes(24).toString('base64url');
  const { data: created, error } = await supabase
    .from('students')
    .insert({ first_name, last_name, phone, email, password_hash, parent_token })
    .select('id, first_name, last_name, phone, email, avatar_url, phone_verified')
    .single();

  if (error) {
    if (String(error.code) === '23505') return res.status(409).json({ error: 'الرقم أو الإيميل ده مسجل قبل كده' });
    return res.status(500).json({ error: 'حصل خطأ أثناء إنشاء الحساب' });
  }

  setStudentSession(res, created.id, password_hash);
  return res.status(201).json({ student: created });
};
