const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { logAdminAction } = require('../../_lib/admin-audit');
const { applyCors } = require('../../_lib/cors');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).single();
    if (error) return res.status(500).json({ error: 'تعذر تحميل الإعدادات' });
    return res.status(200).json({ settings: data });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const update = { updated_at: new Date().toISOString() };

    if (body.maintenance_mode !== undefined) {
      if (typeof body.maintenance_mode !== 'boolean') return res.status(400).json({ error: 'maintenance_mode غير صحيح' });
      update.maintenance_mode = body.maintenance_mode;
    }

    if (body.hidden_sections !== undefined) {
      if (!Array.isArray(body.hidden_sections) || body.hidden_sections.length > 30) return res.status(400).json({ error: 'hidden_sections غير صحيحة' });
      const clean = body.hidden_sections
        .map((item) => String(item || '').trim())
        .filter((item) => item && item.length <= 80 && /^[A-Za-z0-9_-]+$/.test(item));
      if (clean.length !== body.hidden_sections.filter(Boolean).length) return res.status(400).json({ error: 'hidden_sections غير صحيحة' });
      update.hidden_sections = [...new Set(clean)];
    }

    if (body.final_exam_pass_percent !== undefined) {
      const percent = Number(body.final_exam_pass_percent);
      if (!Number.isFinite(percent) || percent < 1 || percent > 100) return res.status(400).json({ error: 'نسبة النجاح لازم تكون من 1 إلى 100' });
      update.final_exam_pass_percent = Math.round(percent);
    }

    if (Object.keys(update).length === 1) return res.status(400).json({ error: 'مفيش إعدادات اتبعتت' });

    const { data, error } = await supabase.from('site_settings').update(update).eq('id', 1).select().single();
    if (error) return res.status(500).json({ error: 'تعذر حفظ الإعدادات' });
    await logAdminAction(auth.identity, 'update_settings', update);
    return res.status(200).json({ settings: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
