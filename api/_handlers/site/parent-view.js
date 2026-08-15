const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// GET /api/parent-view?token=...
// صفحة عامة (من غير تسجيل دخول) — ولي الأمر بيشوف بيها اسم ابنه وتقدّمه بس، من غير أي بيانات حساسة
// (مفيش إيميل ولا باسورد ولا رقم موبايل هنا).
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 655-694 omitted */
  });
};
