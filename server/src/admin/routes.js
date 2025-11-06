import express from 'express';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../auth/authMiddleware.js';
import { setPrice, forcePump, resetEngine, clearTicks, emitSocket } from '../market/engine.js';
import { INITIAL_BALANCE } from '../config.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/market', (req, res) => {
  const s = db.prepare('SELECT * FROM market_settings WHERE id = 1').get();
  res.json(s);
});

router.post('/market/set-price', (req, res) => {
  const { price } = req.body || {};
  if (typeof price !== 'number' || price <= 0) return res.status(400).json({ error: 'Invalid price' });
  const p = setPrice(price);
  db.prepare('INSERT INTO activity_logs (actor_role, action, meta) VALUES (?, ?, ?)')
    .run('admin', 'set_price', JSON.stringify({ price }));
  res.json({ ok: true, price: p });
});

router.post('/market/set-volatility', (req, res) => {
  const { volatility } = req.body || {};
  if (typeof volatility !== 'number' || volatility < 0 || volatility > 1) return res.status(400).json({ error: 'Invalid volatility' });
  db.prepare('UPDATE market_settings SET volatility = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(volatility);
  db.prepare('INSERT INTO activity_logs (actor_role, action, meta) VALUES (?, ?, ?)')
    .run('admin', 'set_volatility', JSON.stringify({ volatility }));
  res.json({ ok: true, volatility });
});

router.post('/market/pause', (req, res) => {
  db.prepare('UPDATE market_settings SET paused = 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run();
  db.prepare('INSERT INTO activity_logs (actor_role, action, meta) VALUES (?, ?, ?)')
    .run('admin', 'pause_market', '{}');
  res.json({ ok: true });
});

router.post('/market/resume', (req, res) => {
  db.prepare('UPDATE market_settings SET paused = 0, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run();
  db.prepare('INSERT INTO activity_logs (actor_role, action, meta) VALUES (?, ?, ?)')
    .run('admin', 'resume_market', '{}');
  res.json({ ok: true });
});

router.post('/market/pump', (req, res) => {
  const { percentage } = req.body || {};
  if (typeof percentage !== 'number') return res.status(400).json({ error: 'percentage required' });
  const price = forcePump(percentage);
  db.prepare('INSERT INTO activity_logs (actor_role, action, meta) VALUES (?, ?, ?)')
    .run('admin', 'pump', JSON.stringify({ percentage, resulting_price: price }));
  res.json({ ok: true, price });
});

router.post('/market/reset', (req, res) => {
  const { base_price, volatility, symbol, pip_size } = req.body || {};
  const current = db.prepare('SELECT * FROM market_settings WHERE id = 1').get();
  const nextBase = typeof base_price === 'number' && base_price > 0 ? base_price : current?.base_price || 60000;
  const nextVol = typeof volatility === 'number' && volatility >= 0 && volatility <= 1 ? volatility : current?.volatility || 0.02;
  const nextSymbol = typeof symbol === 'string' && symbol.trim() ? symbol.trim() : current?.symbol || 'BTCUSDT';
  const nextPipSize = typeof pip_size === 'number' && pip_size > 0 ? pip_size : current?.pip_size || 1;

  const tx = db.transaction(() => {
    db.exec('DELETE FROM trades');
    db.exec('DELETE FROM candles');
    db.exec('DELETE FROM activity_logs');
    db.exec('DELETE FROM ticks');
    db.prepare('UPDATE balances SET available = ?, locked = 0').run(INITIAL_BALANCE);
    db.prepare(`
      UPDATE market_settings
      SET symbol = ?, base_price = ?, volatility = ?, paused = 0, pip_size = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(nextSymbol, nextBase, nextVol, nextPipSize);
  });

  tx();
  resetEngine(nextBase);
  clearTicks();

  const updated = db.prepare('SELECT * FROM market_settings WHERE id = 1').get();
  db.prepare('INSERT INTO activity_logs (actor_role, action, meta) VALUES (?, ?, ?)')
    .run('admin', 'reset_market', JSON.stringify({ base_price: nextBase, volatility: nextVol, symbol: nextSymbol, pip_size: nextPipSize }));

  res.json({ ok: true, settings: updated });
});

router.post('/users/set-balance', (req, res) => {
  const { user_id, email, amount } = req.body || {};
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) {
    return res.status(400).json({ error: 'amount must be a number' });
  }

  let user = null;
  if (user_id) {
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  } else if (email) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('INSERT OR IGNORE INTO balances (user_id, available, locked) VALUES (?, ?, 0)').run(user.id, numericAmount);
  db.prepare('UPDATE balances SET available = ?, locked = 0 WHERE user_id = ?').run(numericAmount, user.id);

  db.prepare('INSERT INTO activity_logs (user_id, actor_role, action, meta) VALUES (?, ?, ?, ?)')
    .run(user.id, 'admin', 'set_user_balance', JSON.stringify({ amount: numericAmount }));

  const balance = db.prepare('SELECT * FROM balances WHERE user_id = ?').get(user.id);
  res.json({ ok: true, user: { id: user.id, email: user.email }, balance });
});

router.post('/notifications', (req, res) => {
  const { title, message, user_id, email } = req.body || {};
  if (!title || !message) {
    return res.status(400).json({ error: 'title and message required' });
  }

  let targetId = null;
  if (user_id) {
    const row = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
    if (!row) return res.status(404).json({ error: 'Target user not found' });
    targetId = row.id;
  } else if (email) {
    const row = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!row) return res.status(404).json({ error: 'Target user not found' });
    targetId = row.id;
  }

  const result = db.prepare('INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)')
    .run(targetId, title, message);
  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid);

  db.prepare('INSERT INTO activity_logs (actor_role, action, meta) VALUES (?, ?, ?)')
    .run('admin', 'create_notification', JSON.stringify({ id: result.lastInsertRowid, title, user_id: targetId }));

  emitSocket('notification', { notification });

  res.json({ ok: true, id: result.lastInsertRowid });
});

router.get('/audit', (req, res) => {
  const rows = db.prepare('SELECT * FROM activity_logs ORDER BY ts DESC LIMIT 200').all();
  res.json(rows);
});

export default router;
