const bcrypt = require('bcryptjs');
const { supabase } = require('../../_lib/supabase');
const { validateName, validateEmail, validatePassword, validatePhone, normalizeEmail, isDisposableEmail, withinMaxLength, MAX_LENGTHS } = require('../../_lib/auth-validators');
const { applyCors } = require('../../_lib/cors');

// POST /api/auth/register
// body: { first_name, last_name, phone, email, password }
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1770-1823 omitted */
  return res.status(201).json({ student: created });
};
