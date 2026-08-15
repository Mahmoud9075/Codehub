const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// POST /api/track-visit   body: { page }
// بينده الموقع نفسه (من غير أي صلاحية) كل ما حد يفتح صفحة.
// فيه حد بسيط: نفس الجهاز (IP) منعرفش نسجله أكتر من مرة كل 5 ثواني، عشان محدش يبعت طلبات كتير بسرعة.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 943-969 omitted */
  return res.status(200).json({ ok: true });
};
