// موزّع طلبات لوحة التحكم (admin) — بيوجّه كل طلب لملفه الأصلي بناءً على route
const handlers = {
  'add-month': require('./_handlers/admin/add-month'),
  'admins': require('./_handlers/admin/admins'),
  'ai-knowledge': require('./_handlers/admin/ai-knowledge'),
  'ai-questions': require('./_handlers/admin/ai-questions'),
  'analytics': require('./_handlers/admin/analytics'),
  'audit-log': require('./_handlers/admin/audit-log'),
  'content': require('./_handlers/admin/content'),
  'login-pin': require('./_handlers/admin/login-pin'),
  'questions': require('./_handlers/admin/questions'),
  'results': require('./_handlers/admin/results'),
  'settings': require('./_handlers/admin/settings'),
  'super-login-request': require('./_handlers/admin/super-login-request'),
  'super-login-verify': require('./_handlers/admin/super-login-verify'),
};

module.exports = async (req, res) => {
  const route = req.query.route || (req.url || '').split('?')[0].split('/').filter(Boolean).pop();
  const handler = handlers[route];

  if (!handler) {
    return res.status(404).json({ error: 'Not found' });
  }

  return handler(req, res);
};
