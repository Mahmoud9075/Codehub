// موزّع طلبات تسجيل الدخول/الحساب (auth) — بيوجّه كل طلب لملفه الأصلي بناءً على route
const handlers = {
  'forgot-password': require('./_handlers/auth/forgot-password'),
  'login': require('./_handlers/auth/login'),
  'logout': require('./_handlers/auth/logout'),
  'register': require('./_handlers/auth/register'),
  'request-phone-otp': require('./_handlers/auth/request-phone-otp'),
  'session': require('./_handlers/auth/session'),
  'reset-password': require('./_handlers/auth/reset-password'),
  'update-profile': require('./_handlers/auth/update-profile'),
  'verify-phone-otp': require('./_handlers/auth/verify-phone-otp'),
};

module.exports = async (req, res) => {
  const rawRoute = req.query.route || (req.url || '').split('?')[0].split('/').filter(Boolean).pop();
  const route = typeof rawRoute === 'string' ? rawRoute : '';
  if (!Object.prototype.hasOwnProperty.call(handlers, route)) {
    return res.status(404).json({ error: 'Not found' });
  }
  return handlers[route](req, res);
};
