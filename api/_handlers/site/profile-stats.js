const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { requireStudent } = require('../../_lib/student-auth');
const { getPassPercent } = require('../../_lib/quiz-access');


const cairoFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
});
function cairoDayKey(value) {
  const parts = Object.fromEntries(cairoFormatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// GET /api/profile-stats?student_id=...
// بيرجع كل بيانات كارت البروفايل الجديد: تاريخ الانضمام، الأيام المتتالية،
// الترتيب النسبي بين الطلاب، عدد الكويزات المكتملة، متوسط الدرجات،
// نشاط آخر 7 أيام، وعدد الكويزات المتبقية في الشهر المفتوح حاليًا.
// كل الأرقام بتتحسب من قاعدة البيانات فعليًا — لو الداتا مش كافية بيرجع null
// عشان الواجهة تخفي الجزء ده بدل ما تعرض رقم وهمي.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await requireStudent(req, res);
  if (!session) return;
  const student_id = session.id;

  const { data: student, error: sErr } = await supabase
    .from('students')
    .select('id, created_at, phone_verified')
    .eq('id', student_id)
    .maybeSingle();

  if (sErr) return res.status(500).json({ error: 'تعذر تحميل بيانات الحساب' });
  if (!student) return res.status(404).json({ error: 'الطالب مش موجود' });

  const { data: myResults, error: rErr } = await supabase
    .from('results')
    .select('quiz_id, score, total, completed_at')
    .eq('student_id', student_id);

  if (rErr) return res.status(500).json({ error: 'تعذر تحميل نتائجك' });

  const results = myResults || [];
  const passPercent = await getPassPercent();
  const { data: allQuizzes, error: qErr } = await supabase.from('quizzes').select('id, month_id, type');
  if (qErr) return res.status(500).json({ error: 'تعذر تحميل بيانات الاختبارات' });
  const quizById = Object.fromEntries((allQuizzes || []).map((quiz) => [String(quiz.id), quiz]));
  const completedResults = results.filter((result) => {
    const quiz = quizById[String(result.quiz_id)];
    if (!quiz || quiz.type !== 'final') return true;
    return Boolean(result.total && Math.round((result.score / result.total) * 100) >= passPercent);
  });
  const quizzesCompleted = completedResults.length;

  let avgScorePercent = null;
  if (results.length > 0) {
    const sumPercent = results.reduce((acc, r) => acc + (r.total ? (r.score / r.total) * 100 : 0), 0);
    avgScorePercent = Math.round(sumPercent / results.length);
  }

  const dateSet = new Set(results.map((r) => cairoDayKey(r.completed_at)));
  let streakDays = 0;
  for (let i = 0; i < 366; i++) {
    const key = cairoDayKey(Date.now() - i * 24 * 60 * 60 * 1000);
    if (!dateSet.has(key)) break;
    streakDays++;
  }

  const weeklyActivity = [];
  for (let i = 6; i >= 0; i--) {
    const key = cairoDayKey(Date.now() - i * 24 * 60 * 60 * 1000);
    weeklyActivity.push({ date: key, active: dateSet.has(key) });
  }

  let percentile = null;
  if (quizzesCompleted > 0) {
    const { data: allResults, error: allErr } = await supabase
      .from('results')
      .select('student_id, score, total');

    if (!allErr && allResults && allResults.length) {
      const byStudent = {};
      allResults.forEach((r) => {
        if (!byStudent[r.student_id]) byStudent[r.student_id] = { sum: 0, count: 0 };
        byStudent[r.student_id].sum += r.total ? (r.score / r.total) * 100 : 0;
        byStudent[r.student_id].count += 1;
      });

      const averages = Object.entries(byStudent).map(([sid, v]) => ({ sid, avg: v.sum / v.count }));
      if (averages.length >= 5) {
        const mine = byStudent[student_id];
        if (mine) {
          const myAvg = mine.sum / mine.count;
          const notBetter = averages.filter((a) => a.avg <= myAvg).length;
          percentile = Math.max(1, Math.min(100, Math.round((notBetter / averages.length) * 100)));
        }
      }
    }
  }

  let currentMonthTitle = null;
  let remainingQuizzesThisMonth = 0;
  let allMonthsDone = false;
  {
    const { data: months } = await supabase.from('months').select('id, name, order_index').order('order_index', { ascending: true });
    const resultByQuizId = Object.fromEntries(results.map((r) => [r.quiz_id, r]));

    let previousPassed = true;
    let found = false;
    for (const month of months || []) {
      const monthQuizzes = (allQuizzes || []).filter((q) => q.month_id === month.id);
      const finalExam = monthQuizzes.find((q) => q.type === 'final');
      const finalResult = finalExam ? resultByQuizId[finalExam.id] : null;
      const passed = Boolean(finalResult?.total && Math.round((finalResult.score / finalResult.total) * 100) >= passPercent);

      if (passed) {
        previousPassed = true;
        continue;
      }
      if (previousPassed) {
        currentMonthTitle = month.name || null;
        remainingQuizzesThisMonth = monthQuizzes.filter((q) => {
          const result = resultByQuizId[q.id];
          if (!result) return true;
          if (q.type !== 'final') return false;
          return !result.total || Math.round((result.score / result.total) * 100) < passPercent;
        }).length;
        found = true;
      }
      break;
    }
    if (!found && months && months.length) allMonthsDone = true;
  }

  return res.status(200).json({
    member_since: student.created_at || null,
    phone_verified: !!student.phone_verified,
    streak_days: streakDays,
    percentile,
    quizzes_completed: quizzesCompleted,
    avg_score_percent: avgScorePercent,
    weekly_activity: weeklyActivity,
    remaining_quizzes_this_month: remainingQuizzesThisMonth,
    current_month_title: currentMonthTitle,
    all_months_done: allMonthsDone,
  });
};
