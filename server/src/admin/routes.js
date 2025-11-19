import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { requireAuth, requireAdminRole } from '../auth/authMiddleware.js';
import { setPrice, forcePump, resetEngine, clearTicks, emitSocket, currentPrice } from '../market/engine.js';
import { INITIAL_BALANCE } from '../config.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireAdminRole());

const ensureSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Main admin only' });
  }
  next();
};

const selectStats = {
  totalUsers: db.prepare('SELECT COUNT(*) AS value FROM users'),
  totalTrades: db.prepare('SELECT COUNT(*) AS value FROM trades'),
  totalInvested: db.prepare('SELECT IFNULL(SUM(notional), 0) AS value FROM trades'),
  totalPnl: db.prepare('SELECT IFNULL(SUM(pnl), 0) AS value FROM trades WHERE status = \'closed\''),
  dayChange: db.prepare(`SELECT IFNULL(SUM(pnl), 0) AS value FROM trades WHERE COALESCE(closed_at, created_at) >= datetime('now','-1 day')`),
  totalNotifications: db.prepare('SELECT COUNT(*) AS value FROM notifications')
};

const selectBalancesSummary = db.prepare(`
  SELECT
    IFNULL(SUM(available), 0) AS available,
    IFNULL(SUM(locked), 0) AS locked
  FROM balances
`);

const selectTopBalances = db.prepare(`
  SELECT
    u.id,
    u.email,
    u.name,
    u.handle,
    IFNULL(b.available, 0) AS available,
    IFNULL(b.locked, 0) AS locked
  FROM users u
  LEFT JOIN balances b ON b.user_id = u.id
  ORDER BY (IFNULL(b.available,0) + IFNULL(b.locked,0)) DESC
  LIMIT 8
`);

const selectRecentTrades = db.prepare(`
  SELECT t.id, t.symbol, t.side, t.status, t.price, t.pnl, t.notional, t.created_at, t.closed_at,
         u.email, u.name
  FROM trades t
  LEFT JOIN users u ON u.id = t.user_id
  ORDER BY t.created_at DESC
  LIMIT 20
`);

const selectRecentNotifications = db.prepare(`
  SELECT n.id, n.title, n.message, n.created_at, u.email
  FROM notifications n
  LEFT JOIN users u ON u.id = n.user_id
  ORDER BY n.created_at DESC
  LIMIT 10
`);

const selectActivityLog = db.prepare(`
  SELECT id, actor_role, action, meta, ts
  FROM activity_logs
  ORDER BY ts DESC
  LIMIT 20
`);

const selectVerificationsForAdmin = db.prepare(`
  SELECT
    v.id,
    v.user_id,
    v.document_type,
    v.status,
    v.notes,
    v.face_similarity,
    v.face_confidence,
    v.face_checked_at,
    v.face_check_notes,
    v.submitted_at,
    v.updated_at,
    u.email,
    u.name,
    u.handle
  FROM verifications v
  JOIN users u ON u.id = v.user_id
  ORDER BY v.submitted_at DESC
  LIMIT 200
`);
const updateVerificationStatusStmt = db.prepare(`
  UPDATE verifications
  SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
  WHERE user_id = ?
`);
const ALLOWED_VERIFICATION_STATUSES = new Set(['pending', 'awaiting_approval', 'approved', 'rejected']);

const listSubadminsStmt = db.prepare(`
  SELECT u.id, u.email, u.name, u.created_at, IFNULL(p.permissions, '[]') AS permissions
  FROM users u
  LEFT JOIN admin_permissions p ON p.user_id = u.id
  WHERE u.role = 'subadmin'
  ORDER BY u.created_at DESC
`);

const insertSubadminStmt = db.prepare(`
  INSERT INTO users (email, password_hash, name, role)
  VALUES (?, ?, ?, 'subadmin')
`);

const upsertPermissionsStmt = db.prepare(`
  INSERT INTO admin_permissions (user_id, permissions)
  VALUES (?, json(?))
  ON CONFLICT(user_id) DO UPDATE SET permissions = json(?), updated_at = CURRENT_TIMESTAMP
`);

