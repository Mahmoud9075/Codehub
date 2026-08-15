const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { applyCors } = require('../../_lib/cors');

// GET /api/admin/audit-log
// بيرجع آخر 200 حركة اتعملت من أي أدمن (تعديل إعدادات، إضافة/حذف سؤال، إضافة/حذف أدمن...)
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1236-1252 omitted */
  return res.status(200).json({ log: data });
};
