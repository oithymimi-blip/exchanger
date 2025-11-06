import db from '../db.js';

const BINANCE_ENDPOINT = 'https://api.binance.com/api/v3/ticker/24hr';
const CACHE_TTL_MS = 45_000;
const MAX_MARKETS = 100;

const overridesStmt = db.prepare(`SELECT symbol, price_override, change_override, volume_override FROM spot_overrides`);
const upsertOverrideStmt = db.prepare(`
  INSERT INTO spot_overrides (symbol, price_override, change_override, volume_override, updated_at)
  VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(symbol) DO UPDATE SET
    price_override = excluded.price_override,
    change_override = excluded.change_override,
    volume_override = excluded.volume_override,
    updated_at = CURRENT_TIMESTAMP
`);
const getOverrideStmt = db.prepare(`SELECT symbol, price_override, change_override, volume_override FROM spot_overrides WHERE symbol = ?`);

let cache = { markets: [], fetchedAt: 0 };

function parseSymbol(symbol) {
  const quoteCandidates = ['USDT', 'BUSD', 'USDC', 'BTC', 'ETH', 'BNB'];
  for (const quote of quoteCandidates) {
    if (symbol.endsWith(quote)) {
      const base = symbol.slice(0, -quote.length);
      return { base, quote };
    }
  }
  return { base: symbol.slice(0, 3), quote: symbol.slice(3) };
}

function applyOverrides(tickers) {
  const overrides = overridesStmt.all();
  if (!overrides.length) return tickers;
  const overrideMap = new Map(overrides.map(o => [o.symbol.toUpperCase(), o]));
  return tickers.map(ticker => {
    const override = overrideMap.get(ticker.symbol);
    if (!override) return ticker;
    return {
      ...ticker,
      price: Number(override.price_override ?? ticker.price),
      change_24h: Number(override.change_override ?? ticker.change_24h),
      volume_24h: Number(override.volume_override ?? ticker.volume_24h)
    };
  });
}

function withLogos(tickers) {
  return tickers.map(ticker => {
    const symbol = ticker.base_asset?.toLowerCase?.() || 'btc';
    const logo = `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${symbol}.svg`;
    return { ...ticker, logo_url: logo };
  });
}

export async function getSpotMarkets() {
  const now = Date.now();
  if (cache.markets.length && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.markets;
  }

  const res = await fetch(BINANCE_ENDPOINT);
  if (!res.ok) {
    throw new Error(`Binance API error: ${res.status}`);
  }
  const data = await res.json();
  const filtered = data
    .filter(t => t.symbol?.endsWith('USDT'))
    .map(t => {
      const { base, quote } = parseSymbol(t.symbol);
      return {
        symbol: `${base}-${quote}`,
        base_asset: base,
        quote_asset: quote,
        price: Number(t.lastPrice),
        change_24h: Number(t.priceChangePercent),
        volume_24h: Number(t.quoteVolume)
      };
    })
    .filter(m => Number.isFinite(m.price) && Number.isFinite(m.change_24h))
    .sort((a, b) => Number(b.volume_24h || 0) - Number(a.volume_24h || 0))
    .slice(0, MAX_MARKETS);

  const enriched = withLogos(applyOverrides(filtered));
  cache = { markets: enriched, fetchedAt: now };
  return enriched;
}

export async function updateSpotOverride(symbol, { price, change_24h, volume_24h }) {
  const upperSymbol = symbol.toUpperCase();
  upsertOverrideStmt.run(
    upperSymbol,
    price != null ? Number(price) : null,
    change_24h != null ? Number(change_24h) : null,
    volume_24h != null ? Number(volume_24h) : null
  );
  cache = { markets: [], fetchedAt: 0 };
  const override = getOverrideStmt.get(upperSymbol);
  return override;
}
