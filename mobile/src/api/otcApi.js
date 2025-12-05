import { API_BASE_URL } from './client'

const OTC_TIMEFRAME_PARAM = {
  M1: '1m',
  M5: '5m',
  M15: '15m',
  M30: '30m',
  H1: '1h',
  H4: '4h',
  D1: '1d',
  W1: '1w',
  Y1: '1y'
}

export async function fetchOtcCandles(symbol = 'BTC/USDT', timeframe = 'M15', limit = 500) {
  const tf = OTC_TIMEFRAME_PARAM[timeframe] ?? '15m'
  const params = new URLSearchParams({
    symbol,
    tf,
    limit: String(Math.max(10, Math.min(limit, 1000)))
  })
  const response = await fetch(`${API_BASE_URL}/api/market/candles?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Failed to load OTC candles (${response.status})`)
  }
  const data = await response.json()
  if (!Array.isArray(data)) {
    return []
  }
  return data.map(bar => ({
    time: bar.time ?? bar.ts ?? 0,
    open: Number(bar.open ?? bar.o ?? bar.price ?? 0),
    high: Number(bar.high ?? bar.h ?? bar.price ?? 0),
    low: Number(bar.low ?? bar.l ?? bar.price ?? 0),
    close: Number(bar.close ?? bar.c ?? bar.price ?? 0),
    volume: Number(bar.volume ?? bar.v ?? 0)
  })).filter(bar => Number.isFinite(bar.time))
}

export async function postOtcTick(symbol, price, timestamp = Date.now(), volume = null) {
  const payload = {
    symbol,
    price,
    ts: Math.floor(timestamp / 1000)
  }
  if (volume != null) {
    payload.volume = volume
  }
  const response = await fetch(`${API_BASE_URL}/api/market/otc/tick`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  if (!response.ok) {
    throw new Error(`Failed to persist OTC tick (${response.status})`)
  }
  return response.json().catch(() => ({}))
}
