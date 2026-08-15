const { supabase } = require('../_supabase');
const { isAuthorized } = require('./_auth');
const { logAdminAction } = require('./_audit');
const { applyCors } = require('../_cors');

// GET  /api/admin/content   -> هات كل نصوص الموقع (مرتبة حسب القسم)
// POST /api/admin/content   -> عدّل نص، أو ارجع لآخر نسخة
//   body: { key, value }              -> يعدّل النص
//   body: { key, rollback: true }     -> يرجّع النص لآخر قيمة كانت قبل التعديل الحالي
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('site_content').select('*').order('section');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ content: data });
  }

  if (req.method === 'POST') {
    const { key, value, rollback } = req.body || {};
    if (!key) return res.status(400).json({ error: 'key مطلوب' });

    const { data: current } = await supabase.from('site_content').select('*').eq('key', key).maybeSingle();
    if (!current) return res.status(404).json({ error: 'النص ده مش موجود' });

    let newValue = value;

    if (rollback) {
      // هات آخر تعديل في السجل وارجع للقيمة اللي قبله
      const { data: lastChange } = await supabase
        .from('site_content_history')
        .select('*')
        .eq('key', key)
        .order('changed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastChange) return res.status(400).json({ error: 'مفيش تاريخ تعديلات لهذا النص' });
      newValue = lastChange.old_value;
    }

    if (newValue == null) return res.status(400).json({ error: 'value مطلوب' });
    if (newValue.length > 2000) return res.status(400).json({ error: 'النص طويل قوي' });

    // سجّل التغيير في التاريخ الأول
    await supabase.from('site_content_history').insert({
      key,
      old_value: current.value,
      new_value: newValue,
      changed_by: auth.identity,
    });

    const { data: updated, error } = await supabase
      .from('site_content')
      .update({ value: newValue, updated_at: new Date().toISOString() })
      .eq('key', key)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await logAdminAction(auth.identity, rollback ? 'rollback_content' : 'update_content', { key });

    return res.status(200).json({ content: updated });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
