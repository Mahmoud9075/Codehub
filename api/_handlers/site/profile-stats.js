const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

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

  const { student_id } = req.query;
  if (!student_id) {
    return res.status(400).json({ error: 'student_id مطلوب' });
  }

  const { data: student, error: sErr } = await supabase
    .from('students')
    .select('id, created_at, phone_verified')
    .eq('id', student_id)
    .maybeSingle();

  if (sErr) return res.status(500).json({ error: sErr.message });
  if (!student) return res.status(404).json({ error: 'الطالب مش موجود' });

  const { data: myResults, error: rErr } = await supabase
    .from('results')
    .select('quiz_id, score, total, completed_at')
    .eq('student_id', student_id);

  if (rErr) return res.status(500).json({ error: rErr.message });

  const results = myResults || [];
  const quizzesCompleted = results.length;

  let avgScorePercent = null;
  if (quizzesCompleted > 0) {
    const sumPercent = results.reduce((acc, r) => acc + (r.total ? (r.score / r.total) * 100 : 0), 0);
    avgScorePercent = Math.round(sumPercent / quizzesCompleted);
  }

  const dateSet = new Set(results.map((r) => new Date(r.completed_at).toISOString().slice(0, 10)));
  let streakDays = 0;
  {
    const cursor = new Date();
    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      if (dateSet.has(key)) {
        streakDays++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
  }

  const weeklyActivity = [];
  {
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      weeklyActivity.push({ date: key, active: dateSet.has(key) });
    }
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
    const { data: months } = await supabase.from('months').select('*').order('order_index', { ascending: true });
    const { data: settings } = await supabase.from('site_settings').select('final_exam_pass_percent').eq('id', 1).maybeSingle();
    const passPercent = settings?.final_exam_pass_percent || 70;
    const { data: allQuizzes } = await supabase.from('quizzes').select('id, month_id, type');
    const resultByQuizId = Object.fromEntries(results.map((r) => [r.quiz_id, r]));

    let previousPassed = true;
    let found = false;
    for (const month of months || []) {
      const monthQuizzes = (allQuizzes || []).filter((q) => q.month_id === month.id);
      const finalExam = monthQuizzes.find((q) => q.type === 'final');
      const finalResult = finalExam ? resultByQuizId[finalExam.id] : null;
      const passed = finalResult ? Math.round((finalResult.score / finalResult.total) * 100) >= passPercent : false;

      if (passed) {
        previousPassed = true;
        continue;
      }
      if (previousPassed) {
        currentMonthTitle = month.name || null;
        remainingQuizzesThisMonth = monthQuizzes.filter((q) => !resultByQuizId[q.id]).length;
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
