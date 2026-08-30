// موزّع طلبات لوحة التحكم (admin) — بيوجّه كل طلب لملفه الأصلي بناءً على route
const handlers = {
  'add-month': require('./_handlers/admin/add-month'),
  'admins': require('./_handlers/admin/admins'),
  'ai-knowledge': require('./_handlers/admin/ai-knowledge'),
  'ai-questions': require('./_handlers/admin/ai-questions'),
  'analytics': require('./_handlers/admin/analytics'),
  'audit-log': require('./_handlers/admin/audit-log'),
  'content': require('./_handlers/admin/content'),
  'dashboard-stats': require('./_handlers/admin/dashboard-stats'),
  'login-pin': require('./_handlers/admin/login-pin'),
  'logout': require('./_handlers/admin/logout'),
  'questions': require('./_handlers/admin/questions'),
  'quizzes': require('./_handlers/admin/quizzes'),
  'results': require('./_handlers/admin/results'),
  'reviews': require('./_handlers/admin/reviews'),
  'settings': require('./_handlers/admin/settings'),
  'session': require('./_handlers/admin/session'),
  'students': require('./_handlers/admin/students'),
  'super-login-request': require('./_handlers/admin/super-login-request'),
  'super-login-verify': require('./_handlers/admin/super-login-verify'),
};

module.exports = async (req, res) => {
  const rawRoute = req.query.route || (req.url || '').split('?')[0].split('/').filter(Boolean).pop();
  const route = typeof rawRoute === 'string' ? rawRoute : '';
  if (!Object.prototype.hasOwnProperty.call(handlers, route)) {
    return res.status(404).json({ error: 'Not found' });
  }
  return handlers[route](req, res);
};
