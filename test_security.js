'use strict';
const assert = require('assert');
const crypto = require('crypto');

process.env.SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
process.env.OTP_PEPPER = process.env.OTP_PEPPER || crypto.randomBytes(32).toString('hex');

const { signPayload, verifyPayload } = require('./api/_lib/session');
const { digestOtp, verifyOtp } = require('./api/_lib/otp');
const { hashPassword, verifyPassword, needsRehash } = require('./api/_lib/password');

(async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signPayload({ typ: 'student', sub: 'abc', exp: now + 60 }, process.env.SESSION_SECRET);
  assert.equal(verifyPayload(token, process.env.SESSION_SECRET).sub, 'abc');
  const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
  assert.equal(verifyPayload(tampered, process.env.SESSION_SECRET), null);
  const expired = signPayload({ typ: 'student', sub: 'abc', exp: now - 1 }, process.env.SESSION_SECRET);
  assert.equal(verifyPayload(expired, process.env.SESSION_SECRET), null);

  const code = '123456';
  const digest = digestOtp(code, 'phone:test-user');
  assert.ok(digest.startsWith('h1:'));
  assert.notEqual(digest, code);
  assert.equal(verifyOtp(digest, code, 'phone:test-user'), true);
  assert.equal(verifyOtp(digest, '654321', 'phone:test-user'), false);
  assert.equal(verifyOtp(code, code, 'phone:test-user'), true, 'legacy plaintext OTPs remain transitionally verifiable');

  const password = 'StrongPass!123';
  const current = await hashPassword(password);
  assert.equal(await verifyPassword(password, current), true);
  assert.equal(await verifyPassword('WrongPass!123', current), false);
  assert.equal(needsRehash(current), false);

  const legacyIterations = 100000;
  const salt = crypto.randomBytes(16).toString('hex');
  const legacyHash = crypto.pbkdf2Sync(password, salt, legacyIterations, 64, 'sha512').toString('hex');
  const legacy = `pbkdf2$${legacyIterations}$${salt}$${legacyHash}`;
  assert.equal(await verifyPassword(password, legacy), true);
  assert.equal(needsRehash(legacy), true);

  console.log('Security unit tests: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
