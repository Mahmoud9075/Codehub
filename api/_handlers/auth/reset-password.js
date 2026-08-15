const bcrypt = require('bcryptjs');
const { supabase } = require('../../_lib/supabase');
const { validatePassword } = require('../../_lib/auth-validators');
const { applyCors } = require('../../_lib/cors');

// POST /api/auth/reset-password   body: { phone, code, new_password }
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1873-1918 omitted */
  return res.status(200).json({ ok: true });
};
