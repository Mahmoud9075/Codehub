function normalizeOrigin(value) {
  try { return new URL(value).origin; }
  catch (error) { return null; }
}

function allowedOrigins(req) {
  const configured = String(process.env.SITE_ORIGIN || '')
    .split(',')
    .map((item) => normalizeOrigin(item.trim()))
    .filter(Boolean);

  const host = String(req.headers?.host || '').trim();
  if (host) {
    configured.push(`https://${host}`);
    if (host.startsWith('localhost:') || host.startsWith('127.0.0.1:')) configured.push(`http://${host}`);
  }

  configured.push('https://codehub-blue-kappa.vercel.app');
  return new Set(configured);
}

function applyCors(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Origin');

  const origin = req.headers?.origin ? normalizeOrigin(req.headers.origin) : null;
  const allowed = allowedOrigins(req);
  if (origin && !allowed.has(origin)) {
    res.status(403).json({ error: 'Origin not allowed' });
    return true;
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-google-token');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { applyCors };
