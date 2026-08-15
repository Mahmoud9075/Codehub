const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// GET /api/content
// بينده الموقع نفسه (من غير أي صلاحية) عشان يجيب أحدث نسخة من النصوص القابلة للتعديل
module.exports = async (req, res) => {
  try {
    if (applyCors(req, res)) return;

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { data, error } = await supabase.from('site_content').select('key, value');
    if (error) return res.status(500).json({ error: error.message });

    const map = {};
    (data || []).forEach((row) => { map[row.key] = row.value; });

    return res.status(200).json({ content: map });
  } catch (err) {
    // Always return JSON on unexpected errors to avoid frontend JSON.parse failures
    return res.status(500).json({ error: err && err.message ? err.message : 'Internal server error' });
  }
};
