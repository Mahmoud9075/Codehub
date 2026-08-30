const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { logAdminAction } = require('../../_lib/admin-audit');
const { applyCors } = require('../../_lib/cors');

const ALLOWED_STATUS = new Set(['pending', 'approved', 'hidden']);

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('site_reviews')
      .select('id, name, audience, stars, comment, status, created_at, moderated_at, moderated_by')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) return res.status(500).json({ error: 'تعذر تحميل التقييمات. تأكد إن تحديث قاعدة البيانات اتشغّل.' });
    return res.status(200).json({ reviews: data || [] });
  }

  if (req.method === 'POST') {
    const id = String(req.body?.id || '').trim();
    const status = String(req.body?.status || '').trim();
    if (!id || !ALLOWED_STATUS.has(status)) return res.status(400).json({ error: 'بيانات التعديل غير صحيحة' });

    const { data, error } = await supabase
      .from('site_reviews')
      .update({ status, moderated_at: new Date().toISOString(), moderated_by: auth.identity })
      .eq('id', id)
      .select('id, status')
      .maybeSingle();
    if (error) return res.status(500).json({ error: 'تعذر تعديل التقييم' });
    if (!data) return res.status(404).json({ error: 'التقييم مش موجود' });
    await logAdminAction(auth.identity, 'moderate_review', { id, status });
    return res.status(200).json({ review: data });
  }

  if (req.method === 'DELETE') {
    const id = String(req.query.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id مطلوب' });
    const { error } = await supabase.from('site_reviews').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'تعذر حذف التقييم' });
    await logAdminAction(auth.identity, 'delete_review', { id });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
