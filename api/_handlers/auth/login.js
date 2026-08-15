const bcrypt = require('bcryptjs');
const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// POST /api/auth/login   body: { phone, password }
// محمي من التخمين العشوائي: 5 محاولات غلط بس من نفس الجهاز كل 10 دقايق.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1716-1755 omitted */
  return res.status(200).json({ student });
};
