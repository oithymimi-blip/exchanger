import express from 'express';
import db from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, INITIAL_BALANCE } from '../config.js';
import { makeReferralCode } from '../utils.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Bootstrap admin if not exists
function ensureAdmin() {
  const stmt = db.prepare('SELECT id FROM users WHERE email = ?');
  const existing = stmt.get(ADMIN_EMAIL);
  if (!existing) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    const code = makeReferralCode();
    const insert = db.prepare(`
      INSERT INTO users (email, password_hash, name, handle, referral_code, role)
      VALUES (?, ?, 'Admin', 'admin', ?, 'admin')
    `);
    insert.run(ADMIN_EMAIL, hash, code);
    const admin = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
    db.prepare('INSERT OR IGNORE INTO balances (user_id, available, locked) VALUES (?, ?, 0)').run(admin.id, INITIAL_BALANCE);
    console.log('[BOOT] Admin user created:', ADMIN_EMAIL);
  }
}
ensureAdmin();

router.post('/signup', (req, res) => {
  const { email, password, name, handle, ref } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already registered' });
  if (handle) {
    const h = db.prepare('SELECT id FROM users WHERE handle = ?').get(handle);
    if (h) return res.status(409).json({ error: 'Handle already taken' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const code = makeReferralCode();
  const ins = db.prepare(`
    INSERT INTO users (email, password_hash, name, handle, referral_code, referred_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  ins.run(email, hash, name || '', handle || null, code, ref || null);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  db.prepare('INSERT OR IGNORE INTO balances (user_id, available, locked) VALUES (?, ?, 0)').run(user.id, INITIAL_BALANCE);

  // Referral record
  if (ref) {
    const referrer = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(ref);
    if (referrer) {
      db.prepare('INSERT OR IGNORE INTO referrals (referrer_id, referee_id) VALUES (?, ?)').run(referrer.id, user.id);
    }
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, handle: user.handle, role: user.role, referral_code: user.referral_code } });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, handle: user.handle, role: user.role, referral_code: user.referral_code } });
});

router.post('/request-password-reset', (req, res) => {
  const { email } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.json({ ok: true }); // don't leak
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 1000*60*30).toISOString(); // 30 mins
  db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt);
  const link = `http://localhost:5173/reset-password?token=${token}`;
  console.log('[RESET] Password reset link (dev):', link);
  res.json({ ok: true });
});

router.post('/reset-password', (req, res) => {
  const { token, new_password } = req.body || {};
  const row = db.prepare('SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0').get(token);
  if (!row) return res.status(400).json({ error: 'Invalid token' });
  if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'Token expired' });
  const hash = require('bcryptjs').hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, row.user_id);
  db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

export default router;
