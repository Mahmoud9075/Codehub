// بيقفل الـ APIs عشان تشتغل بس من دومين موقعك، مش من أي موقع تاني.
// استخدمه في أول أي endpoint: if (applyCors(req, res)) return; // (يوقف الطلب هنا لو كان OPTIONS)
function applyCors(req, res) {
  // 👈 غيّر ده لدومين موقعك الحقيقي بعد ما تنشره (مثلاً: https://codehub.net)
  const ALLOWED_ORIGIN = process.env.SITE_ORIGIN || '*';

  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-pin, x-admin-google-token, x-super-admin-email, x-super-admin-sig');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true; // خلّي الـ endpoint يوقف هنا
  }
  return false;
}

module.exports = { applyCors };
