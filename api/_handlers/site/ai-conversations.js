const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// GET /api/ai-conversations?student_id=...              -> قايمة كل محادثات الطالب (للسايد بار)
// GET /api/ai-conversations?student_id=...&id=...        -> محادثة واحدة كاملة (لما يدوس عليها يفتحها)
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 520-549 omitted */
  return res.status(200).json({ conversations: data });
};
