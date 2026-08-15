const bcrypt = require('bcryptjs');
const { supabase } = require('../../_lib/supabase');
const { validateName, validateEmail, validatePassword, validatePhone, normalizeEmail, isDisposableEmail, withinMaxLength, MAX_LENGTHS } = require('../../_lib/auth-validators');
const { applyCors } = require('../../_lib/cors');

// POST /api/auth/register
// body: { first_name, last_name, phone, email, password }
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let { first_name, last_name, phone, email, password } = req.body || {};

  if (!first_name || !last_name || !phone || !email || !password) {
    return res.status(400).json({ error: 'كل الحقول مطلوبة' });
  }
  if (!withinMaxLength(first_name, MAX_LENGTHS.name) || !withinMaxLength(last_name, MAX_LENGTHS.name)) {
    return res.status(400).json({ error: 'الاسم طويل قوي' });
  }
  if (!validateName(first_name) || !validateName(last_name)) {
    return res.status(400).json({ error: 'الاسم يقبل حروف عربي أو إنجليزي بس، من غير أرقام أو رموز' });
  }
  if (!validatePhone(phone)) {
    return res.status(400).json({ error: 'اكتب رقم موبايل مصري صحيح (11 رقم، يبدأ بـ 010 أو 011 أو 012 أو 015)' });
  }
  email = normalizeEmail(email);
  if (!withinMaxLength(email, MAX_LENGTHS.email)) {
    return res.status(400).json({ error: 'الإيميل طويل قوي' });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'اكتب إيميل صحيح' });
  }
  if (isDisposableEmail(email)) {
    return res.status(400).json({ error: 'من فضلك استخدم إيميل حقيقي، مش إيميل مؤقت' });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({ error: 'الباسورد لازم 8 حروف على الأقل، وفيه حرف كابيتال وحرف سمول ورقم ورمز' });
  }

  const { data: existing } = await supabase
    .from('students')
    .select('id')
    .or(`phone.eq.${phone},email.eq.${email}`)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'الرقم أو الإيميل ده مسجل قبل كده' });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { data: created, error } = await supabase
    .from('students')
    .insert({ first_name, last_name, phone, email, password_hash })
    .select('id, first_name, last_name, phone, email, avatar_url, phone_verified')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Ensure we never return sensitive fields or auto-login tokens after registration
  if (created && created.password_hash) delete created.password_hash;
  if (created && created.parent_token) delete created.parent_token;

  return res.status(201).json({ student: created });
};
