const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { logAdminAction } = require('../../_lib/admin-audit');
const { applyCors } = require('../../_lib/cors');

// GET  /api/admin/content   -> هات كل نصوص الموقع (مرتبة حسب القسم)
// POST /api/admin/content   -> عدّل نص، أو ارجع لآخر نسخة
//   body: { key, value }              -> يعدّل النص
//   body: { key, rollback: true }     -> يرجّع النص لآخر قيمة كانت قبل التعديل الحالي
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1269-1327 omitted */
  return res.status(405).json({ error: 'Method not allowed' });
};
