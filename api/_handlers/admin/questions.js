const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { logAdminAction } = require('../../_lib/admin-audit');
const { applyCors } = require('../../_lib/cors');
const { withinMaxLength, MAX_LENGTHS } = require('../../_lib/auth-validators');

const TYPE_LABELS = { multiple_choice: 'اختياري', true_false: 'صح أو غلط', fill_blank: 'أكمل', essay: 'مقالي', custom: 'نوع مخصص' };
const cleanText = (value, max = 2000) => String(value == null ? '' : value).trim().slice(0, max);

function expandQuestion(row) {
  if (Array.isArray(row.options)) return { ...row, question_type: 'multiple_choice', type_label: 'اختياري', custom_type_name: '', answer_mode: 'choice', correct_answer: row.options[row.correct_index] || '', similarity_threshold: 1 };
  const meta = row.options && typeof row.options === 'object' ? row.options : {};
  return { ...row, options: Array.isArray(meta.choices) ? meta.choices : [], question_type: meta.type || 'multiple_choice', type_label: meta.type_label || TYPE_LABELS[meta.type] || 'اختياري', custom_type_name: meta.custom_type_name || '', answer_mode: meta.answer_mode || 'choice', correct_answer: meta.correct_answer || '', similarity_threshold: Number(meta.similarity_threshold || 0.6) };
}

function prepareQuestion(body) {
  const questionType = TYPE_LABELS[body.question_type] ? body.question_type : 'multiple_choice';
  const customTypeName = questionType === 'custom' ? cleanText(body.custom_type_name, 60) : '';
  if (questionType === 'custom' && !customTypeName) throw new Error('اكتب اسم النوع المخصص');
  const answerMode = questionType === 'custom' ? (body.answer_mode === 'text' ? 'text' : 'choice') : (questionType === 'multiple_choice' || questionType === 'true_false' ? 'choice' : 'text');
  let choices = [];
  let correctIndex = Number(body.correct_index || 0);
  let correctAnswer = cleanText(body.correct_answer, 2000);
  if (answerMode === 'choice') {
    choices = questionType === 'true_false' ? ['صح', 'خطأ'] : (Array.isArray(body.options) ? body.options.map((item) => cleanText(item, 300)).filter(Boolean) : []);
    if (choices.length < 2 || choices.length > 6) throw new Error('اكتب من اختيارين إلى 6 اختيارات');
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= choices.length) throw new Error('حدد الإجابة الصحيحة');
    correctAnswer = choices[correctIndex];
  } else if (!correctAnswer) throw new Error('اكتب الإجابة النموذجية');
  let threshold = Number(body.similarity_threshold);
  if (!Number.isFinite(threshold)) threshold = questionType === 'essay' ? 0.55 : 0.7;
  threshold = Math.max(0.3, Math.min(1, threshold));
  return { question_text: cleanText(body.question_text, MAX_LENGTHS.question), options: { schema_version: 2, type: questionType, type_label: customTypeName || TYPE_LABELS[questionType], custom_type_name: customTypeName, answer_mode: answerMode, choices, correct_answer: correctAnswer, similarity_threshold: threshold }, correct_index: answerMode === 'choice' ? correctIndex : 0, order_index: Math.max(1, Number(body.order_index) || 1) };
}

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });
  if (req.method === 'GET') {
    const { quiz_id } = req.query;
    if (!quiz_id) return res.status(400).json({ error: 'quiz_id مطلوب' });
    const { data, error } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quiz_id).order('order_index', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ questions: (data || []).map(expandQuestion) });
  }
  if (req.method === 'POST') {
    const { quiz_id } = req.body || {};
    if (!quiz_id || !req.body.question_text) return res.status(400).json({ error: 'بيانات ناقصة' });
    if (!withinMaxLength(req.body.question_text, MAX_LENGTHS.question)) return res.status(400).json({ error: 'نص السؤال طويل قوي' });
    let prepared; try { prepared = prepareQuestion(req.body); } catch (error) { return res.status(400).json({ error: error.message }); }
    const { data, error } = await supabase.from('quiz_questions').insert({ quiz_id, ...prepared }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await logAdminAction(auth.identity, 'add_question', { quiz_id, question_text: prepared.question_text, type: prepared.options.type });
    return res.status(201).json({ question: expandQuestion(data) });
  }
  if (req.method === 'PUT') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id مطلوب' });
    let prepared; try { prepared = prepareQuestion(req.body); } catch (error) { return res.status(400).json({ error: error.message }); }
    const { data, error } = await supabase.from('quiz_questions').update(prepared).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await logAdminAction(auth.identity, 'update_question', { id, question_text: prepared.question_text, type: prepared.options.type });
    return res.status(200).json({ question: expandQuestion(data) });
  }
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id مطلوب' });
    const { error } = await supabase.from('quiz_questions').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    await logAdminAction(auth.identity, 'delete_question', { id });
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
};
