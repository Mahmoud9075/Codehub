const bookKnowledge = require('../_data/books-knowledge.json');

const STOP_WORDS = new Set([
  'ازاي', 'ايه', 'اي', 'ايوه', 'انا', 'انت', 'انتي', 'هو', 'هي', 'هما', 'احنا',
  'ده', 'دي', 'دول', 'دا', 'في', 'من', 'عن', 'علي', 'على', 'الي', 'اللي', 'او',
  'و', 'ثم', 'لو', 'ما', 'ماذا', 'متي', 'متى', 'هل', 'ليه', 'كيف', 'كان', 'تكون',
  'شرح', 'اشرح', 'وضح', 'عاوز', 'عايز', 'ممكن', 'سؤال', 'اجابه', 'اجابة', 'كتاب',
  'صفحه', 'صفحة', 'درس', 'منهج', 'يعني', 'ببساطه', 'ببساطة', 'please', 'what',
  'how', 'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'about',
]);

function normalizeArabic(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^a-z0-9\u0621-\u064a+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeArabic(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

const preparedChunks = (bookKnowledge.chunks || []).map((chunk) => {
  const normalized = normalizeArabic(`${chunk.book} ${chunk.grade} ${chunk.text}`);
  return { ...chunk, normalized, tokens: new Set(tokenize(normalized)) };
});

const documentFrequency = new Map();
for (const chunk of preparedChunks) {
  for (const token of chunk.tokens) {
    documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
  }
}

function idf(token) {
  return Math.log((preparedChunks.length + 1) / ((documentFrequency.get(token) || 0) + 1)) + 1;
}

function retrieveBookContext(question, history = [], limit = 8) {
  const recentUserContext = (Array.isArray(history) ? history : [])
    .filter((message) => message && message.role === 'user')
    .slice(-2)
    .map((message) => message.content || '')
    .join(' ');
  const query = `${recentUserContext} ${question || ''}`.trim();
  const normalizedQuery = normalizeArabic(query);
  const queryTokens = [...new Set(tokenize(query))];
  const asksFirstGrade = /(?:اولي|الاول|اولى).*ثانوي|ثانوي.*(?:اولي|الاول|اولى)/.test(normalizedQuery);
  const asksSecondGrade = /(?:تانيه|الثاني|ثانية).*ثانوي|ثانوي.*(?:تانيه|الثاني|ثانية)/.test(normalizedQuery);

  const ranked = preparedChunks.map((chunk) => {
    let score = 0;
    let matches = 0;
    for (const token of queryTokens) {
      if (chunk.tokens.has(token)) {
        score += idf(token);
        matches += 1;
      }
    }
    for (let index = 0; index < queryTokens.length - 1; index += 1) {
      const pair = `${queryTokens[index]} ${queryTokens[index + 1]}`;
      if (pair.length > 5 && chunk.normalized.includes(pair)) score += 2.5;
    }
    if (normalizedQuery.length >= 8 && chunk.normalized.includes(normalizedQuery)) score += 8;
    if (asksFirstGrade && chunk.grade.includes('الأول')) score += 2;
    if (asksSecondGrade && chunk.grade.includes('الثاني')) score += 2;
    // صفحات البداية غالبًا غلاف أو فهرس، فلا تسبق صفحة الشرح الفعلية في النتائج.
    if (chunk.page <= 5 && !/(فهرس|مقدمه|مقدمة|محتويات)/.test(normalizedQuery)) score *= 0.3;
    // صفحة عنوان الوحدة القصيرة مفيدة للسياق، لكنها أقل أهمية من صفحة الشرح التفصيلي.
    if (chunk.text.length < 600) score *= 0.55;
    return { chunk, score, matches };
  }).filter((item) => item.score > 0);

  ranked.sort((a, b) => b.score - a.score || b.matches - a.matches || a.chunk.page - b.chunk.page);
  const selected = [];
  const selectedPages = new Set();
  let totalCharacters = 0;
  for (const item of ranked) {
    if (selected.length >= limit) break;
    const pageKey = `${item.chunk.book}:${item.chunk.page}`;
    if (selectedPages.has(pageKey)) continue;
    const size = item.chunk.text.length;
    if (totalCharacters + size > 24000 && selected.length >= 4) continue;
    selected.push(item);
    selectedPages.add(pageKey);
    totalCharacters += size;
  }

  return {
    matches: selected.map((item) => item.chunk),
    bestScore: selected[0]?.score || 0,
    queryTokens,
    context: selected.map(({ chunk }) => (
      `### ${chunk.book} - ${chunk.grade} - صفحة ${chunk.page}\n${chunk.text}`
    )).join('\n\n'),
  };
}

function getBookStats() {
  return bookKnowledge.books || [];
}

module.exports = { getBookStats, normalizeArabic, retrieveBookContext };
