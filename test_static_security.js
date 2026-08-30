const fs = require('fs');
const path = require('path');

const root = __dirname;
const frontendFiles = [
  'index.html', 'admin.html', 'parent.html', 'privacy.html', '404.html',
  'assets/site.js', 'assets/admin.js', 'assets/parent.js', 'assets/site.css',
];

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const frontend = frontendFiles.map((f) => `\n/* ${f} */\n${read(f)}`).join('\n');
const forbiddenSecrets = [
  'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY', 'WHATSAPP_TOKEN',
  'ADMIN_SESSION_SECRET', 'STUDENT_SESSION_SECRET', 'OTP_PEPPER', 'IP_PEPPER',
];
for (const secret of forbiddenSecrets) {
  assert(!frontend.includes(secret), `Server-only secret identifier leaked to frontend: ${secret}`);
}

assert(!/\bstudent_id\b/.test(read('index.html') + read('assets/site.js')), 'Frontend must not trust/send student_id');
assert(!/\beval\s*\(|new\s+Function\s*\(|document\.write\s*\(/i.test(frontend), 'Dangerous dynamic-code pattern found');
assert(!/javascript\s*:/i.test(frontend), 'javascript: URL found');

for (const htmlFile of ['index.html', 'admin.html', 'parent.html', 'privacy.html', '404.html']) {
  const html = read(htmlFile);
  assert(!/\son[a-z]+\s*=/i.test(html), `Inline event handler found in ${htmlFile}`);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    const attrs = match[1] || '';
    const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : '';
    const hasSrc = /\bsrc\s*=/i.test(attrs);
    const dataOnly = type === 'application/ld+json' || type === 'application/json';
    assert(hasSrc || dataOnly, `Executable inline script found in ${htmlFile}`);
  }
}

const vercel = JSON.parse(read('vercel.json'));
const cspHeader = (vercel.headers || [])
  .flatMap((group) => group.headers || [])
  .find((h) => String(h.key).toLowerCase() === 'content-security-policy');
assert(cspHeader, 'CSP header missing');
const scriptSrc = String(cspHeader.value).split(';').map((x) => x.trim()).find((x) => x.startsWith('script-src')) || '';
assert(scriptSrc && !scriptSrc.includes("'unsafe-inline'"), "script-src must not allow 'unsafe-inline'");
assert(String(cspHeader.value).includes("object-src 'none'"), "CSP object-src 'none' missing");
assert(String(cspHeader.value).includes("frame-ancestors 'none'"), "CSP frame-ancestors 'none' missing");

console.log('Static security checks: PASS');
