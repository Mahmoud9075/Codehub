// موزّع طلبات القسم العام (site) — بيوجّه كل طلب لملفه الأصلي بناءً على route
// ده عشان نقلل عدد الـ Serverless Functions (Vercel Hobby بيسمح بـ 12 بس)
const handlers = {
  'ai-chat': require('./_handlers/site/ai-chat'),
  'ai-conversations': require('./_handlers/site/ai-conversations'),
  'content': require('./_handlers/site/content'),
  'months': require('./_handlers/site/months'),
  'parent-view': require('./_handlers/site/parent-view'),
  'ping': require('./_handlers/site/ping'),
  'quiz-questions': require('./_handlers/site/quiz-questions'),
  'quizzes': require('./_handlers/site/quizzes'),
  'settings': require('./_handlers/site/settings'),
  'submit-result': require('./_handlers/site/submit-result'),
  'track-visit': require('./_handlers/site/track-visit'),
};

module.exports = async (req, res) => {
  const route = req.query.route || (req.url || '').split('?')[0].split('/').filter(Boolean).pop();
  const handler = handlers[route];

  if (!handler) {
    return res.status(404).json({ error: 'Not found' });
  }

  return handler(req, res);
};
