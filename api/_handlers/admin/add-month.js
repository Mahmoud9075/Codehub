const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { logAdminAction } = require('../../_lib/admin-audit');
const { applyCors } = require('../../_lib/cors');

// POST /api/admin/add-month   body: { name }
// بيضيف شهر جديد في آخر الترتيب، وبيولّدله تلقائيًا 8 كويزات أسبوعية + اختبار نهائي واحد
// (زي بالظبط اللي بيحصل في schema.sql، بس ده بيخليك تضيف شهر من غير ما تدخل SQL خالص).
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 985-1029 omitted */
  return res.status(201).json({ month });
};
