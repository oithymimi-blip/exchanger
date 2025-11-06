import express from 'express';
import db from '../db.js';
import { requireAuth } from '../auth/authMiddleware.js';
import { currentPrice } from '../market/engine.js';
import { INITIAL_BALANCE } from '../config.js';

const router = express.Router();
const EPS = 1e-8;

const getBalanceStmt = db.prepare('SELECT available, locked FROM balances WHERE user_id = ?');
const insertBalanceStmt = db.prepare('INSERT OR IGNORE INTO balances (user_id, available, locked) VALUES (?, ?, ?)');
const updateBalanceStmt = db.prepare('UPDATE balances SET available = ?, locked = ? WHERE user_id = ?');
const insertTradeStmt = db.prepare(`
  INSERT INTO trades (user_id, symbol, side, qty, price, status, remaining_qty, pnl, exit_price, notional, pip_value, pips_realized, stake_amount)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateTradeCloseStmt = db.prepare(`
  UPDATE trades
  SET status = 'closed',
      remaining_qty = 0,
      pnl = ?,
      exit_price = ?,
      pips_realized = ?,
      pip_value = 0,
      closed_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);
const selectTradeByIdStmt = db.prepare('SELECT * FROM trades WHERE id = ?');
const selectOpenTradesStmt = db.prepare(`SELECT * FROM trades WHERE user_id = ? AND status = 'open' ORDER BY created_at ASC`);
const selectRecentTradesStmt = db.prepare(`SELECT * FROM trades WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`);
const selectSettingsStmt = db.prepare('SELECT pip_size FROM market_settings WHERE id = 1');

function getOrInitBalance(userId) {
  insertBalanceStmt.run(userId, INITIAL_BALANCE, 0);
  const row = getBalanceStmt.get(userId);
  return {
    available: Number(row?.available ?? INITIAL_BALANCE),
    locked: Number(row?.locked ?? 0)
  };
}

function getPipSize() {
  const row = selectSettingsStmt.get();
  const value = Number(row?.pip_size ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function computeOverview(userId, limit = 10, priceOverride) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 200));
  const balance = getOrInitBalance(userId);
  const price = priceOverride ?? currentPrice();

  const openTrades = selectOpenTradesStmt.all(userId);
  let openPnl = 0;
  let openPips = 0;
  for (const trade of openTrades) {
    const stake = Number(trade.stake_amount || 0);
    if (stake <= 0) continue;
    const direction = trade.side === 'sell' ? -1 : 1;
    const diff = (price - Number(trade.price || 0)) * direction;
    openPnl += diff * stake;
    openPips += diff;
  }

  const recentTrades = selectRecentTradesStmt.all(userId, safeLimit);

  const balanceTotal = balance.available + balance.locked;
  const equity = balance.available + balance.locked + openPnl;
  const marginUsed = balance.locked;
  const freeMargin = equity - marginUsed;
  const marginLevel = marginUsed > EPS ? (equity / marginUsed) * 100 : null;

  return {
    balance: {
      available: round2(balance.available),
      locked: round2(balance.locked),
      total: round2(balanceTotal)
    },
    openTrades,
    recentTrades,
    openPnl: round2(openPnl),
    openPips: round2(openPips),
    equity: round2(equity),
    currentPrice: price,
    pipSize: getPipSize(),
    marginUsed: round2(marginUsed),
    freeMargin: round2(freeMargin),
    marginLevel: marginLevel == null ? null : Math.round(marginLevel * 100) / 100
  };
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function directionForSide(side) {
  return side === 'sell' ? -1 : 1;
}

router.get('/', requireAuth, (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 500, 500));
  const rows = selectRecentTradesStmt.all(req.user.id, limit);
  res.json(rows);
});

router.get('/open', requireAuth, (req, res) => {
  const rows = selectOpenTradesStmt.all(req.user.id);
  res.json(rows);
});

router.get('/overview', requireAuth, (req, res) => {
  const limit = Number(req.query.limit ?? 10);
  const overview = computeOverview(req.user.id, limit);
  res.json(overview);
});

