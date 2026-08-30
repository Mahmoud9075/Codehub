const { supabase } = require('./supabase');

async function getPassPercent() {
  const { data } = await supabase
    .from('site_settings')
    .select('final_exam_pass_percent')
    .eq('id', 1)
    .maybeSingle();
  const parsed = Number(data?.final_exam_pass_percent);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, parsed)) : 70;
}

async function isMonthUnlocked(studentId, monthId, passPercent) {
  const { data: months, error: monthsError } = await supabase
    .from('months')
    .select('id, order_index')
    .order('order_index', { ascending: true });
  if (monthsError) throw monthsError;

  const targetIndex = (months || []).findIndex((month) => String(month.id) === String(monthId));
  if (targetIndex < 0) return false;
  if (targetIndex === 0) return true;

  const priorMonthIds = months.slice(0, targetIndex).map((month) => month.id);
  const { data: finals, error: finalsError } = await supabase
    .from('quizzes')
    .select('id, month_id')
    .eq('type', 'final')
    .in('month_id', priorMonthIds);
  if (finalsError) throw finalsError;

  const finalByMonth = Object.fromEntries((finals || []).map((quiz) => [String(quiz.month_id), quiz.id]));
  const finalIds = (finals || []).map((quiz) => quiz.id);
  const { data: results, error: resultsError } = await supabase
    .from('results')
    .select('quiz_id, score, total')
    .eq('student_id', studentId)
    .in('quiz_id', finalIds.length ? finalIds : ['00000000-0000-0000-0000-000000000000']);
  if (resultsError) throw resultsError;

  const resultByQuiz = Object.fromEntries((results || []).map((result) => [String(result.quiz_id), result]));
  for (const priorMonth of months.slice(0, targetIndex)) {
    const finalId = finalByMonth[String(priorMonth.id)];
    const result = finalId ? resultByQuiz[String(finalId)] : null;
    if (!result || !result.total) return false;
    const percent = Math.round((result.score / result.total) * 100);
    if (percent < passPercent) return false;
  }
  return true;
}

async function getQuizAccess(studentId, quizId) {
  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select('id, month_id, type, order_index')
    .eq('id', quizId)
    .maybeSingle();
  if (quizError) throw quizError;
  if (!quiz) return { exists: false, status: 'locked' };

  const passPercent = await getPassPercent();
  const monthUnlocked = await isMonthUnlocked(studentId, quiz.month_id, passPercent);
  if (!monthUnlocked) return { exists: true, quiz, passPercent, status: 'locked', monthUnlocked: false };

  const { data: allQuizzes, error: listError } = await supabase
    .from('quizzes')
    .select('id, type, order_index')
    .eq('month_id', quiz.month_id)
    .order('order_index', { ascending: true });
  if (listError) throw listError;

  const quizIds = (allQuizzes || []).map((item) => item.id);
  const { data: results, error: resultsError } = await supabase
    .from('results')
    .select('quiz_id, score, total')
    .eq('student_id', studentId)
    .in('quiz_id', quizIds.length ? quizIds : ['00000000-0000-0000-0000-000000000000']);
  if (resultsError) throw resultsError;

  const resultByQuiz = Object.fromEntries((results || []).map((result) => [String(result.quiz_id), result]));
  const weekly = (allQuizzes || []).filter((item) => item.type !== 'final');
  const finalQuiz = (allQuizzes || []).find((item) => item.type === 'final');

  let previousCompleted = true;
  const weeklyStatus = {};
  weekly.forEach((item) => {
    const result = resultByQuiz[String(item.id)];
    const status = result ? 'completed' : (previousCompleted ? 'unlocked' : 'locked');
    weeklyStatus[String(item.id)] = status;
    // Once there is a gap, later historical results must not reopen the sequence.
    previousCompleted = previousCompleted && Boolean(result);
  });

  if (quiz.type !== 'final') {
    return {
      exists: true,
      quiz,
      passPercent,
      monthUnlocked: true,
      status: weeklyStatus[String(quiz.id)] || 'locked',
      result: resultByQuiz[String(quiz.id)] || null,
    };
  }

  const allWeeklyDone = weekly.every((item) => Boolean(resultByQuiz[String(item.id)]));
  const finalResult = finalQuiz ? resultByQuiz[String(finalQuiz.id)] : null;
  const passed = Boolean(finalResult && finalResult.total && Math.round((finalResult.score / finalResult.total) * 100) >= passPercent);
  const status = passed ? 'completed' : (allWeeklyDone ? 'unlocked' : 'locked');

  return {
    exists: true,
    quiz,
    passPercent,
    monthUnlocked: true,
    status,
    result: finalResult || null,
    passed,
  };
}

module.exports = { getPassPercent, isMonthUnlocked, getQuizAccess };
