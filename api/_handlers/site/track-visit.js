const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// POST /api/track-visit   body: { page }
// بينده الموقع نفسه (من غير أي صلاحية) كل ما حد يفتح صفحة.
// فيه حد بسيط: نفس الجهاز (IP) منعرفش نسجله أكتر من مرة كل 5 ثواني، عشان محدش يبعت طلبات كتير بسرعة.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { page } = req.body || {};
  if (!page) return res.status(400).json({ error: 'page مطلوب' });

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();

  const { data: recent } = await supabase
    .from('page_visits')
    .select('id')
    .eq('ip', ip)
    .eq('page', page)
    .gte('visited_at', fiveSecondsAgo)
    .limit(1);

  if (recent && recent.length) {
    return res.status(200).json({ ok: true, skipped: true }); // اتسجلت بالفعل قريب، مش هنكررها
  }

  const { error } = await supabase.from('page_visits').insert({ page, ip });
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true });
};
