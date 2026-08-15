const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { logAdminAction } = require('../../_lib/admin-audit');
const { applyCors } = require('../../_lib/cors');

// GET  /api/admin/admins        -> هات كل الإيميلات المسموح لها تدخل كأدمن
// POST /api/admin/admins        -> ضيف إيميل جديد    body: { email }
// DELETE /api/admin/admins?email=...  -> امسح إيميل
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('admin_emails').select('*').order('added_at');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ admins: data });
  }

  if (req.method === 'POST') {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'الإيميل مطلوب' });

    const { data, error } = await supabase
      .from('admin_emails')
      .insert({ email })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    await logAdminAction(auth.identity, 'add_admin', { email });
    return res.status(201).json({ admin: data });
  }

  if (req.method === 'DELETE') {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'الإيميل مطلوب' });

    const { error } = await supabase.from('admin_emails').delete().eq('email', email);
    if (error) return res.status(500).json({ error: error.message });
    await logAdminAction(auth.identity, 'remove_admin', { email });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
