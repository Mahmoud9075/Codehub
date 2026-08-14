const { supabase } = require('../_supabase');
const { applyCors } = require('../_cors');

// POST /api/admin/login-pin   body: { pin }
// بيتأكد إن الرقم السري صح. لو صح، الفرونت إند بيحفظه ويبعته في كل طلب بعد كده
// جوه هيدر x-admin-pin (زي ما بنعمل مع أي endpoint أدمن تاني).
// محمي كمان من التخمين العشوائي: بعد 5 محاولات غلط من نفس الـ IP خلال 10 دقايق بيترفض أي محاولة جديدة.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: recentAttempts, error: countErr } = await supabase
    .from('login_attempts')
    .select('id')
    .eq('ip', ip)
    .eq('context', 'admin_pin')
    .gte('attempted_at', tenMinutesAgo);

  if (!countErr && recentAttempts && recentAttempts.length >= 5) {
    return res.status(429).json({ error: 'محاولات كتير غلط، حاول تاني بعد شوية.' });
  }

  const { pin } = req.body || {};

  if (!pin || pin !== process.env.ADMIN_PIN) {
    await supabase.from('login_attempts').insert({ ip, context: 'admin_pin' });
    return res.status(401).json({ error: 'الرقم السري غلط' });
  }

  return res.status(200).json({ ok: true });
};