const selectChannelsStmt = db.prepare('SELECT * FROM market_channels ORDER BY channel');
const selectChannelStmt = db.prepare('SELECT * FROM market_channels WHERE channel = ?');

function getOtcChannelSnapshot() {
  const market = db.prepare('SELECT * FROM market_settings WHERE id = 1').get();
  return {
    channel: 'OTC',
    label: 'OTC Desk',
    base_price: Number(market?.base_price ?? 0),
    volatility: Number(market?.volatility ?? 0),
    speed: Number(market?.speed_multiplier ?? 1),
    status: market?.paused ? 'paused' : 'live',
    description: 'Primary admin-controlled OTC feed'
  };
}

function syncOtcChannelRow() {
  const otc = getOtcChannelSnapshot();
  db.prepare(`
    UPDATE market_channels
    SET base_price = ?, volatility = ?, speed = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE channel = 'OTC'
  `).run(otc.base_price, otc.volatility, otc.speed, otc.status);
  return otc;
}

router.get('/market', requireAdminRole('market'), (req, res) => {
  const s = db.prepare('SELECT * FROM market_settings WHERE id = 1').get();
  res.json(s);
});

router.get('/markets', requireAdminRole('market'), (req, res) => {
  const otc = getOtcChannelSnapshot();
  const channels = selectChannelsStmt.all().map(ch => {
    if (ch.channel === 'OTC') {
      return { ...ch, ...otc };
    }
    return {
      ...ch,
      base_price: Number(ch.base_price ?? 0),
      volatility: Number(ch.volatility ?? 0),
      speed: Number(ch.speed ?? 1)
    };
  });
  res.json({ channels, otc });
});

function updateMarketChannel(channel, payload = {}) {
  const normalized = channel.toUpperCase();
  if (normalized === 'OTC') {
    const fields = [];
    const params = [];
    if (typeof payload.volatility === 'number') {
      fields.push('volatility = ?');
      params.push(payload.volatility);
    }
    if (typeof payload.speed === 'number') {
      fields.push('speed_multiplier = ?');
      params.push(payload.speed);
    }
    if (payload.status) {
      const paused = payload.status === 'paused' ? 1 : 0;
      fields.push('paused = ?');
      params.push(paused);
    }
    if (fields.length) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      db.prepare(`UPDATE market_settings SET ${fields.join(', ')} WHERE id = 1`).run(...params);
    }
    if (typeof payload.base_price === 'number' && payload.base_price > 0) {
      setPrice(payload.base_price);
    }
    return syncOtcChannelRow();
  }
  const row = selectChannelStmt.get(normalized);
  if (!row) return null;
  const updates = [];
  const params = [];
  if (typeof payload.base_price === 'number') {
    updates.push('base_price = ?');
    params.push(payload.base_price);
  }
  if (typeof payload.volatility === 'number') {
    updates.push('volatility = ?');
    params.push(payload.volatility);
  }
  if (typeof payload.speed === 'number') {
    updates.push('speed = ?');
    params.push(payload.speed);
  }
  if (payload.status) {
    updates.push('status = ?');
    params.push(payload.status);
  }
  if (!updates.length) {
    return {
      ...row,
      base_price: Number(row.base_price ?? 0),
      volatility: Number(row.volatility ?? 0),
      speed: Number(row.speed ?? 1)
    };
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  db.prepare(`UPDATE market_channels SET ${updates.join(', ')} WHERE channel = ?`).run(...params, normalized);
  return selectChannelStmt.get(normalized);
}

router.post('/markets/:channel', requireAdminRole('market'), (req, res) => {
  const channel = (req.params.channel || '').toUpperCase();
  const result = updateMarketChannel(channel, req.body || {});
  if (!result) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  db.prepare('INSERT INTO activity_logs (actor_role, action, meta) VALUES (?, ?, ?)')
    .run(req.user.role, 'update_market_channel', JSON.stringify({ channel, payload: req.body || {}, actor: req.user.id }));
  res.json({ ok: true, channel: result });
});

