const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// POST /api/auth/request-phone-otp   body: { student_id }
// بيولّد كود من 6 أرقام صالح 10 دقايق.

// ⚠️ ملحوظة: الكود لسه مش بيتبعت SMS فعليًا — محتاج ربط بخدمة زي Twilio (لها رصيد مجاني بسيط للتجربة).
// لحد ما نعملها، الكود بيتسجل في جدول phone_otps بس.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1839-1859 omitted */
  return res.status(200).json({ ok: true, message: 'الكود اتبعت (أو هيبان في السجل لحد ما يتفعّل الإرسال الآلي).' });
};
