// Simple geometric random walk engine with admin overrides
import db from '../db.js';
import { nowTs } from '../utils.js';

const insertCandleStmt = db.prepare(`
  INSERT INTO candles (symbol, open, high, low, close, volume, ts)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(symbol, ts) DO UPDATE SET
    high = CASE WHEN excluded.high > candles.high THEN excluded.high ELSE candles.high END,
    low = CASE WHEN excluded.low < candles.low THEN excluded.low ELSE candles.low END,
    close = excluded.close,
    volume = candles.volume + excluded.volume
`);

let ioRef = null;
let lastPrice = null;
let lastCandle = null; // { open, high, low, close, volume, tsStart }
let lastTickCleanup = 0;

function getSettings() {
  return db.prepare('SELECT * FROM market_settings WHERE id = 1').get();
}

export function attachIO(io) {
  ioRef = io;
}

export function emitSocket(event, payload) {
  if (ioRef) ioRef.emit(event, payload);
}

export function currentPrice() {
  if (lastPrice == null) {
    const s = getSettings();
    lastPrice = s.base_price;
  }
  return lastPrice;
}

export function setPrice(p) {
  lastPrice = p;
  db.prepare('UPDATE market_settings SET base_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(p);
  return lastPrice;
}

export function resetEngine(newBasePrice = null) {
  if (newBasePrice == null) {
    const s = getSettings();
    lastPrice = s.base_price;
  } else {
    lastPrice = newBasePrice;
  }
  lastCandle = null;
}

export function tickOnce() {
  const s = getSettings();
  if (s.paused) return;

  // geometric random walk
  const speedMultiplier = Number(s.speed_multiplier || 1);
  const sigma = s.volatility * speedMultiplier; // scale volatility by speed
  const noise = (Math.random() - 0.5) * 2; // [-1, 1]
  const drift = 0; // flat drift
  const p0 = currentPrice();
  let p1 = p0 * (1 + drift + sigma * noise * 0.1);
  if (p1 <= 1) p1 = 1; // avoid zero

  lastPrice = p1;

  // Update candle
  const now = nowTs();
  if (!lastCandle || now - lastCandle.tsStart >= 60) {
    // close previous candle
    if (lastCandle) {
      insertCandleStmt.run(
        s.symbol,
        lastCandle.open,
        lastCandle.high,
        lastCandle.low,
        lastCandle.close,
        lastCandle.volume,
        lastCandle.tsStart
      );
    }
    lastCandle = { open: p1, high: p1, low: p1, close: p1, volume: Math.random() * 2, tsStart: now - (now % 60) };
  } else {
    lastCandle.high = Math.max(lastCandle.high, p1);
    lastCandle.low = Math.min(lastCandle.low, p1);
    lastCandle.close = p1;
    lastCandle.volume += Math.random() * 2;
  }

  if (ioRef) {
    ioRef.emit('tick', { symbol: s.symbol, price: p1, ts: now });
  }

  try {
    db.prepare('INSERT INTO ticks (symbol, price, ts) VALUES (?, ?, ?)')
      .run(s.symbol, p1, now);
    if (!lastTickCleanup || now - lastTickCleanup > 300) {
      db.prepare('DELETE FROM ticks WHERE ts < ?').run(now - 86400);
      lastTickCleanup = now;
    }
  } catch (e) {
    console.error('tick insert error:', e);
  }
}

export function forcePump(percentage) {
  const p = currentPrice();
  const p1 = p * (1 + percentage / 100);
  setPrice(p1);
  if (lastCandle) {
    lastCandle.high = Math.max(lastCandle.high, p1);
    lastCandle.low = Math.min(lastCandle.low, p1);
    lastCandle.close = p1;
  }
  if (ioRef) ioRef.emit('tick', { symbol: getSettings().symbol, price: p1, ts: nowTs() });
  return p1;
}

export function clearTicks() {
  db.prepare('DELETE FROM ticks').run();
  lastTickCleanup = 0;
}
