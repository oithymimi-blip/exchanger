let randomSeed = 107000

function nextRandom() {
  randomSeed = (randomSeed * 9301 + 49297) % 233280
  return randomSeed / 233280
}

export function mockMarketState() {
  const now = new Date()
  return {
    symbol: 'BTCUSDT',
    base_price: 107000 + Math.round(nextRandom() * 1000),
    volatility: 0.02,
    pip_size: 1,
    paused: 0,
    currentPrice: 107000 + Math.round(nextRandom() * 1000),
    updated_at: new Date().toISOString()
  }
}

export function mockCandles(limit = 120, seconds = 60) {
  const now = Math.floor(Date.now() / 1000)
  const out = []
  let lastClose = 107000
  for (let i = limit - 1; i >= 0; i -= 1) {
    const ts = now - i * seconds
    const open = lastClose
    const close = open + (nextRandom() - 0.5) * 200
    const high = Math.max(open, close) + nextRandom() * 120
    const low = Math.min(open, close) - nextRandom() * 120
    out.push({ time: ts, open, high, low, close, volume: 1 })
    lastClose = close
  }
  return out
}

export function mockTradeOverview() {
  return {
    balance: { available: 10000, locked: 0, total: 10000 },
    openTrades: [],
    recentTrades: [],
    openPnl: 0,
    openPips: 0,
    equity: 10000,
    currentPrice: 107000,
    pipSize: 1,
    marginUsed: 0,
    freeMargin: 10000,
    marginLevel: null
  }
}

export function mockBinaryOverview() {
  const now = Math.floor(Date.now() / 1000)
  return {
    balance: { available: 10000, locked: 0, total: 10000 },
    durations: [30, 60, 120, 300],
    payoutRate: 0.8,
    open: [
      {
        id: 'mock-open-1',
        direction: 'call',
        stake: 50,
        potential_return: 90,
        entry_price: 107050,
        expiry_ts: now + 45,
        time_left: 45
      }
    ],
    history: [
      {
        id: 'mock-hist-1',
        direction: 'call',
        stake: 25,
        payout: 45,
        result: 'win',
        entry_price: 106900,
        settlement_price: 107020,
        settled_ts: now - 120,
        expiry_ts: now - 120
      }
    ],
    stats: {
      total: 1,
      win: 1,
      lose: 0,
      push: 0,
      net: 20
    }
  }
}

export function mockAuthResponse() {
  return {
    token: 'mock-token',
    user: {
      id: 1,
      email: 'demo@example.com',
      name: 'Demo User',
      handle: 'demo',
      role: 'user'
    }
  }
}
