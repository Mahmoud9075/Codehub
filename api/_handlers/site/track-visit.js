const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { getClientIp, tooManyAttempts, recordAttempt } = require('../../_lib/request-security');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const page = String(req.body?.page || '').trim().slice(0, 100);
  if (!page || !/^[\p{L}\p{N}_#?&=./:-]+$/u.test(page)) return res.status(400).json({ error: 'page غير صحيح' });

  const ip = getClientIp(req);
  if (await tooManyAttempts({ ip, context: 'track_visit', windowMs: 60 * 1000, limit: 120 })) {
    return res.status(429).json({ error: 'طلبات كتير. حاول تاني بعد شوية.' });
  }
  await recordAttempt(ip, 'track_visit').catch(() => {});
  const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
  const { data: recent } = await supabase
    .from('page_visits')
    .select('id')
    .eq('ip', ip)
    .eq('page', page)
    .gte('visited_at', fiveSecondsAgo)
    .limit(1);

  if (recent?.length) return res.status(200).json({ ok: true, skipped: true });
  const { error } = await supabase.from('page_visits').insert({ page, ip });
  if (error) return res.status(500).json({ error: 'تعذر تسجيل الزيارة' });
  return res.status(200).json({ ok: true });
};
