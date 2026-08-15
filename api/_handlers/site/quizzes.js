const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// GET /api/quizzes?month_id=...&student_id=...
// بيرجع كويزات الشهر الأسبوعية + الاختبار النهائي، وكل واحد معاه حالته لنفس الطالب:
// "completed" / "unlocked" / "locked"
// الكويزات الأسبوعية بتتفتح ورا بعض زي الأول. الاختبار النهائي بيتفتح لما كل الكويزات الأسبوعية تخلص.
// لو الاختبار النهائي مفتوح بس لسه مفيهوش أسئلة، بنرجّع has_questions:false عشان الموقع يقول للطالب "لسه مش متاح".
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 747-821 omitted */
  return res.status(200).json({ quizzes: weeklyWithStatus, final_exam: finalWithStatus });
};
