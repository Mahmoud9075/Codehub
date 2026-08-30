// api/_lib/password.js
// Compact PBKDF2 v2 hashes + backward compatibility with the older hex format.
const crypto = require('crypto');

const ITERATIONS = 210000;
const DIGEST = 'sha512';
const V2_KEYLEN = 32; // 256-bit derived key; compact enough for legacy varchar columns.
const LEGACY_KEYLEN = 64;

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.pbkdf2(password, salt, ITERATIONS, V2_KEYLEN, DIGEST, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`p2$${ITERATIONS}$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`);
    });
  });
}

function safeCompare(a, b) {
  try { return a.length === b.length && crypto.timingSafeEqual(a, b); }
  catch { return false; }
}

function verifyPassword(password, storedHash) {
  return new Promise((resolve) => {
    try {
      const parts = String(storedHash || '').split('$');
      if (parts.length !== 4) return resolve(false);
      const iterations = Number(parts[1]);
      if (!Number.isFinite(iterations) || iterations < 1 || iterations > 2000000) return resolve(false);

      if (parts[0] === 'p2') {
        const salt = Buffer.from(parts[2], 'base64url');
        const expected = Buffer.from(parts[3], 'base64url');
        if (salt.length < 12 || expected.length < 16 || expected.length > 64) return resolve(false);
        return crypto.pbkdf2(password, salt, iterations, expected.length, DIGEST, (err, derived) => {
          if (err) return resolve(false);
          resolve(safeCompare(derived, expected));
        });
      }

      // Legacy: pbkdf2$iterations$salt-hex$hash-hex
      if (parts[0] === 'pbkdf2') {
        const salt = parts[2];
        const expected = Buffer.from(parts[3], 'hex');
        if (!/^[0-9a-f]+$/i.test(parts[3]) || expected.length !== LEGACY_KEYLEN) return resolve(false);
        return crypto.pbkdf2(password, salt, iterations, LEGACY_KEYLEN, DIGEST, (err, derived) => {
          if (err) return resolve(false);
          resolve(safeCompare(derived, expected));
        });
      }
      resolve(false);
    } catch { resolve(false); }
  });
}

function needsRehash(storedHash) {
  try {
    const parts = String(storedHash || '').split('$');
    return parts.length !== 4 || parts[0] !== 'p2' || Number(parts[1]) < ITERATIONS;
  } catch { return true; }
}

module.exports = { hashPassword, verifyPassword, needsRehash };
