const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { applyCors } = require('../../_lib/cors');

// GET /api/admin/ai-questions
// بيرجع أكتر الأسئلة اللي بيسألها الطلاب للمساعد الذكي، مرتبة الأحدث الأول،
// عشان تعرف الأجزاء اللي محتاجة توضيح أكتر في الشرح.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1148-1175 omitted */
  return res.status(200).json({ total_questions: data.length, top_questions: topQuestions });
};
