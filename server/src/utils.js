import crypto from 'crypto';

export function makeReferralCode() {
  return crypto.randomBytes(3).toString('hex'); // 6 chars
}

export function nowTs() {
  return Math.floor(Date.now() / 1000);
}
