const nodemailer = require('nodemailer');

// بيبعت إيميلات حقيقية عن طريق Gmail — محتاج إيميل Gmail + "App Password" (كلمة سر تطبيقات،
// مش الباسورد العادي بتاع الحساب). طريقة عملها:
// 1. فعّل "التحقق بخطوتين" على حساب الـ Gmail بتاعك من myaccount.google.com/security
// 2. روح myaccount.google.com/apppasswords واعمل App Password جديد
// 3. حط الإيميل في ADMIN_EMAIL_SENDER، والكود اللي هيديهولك (16 حرف) في GMAIL_APP_PASS
//    (في Environment Variables على فيرسيل)

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const sender = String(process.env.ADMIN_EMAIL_SENDER || process.env.SMTP_USER || '').trim();
  // Google displays app passwords in groups. Remove copied spaces/newlines and
  // accidental wrapping quotes before authenticating.
  const password = String(process.env.GMAIL_APP_PASS || process.env.SMTP_PASS || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, '');
  if (!sender || !password) return null;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER || sender, pass: password },
    });
  } else {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: sender, pass: password },
    });
  }
  return transporter;
}

async function sendOtpEmail(toEmail, code) {
  const t = getTransporter();
  if (!t) {
    return { sent: false, reason: 'ADMIN_EMAIL_SENDER أو GMAIL_APP_PASS مش متظبطين لسه' };
  }

  await t.sendMail({
    from: `"Code Hub 🔐" <${process.env.ADMIN_EMAIL_SENDER || process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `🔐 كود دخول لوحة تحكم Code Hub: ${code}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;background:#1a2142;border-radius:16px;padding:32px;text-align:center;">
        <h2 style="color:#b6913b;font-size:24px;margin-bottom:8px;">Code Hub</h2>
        <p style="color:#dfd9c8;font-size:14px;margin-bottom:24px;">كود الدخول للوحة التحكم</p>
        <div style="background:#241a17;border-radius:12px;padding:22px;margin:16px 0;border:2px solid #b6913b;">
          <div style="color:#b6913b;font-size:13px;letter-spacing:2px;margin-bottom:8px;">الكود السري</div>
          <div style="color:#fff;font-size:34px;font-weight:800;letter-spacing:8px;">${code}</div>
        </div>
        <p style="color:#a89f8c;font-size:12px;">الكود صالح 10 دقايق. لو محدش طلب الكود ده، تجاهل الإيميل ده.</p>
      </div>
    `,
  });

  return { sent: true };
}

// بيبعت كود تحقق لإيميل الطالب — مستخدمة في التحقق من الموبايل واستعادة كلمة السر.
// purpose: 'verify' (تحقق من الموبايل) أو 'reset' (استعادة كلمة السر) — بس بيغيّر نص الرسالة.
async function sendStudentOtpEmail(toEmail, code, purpose) {
  const t = getTransporter();
  if (!t) {
    return { sent: false, reason: 'ADMIN_EMAIL_SENDER أو GMAIL_APP_PASS مش متظبطين لسه' };
  }

  const isReset = purpose === 'reset';
  const title = isReset ? 'استعادة كلمة السر' : 'التحقق من رقم الموبايل';
  const subject = isReset
    ? `🔑 كود استعادة كلمة السر في Code Hub: ${code}`
    : `📱 كود التحقق من الموبايل في Code Hub: ${code}`;

  await t.sendMail({
    from: `"Code Hub" <${process.env.ADMIN_EMAIL_SENDER || process.env.SMTP_USER}>`,
    to: toEmail,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;background:#1a2142;border-radius:16px;padding:32px;text-align:center;">
        <h2 style="color:#2f6fed;font-size:24px;margin-bottom:8px;">Code Hub</h2>
        <p style="color:#dfd9c8;font-size:14px;margin-bottom:24px;">${title}</p>
        <div style="background:#0f1730;border-radius:12px;padding:22px;margin:16px 0;border:2px solid #2f6fed;">
          <div style="color:#8fb8ff;font-size:13px;letter-spacing:2px;margin-bottom:8px;">الكود السري</div>
          <div style="color:#fff;font-size:34px;font-weight:800;letter-spacing:8px;">${code}</div>
        </div>
        <p style="color:#a89f8c;font-size:12px;">الكود صالح لمدة محدودة. لو محدش طلب الكود ده، تجاهل الإيميل ده.</p>
      </div>
    `,
  });

  return { sent: true };
}

module.exports = { sendOtpEmail, sendStudentOtpEmail };
