const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { requireStudent } = require('../../_lib/student-auth');
const { getPassPercent, isMonthUnlocked } = require('../../_lib/quiz-access');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const monthId = String(req.query.month_id || '').trim();
  if (!monthId) return res.status(400).json({ error: 'month_id مطلوب' });
  const session = await requireStudent(req, res);
  if (!session) return;
  const studentId = session.id;

  const passPercent = await getPassPercent();
  let monthUnlocked = false;
  try { monthUnlocked = await isMonthUnlocked(studentId, monthId, passPercent); }
  catch (error) { return res.status(500).json({ error: 'تعذر التحقق من حالة الشهر' }); }
  if (!monthUnlocked) return res.status(403).json({ error: 'الشهر ده لسه مقفول' });

  const { data: allQuizzes, error: qErr } = await supabase
    .from('quizzes')
    .select('id, month_id, title, type, week_number, quiz_number_in_week, order_index')
    .eq('month_id', monthId)
    .order('order_index', { ascending: true });
  if (qErr) return res.status(500).json({ error: 'تعذر تحميل الكويزات' });

  const weeklyQuizzes = (allQuizzes || []).filter((quiz) => quiz.type !== 'final');
  const finalExam = (allQuizzes || []).find((quiz) => quiz.type === 'final');
  const quizIds = (allQuizzes || []).map((quiz) => quiz.id);

  const { data: results, error: rErr } = await supabase
    .from('results')
    .select('quiz_id, score, total')
    .eq('student_id', studentId)
    .in('quiz_id', quizIds.length ? quizIds : ['00000000-0000-0000-0000-000000000000']);
  if (rErr) return res.status(500).json({ error: 'تعذر تحميل النتائج' });

  const resultByQuiz = Object.fromEntries((results || []).map((result) => [String(result.quiz_id), result]));
  let previousCompleted = true;
  const weeklyWithStatus = weeklyQuizzes.map((quiz) => {
    const result = resultByQuiz[String(quiz.id)];
    const status = result ? 'completed' : (previousCompleted ? 'unlocked' : 'locked');
    previousCompleted = previousCompleted && Boolean(result);
    return { ...quiz, status, result: result || null };
  });

  const allWeeklyDone = weeklyWithStatus.every((quiz) => quiz.status === 'completed');
  let finalWithStatus = null;
  if (finalExam) {
    const result = resultByQuiz[String(finalExam.id)] || null;
    const passed = Boolean(result?.total && Math.round((result.score / result.total) * 100) >= passPercent);
    const status = passed ? 'completed' : (allWeeklyDone ? 'unlocked' : 'locked');
    const { count: questionCount } = await supabase
      .from('quiz_questions')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_id', finalExam.id);

    finalWithStatus = {
      ...finalExam,
      status,
      result,
      has_questions: (questionCount || 0) > 0,
      passed: result ? passed : null,
    };
  }

  return res.status(200).json({ quizzes: weeklyWithStatus, final_exam: finalWithStatus, pass_percent: passPercent });
};
