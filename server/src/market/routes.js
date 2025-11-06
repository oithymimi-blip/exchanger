import express from 'express';
import db from '../db.js';
import { currentPrice } from './engine.js';

const router = express.Router();

const TIMEFRAME_SECONDS = {
  '15s': 15,
  '30s': 30,
  '1m': 60,
  '5m': 300,
  '10m': 600,
};

function parseTimeframe(tf) {
  if (!tf) return 60;
  const normalized = String(tf).toLowerCase();
  if (TIMEFRAME_SECONDS[normalized]) return TIMEFRAME_SECONDS[normalized];
  const match = normalized.match(/^(\d+)(s|m)$/);
  if (!match) return 60;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 60;
  return match[2] === 'm' ? value * 60 : value;
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
  const intervalSec = parseTimeframe(tf);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 1000));
  const fromTs = from ? Number(from) : undefined;
  const toTs = to ? Number(to) : undefined;

  let rows = [];
  if (intervalSec < 60) {
    rows = aggregateTicks(symbol, intervalSec, safeLimit, fromTs, toTs);
  } else {
    rows = aggregateCandles(symbol, intervalSec, safeLimit, fromTs, toTs);
  }

  res.json(rows);
});

export default router;
