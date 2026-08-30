const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { getClientIp } = require('../../_lib/request-security');

const ALLOWED_AUDIENCES = new Set(['أولى ثانوي', 'ثانية ثانوي', 'ولي أمر', 'زائر']);

function cleanText(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function tableMissing(error) {
  return error && (
    error.code === '42P01' ||
    (/site_reviews/i.test(String(error.message || '')) && /does not exist|schema cache/i.test(String(error.message || '')))
  );
}

function normalizeArabic(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0600-\u06FFa-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const DIRECT_ABUSE = [
  'وسخ', 'وسخه', 'معفن', 'معفنه', 'زباله', 'حقير', 'حقيره', 'قذر', 'قذره',
  'غبي', 'غبيه', 'اهبل', 'هبله', 'حمار', 'حماره', 'كلب', 'كلبه',
  'قليل الادب', 'قله ادب', 'عديم الادب', 'عديمه الادب',
  'عرص', 'خول', 'شرموط', 'شرموطه', 'متناك', 'متناكه', 'كسم', 'كس امك',
  'ابن متناك', 'يلعن', 'لعنه'
];

const DIRECTED_NEGATIVE_PHRASES = [
  'شرحك وحش', 'شرحك وحشه', 'شرحك مش حلو', 'شرحك مش كويس', 'شرحك معفن',
  'شرحكم وحش', 'شرحكم وحشه', 'شرحكم مش حلو', 'شرحكم مش كويس', 'شرحكم معفن',
  'انت مبتفهمش حاجه', 'انتم مبتفهموش حاجه', 'انتوا مبتفهموش حاجه',
  'انت مش فاهم حاجه', 'انتم مش فاهمين حاجه', 'انتوا مش فاهمين حاجه',
  'لبسك وحش', 'لبسك وحشه', 'شكلك وحش', 'شكلك وحشه', 'مراتك وحشه', 'مراتك وحش'
];

const FAMILY_WORDS = [
  'امك', 'ابوك', 'اهلك', 'والدتك', 'والدك', 'اختك', 'اخوك', 'خالك', 'عمك', 'مراتك'
];

const FAMILY_INSULT_WORDS = [
  'وسخ', 'وسخه', 'معفن', 'معفنه', 'زباله', 'قذر', 'قذره', 'حمار', 'حماره',
  'كلب', 'كلبه', 'قليل الادب', 'وحش', 'وحشه', 'قبيح', 'قبيحه', 'لعنه', 'يلعن'
];

function containsPhrase(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

function needsAdminReview(comment) {
  const text = normalizeArabic(comment);
  if (!text) return false;
  if (containsPhrase(text, DIRECT_ABUSE)) return true;
  if (containsPhrase(text, DIRECTED_NEGATIVE_PHRASES)) return true;
  const familyMention = FAMILY_WORDS.some((word) => text.includes(word));
  const familyInsult = FAMILY_INSULT_WORDS.some((word) => text.includes(word));
  if (familyMention && familyInsult) return true;
  return false;
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
      if (tableMissing(error)) {
        return res.status(200).json({ reviews: [], average: 0, count: 0, configured: false });
      }
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

    // Anti-bot only. No public-review rate limit: real users can submit more than one review.
    if (honeypot) {
      return res.status(202).json({ ok: true, pending: true, message: 'شكرًا لتقييمك ❤️ رأيك وصلنا.' });
    }

    if (name.length < 2) return res.status(400).json({ error: 'اكتب اسم صحيح' });
    if (!ALLOWED_AUDIENCES.has(audience)) return res.status(400).json({ error: 'اختار صفتك بشكل صحيح' });
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ error: 'اختار تقييم من 1 إلى 5 نجوم' });
    if (comment.length < 5) return res.status(400).json({ error: 'اكتب رأيك بشكل أوضح' });

    const pending = needsAdminReview(comment);
    const ipHash = getClientIp(req);

    const { data, error } = await supabase
      .from('site_reviews')
      .insert({
        name,
        audience,
        stars,
        comment,
        status: pending ? 'pending' : 'approved',
        ip_hash: ipHash,
      })
      .select('id')
      .single();

    if (error) {
      if (tableMissing(error)) {
        return res.status(503).json({ error: 'نظام التقييمات محتاج تشغيل تحديث قاعدة البيانات أولًا' });
      }
      return res.status(500).json({ error: 'تعذر حفظ التقييم' });
    }

    // Same user-facing message in both cases: we don't expose moderation details to the visitor.
    return res.status(201).json({
      ok: true,
      pending,
      id: data?.id || null,
      message: 'شكرًا لتقييمك ❤️ رأيك وصلنا.'
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
