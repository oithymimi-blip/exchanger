import express from 'express';
import db from '../db.js';
import { requireAuth } from '../auth/authMiddleware.js';
import { currentPrice } from '../market/engine.js';
import { nowTs } from '../utils.js';
import { INITIAL_BALANCE } from '../config.js';

const router = express.Router();

const EPS = 1e-8;
const DEFAULT_PAYOUT_RATE = 0.8;
const ALLOWED_DURATIONS = [30, 60, 120, 300, 600];

const getBalanceStmt = db.prepare('SELECT available, locked FROM balances WHERE user_id = ?');
const insertBalanceStmt = db.prepare('INSERT OR IGNORE INTO balances (user_id, available, locked) VALUES (?, ?, ?)');
const updateBalanceStmt = db.prepare('UPDATE balances SET available = ?, locked = ? WHERE user_id = ?');

const insertBinaryTradeStmt = db.prepare(`
  INSERT INTO binary_trades (user_id, symbol, direction, stake, payout_rate, duration_sec, entry_price, expiry_ts, status, created_ts)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
`);
const selectOpenBinaryTradesStmt = db.prepare(`
  SELECT * FROM binary_trades WHERE user_id = ? AND status = 'open' ORDER BY expiry_ts ASC
`);
const selectRecentBinaryTradesStmt = db.prepare(`
  SELECT * FROM binary_trades WHERE user_id = ?
  ORDER BY COALESCE(settled_ts, expiry_ts) DESC
  LIMIT ?
`);
const selectExpiredBinaryTradesStmt = db.prepare(`
  SELECT * FROM binary_trades
  WHERE user_id = ? AND status = 'open' AND expiry_ts <= ?
  ORDER BY expiry_ts ASC
`);
const updateBinaryTradeSettleStmt = db.prepare(`
  UPDATE binary_trades
  SET status = 'settled',
      result = ?,
      settlement_price = ?,
      payout = ?,
      settled_ts = ?
  WHERE id = ?
`);
const selectSettledStatsStmt = db.prepare(`
  SELECT result, stake, payout FROM binary_trades
  WHERE user_id = ? AND status = 'settled'
`);
const selectTickBeforeStmt = db.prepare(`
  SELECT price FROM ticks WHERE symbol = ? AND ts <= ? ORDER BY ts DESC LIMIT 1
`);

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function getOrInitBalance(userId) {
  insertBalanceStmt.run(userId, INITIAL_BALANCE, 0);
  const row = getBalanceStmt.get(userId);
  return {
    available: Number(row?.available ?? 0),
    locked: Number(row?.locked ?? 0)
  };
}

function priceAt(symbol, ts) {
  const row = selectTickBeforeStmt.get(symbol, ts);
  if (row && Number.isFinite(Number(row.price))) {
    return Number(row.price);
  }
  return currentPrice();
}

function normaliseTradePayload(trade) {
  if (!trade) return null;
  return {
    id: trade.id,
    symbol: trade.symbol,
    direction: trade.direction,
    stake: round2(trade.stake),
    payout_rate: Number(trade.payout_rate),
    duration_sec: Number(trade.duration_sec),
    entry_price: Number(trade.entry_price),
    expiry_ts: Number(trade.expiry_ts),
    status: trade.status,
    result: trade.result,
    settlement_price: trade.settlement_price != null ? Number(trade.settlement_price) : null,
    payout: round2(trade.payout),
    created_ts: Number(trade.created_ts),
    settled_ts: trade.settled_ts != null ? Number(trade.settled_ts) : null,
    potential_return: round2(Number(trade.stake) + Number(trade.stake) * Number(trade.payout_rate))
  };
}

