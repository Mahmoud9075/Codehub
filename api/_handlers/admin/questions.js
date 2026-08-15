const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { logAdminAction } = require('../../_lib/admin-audit');
const { applyCors } = require('../../_lib/cors');
const { withinMaxLength, MAX_LENGTHS } = require('../../_lib/auth-validators');

// GET    /api/admin/questions?quiz_id=...           -> هات كل أسئلة الكويز ده
// POST   /api/admin/questions                        -> ضيف سؤال جديد
//   body: { quiz_id, question_text, options: [...], correct_index, order_index }
// PUT    /api/admin/questions                        -> عدّل سؤال موجود
//   body: { id, question_text, options, correct_index, order_index }
// DELETE /api/admin/questions?id=...                 -> امسح سؤال
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1388-1451 omitted */
  return res.status(405).json({ error: 'Method not allowed' });
};
