const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { setAdminSession } = require('../../_lib/admin-auth');
const { safeEqual } = require('../../_lib/session');
const { getClientIp, tooManyAttempts, recordAttempt } = require('../../_lib/request-security');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  if (await tooManyAttempts({ ip, context: 'admin_pin', windowMs: 10 * 60 * 1000, limit: 5 }) ||
      await tooManyAttempts({ ip: 'account', context: 'admin_pin_global', windowMs: 60 * 60 * 1000, limit: 20 })) {
    return res.status(429).json({ error: 'محاولات كتير غلط، حاول تاني بعد شوية.' });
  }

  const pin = String(req.body?.pin || '');
  if (pin.length > 128) return res.status(400).json({ error: 'بيانات الدخول غير صالحة' });
  if (!process.env.ADMIN_PIN) return res.status(503).json({ error: 'دخول الإدارة غير متاح حاليًا' });
  if (!pin || !safeEqual(pin, process.env.ADMIN_PIN)) {
    await Promise.allSettled([
      recordAttempt(ip, 'admin_pin'),
      recordAttempt('account', 'admin_pin_global'),
    ]);
    return res.status(401).json({ error: 'الرقم السري غلط' });
  }

  await Promise.allSettled([
    supabase.from('login_attempts').delete().eq('ip', ip).eq('context', 'admin_pin'),
    supabase.from('login_attempts').delete().eq('ip', 'account').eq('context', 'admin_pin_global'),
  ]);
  setAdminSession(res, 'PIN', 'pin');
  return res.status(200).json({ ok: true });
};
