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

  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });

  if (req.method === 'GET') {
    const { quiz_id } = req.query;
    if (!quiz_id) return res.status(400).json({ error: 'quiz_id مطلوب' });

    const { data, error } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quiz_id)
      .order('order_index', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ questions: data });
  }

  if (req.method === 'POST') {
    const { quiz_id, question_text, options, correct_index, order_index } = req.body || {};
    if (!quiz_id || !question_text || !options || correct_index == null) {
      return res.status(400).json({ error: 'بيانات ناقصة' });
    }
    if (!withinMaxLength(question_text, MAX_LENGTHS.question)) {
      return res.status(400).json({ error: 'نص السؤال طويل قوي' });
    }
    const { data, error } = await supabase
      .from('quiz_questions')
      .insert({ quiz_id, question_text, options, correct_index, order_index: order_index || 1 })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    await logAdminAction(auth.identity, 'add_question', { quiz_id, question_text });
    return res.status(201).json({ question: data });
  }

  if (req.method === 'PUT') {
    const { id, question_text, options, correct_index, order_index } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id مطلوب' });

    const { data, error } = await supabase
      .from('quiz_questions')
      .update({ question_text, options, correct_index, order_index })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    await logAdminAction(auth.identity, 'update_question', { id, question_text });
    return res.status(200).json({ question: data });
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
