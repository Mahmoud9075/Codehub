const crypto = require('crypto');
const { supabase } = require('./supabase');
const { signPayload, verifyPayload, parseCookies, setCookie, clearCookie, safeEqual } = require('./session');

const COOKIE_NAME = 'ch_student_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;

function sessionSecret() {
  return process.env.STUDENT_SESSION_SECRET || process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function passwordVersion(passwordHash) {
  return crypto.createHash('sha256').update(String(passwordHash || '')).digest('hex').slice(0, 24);
}

function setStudentSession(res, studentId, passwordHash) {
  const now = Math.floor(Date.now() / 1000);
  const token = signPayload({
    typ: 'student',
    sub: String(studentId),
    pv: passwordVersion(passwordHash),
    iat: now,
    exp: now + SESSION_SECONDS,
  }, sessionSecret());
  setCookie(res, COOKIE_NAME, token, { maxAge: SESSION_SECONDS, httpOnly: true, sameSite: 'Lax' });
}

function clearStudentSession(res) {
  clearCookie(res, COOKIE_NAME, { httpOnly: true, sameSite: 'Lax' });
}

async function getStudentSession(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  const payload = verifyPayload(token, sessionSecret());
  if (!payload || payload.typ !== 'student' || !payload.sub || !payload.pv) return null;

  const { data: student, error } = await supabase
    .from('students')
    .select('id, password_hash')
    .eq('id', payload.sub)
    .maybeSingle();

  if (error || !student || !safeEqual(payload.pv, passwordVersion(student.password_hash))) return null;
  return { id: student.id };
}

async function requireStudent(req, res) {
  const session = await getStudentSession(req);
  if (!session) {
    clearStudentSession(res);
    res.status(401).json({ error: 'الجلسة انتهت. سجّل دخول من جديد.' });
    return null;
  }
  return session;
}

module.exports = {
  setStudentSession,
  clearStudentSession,
  getStudentSession,
  requireStudent,
};
