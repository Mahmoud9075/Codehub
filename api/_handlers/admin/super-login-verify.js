const crypto = require('crypto');
const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// POST /api/admin/super-login-verify   body: { email, code }
// لو الكود صح، بيرجّع توقيع (signature) — الفرونت إند بيحفظه ويبعته في كل طلب أدمن بعد كده
// جوه هيدرز x-super-admin-email و x-super-admin-sig.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1620-1654 omitted */
  return res.status(200).json({ ok: true, email: normalizedEmail, signature });
};
