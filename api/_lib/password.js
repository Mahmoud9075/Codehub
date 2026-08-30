// api/_lib/password.js
// Password hashing using Node's built-in crypto module (no external dependency).
// Uses PBKDF2 with a random salt per password.

const crypto = require('crypto');

const ITERATIONS = 210000;
const KEYLEN = 64;
const DIGEST = 'sha512';

/**
 * Hash a plain-text password.
 * Returns a string in the format: pbkdf2$<iterations>$<salt-hex>$<hash-hex>
 */
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.pbkdf2(password, salt, ITERATIONS, KEYLEN, DIGEST, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`pbkdf2$${ITERATIONS}$${salt}$${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verify a plain-text password against a stored hash produced by hashPassword.
 * Returns true/false. Never throws for malformed hashes — just returns false.
 */
function verifyPassword(password, storedHash) {
  return new Promise((resolve) => {
    try {
      if (!storedHash || typeof storedHash !== 'string') return resolve(false);
      const parts = storedHash.split('$');
      if (parts.length !== 4 || parts[0] !== 'pbkdf2') return resolve(false);
      const iterations = parseInt(parts[1], 10);
      const salt = parts[2];
      const originalHash = parts[3];

      crypto.pbkdf2(password, salt, iterations, KEYLEN, DIGEST, (err, derivedKey) => {
        if (err) return resolve(false);
        const derivedHex = derivedKey.toString('hex');
        try {
          const match = crypto.timingSafeEqual(
            Buffer.from(derivedHex, 'hex'),
            Buffer.from(originalHash, 'hex')
          );
          resolve(match);
        } catch {
          resolve(false);
        }
      });
    } catch {
      resolve(false);
    }
  });
}

function needsRehash(storedHash) {
  try {
    const parts = String(storedHash || '').split('$');
    return parts.length !== 4 || parts[0] !== 'pbkdf2' || Number(parts[1]) < ITERATIONS;
  } catch (error) { return true; }
}

module.exports = { hashPassword, verifyPassword, needsRehash };
