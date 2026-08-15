const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { sendOtpEmail } = require('../../_lib/admin-email');

// POST /api/admin/super-login-request   body: { email }
// بيولّد كود من 6 أرقام صالح 10 دقايق ويبعته على الإيميل فعليًا (عن طريق Gmail).
// لو GMAIL_APP_PASS مش متظبط لسه، الكود بيتسجل في القاعدة بس من غير ما يتبعت.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'الإيميل مطلوب' });

  const normalizedEmail = email.toLowerCase().trim();

  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  // بنرجع نفس الرسالة دايمًا، حتى لو الإيميل مش أدمن رئيسي، عشان محدش يتأكد مين الأدمن
  if (!superAdmin) {
    await new Promise((r) => setTimeout(r, 800)); // تأخير بسيط عشان محدش يعرف الفرق بسرعة الرد
    return res.status(200).json({ ok: true, message: 'لو الإيميل ده أدمن، هيوصله كود التحقق.' });
  }

  // حماية بسيطة: لو فيه محاولات كتير في آخر 10 دقايق، منمنعش الإرسال بس نأجّل
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recentCodes } = await supabase
    .from('super_admin_otps')
    .select('id')
    .eq('email', superAdmin.email)
    .gte('created_at', tenMinutesAgo);

  if (recentCodes && recentCodes.length >= 5) {
    return res.status(429).json({ error: 'طلبت أكواد كتير. استنى شوية وحاول تاني.' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('super_admin_otps')
    .insert({ email: superAdmin.email, code, expires_at });

  if (error) return res.status(500).json({ error: error.message });

  const emailResult = await sendOtpEmail(superAdmin.email, code).catch((e) => ({ sent: false, reason: e.message }));

  return res.status(200).json({
    ok: true,
    message: 'لو الإيميل ده أدمن، هيوصله كود التحقق.',
    email_sent: emailResult.sent, // مفيد وقت التجربة عشان تعرف لو الإرسال شغّال فعلاً
  });
};
