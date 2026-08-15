const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { sendOtpEmail } = require('../../_lib/admin-email');

// POST /api/admin/super-login-request   body: { email }
// بيولّد كود من 6 أرقام صالح 10 دقايق ويبعته على الإيميل فعليًا (عن طريق Gmail).
// لو GMAIL_APP_PASS مش متظبط لسه، الكود بيتسجل في القاعدة بس من غير ما يتبعت.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1556-1605 omitted */
  });
};
