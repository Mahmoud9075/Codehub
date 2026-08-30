const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { logAdminAction } = require('../../_lib/admin-audit');
const { applyCors } = require('../../_lib/cors');

function normalizeEmail(value) {
  const email = String(value || '').toLowerCase().trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });
  if (auth.via !== 'super_admin') return res.status(403).json({ error: 'إدارة الأدمنز متاحة للأدمن الرئيسي فقط' });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('admin_emails').select('*').order('added_at');
    if (error) return res.status(500).json({ error: 'تعذر تحميل الأدمنز' });
    return res.status(200).json({ admins: data || [] });
  }

  if (req.method === 'POST') {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'اكتب إيميل صحيح' });
    const { data: existing } = await supabase.from('admin_emails').select('email').eq('email', email).maybeSingle();
    if (existing) return res.status(409).json({ error: 'الإيميل موجود بالفعل' });

    const { data, error } = await supabase.from('admin_emails').insert({ email }).select().single();
    if (error) return res.status(500).json({ error: 'تعذر إضافة الأدمن' });
    await logAdminAction(auth.identity, 'add_admin', { email });
    return res.status(201).json({ admin: data });
  }

  if (req.method === 'DELETE') {
    const email = normalizeEmail(req.query.email);
    if (!email) return res.status(400).json({ error: 'اكتب إيميل صحيح' });
    if (auth.email && auth.email === email) return res.status(400).json({ error: 'مينفعش تمسح حسابك الحالي' });

    const { error } = await supabase.from('admin_emails').delete().eq('email', email);
    if (error) return res.status(500).json({ error: 'تعذر حذف الأدمن' });
    await logAdminAction(auth.identity, 'remove_admin', { email });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
