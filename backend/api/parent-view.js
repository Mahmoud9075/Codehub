const { supabase } = require('./_supabase');
const { applyCors } = require('./_cors');

// GET /api/parent-view?token=...
// صفحة عامة (من غير تسجيل دخول) — ولي الأمر بيشوف بيها اسم ابنه وتقدّمه بس، من غير أي بيانات حساسة
// (مفيش إيميل ولا باسورد ولا رقم موبايل هنا).
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'اللينك غير صحيح' });

  const { data: student } = await supabase
    .from('students')
    .select('id, first_name, last_name')
    .eq('parent_token', token)
    .maybeSingle();

  if (!student) return res.status(404).json({ error: 'اللينك غير صحيح أو منتهي' });

  const { data: results } = await supabase
    .from('results')
    .select('score, total, completed_at, quizzes ( title, months ( name, order_index ) )')
    .eq('student_id', student.id)
    .order('completed_at', { ascending: false });

  const rows = (results || []).map((r) => ({
    month: r.quizzes?.months?.name,
    quiz: r.quizzes?.title,
    score: r.score,
    total: r.total,
    completed_at: r.completed_at,
  }));

  const totalScore = rows.reduce((sum, r) => sum + r.score, 0);
  const totalMax = rows.reduce((sum, r) => sum + r.total, 0);
  const average = totalMax ? Math.round((totalScore / totalMax) * 100) : null;

  return res.status(200).json({
    student: { first_name: student.first_name, last_name: student.last_name },
    quizzes_completed: rows.length,
    average_percent: average,
    results: rows,
  });
};
