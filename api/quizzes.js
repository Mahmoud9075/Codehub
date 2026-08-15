const { supabase } = require('./_supabase');
const { applyCors } = require('./_cors');

// GET /api/quizzes?month_id=...&student_id=...
// بيرجع كويزات الشهر الأسبوعية + الاختبار النهائي، وكل واحد معاه حالته لنفس الطالب:
// "completed" / "unlocked" / "locked"
// الكويزات الأسبوعية بتتفتح ورا بعض زي الأول. الاختبار النهائي بيتفتح لما كل الكويزات الأسبوعية تخلص.
// لو الاختبار النهائي مفتوح بس لسه مفيهوش أسئلة، بنرجّع has_questions:false عشان الموقع يقول للطالب "لسه مش متاح".
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { month_id, student_id } = req.query;

  if (!month_id || !student_id) {
    return res.status(400).json({ error: 'month_id و student_id مطلوبين' });
  }

  const { data: allQuizzes, error: qErr } = await supabase
    .from('quizzes')
    .select('*')
    .eq('month_id', month_id)
    .order('order_index', { ascending: true });

  if (qErr) return res.status(500).json({ error: qErr.message });

  const weeklyQuizzes = allQuizzes.filter((q) => q.type !== 'final');
  const finalExam = allQuizzes.find((q) => q.type === 'final');

  const quizIds = allQuizzes.map((q) => q.id);

  const { data: results, error: rErr } = await supabase
    .from('results')
    .select('quiz_id, score, total')
    .eq('student_id', student_id)
    .in('quiz_id', quizIds.length ? quizIds : ['00000000-0000-0000-0000-000000000000']);

  if (rErr) return res.status(500).json({ error: rErr.message });

  const resultByQuiz = Object.fromEntries((results || []).map((r) => [r.quiz_id, r]));

  // 1) حالة الكويزات الأسبوعية (تتفتح ورا بعض)
  let previousCompleted = true; // أول كويز أسبوعي دايمًا مفتوح
  const weeklyWithStatus = weeklyQuizzes.map((quiz) => {
    const result = resultByQuiz[quiz.id];
    let status;
    if (result) status = 'completed';
    else if (previousCompleted) status = 'unlocked';
    else status = 'locked';
    previousCompleted = Boolean(result);
    return { ...quiz, status, result: result || null };
  });

  const allWeeklyDone = weeklyWithStatus.every((q) => q.status === 'completed');

  // 2) حالة الاختبار النهائي (يتفتح بعد كل الكويزات الأسبوعية)
  let finalWithStatus = null;
  if (finalExam) {
    const result = resultByQuiz[finalExam.id];
    let status;
    if (result) status = 'completed';
    else if (allWeeklyDone) status = 'unlocked';
    else status = 'locked';

    const { count: questionCount } = await supabase
      .from('quiz_questions')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_id', finalExam.id);

    const passPercent = 70; // القيمة الافتراضية، وبنجيب المحدّثة من site_settings تحت
    const passed = result ? Math.round((result.score / result.total) * 100) >= passPercent : null;

    finalWithStatus = {
      ...finalExam,
      status,
      result: result || null,
      has_questions: (questionCount || 0) > 0,
      passed,
    };
  }

  return res.status(200).json({ quizzes: weeklyWithStatus, final_exam: finalWithStatus });
};
