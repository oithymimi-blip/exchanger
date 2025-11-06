import express from 'express';
import db from '../db.js';
import { requireAuth } from '../auth/authMiddleware.js';

const router = express.Router();

router.get('/me', requireAuth, (req, res) => {
  const u = db.prepare('SELECT id, email, name, handle, referral_code, role, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(u);
});

router.put('/me', requireAuth, (req, res) => {
  const { name, handle } = req.body || {};
  if (handle) {
    const exists = db.prepare('SELECT id FROM users WHERE handle = ? AND id != ?').get(handle, req.user.id);
    if (exists) return res.status(409).json({ error: 'Handle already taken' });
  }
  db.prepare('UPDATE users SET name = COALESCE(?, name), handle = COALESCE(?, handle), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(name || null, handle || null, req.user.id);
  const u = db.prepare('SELECT id, email, name, handle, referral_code, role, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(u);
});

router.get('/referrals', requireAuth, (req, res) => {
  const codeRow = db.prepare('SELECT referral_code FROM users WHERE id = ?').get(req.user.id);
  const countRow = db.prepare('SELECT COUNT(*) as c FROM referrals WHERE referrer_id = ?').get(req.user.id);
  res.json({ referral_code: codeRow?.referral_code, referred_count: countRow?.c || 0 });
});

export default router;
