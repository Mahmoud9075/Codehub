const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { logAdminAction } = require('../../_lib/admin-audit');
const { applyCors } = require('../../_lib/cors');

// GET  /api/admin/settings   -> هات الإعدادات الحالية
// POST /api/admin/settings   -> عدّل الإعدادات
//   body: { maintenance_mode?: boolean, hidden_sections?: string[] }
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1513-1541 omitted */
  return res.status(405).json({ error: 'Method not allowed' });
};