function settleExpiredTrades(userId) {
  const now = nowTs();
  const open = selectExpiredBinaryTradesStmt.all(userId, now);
  if (!open.length) return;

  let balance = getOrInitBalance(userId);
  let available = Number(balance.available);
  let locked = Number(balance.locked);

  for (const trade of open) {
    const entryPrice = Number(trade.entry_price);
    const payoutRate = Number(trade.payout_rate);
    const stake = Number(trade.stake);
    const settlementPrice = priceAt(trade.symbol, Number(trade.expiry_ts));

    let result = 'lose';
    let payout = 0;

    if (Math.abs(settlementPrice - entryPrice) <= EPS) {
      result = 'push';
    } else if (
      (trade.direction === 'call' && settlementPrice > entryPrice) ||
      (trade.direction === 'put' && settlementPrice < entryPrice)
    ) {
      result = 'win';
      payout = stake * payoutRate;
    }

    if (result === 'win') {
      available += stake + payout;
    } else if (result === 'push') {
      available += stake;
    }
    locked = Math.max(0, locked - stake);

    updateBinaryTradeSettleStmt.run(result, settlementPrice, payout, now, trade.id);
  }

  updateBalanceStmt.run(round2(available), round2(locked), userId);
}

function buildStats(userId) {
  const rows = selectSettledStatsStmt.all(userId);
  if (!rows.length) {
    return { total: 0, win: 0, lose: 0, push: 0, net: 0 };
  }
  let win = 0;
  let lose = 0;
  let push = 0;
  let net = 0;
  for (const row of rows) {
    const stake = Number(row.stake);
    const payout = Number(row.payout);
    if (row.result === 'win') {
      win += 1;
      net += payout;
    } else if (row.result === 'push') {
      push += 1;
    } else {
      lose += 1;
      net -= stake;
    }
  }
  return {
    total: win + lose + push,
    win,
    lose,
    push,
    net: round2(net)
  };
}

function getOverview(userId, limit = 15) {
  settleExpiredTrades(userId);
  const balance = getOrInitBalance(userId);
  const openRows = selectOpenBinaryTradesStmt.all(userId).map(normaliseTradePayload);
  const historyRows = selectRecentBinaryTradesStmt.all(userId, Math.max(1, Math.min(Number(limit) || 15, 50))).map(normaliseTradePayload);
  const stats = buildStats(userId);
  return {
    open: openRows,
    history: historyRows,
    stats,
    payoutRate: DEFAULT_PAYOUT_RATE,
    durations: ALLOWED_DURATIONS,
    balance: {
      available: round2(balance.available),
      locked: round2(balance.locked),
      total: round2(Number(balance.available) + Number(balance.locked))
    },
    serverTime: nowTs()
  };
}

router.use(requireAuth);

router.get('/overview', (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 15);
    const overview = getOverview(req.user.id, limit);
    res.json(overview);
  } catch (err) {
    console.error('binary overview error', err);
    res.status(500).json({ error: 'Failed to load binary overview' });
  }
});

router.post('/', (req, res) => {
  try {
    const { direction, amount, duration, symbol = 'BTCUSDT' } = req.body || {};
    const normalizedDirection = String(direction || '').toLowerCase();
    if (!['call', 'put'].includes(normalizedDirection)) {
      return res.status(400).json({ error: 'direction must be call or put' });
    }
    const stake = Number(amount);
    if (!Number.isFinite(stake) || stake <= 0) {
      return res.status(400).json({ error: 'amount must be positive' });
    }
    const selectedDuration = Number(duration);
    if (!ALLOWED_DURATIONS.includes(selectedDuration)) {
      return res.status(400).json({ error: 'invalid expiry duration' });
    }

    const balance = getOrInitBalance(req.user.id);
    if (balance.available + EPS < stake) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const entry = currentPrice();
    if (!Number.isFinite(entry) || entry <= 0) {
      return res.status(500).json({ error: 'Invalid market price' });
    }

    const now = nowTs();
    const expiry = now + selectedDuration;

    insertBinaryTradeStmt.run(
      req.user.id,
      symbol,
      normalizedDirection,
      stake,
      DEFAULT_PAYOUT_RATE,
      selectedDuration,
      entry,
      expiry,
      now
    );

    updateBalanceStmt.run(
      round2(balance.available - stake),
      round2(balance.locked + stake),
      req.user.id
    );

    const overview = getOverview(req.user.id, 15);
    res.json({ ok: true, entry_price: entry, ...overview });
  } catch (err) {
    console.error('binary trade error', err);
    res.status(500).json({ error: 'Failed to place binary trade' });
  }
});

export default router;