router.post('/markets/:channel/pulse', requireAdminRole('market'), (req, res) => {
  const channel = (req.params.channel || '').toUpperCase();
  const { percentage } = req.body || {};
  if (typeof percentage !== 'number') {
    return res.status(400).json({ error: 'percentage required' });
  }
  if (channel === 'OTC') {
    const price = forcePump(percentage);
    syncOtcChannelRow();
    return res.json({ ok: true, price });
  }
  const row = selectChannelStmt.get(channel);
  if (!row) return res.status(404).json({ error: 'Channel not found' });
  const nextPrice = Number(row.base_price || 0) * (1 + percentage / 100);
  db.prepare('UPDATE market_channels SET base_price = ?, updated_at = CURRENT_TIMESTAMP WHERE channel = ?')
    .run(nextPrice, channel);
  db.prepare('INSERT INTO activity_logs (actor_role, action, meta) VALUES (?, ?, ?)')
    .run(req.user.role, 'pulse_market_channel', JSON.stringify({ channel, percentage, actor: req.user.id }));
  res.json({ ok: true, price: nextPrice });
});

router.get('/dashboard', requireAdminRole('analytics'), (req, res) => {
  const stats = {
    totalUsers: selectStats.totalUsers.get().value,
    totalTrades: selectStats.totalTrades.get().value,
    totalInvested: selectStats.totalInvested.get().value,
    totalPnL: selectStats.totalPnl.get().value,
    dayChange: selectStats.dayChange.get().value,
    notifications: selectStats.totalNotifications.get().value
  };
  const balances = selectBalancesSummary.get();
  const balanceTotal = (Number(balances.available) || 0) + (Number(balances.locked) || 0);
  const market = db.prepare('SELECT * FROM market_settings WHERE id = 1').get();
  const channels = selectChannelsStmt.all().map(ch => {
    if (ch.channel === 'OTC') {
      const otc = getOtcChannelSnapshot();
      return { ...ch, ...otc };
    }
    return {
      ...ch,
      base_price: Number(ch.base_price ?? 0),
      volatility: Number(ch.volatility ?? 0),
      speed: Number(ch.speed ?? 1)
    };
  });
  res.json({
    stats: {
      ...stats,
      availableLiquidity: Number(balances.available) || 0,
      lockedMargin: Number(balances.locked) || 0,
      totalBalance: balanceTotal
    },
    market: {
      ...market,
      currentPrice: currentPrice()
    },
    topBalances: selectTopBalances.all(),
    recentTrades: selectRecentTrades.all(),
    notifications: selectRecentNotifications.all(),
    activity: selectActivityLog.all(),
    channels
  });
});

router.get('/users', requireAdminRole('users'), (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const likeQuery = `%${query}%`;
  const rows = db.prepare(`
    SELECT u.id, u.email, u.name, u.handle, u.role, u.created_at,
           IFNULL(b.available,0) AS available,
           IFNULL(b.locked,0) AS locked,
           COUNT(t.id) AS trade_count,
           IFNULL(SUM(CASE WHEN t.status = 'closed' THEN t.pnl ELSE 0 END),0) AS realized_pnl,
           v.status AS verification_status,
           v.submitted_at AS verification_submitted_at,
           v.updated_at AS verification_updated_at
    FROM users u
    LEFT JOIN balances b ON b.user_id = u.id
    LEFT JOIN trades t ON t.user_id = u.id
    LEFT JOIN verifications v ON v.user_id = u.id
    WHERE (? = '' OR u.email LIKE ? OR u.name LIKE ? OR u.handle LIKE ?)
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT 100
  `).all(query, likeQuery, likeQuery, likeQuery);
  res.json(rows);
});

router.get('/verifications', requireAdminRole('users'), (req, res) => {
  const rows = selectVerificationsForAdmin.all();
  res.json(rows);
});

