import Constants from 'expo-constants'

const TIMEFRAME_MAP = {
  M1: '1Min',
  M5: '5Min',
  M15: '15Min',
  M30: '30Min',
  H1: '1Hour',
  H4: '4Hour',
  D1: '1Day'
}

function getConfig() {
  const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {}
  const key = extra.alpacaKeyId
  const secret = extra.alpacaSecretKey
  const dataUrl = extra.alpacaDataUrl ?? 'https://data.alpaca.markets'

  if (!key || !secret) {
    throw new Error('Alpaca credentials are not configured. Set ALPACA_KEY_ID and ALPACA_SECRET_KEY in your environment.')
  }

  return {
    key,
    secret,
    dataUrl
  }
}

function buildAuthHeaders() {
  const { key, secret } = getConfig()
  return {
    'APCA-API-KEY-ID': key,
    'APCA-API-SECRET-KEY': secret
  }
}

async function fetchLatestTrade(symbol, type, headers, dataUrl) {
  const endpoint = type === 'forex'
    ? `${dataUrl}/v1beta1/forex/${symbol}/trades/latest`
    : `${dataUrl}/v2/stocks/${symbol}/trades/latest`
  const response = await fetch(endpoint, { headers })
  if (!response.ok) {
    throw new Error(`Trade request failed with status ${response.status}`)
  }
  const json = await response.json()
  const trade = type === 'forex' ? json?.trade : json?.trade
  if (!trade) {
    throw new Error('Trade payload missing')
  }
  return {
    price: Number((trade.price ?? trade.p ?? 0).toFixed(5)),
    timestamp: trade.t
  }
}

export async function fetchForexQuote(symbol = 'EURUSD', { assetType } = {}) {
  const { dataUrl } = getConfig()
  const headers = buildAuthHeaders()
  const normalized = symbol.replace('/', '')
  const type = assetType ?? (symbol.includes('/') || symbol.length === 6 ? 'forex' : 'equity')
  const endpoint = type === 'forex'
    ? `${dataUrl}/v1beta1/forex/${normalized}/quotes/latest`
    : `${dataUrl}/v2/stocks/${normalized}/quotes/latest`
  const response = await fetch(endpoint, { headers })
  if (!response.ok) {
    throw new Error(`Quote request failed with status ${response.status}`)
  }
  const json = await response.json()
  const quote = json?.quote
  let bid = type === 'forex' ? quote?.bid_price : quote?.bp
  let ask = type === 'forex' ? quote?.ask_price : quote?.ap

  if (!bid || !ask) {
    const trade = await fetchLatestTrade(normalized, type, headers, dataUrl)
    bid = bid ?? trade.price
    ask = ask ?? trade.price
  }

  const change = Number(ask - bid)

  return {
    bid: Number(Number(bid).toFixed(5)),
    ask: Number(Number(ask).toFixed(5)),
    change: change === 0 ? 0 : Number(((change / bid) * 100).toFixed(3))
  }
}

export async function fetchForexCandles(symbol = 'EURUSD', timeframe = 'M15', limit = 500, assetType = 'forex') {
  const { dataUrl } = getConfig()
  const headers = buildAuthHeaders()
  const mappedTimeframe = TIMEFRAME_MAP[timeframe] ?? TIMEFRAME_MAP.M15
  const params = new URLSearchParams({
    timeframe: mappedTimeframe,
    limit: String(limit)
  })
  const normalized = symbol.replace('/', '')
  const type = assetType ?? (symbol.includes('/') || symbol.length === 6 ? 'forex' : 'equity')
  const endpoint = type === 'forex'
    ? `${dataUrl}/v1beta1/forex/${normalized}/bars?${params.toString()}`
    : `${dataUrl}/v2/stocks/${normalized}/bars?${params.toString()}`
  const response = await fetch(endpoint, { headers })
  if (!response.ok) {
    throw new Error(`Bars request failed with status ${response.status}`)
  }
  const json = await response.json()
  const bars = json?.bars ?? []
  if (!bars.length) {
    throw new Error('Bars payload empty')
  }
  const decimals = assetType === 'forex' ? 5 : 2
  return bars.map(bar => ({
    time: bar.t,
    open: Number(bar.o.toFixed(decimals)),
    high: Number(bar.h.toFixed(decimals)),
    low: Number(bar.l.toFixed(decimals)),
    close: Number(bar.c.toFixed(decimals))
  }))
}
