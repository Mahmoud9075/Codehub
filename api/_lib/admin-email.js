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
  /* Lines 305-313 omitted */
  return transporter;
}

async function sendOtpEmail(toEmail, code) {
  const t = getTransporter();
  /* Lines 318-339 omitted */
  return { sent: true };
}

module.exports = { sendOtpEmail };
