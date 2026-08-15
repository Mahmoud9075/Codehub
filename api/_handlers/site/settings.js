const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// GET /api/settings
// بينده الموقع نفسه (من غير أي صلاحية) عشان يعرف لو في وضع صيانة أو أقسام مخفية
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 834-847 omitted */
  return res.status(200).json({ settings: data });
};
