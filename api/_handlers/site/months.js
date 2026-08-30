const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { requireStudent } = require('../../_lib/student-auth');
const { getPassPercent } = require('../../_lib/quiz-access');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { data: months, error } = await supabase.from('months').select('id, name, order_index').order('order_index', { ascending: true });
  if (error) return res.status(500).json({ error: 'تعذر تحميل الشهور' });

  if (String(req.query.mine || '') !== '1') return res.status(200).json({ months: months || [] });

  const session = await requireStudent(req, res);
  if (!session) return;
  const studentId = session.id;
  const passPercent = await getPassPercent();

  const { data: finalExams, error: finalsError } = await supabase.from('quizzes').select('id, month_id').eq('type', 'final');
  if (finalsError) return res.status(500).json({ error: 'تعذر تحميل الاختبارات' });
  const finalExamByMonth = Object.fromEntries((finalExams || []).map((item) => [String(item.month_id), item.id]));
  const finalExamIds = (finalExams || []).map((item) => item.id);

  const { data: results, error: resultsError } = await supabase
    .from('results')
    .select('quiz_id, score, total')
    .eq('student_id', studentId)
    .in('quiz_id', finalExamIds.length ? finalExamIds : ['00000000-0000-0000-0000-000000000000']);
  if (resultsError) return res.status(500).json({ error: 'تعذر تحميل تقدمك' });

  const resultByQuizId = Object.fromEntries((results || []).map((item) => [String(item.quiz_id), item]));
  let previousPassed = true;
  const monthsWithStatus = (months || []).map((month) => {
    const finalExamId = finalExamByMonth[String(month.id)];
    const finalResult = finalExamId ? resultByQuizId[String(finalExamId)] : null;
    const passed = Boolean(finalResult?.total && Math.round((finalResult.score / finalResult.total) * 100) >= passPercent);
    const status = passed ? 'completed' : (previousPassed ? 'unlocked' : 'locked');
    // Keep the prerequisite chain strict even if legacy data contains later results.
    previousPassed = previousPassed && passed;
    return { ...month, status };
  });

  return res.status(200).json({ months: monthsWithStatus, pass_percent: passPercent });
};
