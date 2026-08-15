const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// GET /api/months?student_id=...
// بيرجع كل الشهور مرتبة، وكل شهر معاه حالته لنفس الطالب:
// "locked" (لسه مقفول لأن الشهر اللي قبله محتاج نجاح 70% في الاختبار النهائي) / "unlocked" / "completed"
// من غير student_id بيرجع الشهور من غير حالة (استخدام قديم / لوحة التحكم).
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 593-641 omitted */
  return res.status(200).json({ months: monthsWithStatus });
};
