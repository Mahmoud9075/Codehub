const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { applyCors } = require('../../_lib/cors');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const monthId = String(req.query.month_id || '').trim();
  if (!monthId) return res.status(400).json({ error: 'month_id مطلوب' });
  const { data, error } = await supabase
    .from('quizzes')
    .select('id, month_id, title, type, week_number, quiz_number_in_week, order_index')
    .eq('month_id', monthId)
    .order('order_index', { ascending: true });
  if (error) return res.status(500).json({ error: 'تعذر تحميل الكويزات' });

  const quizzes = await Promise.all((data || []).map(async (quiz) => {
    const { count } = await supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', quiz.id);
    return { ...quiz, question_count: count || 0 };
  }));
  return res.status(200).json({ quizzes });
};
