const { supabase } = require('../_supabase');
const { isAuthorized } = require('./_auth');
const { logAdminAction } = require('./_audit');
const { applyCors } = require('../_cors');

// GET  /api/admin/settings   -> هات الإعدادات الحالية
// POST /api/admin/settings   -> عدّل الإعدادات
//   body: { maintenance_mode?: boolean, hidden_sections?: string[] }
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ settings: data });
  }

  if (req.method === 'POST') {
    const { maintenance_mode, hidden_sections } = req.body || {};
    const update = { updated_at: new Date().toISOString() };
    if (maintenance_mode !== undefined) update.maintenance_mode = maintenance_mode;
    if (hidden_sections !== undefined) update.hidden_sections = hidden_sections;

    const { data, error } = await supabase
      .from('site_settings')
      .update(update)
      .eq('id', 1)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    await logAdminAction(auth.identity, 'update_settings', update);
    return res.status(200).json({ settings: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
