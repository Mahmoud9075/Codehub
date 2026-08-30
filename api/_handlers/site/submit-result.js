const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { sendWhatsAppNotification } = require('../../_lib/whatsapp');
const { requireStudent } = require('../../_lib/student-auth');
const { getQuizAccess } = require('../../_lib/quiz-access');

function normalizeAnswer(value) {
  return String(value == null ? '' : value).toLowerCase().normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function diceCoefficient(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const pairs = new Map();
  for (let i = 0; i < a.length - 1; i++) { const pair = a.slice(i, i + 2); pairs.set(pair, (pairs.get(pair) || 0) + 1); }
  let overlap = 0;
  for (let i = 0; i < b.length - 1; i++) { const pair = b.slice(i, i + 2); const count = pairs.get(pair) || 0; if (count) { overlap++; pairs.set(pair, count - 1); } }
  return (2 * overlap) / ((a.length - 1) + (b.length - 1));
}

function tokenSimilarity(a, b) {
  const left = new Set(a.split(' ').filter(Boolean));
  const right = new Set(b.split(' ').filter(Boolean));
  if (!left.size || !right.size) return 0;
  let common = 0; left.forEach((token) => { if (right.has(token)) common++; });
  return (2 * common) / (left.size + right.size);
}

function textSimilarity(studentAnswer, modelAnswer) {
  const student = normalizeAnswer(studentAnswer);
  const model = normalizeAnswer(modelAnswer);
  if (!student || !model) return 0;
  if (student === model) return 1;
  return Math.max(diceCoefficient(student, model), tokenSimilarity(student, model));
}

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await requireStudent(req, res);
  if (!session) return;
  const studentId = session.id;
  const quizId = String(req.body?.quiz_id || '').trim();
  const answers = req.body?.answers;
  if (!quizId || !Array.isArray(answers) || !answers.length || answers.length > 200) return res.status(400).json({ error: 'بيانات ناقصة' });

  let access;
  try { access = await getQuizAccess(studentId, quizId); }
  catch (error) { return res.status(500).json({ error: 'تعذر التحقق من الكويز' }); }
  if (!access.exists) return res.status(404).json({ error: 'الكويز مش موجود' });
  if (access.status === 'locked') return res.status(403).json({ error: 'الكويز ده لسه مقفول' });
  if (access.status === 'completed') return res.status(409).json({ error: 'الكويز ده متسجل عندك بالفعل' });

  const { data: questions, error: qErr } = await supabase
    .from('quiz_questions')
    .select('id, question_text, options, correct_index')
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: true });
  if (qErr) return res.status(500).json({ error: 'تعذر تحميل أسئلة الكويز' });
  if (!questions?.length) return res.status(400).json({ error: 'الكويز ده لسه مفيهوش أسئلة' });
  if (answers.length !== questions.length) return res.status(400).json({ error: 'جاوب على كل الأسئلة قبل الإرسال' });

  const answerByQuestion = {};
  for (const answer of answers) {
    const questionId = String(answer?.question_id || '');
    if (!questionId || answerByQuestion[questionId]) return res.status(400).json({ error: 'الإجابات المرسلة غير صحيحة' });
    answerByQuestion[questionId] = answer;
  }
  const validIds = new Set(questions.map((question) => String(question.id)));
  if (Object.keys(answerByQuestion).some((id) => !validIds.has(id))) return res.status(400).json({ error: 'الإجابات المرسلة غير صحيحة' });

  let score = 0;
  const breakdown = questions.map((question) => {
    const submitted = answerByQuestion[String(question.id)] || {};
    const meta = Array.isArray(question.options)
      ? { choices: question.options, answer_mode: 'choice', type: 'multiple_choice', type_label: 'اختياري' }
      : (question.options || {});
    const choices = Array.isArray(meta.choices) ? meta.choices : [];
    const answerMode = meta.answer_mode || 'choice';
    let isCorrect = false;
    let similarity = null;
    let studentAnswer = '';
    let correctAnswer = '';

    if (answerMode === 'choice') {
      const selected = submitted.selected_index === '' || submitted.selected_index == null ? null : Number(submitted.selected_index);
      if (!Number.isInteger(selected) || selected < 0 || selected >= choices.length) return {
        invalid: true,
        question_id: question.id,
      };
      isCorrect = selected === question.correct_index;
      studentAnswer = choices[selected] || '';
      correctAnswer = choices[question.correct_index] || '';
    } else {
      studentAnswer = String(submitted.text_answer || '').trim();
      if (!studentAnswer || studentAnswer.length > 4000) return { invalid: true, question_id: question.id };
      correctAnswer = String(meta.correct_answer || '').trim();
      const modelAnswers = correctAnswer.split('|').map((item) => item.trim()).filter(Boolean);
      similarity = modelAnswers.reduce((best, model) => Math.max(best, textSimilarity(studentAnswer, model)), 0);
      const threshold = meta.type === 'fill_blank' ? 0.92 : Math.max(0.3, Math.min(1, Number(meta.similarity_threshold || 0.6)));
      isCorrect = similarity >= threshold;
    }

    if (isCorrect) score++;
    return {
      question_id: question.id,
      question_text: question.question_text,
      question_type: meta.type || 'multiple_choice',
      type_label: meta.type_label || 'اختياري',
      answer_mode: answerMode,
      options: choices,
      selected_index: submitted.selected_index != null ? Number(submitted.selected_index) : null,
      correct_index: question.correct_index,
      student_answer: studentAnswer || null,
      correct_answer: correctAnswer,
      similarity: similarity == null ? null : Math.round(similarity * 100),
      is_correct: isCorrect,
    };
  });

  if (breakdown.some((item) => item.invalid)) return res.status(400).json({ error: 'جاوب على كل الأسئلة بشكل صحيح قبل الإرسال' });

  const total = questions.length;
  const percent = Math.round((score / total) * 100);
  const isFinal = access.quiz.type === 'final';
  const passedFinal = isFinal && percent >= access.passPercent;

  const { data, error } = await supabase
    .from('results')
    .upsert({ student_id: studentId, quiz_id: quizId, score, total, completed_at: new Date().toISOString() }, { onConflict: 'student_id,quiz_id' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: 'تعذر حفظ النتيجة' });

  const shouldNotify = !access.result || passedFinal;
  if (shouldNotify) {
    try {
      const { data: student } = await supabase.from('students').select('phone, first_name').eq('id', studentId).maybeSingle();
      if (student?.phone) {
        let message;
        if (isFinal && !passedFinal) {
          message = `يا ${student.first_name || 'بطل'}، درجتك في الاختبار النهائي ${score}/${total} (${percent}%). المطلوب ${access.passPercent}% للنجاح. تقدر تراجع وتحاول تاني من Code Hub.`;
        } else if (isFinal) {
          message = `مبروك يا ${student.first_name || 'بطل'}! نجحت في الاختبار النهائي بدرجة ${score}/${total} (${percent}%). الشهر اللي بعده اتفتح ليك في Code Hub 🎉`;
        } else {
          message = `مبروك يا ${student.first_name || 'بطل'}! خلّصت الكويز بدرجة ${score}/${total}. الكويز اللي بعده اتفتح دلوقتي في Code Hub 🎉`;
        }
        await sendWhatsAppNotification(student.phone, message);
      }
    } catch (error) {
      // Notification failure must never invalidate a saved quiz result.
    }
  }

  const reviewLocked = isFinal && !passedFinal;
  const safeBreakdown = reviewLocked
    ? breakdown.map(({ correct_index, correct_answer, ...item }) => ({ ...item, correct_index: null, correct_answer: null }))
    : breakdown;

  return res.status(200).json({ result: data, breakdown: safeBreakdown, review_locked: reviewLocked, pass_percent: access.passPercent });
};
