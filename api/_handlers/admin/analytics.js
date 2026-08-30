const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { applyCors } = require('../../_lib/cors');

// GET /api/admin/analytics
// بيرجع: إجمالي الزيارات، وعدد الزيارات لكل صفحة، وآخر 7 أيام
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data, error } = await supabase
    .from('page_visits')
    .select('page, visited_at')
    .order('visited_at', { ascending: false })
    .limit(5000);

  if (error) return res.status(500).json({ error: 'تعذر تحميل الزيارات' });

  const byPage = {};
  const last7Days = {};
  const now = Date.now();

  (data || []).forEach((row) => {
    byPage[row.page] = (byPage[row.page] || 0) + 1;
    const daysAgo = Math.floor((now - new Date(row.visited_at).getTime()) / 86400000);
    if (daysAgo < 7) {
      const key = new Date(row.visited_at).toISOString().slice(0, 10);
      last7Days[key] = (last7Days[key] || 0) + 1;
    }
  });

  return res.status(200).json({
    total: (data || []).length,
    by_page: byPage,
    last_7_days: last7Days,
  });
};
