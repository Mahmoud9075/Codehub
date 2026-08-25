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

  // بنرجع رسالة واضحة لو الإيميل مش أدمن، عشان يبان له إنه لازم يتسجل الأول
  // (ملحوظة أمان: ده بيسمح لأي حد يجرّب إيميلات عشوائية يعرف مين أدمن ومين لأ —
  // لو حابب تحافظ على السرية أكتر، قولّي نرجعها زي ما كانت.)
  if (!superAdmin) {
    await new Promise((r) => setTimeout(r, 400));
    return res.status(403).json({ error: 'الإيميل ده مش مسجل كأدمن. اطلب من المدير الأساسي يضيفك.' });
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

  // Do not tell the UI that the code was sent when the mail provider is not
  // configured or rejected the message. Also invalidate the unusable code.
  if (!emailResult.sent) {
    await supabase.from('super_admin_otps').delete().eq('email', superAdmin.email).eq('code', code);
    console.error('Admin OTP email failed:', emailResult.reason || 'unknown mail error');
    return res.status(503).json({
      error: 'تعذر إرسال كود الدخول. تأكد من إعداد بريد الإرسال على Vercel ثم حاول مرة أخرى.',
    });
  }

  return res.status(200).json({
    ok: true,
    message: 'تم إرسال كود التحقق إلى بريدك. راجع البريد الوارد والرسائل غير المرغوب فيها.',
    email_sent: true,
  });
};
