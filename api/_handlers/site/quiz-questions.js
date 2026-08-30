const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { requireStudent } = require('../../_lib/student-auth');
const { getQuizAccess } = require('../../_lib/quiz-access');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const quizId = String(req.query.quiz_id || '').trim();
  if (!quizId) return res.status(400).json({ error: 'quiz_id مطلوب' });

  const session = await requireStudent(req, res);
  if (!session) return;

  let access;
  try { access = await getQuizAccess(session.id, quizId); }
  catch (error) { return res.status(500).json({ error: 'تعذر التحقق من الكويز' }); }
  if (!access.exists) return res.status(404).json({ error: 'الكويز مش موجود' });
  if (access.status === 'locked') return res.status(403).json({ error: 'الكويز ده لسه مقفول' });

  const { data, error } = await supabase
    .from('quiz_questions')
    .select('id, question_text, options, order_index')
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: true });
  if (error) return res.status(500).json({ error: 'تعذر تحميل الأسئلة' });

  const questions = (data || []).map((row) => {
    if (Array.isArray(row.options)) return { ...row, question_type: 'multiple_choice', type_label: 'اختياري', answer_mode: 'choice' };
    const meta = row.options && typeof row.options === 'object' ? row.options : {};
    return {
      id: row.id,
      question_text: row.question_text,
      order_index: row.order_index,
      options: Array.isArray(meta.choices) ? meta.choices : [],
      question_type: meta.type || 'multiple_choice',
      type_label: meta.type_label || 'اختياري',
      answer_mode: meta.answer_mode || 'choice',
    };
  });
  return res.status(200).json({ questions });
};
