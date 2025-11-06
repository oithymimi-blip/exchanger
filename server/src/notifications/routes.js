import express from 'express';
import db from '../db.js';
import { requireAuth } from '../auth/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const rows = db.prepare(
    `SELECT n.id, n.title, n.message, n.created_at, n.user_id,
            CASE WHEN nr.read_at IS NULL THEN 0 ELSE 1 END AS is_read
     FROM notifications n
     LEFT JOIN notification_reads nr
       ON nr.notification_id = n.id AND nr.user_id = ?
     WHERE n.user_id IS NULL OR n.user_id = ?
     ORDER BY n.created_at DESC
     LIMIT ?`,
  ).all(req.user.id, req.user.id, limit);

  const unreadCount = rows.reduce((count, row) => count + (row.is_read ? 0 : 1), 0);
  res.json({ notifications: rows, unread: unreadCount });
});

router.post('/read', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const stmt = db.prepare('INSERT OR IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)');
  const tx = db.transaction((list) => {
    for (const id of list) {
      if (!Number.isInteger(id)) continue;
      stmt.run(id, req.user.id);
    }
  });
  tx(ids);
  res.json({ ok: true });
});

router.post('/read-all', (req, res) => {
  const rows = db.prepare(
    `SELECT id FROM notifications
     WHERE user_id IS NULL OR user_id = ?`,
  ).all(req.user.id);
  const stmt = db.prepare('INSERT OR IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)');
  const tx = db.transaction((list) => {
    for (const row of list) {
      stmt.run(row.id, req.user.id);
    }
  });
  tx(rows);
  res.json({ ok: true });
});

export default router;
