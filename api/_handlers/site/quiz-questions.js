const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// GET /api/quiz-questions?quiz_id=...
// بيرجع أسئلة الكويز عشان الطالب يجاوب عليها — من غير ما يبين الإجابة الصح
// (عشان محدش يقدر يغش بفتح كود الصفحة).
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 715-731 omitted */
  return res.status(200).json({ questions: data });
};