router.patch('/verifications/:userId', requireAdminRole('users'), (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  const target = db.prepare('SELECT user_id FROM verifications WHERE user_id = ?').get(userId);
  if (!target) {
    return res.status(404).json({ error: 'Verification not found' });
  }
  const { status, notes } = req.body || {};
  const normalizedStatus = (status || '').trim().toLowerCase();
  if (!ALLOWED_VERIFICATION_STATUSES.has(normalizedStatus)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const notesValue = typeof notes === 'string' ? notes.trim() : null;
  updateVerificationStatusStmt.run(
    normalizedStatus,
    notesValue ? notesValue : null,
    userId
  );
  res.json({ ok: true, status: normalizedStatus });
});

router.delete('/users/:id', requireAdminRole('users'), (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM balances WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM trades WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM activity_logs WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM referrals WHERE referrer_id = ? OR referee_id = ?').run(userId, userId);
    db.prepare('DELETE FROM admin_permissions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });
  tx();
  res.json({ ok: true });
});

router.post('/users/set-balance', requireAdminRole('users'), (req, res) => {
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
    .run(user.id, req.user.role, 'set_user_balance', JSON.stringify({ amount: numericAmount, actor: req.user.id }));

  const balance = db.prepare('SELECT * FROM balances WHERE user_id = ?').get(user.id);
  res.json({ ok: true, user: { id: user.id, email: user.email }, balance });
});

router.post('/market/set-price', requireAdminRole('market'), (req, res) => {
  const { price } = req.body || {};
  if (typeof price !== 'number' || price <= 0) return res.status(400).json({ error: 'Invalid price' });
  const p = setPrice(price);
  syncOtcChannelRow();
  db.prepare('INSERT INTO activity_logs (actor_role, action, meta) VALUES (?, ?, ?)')
    .run(req.user.role, 'set_price', JSON.stringify({ price, actor: req.user.id }));
  res.json({ ok: true, price: p });
});

router.post('/market/set-volatility', requireAdminRole('market'), (req, res) => {
  const { volatility } = req.body || {};
  if (typeof volatility !== 'number' || volatility < 0 || volatility > 1) return res.status(400).json({ error: 'Invalid volatility' });
  db.prepare('UPDATE market_settings SET volatility = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(volatility);
  syncOtcChannelRow();
  db.prepare('INSERT INTO activity_logs (actor_role, action, meta) VALUES (?, ?, ?)')
    .run(req.user.role, 'set_volatility', JSON.stringify({ volatility, actor: req.user.id }));
  res.json({ ok: true, volatility });
});

router.post('/market/pause', requireAdminRole('market'), (req, res) => {
  db.prepare('UPDATE market_settings SET paused = 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run();
  syncOtcChannelRow();
  db.prepare('INSERT INTO activity_logs (actor_role, action, meta) VALUES (?, ?, ?)')
    .run(req.user.role, 'pause_market', JSON.stringify({ actor: req.user.id }));
  res.json({ ok: true });
});

router.post('/market/resume', requireAdminRole('market'), (req, res) => {
  db.prepare('UPDATE market_settings SET paused = 0, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run();
  syncOtcChannelRow();
  db.prepare('INSERT INTO activity_logs (actor_role, action, meta) VALUES (?, ?, ?)')
    .run(req.user.role, 'resume_market', JSON.stringify({ actor: req.user.id }));
  res.json({ ok: true });
});

router.post('/market/pump', requireAdminRole('market'), (req, res) => {
  const { percentage } = req.body || {};
  if (typeof percentage !== 'number') return res.status(400).json({ error: 'percentage required' });
  const price = forcePump(percentage);
  syncOtcChannelRow();
  db.prepare('INSERT INTO activity_logs (actor_role, action, meta) VALUES (?, ?, ?)')
    .run(req.user.role, 'pump', JSON.stringify({ percentage, resulting_price: price, actor: req.user.id }));
  res.json({ ok: true, price });
});

router.post('/market/reset', requireAdminRole('market'), ensureSuperAdmin, (req, res) => {
  const { base_price, volatility, symbol, pip_size } = req.body || {};
  const current = db.prepare('SELECT * FROM market_settings WHERE id = 1').get();
  const nextBase = typeof base_price === 'number' && base_price > 0 ? base_price : current?.base_price || 60000;
  const nextVol = typeof volatility === 'number' && volatility >= 0 && volatility <= 1 ? volatility : current?.volatility || 0.02;
  const nextSymbol = typeof symbol === 'string' && symbol.trim() ? symbol.trim().toUpperCase() : current?.symbol || 'BTCUSDT';
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
  syncOtcChannelRow();

  const updated = db.prepare('SELECT * FROM market_settings WHERE id = 1').get();
  db.prepare('INSERT INTO activity_logs (actor_role, action, meta) VALUES (?, ?, ?)')
    .run(req.user.role, 'reset_market', JSON.stringify({ base_price: nextBase, volatility: nextVol, symbol: nextSymbol, pip_size: nextPipSize, actor: req.user.id }));

  res.json({ ok: true, settings: updated });
});

router.post('/notifications', requireAdminRole('notifications'), (req, res) => {
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
    .run(req.user.role, 'create_notification', JSON.stringify({ id: result.lastInsertRowid, title, user_id: targetId, actor: req.user.id }));

  emitSocket('notification', { notification });

  res.json({ ok: true, id: result.lastInsertRowid });
});

router.get('/audit', requireAdminRole('audit'), (req, res) => {
  const rows = db.prepare('SELECT * FROM activity_logs ORDER BY ts DESC LIMIT 200').all();
  res.json(rows);
});

router.get('/subadmins', requireAdminRole('admin_manage'), ensureSuperAdmin, (req, res) => {
  const rows = listSubadminsStmt.all().map(row => ({
    ...row,
    permissions: (() => {
      try {
        const parsed = JSON.parse(row.permissions || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        return [];
      }
    })()
  }));
  res.json(rows);
});

router.post('/subadmins', requireAdminRole('admin_manage'), ensureSuperAdmin, (req, res) => {
  const { email, password, name, permissions } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already exists' });
  const hash = bcrypt.hashSync(password, 10);
  const tx = db.transaction(() => {
    insertSubadminStmt.run(email, hash, name || '');
    const created = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    db.prepare('INSERT OR IGNORE INTO balances (user_id, available, locked) VALUES (?, 0, 0)').run(created.id);
    upsertPermissionsStmt.run(created.id, JSON.stringify(permissions || []), JSON.stringify(permissions || []));
    return created;
  });
  const newUser = tx();
  res.json({ ok: true, user: { id: newUser.id, email, name: name || '', permissions: permissions || [] } });
});

router.put('/subadmins/:id', requireAdminRole('admin_manage'), ensureSuperAdmin, (req, res) => {
  const subId = Number(req.params.id);
  if (!Number.isInteger(subId)) return res.status(400).json({ error: 'Invalid id' });
  const target = db.prepare('SELECT * FROM users WHERE id = ? AND role = \'subadmin\'').get(subId);
  if (!target) return res.status(404).json({ error: 'Sub admin not found' });
  const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : [];
  const name = req.body?.name;
  if (typeof name === 'string') {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, subId);
  }
  upsertPermissionsStmt.run(subId, JSON.stringify(permissions), JSON.stringify(permissions));
  res.json({ ok: true });
});

router.delete('/subadmins/:id', requireAdminRole('admin_manage'), ensureSuperAdmin, (req, res) => {
  const subId = Number(req.params.id);
  if (!Number.isInteger(subId)) return res.status(400).json({ error: 'Invalid id' });
  const target = db.prepare('SELECT * FROM users WHERE id = ? AND role = \'subadmin\'').get(subId);
  if (!target) return res.status(404).json({ error: 'Sub admin not found' });
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM admin_permissions WHERE user_id = ?').run(subId);
    db.prepare('DELETE FROM users WHERE id = ?').run(subId);
  });
  tx();
  res.json({ ok: true });
});

export default router;
