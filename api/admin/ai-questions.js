const { supabase } = require('../_supabase');
const { isAuthorized } = require('./_auth');
const { applyCors } = require('../_cors');

// GET /api/admin/ai-questions
// بيرجع أكتر الأسئلة اللي بيسألها الطلاب للمساعد الذكي، مرتبة الأحدث الأول،
// عشان تعرف الأجزاء اللي محتاجة توضيح أكتر في الشرح.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data, error } = await supabase
    .from('ai_chat_log')
    .select('question, answer_source, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ error: error.message });

  // تجميع الأسئلة المتشابهة (نص مطابق تمامًا) عشان نعرف الأكتر تكرارًا
  const counts = {};
  (data || []).forEach((row) => {
    const key = row.question.trim().toLowerCase();
    counts[key] = counts[key] || { question: row.question, count: 0, last_asked: row.created_at, general: 0 };
    counts[key].count++;
    if (row.answer_source === 'general_knowledge') counts[key].general++;
  });

  const topQuestions = Object.values(counts).sort((a, b) => b.count - a.count);

  return res.status(200).json({ total_questions: data.length, top_questions: topQuestions });
};
