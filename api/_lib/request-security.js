const crypto = require('crypto');
const { supabase } = require('./supabase');

function getClientIp(req) {
  // Return a stable pseudonymous key instead of storing the visitor's raw IP address.
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const raw = forwarded || req.socket?.remoteAddress || 'unknown';
  const secret = process.env.IP_PEPPER || process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'codehub-ip-key';
  return crypto.createHmac('sha256', secret).update(raw).digest('hex').slice(0, 32);
}

function shortHash(value) {
  const secret = process.env.IP_PEPPER || process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'codehub-context-key';
  return crypto.createHmac('sha256', secret).update(String(value || '')).digest('hex').slice(0, 20);
}

async function tooManyAttempts({ ip, context, windowMs, limit }) {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await supabase
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('context', context)
    .gte('attempted_at', since);
  // Fail closed: if the limiter table cannot be checked, do not silently disable protection.
  if (error) return true;
  return (count || 0) >= limit;
}

async function recordAttempt(ip, context) {
  await supabase.from('login_attempts').insert({ ip, context });
}

module.exports = { getClientIp, shortHash, tooManyAttempts, recordAttempt };
