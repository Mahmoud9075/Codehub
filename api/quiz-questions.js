const { supabase } = require('./_supabase');
const { applyCors } = require('./_cors');

// GET /api/quiz-questions?quiz_id=...
// بيرجع أسئلة الكويز عشان الطالب يجاوب عليها — من غير ما يبين الإجابة الصح
// (عشان محدش يقدر يغش بفتح كود الصفحة).
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { quiz_id } = req.query;
  if (!quiz_id) return res.status(400).json({ error: 'quiz_id مطلوب' });

  const { data, error } = await supabase
    .from('quiz_questions')
    .select('id, question_text, options, order_index')
    .eq('quiz_id', quiz_id)
    .order('order_index', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ questions: data });
};
