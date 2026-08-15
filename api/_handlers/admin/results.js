const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { logAdminAction } = require('../../_lib/admin-audit');
const { applyCors } = require('../../_lib/cors');

// GET /api/admin/results
// ده اللي هيوريك "اسم الطالب + نتيجته" في كل الكويزات اللي خلصها.
// محمي بنفس نظام دخول الأدمن (PIN أو جوجل).
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1466-1497 omitted */
  return res.status(200).json({ results: rows });
};
