const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { logAdminAction } = require('../../_lib/admin-audit');
const { applyCors } = require('../../_lib/cors');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('site_content').select('*').order('section');
    if (error) return res.status(500).json({ error: 'تعذر تحميل النصوص' });
    return res.status(200).json({ content: data || [] });
  }

  if (req.method === 'POST') {
    const key = String(req.body?.key || '').trim();
    const rollback = req.body?.rollback === true;
    if (!key || key.length > 120) return res.status(400).json({ error: 'key غير صحيح' });

    const { data: current, error: currentError } = await supabase.from('site_content').select('*').eq('key', key).maybeSingle();
    if (currentError) return res.status(500).json({ error: 'تعذر تحميل النص الحالي' });
    if (!current) return res.status(404).json({ error: 'النص ده مش موجود' });

    let newValue;
    if (rollback) {
      const { data: lastChange } = await supabase
        .from('site_content_history')
        .select('old_value')
        .eq('key', key)
        .order('changed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lastChange) return res.status(400).json({ error: 'مفيش تاريخ تعديلات لهذا النص' });
      newValue = String(lastChange.old_value ?? '');
    } else {
      if (req.body?.value == null) return res.status(400).json({ error: 'value مطلوب' });
      newValue = String(req.body.value);
    }

    if (newValue.length > 2000) return res.status(400).json({ error: 'النص طويل قوي' });

    const { error: historyError } = await supabase.from('site_content_history').insert({
      key,
      old_value: String(current.value ?? ''),
      new_value: newValue,
      changed_by: auth.identity,
    });
    if (historyError) return res.status(500).json({ error: 'تعذر حفظ سجل التعديل' });

    const { data: updated, error } = await supabase
      .from('site_content')
      .update({ value: newValue, updated_at: new Date().toISOString() })
      .eq('key', key)
      .select()
      .single();
    if (error) return res.status(500).json({ error: 'تعذر حفظ النص' });

    await logAdminAction(auth.identity, rollback ? 'rollback_content' : 'update_content', { key });
    return res.status(200).json({ content: updated });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
