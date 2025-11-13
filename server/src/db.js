import Database from 'better-sqlite3';
import { DB_FILE, INITIAL_BALANCE } from './config.js';
import fs from 'fs';
import path from 'path';
import { spotMarketsSeed } from './spot/marketsSeed.js';

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

// Initialize schema if not present
const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  handle TEXT UNIQUE,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS balances (
  user_id INTEGER PRIMARY KEY,
  available REAL DEFAULT 0,
  locked REAL DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL, -- 'buy' | 'sell'
  qty REAL NOT NULL,
  price REAL NOT NULL,
  status TEXT DEFAULT 'open',
  remaining_qty REAL DEFAULT 0,
  pnl REAL DEFAULT 0,
  exit_price REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id INTEGER NOT NULL,
  referee_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(referrer_id, referee_id),
  FOREIGN KEY(referrer_id) REFERENCES users(id),
  FOREIGN KEY(referee_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS market_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  symbol TEXT NOT NULL,
  base_price REAL NOT NULL,
  volatility REAL NOT NULL,
  paused INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO market_settings (id, symbol, base_price, volatility, paused) VALUES (1, 'BTCUSDT', 60000, 0.02, 0);

CREATE TABLE IF NOT EXISTS candles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_candles_symbol_ts ON candles(symbol, ts);
DELETE FROM candles
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM candles
  GROUP BY symbol, ts
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_candles_symbol_ts ON candles(symbol, ts);

CREATE TABLE IF NOT EXISTS ticks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  price REAL NOT NULL,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticks_symbol_ts ON ticks(symbol, ts);

CREATE TABLE IF NOT EXISTS admin_permissions (
  user_id INTEGER PRIMARY KEY,
  permissions TEXT NOT NULL DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS spot_markets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT UNIQUE NOT NULL,
  base_asset TEXT NOT NULL,
  quote_asset TEXT NOT NULL,
  price REAL NOT NULL,
  change_24h REAL DEFAULT 0,
  volume_24h REAL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spot_overrides (
  symbol TEXT PRIMARY KEY,
  price_override REAL,
  change_override REAL,
  volume_override REAL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS binary_trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  stake REAL NOT NULL,
  payout_rate REAL NOT NULL,
  duration_sec INTEGER NOT NULL,
  entry_price REAL NOT NULL,
  expiry_ts INTEGER NOT NULL,
  status TEXT DEFAULT 'open',
  result TEXT,
  settlement_price REAL,
  payout REAL DEFAULT 0,
  created_ts INTEGER NOT NULL,
  settled_ts INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_binary_trades_user_status ON binary_trades(user_id, status);
CREATE INDEX IF NOT EXISTS idx_binary_trades_user_expiry ON binary_trades(user_id, expiry_ts);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  actor_role TEXT,
  action TEXT NOT NULL,
  meta TEXT,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(notification_id, user_id),
  FOREIGN KEY(notification_id) REFERENCES notifications(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`;

db.exec(schema);

const insertSpotMarketStmt = db.prepare(`
  INSERT INTO spot_markets (symbol, base_asset, quote_asset, price, change_24h, volume_24h)
  VALUES (@symbol, @base_asset, @quote_asset, @price, @change_24h, @volume_24h)
  ON CONFLICT(symbol) DO NOTHING
`);

for (const market of spotMarketsSeed) {
  insertSpotMarketStmt.run(market);
}

function ensureColumn(table, column, definition) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = info.some(col => col.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

ensureColumn('trades', 'remaining_qty', 'remaining_qty REAL DEFAULT 0');
ensureColumn('trades', 'exit_price', 'exit_price REAL');
ensureColumn('trades', 'notional', 'notional REAL DEFAULT 0');
ensureColumn('trades', 'pip_value', 'pip_value REAL DEFAULT 0');
ensureColumn('trades', 'pips_realized', 'pips_realized REAL DEFAULT 0');
ensureColumn('trades', 'stake_amount', 'stake_amount REAL DEFAULT 0');
ensureColumn('market_settings', 'pip_size', 'pip_size REAL DEFAULT 0.0001');
ensureColumn('market_settings', 'speed_multiplier', 'speed_multiplier REAL DEFAULT 1');

db.exec(`
CREATE TABLE IF NOT EXISTS market_channels (
  channel TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  base_price REAL DEFAULT 0,
  volatility REAL DEFAULT 0.01,
  speed REAL DEFAULT 1,
  status TEXT DEFAULT 'live',
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

const defaultChannels = [
  { channel: 'OTC', label: 'OTC Desk', base_price: 60000, volatility: 0.02, speed: 1, status: 'live', description: 'Primary OTC desk' },
  { channel: 'BINARY', label: 'Binary Options', base_price: 1.25, volatility: 0.05, speed: 1.2, status: 'live', description: 'Short-term binary ladder' },
  { channel: 'SPOT', label: 'Spot Market', base_price: 2700, volatility: 0.03, speed: 1, status: 'live', description: 'Spot liquidity pool' },
  { channel: 'FUTURE', label: 'Futures', base_price: 35000, volatility: 0.04, speed: 0.9, status: 'maintenance', description: 'Perpetual futures board' },
  { channel: 'ALPHA', label: 'Alpha Strategy', base_price: 1200, volatility: 0.06, speed: 1.4, status: 'live', description: 'Experimental alpha stream' }
];

const upsertChannelStmt = db.prepare(`
  INSERT INTO market_channels (channel, label, base_price, volatility, speed, status, description)
  VALUES (@channel, @label, @base_price, @volatility, @speed, @status, @description)
  ON CONFLICT(channel) DO UPDATE SET
    label = excluded.label,
    description = COALESCE(market_channels.description, excluded.description)
`);

for (const ch of defaultChannels) {
  upsertChannelStmt.run(ch);
}

// Backfill legacy rows so new logic has sane defaults
db.prepare(`
  UPDATE trades
  SET remaining_qty = CASE
    WHEN status IN ('open') THEN COALESCE(remaining_qty, qty)
    ELSE 0
  END
  WHERE remaining_qty IS NULL OR remaining_qty = 0
`).run();

db.prepare(`
  UPDATE trades
  SET status = 'closed'
  WHERE status IS NULL OR status = '' OR status = 'filled'
`).run();

db.prepare(`
  UPDATE trades
  SET exit_price = COALESCE(exit_price, price)
  WHERE status = 'closed' AND exit_price IS NULL
`).run();

db.prepare(`
  UPDATE trades
  SET notional = qty * price
  WHERE (notional IS NULL OR notional = 0) AND qty IS NOT NULL AND price IS NOT NULL
`).run();

db.prepare(`
  UPDATE market_settings
  SET pip_size = CASE WHEN pip_size IS NULL OR pip_size <= 0 THEN 1 ELSE pip_size END
  WHERE id = 1
`).run();

db.prepare(`
  UPDATE trades
  SET stake_amount = CASE
    WHEN stake_amount IS NULL OR stake_amount = 0 THEN COALESCE(stake_amount, pip_value, notional, 0)
    ELSE stake_amount
  END
`).run();

db.prepare(`
  UPDATE trades
  SET pip_value = stake_amount
  WHERE stake_amount IS NOT NULL AND stake_amount > 0
`).run();

db.prepare(`
  INSERT OR IGNORE INTO balances (user_id, available, locked)
  SELECT id, ?, 0 FROM users
`).run(INITIAL_BALANCE);

db.prepare(`
  UPDATE balances
  SET available = ?, locked = COALESCE(locked, 0)
  WHERE (available IS NULL OR available = 0)
    AND (locked IS NULL OR locked = 0)
`).run(INITIAL_BALANCE);

export default db;
