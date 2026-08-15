const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// POST /api/auth/forgot-password   body: { phone }
// بيولّد كود من 6 أرقام صالح 15 دقيقة، ويخزّنه.

// ⚠️ ملحوظة مهمة: الكود مبيتبعتش فعليًا للطالب لسه — محتاجين نربطه بخدمة SMS أو واتساب
// (زي Twilio أو WhatsApp Business API) عشان يوصله. لحد ما نعمل ده، الكود بيتسجل في جدول
// password_resets، وتقدر تدخل تشوفه من Supabase وتديه للطالب يدوي لو اتصل بيك.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1671-1702 omitted */
  return res.status(200).json({ ok: true, message: 'لو الرقم ده مسجل، هيوصله كود التحقق.' });
};
