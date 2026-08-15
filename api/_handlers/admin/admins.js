const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { logAdminAction } = require('../../_lib/admin-audit');
const { applyCors } = require('../../_lib/cors');

// GET  /api/admin/admins        -> هات كل الإيميلات المسموح لها تدخل كأدمن
// POST /api/admin/admins        -> ضيف إيميل جديد    body: { email }
// DELETE /api/admin/admins?email=...  -> امسح إيميل
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1045-1080 omitted */
  return res.status(405).json({ error: 'Method not allowed' });
};
