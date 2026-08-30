const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// GET /api/settings
// بينده الموقع نفسه (من غير أي صلاحية) عشان يعرف لو في وضع صيانة أو أقسام مخفية
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data, error } = await supabase
    .from('site_settings')
    .select('maintenance_mode, hidden_sections')
    .eq('id', 1)
    .single();

  if (error) return res.status(500).json({ error: 'تعذر تحميل الإعدادات' });

  return res.status(200).json({ settings: data });
};
