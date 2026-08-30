const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { getClientIp, tooManyAttempts, recordAttempt } = require('../../_lib/request-security');

const ALLOWED_AUDIENCES = new Set(['أولى ثانوي', 'ثانية ثانوي', 'ولي أمر', 'زائر']);

function cleanText(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function tableMissing(error) {
  return error && (error.code === '42P01' || /site_reviews/i.test(String(error.message || '')) && /does not exist|schema cache/i.test(String(error.message || '')));
}

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('site_reviews')
      .select('id, name, audience, stars, comment, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) {
      if (tableMissing(error)) return res.status(200).json({ reviews: [], average: 0, count: 0, configured: false });
      return res.status(500).json({ error: 'تعذر تحميل التقييمات' });
    }

    const reviews = data || [];
    const average = reviews.length
      ? Math.round((reviews.reduce((sum, review) => sum + Number(review.stars || 0), 0) / reviews.length) * 10) / 10
      : 0;
    return res.status(200).json({ reviews, average, count: reviews.length, configured: true });
  }

  if (req.method === 'POST') {
    const name = cleanText(req.body?.name, 60);
    const audience = cleanText(req.body?.audience || 'زائر', 40);
    const comment = cleanText(req.body?.comment, 400);
    const stars = Number(req.body?.stars);
    const honeypot = cleanText(req.body?.website, 100);

    // حقل مخفي للبوتات؛ الرد الطبيعي يمنع البوت من معرفة قاعدة الحماية.
    if (honeypot) return res.status(202).json({ ok: true, pending: true });

    if (name.length < 2) return res.status(400).json({ error: 'اكتب اسم صحيح' });
    if (!ALLOWED_AUDIENCES.has(audience)) return res.status(400).json({ error: 'اختار صفتك بشكل صحيح' });
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ error: 'اختار تقييم من 1 إلى 5 نجوم' });
    if (comment.length < 5) return res.status(400).json({ error: 'اكتب رأيك بشكل أوضح' });

    const ipHash = getClientIp(req);
    const shortWindow = { ip: ipHash, context: 'public_review_short', windowMs: 15 * 60 * 1000, limit: 2 };
    const dailyWindow = { ip: ipHash, context: 'public_review_daily', windowMs: 24 * 60 * 60 * 1000, limit: 5 };
    if (await tooManyAttempts(shortWindow) || await tooManyAttempts(dailyWindow)) {
      return res.status(429).json({ error: 'أرسلت تقييمات كتير. جرّب مرة تانية بعد شوية.' });
    }

    const { data: recent } = await supabase
      .from('site_reviews')
      .select('id')
      .eq('ip_hash', ipHash)
      .eq('comment', comment)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);
    if (recent && recent.length) return res.status(409).json({ error: 'التقييم ده اتبعت بالفعل' });

    const { data, error } = await supabase
      .from('site_reviews')
      .insert({ name, audience, stars, comment, status: 'pending', ip_hash: ipHash })
      .select('id')
      .single();

    if (error) {
      if (tableMissing(error)) return res.status(503).json({ error: 'نظام التقييمات محتاج تشغيل تحديث قاعدة البيانات أولًا' });
      return res.status(500).json({ error: 'تعذر حفظ التقييم' });
    }

    await Promise.allSettled([
      recordAttempt(ipHash, 'public_review_short'),
      recordAttempt(ipHash, 'public_review_daily'),
    ]);

    return res.status(201).json({ ok: true, pending: true, id: data?.id || null });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
