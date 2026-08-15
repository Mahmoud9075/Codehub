const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { sendWhatsAppNotification } = require('../../_lib/whatsapp');

// POST /api/submit-result
// body: { student_id, quiz_id, answers: [{ question_id, selected_index }, ...] }
// السيرفر نفسه بيحسب الدرجة من قاعدة البيانات (مش بياخدها من المتصفح) — عشان محدش يقدر يغش.
// بيسجّل نتيجة الكويز، وبمجرد ما يتسجل الكويز اللي بعده هيبان "unlocked" تلقائي.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 863-929 omitted */
  return res.status(200).json({ result: data, breakdown });
};
