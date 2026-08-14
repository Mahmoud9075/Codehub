const crypto = require('crypto');
const { supabase } = require('../_supabase');
const { applyCors } = require('../_cors');

// POST /api/admin/super-login-verify   body: { email, code }
// لو الكود صح، بيرجّع توقيع (signature) — الفرونت إند بيحفظه ويبعته في كل طلب أدمن بعد كده
// جوه هيدرز x-super-admin-email و x-super-admin-sig.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: 'الإيميل والكود مطلوبين' });

  const normalizedEmail = email.toLowerCase().trim();

  const { data: otp } = await supabase
    .from('super_admin_otps')
    .select('*')
    .eq('email', normalizedEmail)
    .eq('code', code)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) return res.status(400).json({ error: 'الكود غلط أو منتهي' });

  await supabase.from('super_admin_otps').update({ used: true }).eq('id', otp.id);

  if (!process.env.SUPER_ADMIN_SECRET) {
    return res.status(500).json({ error: 'الإعداد ناقص: SUPER_ADMIN_SECRET' });
  }

  const signature = crypto
    .createHmac('sha256', process.env.SUPER_ADMIN_SECRET)
    .update(normalizedEmail)
    .digest('hex');

  return res.status(200).json({ ok: true, email: normalizedEmail, signature });
};
