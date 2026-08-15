const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// GET /api/months?student_id=...
// بيرجع كل الشهور مرتبة، وكل شهر معاه حالته لنفس الطالب:
// "locked" (لسه مقفول لأن الشهر اللي قبله محتاج نجاح 70% في الاختبار النهائي) / "unlocked" / "completed"
// من غير student_id بيرجع الشهور من غير حالة (استخدام قديم / لوحة التحكم).
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id } = req.query;

  const { data: months, error } = await supabase
    .from('months')
    .select('*')
    .order('order_index', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  if (!student_id) {
    return res.status(200).json({ months });
  }

  const { data: settings } = await supabase.from('site_settings').select('final_exam_pass_percent').eq('id', 1).maybeSingle();
  const passPercent = settings?.final_exam_pass_percent || 70;

  const { data: finalExams } = await supabase.from('quizzes').select('id, month_id').eq('type', 'final');
  const finalExamByMonth = Object.fromEntries((finalExams || []).map((f) => [f.month_id, f.id]));
  const finalExamIds = (finalExams || []).map((f) => f.id);

  const { data: results } = await supabase
    .from('results')
    .select('quiz_id, score, total')
    .eq('student_id', student_id)
    .in('quiz_id', finalExamIds.length ? finalExamIds : ['00000000-0000-0000-0000-000000000000']);

  const resultByQuizId = Object.fromEntries((results || []).map((r) => [r.quiz_id, r]));

  let previousPassed = true; // أول شهر دايمًا مفتوح
  const monthsWithStatus = months.map((month) => {
    const finalExamId = finalExamByMonth[month.id];
    const finalResult = finalExamId ? resultByQuizId[finalExamId] : null;
    const passed = finalResult ? Math.round((finalResult.score / finalResult.total) * 100) >= passPercent : false;

    let status;
    if (passed) status = 'completed';
    else if (previousPassed) status = 'unlocked';
    else status = 'locked';

    previousPassed = passed;
    return { ...month, status };
  });

  return res.status(200).json({ months: monthsWithStatus });
};
