const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// POST /api/auth/verify-phone-otp   body: { student_id, code }
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1996-2028 omitted */
  return res.status(200).json({ ok: true, student });
};
