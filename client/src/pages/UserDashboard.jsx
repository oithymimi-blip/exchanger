import { useCallback, useEffect, useMemo, useState } from 'react'
import CandlestickChart from '../components/CandlestickChart'
import OrderTicket from '../components/OrderTicket'
import BinaryTradePanel from '../components/BinaryTradePanel'
import SpotTradePanel from '../components/SpotTradePanel'
import ReferralWidget from '../components/ReferralWidget'
import Leaderboard from '../components/Leaderboard'
import { api } from '../api'
import { useAuth } from '../store'
import { useAccount } from '../accountStore'

const defaultBase = (() => {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:4000`
  }
  return 'http://localhost:4000'
})()

const API_BASE = import.meta.env.VITE_API_BASE || defaultBase

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

function formatCurrency(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '$0.00'
  const abs = Math.abs(num)
  if (abs > 0 && abs < 0.01) {
    return `${num < 0 ? '-' : ''}$${abs.toFixed(4)}`
  }
  return currency.format(num)
}

export default function UserDashboard() {
  const { token } = useAuth()
  const [state, setState] = useState(null)
  const [currentPrice, setCurrentPrice] = useState(null)
  const [openTrades, setOpenTrades] = useState([])
  const [recentTrades, setRecentTrades] = useState([])
  const [balances, setBalances] = useState({ available: 0, locked: 0, total: 0 })
  const [equity, setEquity] = useState(0)
  const [openPnl, setOpenPnl] = useState(0)
  const [openPips, setOpenPips] = useState(0)
  const [initialBalance, setInitialBalance] = useState(10000)
  const [loadingTrades, setLoadingTrades] = useState(false)
  const [pipSize, setPipSize] = useState(0.0001)
  const [closingAll, setClosingAll] = useState(false)
  const [closingTradeIds, setClosingTradeIds] = useState([])
  const [marginUsed, setMarginUsed] = useState(0)
  const [freeMargin, setFreeMargin] = useState(0)
  const [marginLevel, setMarginLevel] = useState(null)
  const setAccountSummary = useAccount(state => state.setSummary)
  const clearAccountSummary = useAccount(state => state.clear)
  const [timeframe, setTimeframe] = useState('1m')
  const [mode, setMode] = useState('forex')

  useEffect(() => {
    async function loadState() {
      try {
        const res = await fetch(`${API_BASE}/api/market/state`)
        const data = await res.json()
        setState(data)
        setCurrentPrice(data?.currentPrice ?? null)
      } catch (err) {
        console.error('Failed to load market state', err)
      }
    }
    loadState()
  }, [])

  const applyOverview = useCallback((payload) => {
    if (!payload) return
    if (payload.currentPrice != null) {
      setCurrentPrice(payload.currentPrice)
    }
    if (payload.openTrades) {
      setOpenTrades(payload.openTrades)
    }
    if (payload.recentTrades) {
      setRecentTrades(payload.recentTrades)
    }
    if (payload.balance) {
      setBalances({
        available: Number(payload.balance.available ?? 0),
        locked: Number(payload.balance.locked ?? 0),
        total: Number(payload.balance.total ?? (Number(payload.balance.available ?? 0) + Number(payload.balance.locked ?? 0)))
      })
    }
    if (payload.equity != null) {
      setEquity(Number(payload.equity))
    }
    if (payload.openPnl != null) {
      setOpenPnl(Number(payload.openPnl))
    }
    if (payload.openPips != null) {
      setOpenPips(Number(payload.openPips))
    }
    if (payload.initialBalance != null) {
      setInitialBalance(Number(payload.initialBalance))
    }
    if (payload.pipSize != null) {
      setPipSize(Number(payload.pipSize))
    }
    if (payload.marginUsed != null) {
      setMarginUsed(Number(payload.marginUsed))
    }
    if (payload.freeMargin != null) {
      setFreeMargin(Number(payload.freeMargin))
    }
    if (payload.marginLevel != null) {
      setMarginLevel(Number(payload.marginLevel))
    }
    setAccountSummary(payload)
  }, [setAccountSummary])

  const refreshTrades = useCallback(async () => {
    if (!token) {
      setOpenTrades([])
      setRecentTrades([])
      setBalances({ available: 0, locked: 0, total: 0 })
      setEquity(0)
      setOpenPnl(0)
      setOpenPips(0)
      setMarginUsed(0)
      setFreeMargin(0)
      setMarginLevel(null)
      clearAccountSummary()
      return
    }
    setLoadingTrades(true)
    try {
      const res = await api(token).get('/api/trades/overview', { params: { limit: 10 } })
      applyOverview(res.data)
    } catch (err) {
      console.error('Failed to load trades', err)
    } finally {
      setLoadingTrades(false)
    }
  }, [token, applyOverview, clearAccountSummary])

  const handleBinaryBalance = useCallback((snapshot) => {
    if (!snapshot) return
    const availableVal = Number(snapshot.available ?? 0)
    const lockedVal = Number(snapshot.locked ?? 0)
    const totalValRaw = snapshot.total != null ? Number(snapshot.total) : availableVal + lockedVal
    const totalVal = Math.round(totalValRaw * 100) / 100
    const freeVal = Math.round((totalVal - lockedVal) * 100) / 100
    const marginLevelVal = lockedVal > 0 ? Math.round(((totalVal / lockedVal) * 100) * 100) / 100 : null

    setBalances({ available: availableVal, locked: lockedVal, total: totalVal })
    setEquity(totalVal)
    setMarginUsed(Math.round(lockedVal * 100) / 100)
    setFreeMargin(freeVal)
    setMarginLevel(marginLevelVal)

    const previous = useAccount.getState().summary || {}
    setAccountSummary({
      ...previous,
      balance: { available: availableVal, locked: lockedVal, total: totalVal },
      equity: totalVal,
      marginUsed: Math.round(lockedVal * 100) / 100,
      freeMargin: freeVal,
      marginLevel: marginLevelVal
    })
  }, [setAccountSummary])

  useEffect(() => {
    if (token) {
      refreshTrades()
    }
  }, [token, refreshTrades])

  useEffect(() => {
    if (!Number.isFinite(currentPrice)) {
      setOpenPnl(0)
      setOpenPips(0)
      setEquity(Number((balances.available + balances.locked).toFixed(2)))
      return
    }
    let totalOpenPnl = 0
    let totalOpenPips = 0
    for (const t of openTrades) {
      const totalQty = Number(t.qty || 0)
      const remainingQty = Number(t.remaining_qty ?? totalQty)
      if (!totalQty || !remainingQty) continue
      const entry = Number(t.price || 0)
      const direction = t.side === 'sell' ? -1 : 1
      const tradePipSize = Number(t.pip_size ?? pipSize)
      const pipDiff = tradePipSize > 0 ? ((currentPrice - entry) / tradePipSize) * direction : 0
      const portion = Number(t.pip_value ?? (remainingQty / totalQty))
      const tradePips = pipDiff * portion
      totalOpenPips += tradePips
      totalOpenPnl += tradePips
    }
    const computedEquity = balances.available + balances.locked + totalOpenPnl
    setOpenPnl(Number(totalOpenPnl.toFixed(2)))
    setOpenPips(Number(totalOpenPips.toFixed(2)))
    setEquity(Number(computedEquity.toFixed(2)))
  }, [currentPrice, openTrades, balances, pipSize])

  const displayPrice = currentPrice ?? state?.currentPrice
  const numericDisplayPrice = Number(displayPrice)
  const volatility = Number(state?.volatility ?? 0)
  const marketPaused = Boolean(state?.paused)
  const lastUpdated = state?.updated_at ? new Date(state.updated_at) : null
  const volatilityLabel = Number.isFinite(volatility) ? `${(volatility * 100).toFixed(1)}%` : '--'
  const lastUpdatedLabel = lastUpdated
    ? `${lastUpdated.toLocaleDateString()} ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '--'
  const marketStatusLabel = marketPaused ? 'Paused' : 'Live'
  const chartSummary = [
    { label: 'Pair', value: `${state?.symbol || 'BTCUSDT'} · Spot`, tone: 'muted' },
    {
      label: 'Price',
      value: Number.isFinite(numericDisplayPrice) ? numericDisplayPrice.toFixed(2) : '--',
      tone: 'primary',
      monospace: true
    },
    { label: 'Market', value: marketStatusLabel, tone: marketPaused ? 'danger' : 'success' },
    { label: 'Updated', value: lastUpdatedLabel, tone: 'muted' }
  ]
  const enrichedTrades = useMemo(() => {
    return (recentTrades || []).map(trade => {
      const qty = Number(trade.qty || 0)
      const remaining = Number(trade.remaining_qty ?? qty)
      const isOpen = trade.status === 'open' && remaining > 1e-8
      const entryPrice = Number(trade.price || 0)
      const exitPrice = Number(trade.exit_price || trade.price || 0)
      const tradePipSize = Number(trade.pip_size ?? pipSize)
      const totalNotional = Number(trade.notional ?? entryPrice * qty)
      const stakeAmount = Number(trade.stake_amount ?? totalNotional)
      const remainingStake = Number(trade.pip_value ?? (isOpen ? stakeAmount : 0))
      const effectivePrice = isOpen && Number.isFinite(currentPrice)
        ? currentPrice
        : exitPrice
      const direction = trade.side === 'sell' ? -1 : 1
      const pipDiff = tradePipSize > 0 ? ((effectivePrice - entryPrice) / tradePipSize) * direction : 0
      const livePips = isOpen ? pipDiff : Number(trade.pips_realized ?? pipDiff)
      const pnl = isOpen ? pipDiff * remainingStake : Number(trade.pnl ?? (livePips * stakeAmount))
      const realizedPips = Number(trade.pips_realized ?? 0)
      return {
        ...trade,
        qty,
        remaining,
        isOpen,
        stakeAmount,
        remainingStake,
        totalNotional,
        pipValue: remainingStake,
        realizedPips,
        displayPrice: Number.isFinite(effectivePrice) ? effectivePrice : null,
        livePnl: pnl,
        livePips
      }
    })
  }, [recentTrades, currentPrice, pipSize])

  const closingSet = useMemo(() => new Set(closingTradeIds), [closingTradeIds])
  const hasOpenPositions = openTrades.some(t => Number(t.remaining_qty || 0) > 1e-8)
  const openPipsLabel = Number.isFinite(openPips) ? `${openPips >= 0 ? '+' : ''}${openPips.toFixed(2)} pips` : '--'

  const metricCards = [
    { label: 'Balance', value: balances.total, accentClass: 'text-white' },
    { label: 'Available', value: balances.available, accentClass: 'text-emerald-400' },
    { label: 'Equity', value: equity, accentClass: 'text-white' },
    { label: 'Margin Used', value: marginUsed, accentClass: 'text-sky-300' },
    { label: 'Free Margin', value: freeMargin, accentClass: 'text-emerald-400' },
    {
      label: 'Open P/L',
      value: openPnl,
      accentClass: openPnl >= 0 ? 'text-emerald-400' : 'text-rose-400',
      secondary: openPipsLabel
    },
    {
      label: 'Margin Level',
      value: marginLevel,
      formatter: (val) => val == null ? '∞' : `${Number(val).toFixed(2)}%`
    }
  ]

  function renderMetric({ label, value, accentClass = '', secondary, formatter = formatCurrency }) {
    const displayValue = formatter ? formatter(value) : value
    return (
      <div key={label} className="rounded-2xl border border-white/5 bg-black/20 px-3 py-3 sm:px-4 sm:py-4 flex flex-col gap-1.5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</div>
        <div className={`text-sm sm:text-base font-mono leading-tight ${accentClass}`}>{displayValue ?? '--'}</div>
        {secondary != null && (
          <div className="text-[11px] text-white/55 leading-tight">{secondary}</div>
        )}
      </div>
    )
  }

  async function handleCloseTrade(id) {
    if (!token || closingSet.has(id)) return
    setClosingTradeIds(prev => [...prev, id])
    try {
      const res = await api(token).post(`/api/trades/${id}/close`)
      applyOverview(res.data)
    } catch (err) {
      console.error('Failed to close trade', err)
    } finally {
      setClosingTradeIds(prev => prev.filter(tid => tid !== id))
    }
  }

  async function handleCloseAll() {
    if (!token || !hasOpenPositions) return
    setClosingAll(true)
    try {
      const res = await api(token).post('/api/trades/close-all')
      applyOverview(res.data)
      setClosingTradeIds([])
    } catch (err) {
      console.error('Failed to close all trades', err)
    } finally {
      setClosingAll(false)
    }
  }

  return (
    <div className="grid gap-4 lg:gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
      <div className="space-y-4 lg:space-y-5">
        <section className="space-y-4 md:space-y-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-white/50">
            {[
              { key: 'forex', label: 'Forex' },
              { key: 'binary', label: 'Binary' },
              { key: 'spot', label: 'Spot' },
              { key: 'web3', label: 'Web3' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`rounded-full border px-3 py-1.5 transition ${
                  mode === key
                    ? 'border-brand/80 bg-brand text-black shadow-[0_12px_24px_rgba(0,223,154,0.35)]'
                    : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === 'forex' && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,320px)] items-start">
              <CandlestickChart
                symbol={state?.symbol || 'BTCUSDT'}
                trades={openTrades}
                onPriceUpdate={setCurrentPrice}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                summary={chartSummary}
              />
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/60 mb-3">Forex Order</div>
                <OrderTicket
                  variant="embedded"
                  onPlaced={(payload) => {
                    applyOverview(payload)
                  }}
                />
              </div>
            </div>
          )}
          {mode === 'binary' && (
            <BinaryTradePanel
              summary={chartSummary}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              onAccountRefresh={refreshTrades}
              symbol={state?.symbol || 'BTCUSDT'}
              onPriceUpdate={setCurrentPrice}
              onBalanceSnapshot={handleBinaryBalance}
            />
          )}
          {mode === 'spot' && (
            <SpotTradePanel
              onSelectPrice={(market) => {
                setCurrentPrice(market?.price ?? currentPrice)
              }}
            />
          )}
          {mode === 'web3' && (
            <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm text-white/60">
              Web3 trading module is on the way.
            </div>
          )}
        </section>

        <section className="card space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Account</div>
              <div className="text-lg font-semibold text-white/90">Demo Balance</div>
              <div className="text-[11px] text-white/55">Initial deposit {formatCurrency(initialBalance)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] sm:text-xs sm:min-w-[240px]">
              <div className="rounded-xl border border-white/5 bg-black/15 px-3 py-2">
                <div className="text-[9px] uppercase tracking-[0.16em] text-white/45">Pip Size</div>
                <div className="font-mono text-sm">{pipSize}</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/15 px-3 py-2">
                <div className="text-[9px] uppercase tracking-[0.16em] text-white/45">Volatility</div>
                <div className="font-mono text-sm">{volatilityLabel}</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {metricCards.map(renderMetric)}
          </div>
        </section>

        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Current Orders</div>
              <div className="text-lg font-semibold">Recent Trades</div>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              {loadingTrades && <span className="text-white/50">Updating…</span>}
              {hasOpenPositions && (
                <button
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-medium hover:bg-white/10 transition disabled:opacity-60"
                  onClick={handleCloseAll}
                  disabled={closingAll}
                >
                  {closingAll ? 'Closing…' : 'Close All'}
                </button>
              )}
            </div>
          </div>
          <div className="hidden md:block overflow-auto">
            <table className="w-full text-[12px]">
              <thead className="text-white/55 uppercase tracking-[0.12em] text-[10px]">
                <tr className="text-left">
                  <th className="p-2">Time</th>
                  <th className="p-2">Side</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2 text-right">Size</th>
                  <th className="p-2 text-right">Entry</th>
                  <th className="p-2 text-right">Current</th>
                  <th className="p-2 text-right">P/L</th>
                  <th className="p-2 text-right">Status</th>
                  <th className="p-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {enrichedTrades.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-white/50">
                      No trades yet.
                    </td>
                  </tr>
                )}
                {enrichedTrades.map(trade => {
                  const timeLabel = trade.created_at
                    ? new Date(trade.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--'
                  const sizeLabel = Number.isFinite(trade.remaining) && trade.isOpen
                    ? `${trade.remaining.toFixed(6)} / ${trade.qty.toFixed(6)}`
                    : trade.qty.toFixed(6)
                  const currentLabel = trade.displayPrice != null
                    ? trade.displayPrice.toFixed(2)
                    : '--'
                  const pnlLabel = Number.isFinite(trade.livePnl) ? trade.livePnl : 0
                  const pipsValue = trade.isOpen ? trade.livePips : trade.realizedPips
                  const pipsLabel = Number.isFinite(pipsValue) ? pipsValue : 0
                  const pnlClass = pnlLabel >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  const isClosing = closingSet.has(trade.id)
                  const amountDisplay = trade.isOpen && trade.stakeAmount
                    ? `${formatCurrency(trade.remainingStake)} / ${formatCurrency(trade.stakeAmount)}`
                    : formatCurrency(trade.stakeAmount || trade.remainingStake)
                  return (
                    <tr key={trade.id}>
                      <td className="p-2 text-white/70">{timeLabel}</td>
                      <td className={`p-2 font-semibold ${trade.side === 'buy' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {trade.side?.toUpperCase?.() || trade.side}
                      </td>
                      <td className="p-2 text-right font-mono">{amountDisplay}</td>
                      <td className="p-2 text-right font-mono">{sizeLabel}</td>
                      <td className="p-2 text-right font-mono">{trade.price?.toFixed?.(2) ?? '--'}</td>
                      <td className="p-2 text-right font-mono">{currentLabel}</td>
                      <td className={`p-2 text-right font-mono ${pnlClass}`}>
                        <div>{formatCurrency(pnlLabel)}</div>
                        <div className="text-[10px] text-white/55">{pipsLabel >= 0 ? '+' : ''}{pipsLabel.toFixed(2)} pips</div>
                      </td>
                      <td className="p-2 text-right text-white/50">
                        {trade.isOpen ? 'Open' : 'Closed'}
                      </td>
                      <td className="p-2 text-right">
                        {trade.isOpen ? (
                          <button
                            className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium hover:bg-white/10 transition disabled:opacity-60"
                            onClick={() => handleCloseTrade(trade.id)}
                            disabled={isClosing}
                          >
                            {isClosing ? 'Closing…' : 'Close'}
                          </button>
                        ) : (
                          <span className="text-white/35 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {enrichedTrades.length === 0 && (
              <div className="text-center text-white/50 text-[12px]">No trades yet.</div>
            )}
            {enrichedTrades.map(trade => {
              const timeLabel = trade.created_at
                ? new Date(trade.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '--'
              const sizeLabel = Number.isFinite(trade.remaining) && trade.isOpen
                ? `${trade.remaining.toFixed(5)} / ${trade.qty.toFixed(5)}`
                : trade.qty.toFixed(5)
              const pnlLabel = Number.isFinite(trade.livePnl) ? trade.livePnl : 0
              const pipsValue = trade.isOpen ? trade.livePips : trade.realizedPips
              const pipsLabel = Number.isFinite(pipsValue) ? pipsValue : 0
              const pnlClass = pnlLabel >= 0 ? 'text-emerald-400' : 'text-rose-400'
              const isClosing = closingSet.has(trade.id)
              return (
                <div key={trade.id} className="rounded-2xl border border-white/5 bg-black/15 p-3 space-y-2 text-[11px]">
                  <div className="flex justify-between text-white/50 text-[10px] uppercase tracking-[0.12em]">
                    <span>{timeLabel}</span>
                    <span>{trade.isOpen ? 'Open' : 'Closed'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className={`font-semibold ${trade.side === 'buy' ? 'text-emerald-400' : 'text-rose-400'}`}>{trade.side?.toUpperCase?.() || trade.side}</div>
                    <div className="text-white/60 text-[11px]">{sizeLabel}</div>
                  </div>
                  <div className="text-white/55 text-[10px]">Entry {trade.price?.toFixed?.(2) ?? '--'} · Current {trade.displayPrice != null ? trade.displayPrice.toFixed(2) : '--'}</div>
                  <div className="flex items-end justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-white/45 text-[9px] uppercase tracking-[0.14em]">Amount</div>
                      <div className="font-mono text-[11px]">{trade.isOpen && trade.stakeAmount ? `${formatCurrency(trade.remainingStake)} / ${formatCurrency(trade.stakeAmount)}` : formatCurrency(trade.stakeAmount || trade.remainingStake)}</div>
                    </div>
                    <div className={`font-mono text-right ${pnlClass}`}>
                      <div>{formatCurrency(pnlLabel)}</div>
                      <div className="text-[9px] text-white/55">{pipsLabel >= 0 ? '+' : ''}{pipsLabel.toFixed(2)} pips</div>
                    </div>
                    {trade.isOpen ? (
                      <button
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-medium hover:bg-white/10 transition disabled:opacity-60"
                        onClick={() => handleCloseTrade(trade.id)}
                        disabled={isClosing}
                      >
                        {isClosing ? '...' : 'Close'}
                      </button>
                    ) : (
                      <span className="text-white/35 text-[10px]">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <div className="space-y-3 lg:space-y-4">
        <Leaderboard />
        <ReferralWidget />
        <div className="card space-y-2 text-[11px] text-white/65">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Notes</div>
          <p>Market is simulated and may be paused or moved by Admin. This build is for demo/testing.</p>
        </div>
      </div>
    </div>
  )
}
