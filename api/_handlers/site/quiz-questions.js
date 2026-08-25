const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { quiz_id } = req.query;
  if (!quiz_id) return res.status(400).json({ error: 'quiz_id مطلوب' });
  const { data, error } = await supabase.from('quiz_questions').select('id, question_text, options, order_index').eq('quiz_id', quiz_id).order('order_index', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  const questions = (data || []).map((row) => {
    if (Array.isArray(row.options)) return { ...row, question_type: 'multiple_choice', type_label: 'اختياري', answer_mode: 'choice' };
    const meta = row.options && typeof row.options === 'object' ? row.options : {};
    return { id: row.id, question_text: row.question_text, order_index: row.order_index, options: Array.isArray(meta.choices) ? meta.choices : [], question_type: meta.type || 'multiple_choice', type_label: meta.type_label || 'اختياري', answer_mode: meta.answer_mode || 'choice' };
  });
  return res.status(200).json({ questions });
};
