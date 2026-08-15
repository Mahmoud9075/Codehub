const { supabase } = require('../_supabase');
const { isAuthorized } = require('./_auth');
const { logAdminAction } = require('./_audit');
const { applyCors } = require('../_cors');

// GET    /api/admin/ai-knowledge            -> هات كل محتوى المنهج المتاح للمساعد الذكي
// POST   /api/admin/ai-knowledge            -> ضيف درس جديد   body: { title, content }
// DELETE /api/admin/ai-knowledge?id=...     -> احذف درس
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('ai_knowledge').select('*').order('order_index');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ knowledge: data });
  }

  if (req.method === 'POST') {
    const { title, content } = req.body || {};
    if (!title || !content) return res.status(400).json({ error: 'العنوان والمحتوى مطلوبين' });
    if (content.length > 20000) return res.status(400).json({ error: 'المحتوى طويل قوي (أقصى 20000 حرف)' });

    const { count } = await supabase.from('ai_knowledge').select('id', { count: 'exact', head: true });

    const { data, error } = await supabase
      .from('ai_knowledge')
      .insert({ title, content, order_index: count || 0 })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    await logAdminAction(auth.identity, 'add_ai_knowledge', { title });
    return res.status(201).json({ knowledge: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id مطلوب' });
    const { error } = await supabase.from('ai_knowledge').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    await logAdminAction(auth.identity, 'delete_ai_knowledge', { id });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
