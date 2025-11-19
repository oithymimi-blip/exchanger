import express from 'express';
import db from '../db.js';
import { requireAuth } from '../auth/authMiddleware.js';
import { performFaceCheck } from '../faceCheck.js';

const router = express.Router();

const selectVerificationStmt = db.prepare(`
  SELECT
    document_type,
    document_number,
    document_name,
    document_country,
    document_expires_at,
    status,
    notes,
    submitted_at,
    updated_at,
    document_front IS NOT NULL AS has_document_front,
    document_back IS NOT NULL AS has_document_back,
    selfie IS NOT NULL AS has_selfie,
    face_similarity,
    face_confidence,
    face_checked_at,
    face_check_notes
  FROM verifications
  WHERE user_id = ?
`);

const upsertVerificationStmt = db.prepare(`
  INSERT INTO verifications (user_id, document_type, document_number, document_name, document_country, document_expires_at, document_front, document_back, selfie, status, notes, submitted_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_approval', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT(user_id) DO UPDATE SET
    document_type = excluded.document_type,
    document_number = excluded.document_number,
    document_name = excluded.document_name,
    document_country = excluded.document_country,
    document_expires_at = excluded.document_expires_at,
    document_front = excluded.document_front,
    document_back = excluded.document_back,
    selfie = excluded.selfie,
    status = 'awaiting_approval',
    notes = excluded.notes,
    submitted_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
`);

const ALLOWED_DOCUMENT_TYPES = new Set(['nid', 'passport', 'driver_license']);

function formatVerification(row) {
  if (!row) {
    return { status: 'not_started' };
  }
  return {
    document_type: row.document_type,
    document_number: row.document_number,
    document_name: row.document_name,
    document_country: row.document_country,
    document_expires_at: row.document_expires_at,
    status: row.status || 'pending',
    notes: row.notes,
    submitted_at: row.submitted_at,
    updated_at: row.updated_at,
    has_document_front: Boolean(row.has_document_front),
    has_document_back: Boolean(row.has_document_back),
    has_selfie: Boolean(row.has_selfie),
    face_similarity: row.face_similarity ?? 0,
    face_confidence: row.face_confidence ?? 0,
    face_checked_at: row.face_checked_at,
    face_check_notes: row.face_check_notes
  };
}

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

router.get('/verifications/me', requireAuth, (req, res) => {
  const row = selectVerificationStmt.get(req.user.id);
  res.json(formatVerification(row));
});

router.post('/verifications', requireAuth, (req, res) => {
  try {
    const {
      document_type,
      document_number,
      document_name,
      document_country,
      document_expires_at,
      document_front,
      document_back,
      selfie,
      notes
    } = req.body || {};

    const normalizedType = (document_type || '').trim().toLowerCase();
    if (!ALLOWED_DOCUMENT_TYPES.has(normalizedType)) {
      return res.status(400).json({ error: 'Document type is required' });
    }

    const trimmedNumber = (document_number || '').trim();
    if (!trimmedNumber) {
      return res.status(400).json({ error: 'Document number is required' });
    }

    const trimmedName = (document_name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    const trimmedCountry = (document_country || '').trim();
    if (!trimmedCountry) {
      return res.status(400).json({ error: 'Document issuing country is required' });
    }

    const trimmedExpires = (document_expires_at || '').trim();
    if (!trimmedExpires) {
      return res.status(400).json({ error: 'Document expiration date is required' });
    }

    if (typeof document_front !== 'string' || !document_front.trim()) {
      return res.status(400).json({ error: 'Document front image is required' });
    }
    if (typeof document_back !== 'string' || !document_back.trim()) {
      return res.status(400).json({ error: 'Document back image is required' });
    }
    if (typeof selfie !== 'string' || !selfie.trim()) {
      return res.status(400).json({ error: 'Selfie image is required' });
    }

    upsertVerificationStmt.run(
      req.user.id,
      normalizedType,
      trimmedNumber,
      trimmedName,
      trimmedCountry,
      trimmedExpires,
      document_front.trim(),
      document_back.trim(),
      selfie.trim(),
      typeof notes === 'string' && notes.trim() ? notes.trim() : null
    );

    const saved = selectVerificationStmt.get(req.user.id);
    res.json(formatVerification(saved));
    void performFaceCheck(req.user.id);
  } catch (err) {
    console.error('Failed to save verification:', err);
    res.status(500).json({ error: 'Failed to submit verification' });
  }
});

export default router;
