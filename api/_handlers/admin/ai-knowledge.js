const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { logAdminAction } = require('../../_lib/admin-audit');
const { applyCors } = require('../../_lib/cors');

// GET    /api/admin/ai-knowledge            -> هات كل محتوى المنهج المتاح للمساعد الذكي
// POST   /api/admin/ai-knowledge            -> ضيف درس جديد   body: { title, content }
// DELETE /api/admin/ai-knowledge?id=...     -> احذف درس
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1096-1133 omitted */
  return res.status(405).json({ error: 'Method not allowed' });
};
