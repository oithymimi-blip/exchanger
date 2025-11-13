import express from 'express';
import db from '../db.js';
import { currentPrice } from './engine.js';

const router = express.Router();

const insertTickStmt = db.prepare('INSERT INTO ticks (symbol, price, ts) VALUES (?, ?, ?)');
const upsertCandleStmt = db.prepare(`
  INSERT INTO candles (symbol, open, high, low, close, volume, ts)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(symbol, ts) DO UPDATE SET
    high = CASE WHEN excluded.high > candles.high THEN excluded.high ELSE candles.high END,
    low = CASE WHEN excluded.low < candles.low THEN excluded.low ELSE candles.low END,
    close = excluded.close,
    volume = candles.volume + excluded.volume
`);

const TIMEFRAME_SECONDS = {
  '15s': 15,
  '30s': 30,
  '1m': 60,
  '3m': 180,
  '5m': 300,
  '10m': 600,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
  '1w': 604800,
  '1y': 31536000,
};

const UNIT_TO_SECONDS = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
  y: 31536000
};

function parseTimeframe(tf) {
  if (!tf) return 60;
  const normalized = String(tf).toLowerCase();
  if (TIMEFRAME_SECONDS[normalized]) return TIMEFRAME_SECONDS[normalized];
  const match = normalized.match(/^(\d+)([smhdwy])$/);
  if (!match) return 60;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 60;
  const multiplier = UNIT_TO_SECONDS[match[2]] ?? 60;
  return value * multiplier;
}

function aggregateTicks(symbol, intervalSec, limit, fromTs, toTs) {
  const now = Math.floor(Date.now() / 1000);
  const endTs = toTs || now;
  const startTs = fromTs || endTs - intervalSec * limit * 4;
  const rows = db
    .prepare(
      `SELECT ts, price FROM ticks
       WHERE symbol = ? AND ts BETWEEN ? AND ?
       ORDER BY ts ASC`,
    )
    .all(symbol, startTs, endTs);

  const bucketMap = new Map();
  for (const row of rows) {
    const bucket = Math.floor(row.ts / intervalSec) * intervalSec;
    let candle = bucketMap.get(bucket);
    if (!candle) {
      candle = { time: bucket, open: row.price, high: row.price, low: row.price, close: row.price, volume: 0 };
      bucketMap.set(bucket, candle);
    } else {
      candle.high = Math.max(candle.high, row.price);
      candle.low = Math.min(candle.low, row.price);
      candle.close = row.price;
    }
  }

  const candles = Array.from(bucketMap.values()).sort((a, b) => a.time - b.time);
  return candles.slice(-limit);
}

function aggregateCandles(symbol, intervalSec, limit, fromTs, toTs) {
  const now = Math.floor(Date.now() / 1000);
  const endTs = toTs || now;
  const startTs = fromTs || endTs - intervalSec * limit * 4;
  const rows = db
    .prepare(
      `SELECT * FROM candles
       WHERE symbol = ? AND ts BETWEEN ? AND ?
       ORDER BY ts ASC`,
    )
    .all(symbol, startTs, endTs);

  if (intervalSec === 60) {
    return rows.slice(-limit);
  }

  const bucketMap = new Map();
  for (const row of rows) {
    const bucket = Math.floor(row.ts / intervalSec) * intervalSec;
    let candle = bucketMap.get(bucket);
    if (!candle) {
      candle = { time: bucket, open: row.open, high: row.high, low: row.low, close: row.close, volume: row.volume };
      bucketMap.set(bucket, candle);
    } else {
      candle.high = Math.max(candle.high, row.high);
      candle.low = Math.min(candle.low, row.low);
      candle.close = row.close;
      candle.volume += row.volume;
    }
  }

  const candles = Array.from(bucketMap.values()).sort((a, b) => a.time - b.time);
  return candles.slice(-limit);
}

router.get('/state', (req, res) => {
  const s = db.prepare('SELECT * FROM market_settings WHERE id = 1').get();
  res.json({ ...s, currentPrice: currentPrice() });
});

router.get('/candles', (req, res) => {
  const { symbol = 'BTCUSDT', from, to, limit = 500, tf } = req.query;
  const normalizedSymbol = typeof symbol === 'string' ? symbol.trim().toUpperCase() : 'BTCUSDT';
  const intervalSec = parseTimeframe(tf);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 1000));
  const fromTs = from ? Number(from) : undefined;
  const toTs = to ? Number(to) : undefined;

  let rows = [];
  if (intervalSec < 60) {
    rows = aggregateTicks(normalizedSymbol, intervalSec, safeLimit, fromTs, toTs);
  } else {
    rows = aggregateCandles(normalizedSymbol, intervalSec, safeLimit, fromTs, toTs);
  }

  res.json(rows);
});

router.post('/otc/tick', (req, res) => {
  const { symbol, price, ts, volume } = req.body ?? {};
  const normalizedSymbol = typeof symbol === 'string' && symbol.trim().length ? symbol.trim().toUpperCase() : null;
  const numericPrice = Number(price);
  if (!normalizedSymbol || !Number.isFinite(numericPrice)) {
    return res.status(400).json({ error: 'symbol and price are required' });
  }
  const timestamp = Number.isFinite(Number(ts)) ? Number(ts) : Math.floor(Date.now() / 1000);
  const bucket = Math.floor(timestamp / 60) * 60;
  const safeVolume = Math.max(0, Number(volume) || Math.random() * 2);

  insertTickStmt.run(normalizedSymbol, numericPrice, timestamp);
  upsertCandleStmt.run(
    normalizedSymbol,
    numericPrice,
    numericPrice,
    numericPrice,
    numericPrice,
    safeVolume,
    bucket
  );

  res.json({ ok: true, symbol: normalizedSymbol, ts: timestamp });
});

export default router;
