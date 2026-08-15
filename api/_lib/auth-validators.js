// قواعد التحقق — نفس القواعد بالظبط اللي في الفرونت إند، بس هنا هي المصدر الحقيقي للأمان
// (التحقق في المتصفح بس شكلي، أي حد يقدر يتخطاه، فالتحقق الحقيقي لازم يكون هنا في السيرفر)

const NAME_RE = /^[A-Za-z\u0600-\u06FF\s]{2,}$/;              // حروف عربي/إنجليزي بس
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;                  // شكل إيميل صحيح
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/; // 8+ حروف، كابيتال، سمول، رقم، رمز
const PHONE_RE = /^01[0125]\d{8}$/;                             // رقم مصري: 01 + 0/1/2/5 + 8 أرقام
const DISPOSABLE_DOMAINS = ['tempmail.com', '10minutemail.com', 'guerrillamail.com', 'mailinator.com', 'yopmail.com', 'trashmail.com'];

const MAX_LENGTHS = { name: 60, email: 120, comment: 400, question: 500, generic: 200 };

function withinMaxLength(v, max) {
  return typeof v === 'string' && v.length <= max;
}

function validateName(v) {
  return typeof v === 'string' && NAME_RE.test(v.trim());
}
function validateEmail(v) {
  return typeof v === 'string' && EMAIL_RE.test(v.trim());
}
function validatePassword(v) {
  return typeof v === 'string' && PASSWORD_RE.test(v);
}
function validatePhone(v) {
  return typeof v === 'string' && PHONE_RE.test(v.trim());
}
function normalizeEmail(v) {
  return typeof v === 'string' ? v.trim().toLowerCase() : v;
}
function isDisposableEmail(v) {
  var domain = normalizeEmail(v).split('@')[1] || '';
  return DISPOSABLE_DOMAINS.indexOf(domain) !== -1;
}

module.exports = { validateName, validateEmail, validatePassword, validatePhone, normalizeEmail, isDisposableEmail, withinMaxLength, MAX_LENGTHS };