router.post('/', requireAuth, (req, res) => {
  try {
    const { side, amount, symbol = 'BTCUSDT' } = req.body || {};
    const normalizedSide = (side || '').toLowerCase();
    if (!['buy', 'sell'].includes(normalizedSide)) {
      return res.status(400).json({ error: 'side must be buy or sell' });
    }
    const usdAmount = Number(amount);
    if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
      return res.status(400).json({ error: 'amount must be positive' });
    }

    const balance = getOrInitBalance(req.user.id);
    if (balance.available + EPS < usdAmount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const price = currentPrice();
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(500).json({ error: 'Invalid market price' });
    }

    const qty = usdAmount / price;
    insertTradeStmt.run(
      req.user.id,
      symbol,
      normalizedSide,
      qty,
      price,
      'open',
      1,
      0,
      null,
      usdAmount,
      usdAmount,
      0,
      usdAmount
    );

    updateBalanceStmt.run(round2(balance.available - usdAmount), round2(balance.locked + usdAmount), req.user.id);

    const overview = computeOverview(req.user.id, 10, price);
    res.json({ ok: true, price, amount: usdAmount, ...overview });
  } catch (err) {
    console.error('trade error', err);
    res.status(500).json({ error: 'Trade failed' });
  }
});

router.post('/:id/close', requireAuth, (req, res) => {
  try {
    const tradeId = Number(req.params.id);
    if (!Number.isInteger(tradeId)) {
      return res.status(400).json({ error: 'Invalid trade id' });
    }
    const trade = selectTradeByIdStmt.get(tradeId);
    if (!trade || trade.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    if (trade.status !== 'open') {
      const overview = computeOverview(req.user.id, 10);
      return res.json({ ok: true, ...overview });
    }

    const price = currentPrice();
    const stake = Number(trade.stake_amount || 0);
    const direction = directionForSide(trade.side);
    const pnl = (price - Number(trade.price || 0)) * direction * stake;
    const pips = (price - Number(trade.price || 0)) * direction;

    updateTradeCloseStmt.run(pnl, price, pips, tradeId);

    const balance = getOrInitBalance(req.user.id);
    updateBalanceStmt.run(
      round2(balance.available + stake + pnl),
      round2(Math.max(0, balance.locked - stake)),
      req.user.id
    );

    const overview = computeOverview(req.user.id, 10, price);
    res.json({ ok: true, realizedPnl: pnl, realizedPips: pips, price, ...overview });
  } catch (err) {
    console.error('close trade error', err);
    res.status(500).json({ error: 'Failed to close trade' });
  }
});

router.post('/close-all', requireAuth, (req, res) => {
  try {
    const price = currentPrice();
    const openTrades = selectOpenTradesStmt.all(req.user.id);
    let totalPnl = 0;
    let totalPips = 0;
    for (const trade of openTrades) {
      const stake = Number(trade.stake_amount || 0);
      const direction = directionForSide(trade.side);
      const pnl = (price - Number(trade.price || 0)) * direction * stake;
      const pips = (price - Number(trade.price || 0)) * direction;
      updateTradeCloseStmt.run(pnl, price, pips, trade.id);
      totalPnl += pnl;
      totalPips += pips;
      const balance = getOrInitBalance(req.user.id);
      updateBalanceStmt.run(
        round2(balance.available + stake + pnl),
        round2(Math.max(0, balance.locked - stake)),
        req.user.id
      );
    }
    const overview = computeOverview(req.user.id, 10, price);
    res.json({ ok: true, realizedPnl: totalPnl, realizedPips: totalPips, price, ...overview });
  } catch (err) {
    console.error('close-all error', err);
    res.status(500).json({ error: 'Failed to close all trades' });
  }
});

router.get('/leaderboard', (req, res) => {
  const users = db.prepare('SELECT id, handle, name FROM users').all();
  const lb = [];
  for (const user of users) {
    const trades = db.prepare('SELECT pnl FROM trades WHERE user_id = ?').all(user.id);
    const pnl = trades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
    lb.push({ user_id: user.id, handle: user.handle || `user${user.id}`, name: user.name || '', realized_pnl: Number(pnl.toFixed(2)) });
  }
  lb.sort((a, b) => b.realized_pnl - a.realized_pnl);
  res.json(lb.slice(0, 50));
});

export default router;
