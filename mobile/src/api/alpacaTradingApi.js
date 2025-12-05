import Constants from 'expo-constants'

function getConfig() {
  const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {}
  const key = extra.alpacaKeyId
  const secret = extra.alpacaSecretKey
  const tradingUrl = extra.alpacaPaperTradingUrl ?? 'https://paper-api.alpaca.markets'

  if (!key || !secret) {
    throw new Error('Alpaca credentials are not configured. Set ALPACA_KEY_ID and ALPACA_SECRET_KEY in your environment.')
  }

  return {
    key,
    secret,
    tradingUrl
  }
}

function authHeaders() {
  const { key, secret } = getConfig()
  return {
    'APCA-API-KEY-ID': key,
    'APCA-API-SECRET-KEY': secret,
    'Content-Type': 'application/json'
  }
}

const LOT_SIZE = 100000

export async function submitForexOrder(order) {
  const { tradingUrl } = getConfig()
  const headers = authHeaders()

  const normalizedSymbol = order.symbol.replace('/', '')
  const assetType = order.assetType ?? 'forex'

  const body = {
    symbol: normalizedSymbol,
    side: order.side,
    type: order.orderType.toLowerCase(),
    time_in_force: 'day',
    client_order_id: order.clientOrderId
  }

  if (assetType === 'forex') {
    body.notional = Number((order.volume * LOT_SIZE).toFixed(2))
  } else {
    body.qty = Math.max(1, Math.round(order.volume))
  }

  if (order.orderType === 'limit' || order.orderType === 'stop_limit') {
    body.limit_price = Number(order.limitPrice?.toFixed(5) ?? order.price?.toFixed(5))
  }

  if (order.orderType === 'stop' || order.orderType === 'stop_limit') {
    body.stop_price = Number((order.stopPrice ?? order.stopLoss ?? order.price)?.toFixed(5))
  }

  if (order.orderType === 'market') {
    delete body.limit_price
    delete body.stop_price
  }

  const response = await fetch(`${tradingUrl}/v2/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Order failed (${response.status}): ${errorBody}`)
  }

  return response.json()
}

export async function fetchOpenPositions() {
  const { tradingUrl } = getConfig()
  const headers = authHeaders()
  const response = await fetch(`${tradingUrl}/v2/positions`, { headers })
  if (!response.ok) {
    throw new Error(`Positions request failed (${response.status})`)
  }
  const data = await response.json()
  return data.map(position => ({
    id: position.asset_id,
    symbol: position.symbol,
    type: Number(position.qty) >= 0 ? 'Buy' : 'Sell',
    volume: Math.abs(Number(position.qty ?? 0)),
    entry: Number(position.avg_entry_price ?? 0),
    price: Number(position.current_price ?? 0),
    pnl: Number(position.unrealized_pl ?? 0),
    pnlPct: Number(position.unrealized_plpc ?? 0) * 100,
    assetClass: position.asset_class
  }))
}

export async function fetchRecentOrders(limit = 15) {
  const { tradingUrl } = getConfig()
  const headers = authHeaders()
  const params = new URLSearchParams({
    status: 'all',
    limit: String(limit),
    nested: 'true',
    direction: 'desc'
  })
  const response = await fetch(`${tradingUrl}/v2/orders?${params.toString()}`, { headers })
  if (!response.ok) {
    throw new Error(`Orders request failed (${response.status})`)
  }
  const data = await response.json()
  return data.map(order => ({
    id: order.id,
    symbol: order.symbol,
    type: order.type,
    side: order.side,
    volume: order.qty ? Number(order.qty) : Number(order.notional ?? 0),
    filledAvgPrice: order.filled_avg_price ? Number(order.filled_avg_price) : null,
    status: order.status,
    submittedAt: order.submitted_at,
    assetClass: order.asset_class
  }))
}

export async function closePosition(symbol) {
  const { tradingUrl } = getConfig()
  const headers = authHeaders()
  const response = await fetch(`${tradingUrl}/v2/positions/${symbol.replace('/', '')}`, {
    method: 'DELETE',
    headers
  })
  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Failed to close position (${response.status}): ${errorBody}`)
  }
  return response.json()
}

export async function fetchAccountSummary() {
  const { tradingUrl } = getConfig()
  const headers = authHeaders()
  const response = await fetch(`${tradingUrl}/v2/account`, { headers })
  if (!response.ok) {
    throw new Error(`Account request failed (${response.status})`)
  }
  const data = await response.json()
  return {
    id: data.id,
    number: data.account_number,
    equity: Number(data.equity ?? 0),
    buyingPower: Number(data.buying_power ?? 0),
    cash: Number(data.cash ?? 0),
    portfolioValue: Number(data.portfolio_value ?? 0),
    multiplier: Number(data.multiplier ?? 1),
    status: data.status,
    createdAt: data.created_at
  }
}
