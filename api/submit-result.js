const { supabase } = require('./_supabase');
const { applyCors } = require('./_cors');
const { sendWhatsAppNotification } = require('./_whatsapp');

// POST /api/submit-result
// body: { student_id, quiz_id, answers: [{ question_id, selected_index }, ...] }
// السيرفر نفسه بيحسب الدرجة من قاعدة البيانات (مش بياخدها من المتصفح) — عشان محدش يقدر يغش.
// بيسجل نتيجة الكويز، وبمجرد ما يتسجل الكويز اللي بعده هيبان "unlocked" تلقائي.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id, quiz_id, answers } = req.body || {};

  if (!student_id || !quiz_id || !Array.isArray(answers) || !answers.length) {
    return res.status(400).json({ error: 'بيانات ناقصة' });
  }

  // هات الأسئلة الحقيقية بالإجابة الصح من قاعدة البيانات
  const { data: questions, error: qErr } = await supabase
    .from('quiz_questions')
    .select('id, question_text, options, correct_index')
    .eq('quiz_id', quiz_id);

  if (qErr) return res.status(500).json({ error: qErr.message });
  if (!questions.length) return res.status(400).json({ error: 'الكويز ده لسه مفيهوش أسئلة' });

  const questionById = Object.fromEntries(questions.map((q) => [q.id, q]));
  const answerByQuestion = Object.fromEntries(answers.map((a) => [a.question_id, a.selected_index]));

  let score = 0;
  // مراجعة الإجابات بعد التسليم — آمن نرجّعها دلوقتي لأن الامتحان خلص فعلاً
  const breakdown = questions.map((q) => {
    const selected = answerByQuestion[q.id];
    const isCorrect = selected === q.correct_index;
    if (isCorrect) score++;
    return {
      question_id: q.id,
      question_text: q.question_text,
      options: q.options,
      selected_index: selected != null ? selected : null,
      correct_index: q.correct_index,
      is_correct: isCorrect,
    };
  });
  const total = questions.length;

  const { data, error } = await supabase
    .from('results')
    .upsert(
      { student_id, quiz_id, score, total, completed_at: new Date().toISOString() },
      { onConflict: 'student_id,quiz_id' }
    )
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // تنبيه واتساب تلقائي — بيحصل في الخلفية ومبيأخرش الرد على الطالب لو فشل أو لسه مش مفعّل
  (async () => {
    try {
      const { data: student } = await supabase.from('students').select('phone, first_name').eq('id', student_id).maybeSingle();
      if (student) {
        await sendWhatsAppNotification(
          student.phone,
          `مبروك يا ${student.first_name}! خلّصت الكويز بدرجة ${score}/${total}. الكويز اللي بعده اتفتح دلوقتي في Code Hub 🎉`
        );
      }
    } catch (e) {
      // متعملش الطلب الأساسي يفشل بسبب فشل الإشعار
    }
  })();

  return res.status(200).json({ result: data, breakdown });
};
