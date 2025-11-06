import { useCallback, useEffect, useMemo, useState } from 'react'
import CandlestickChart from './CandlestickChart'
import { api } from '../api'
import { useAuth } from '../store'

const FALLBACK_DURATIONS = [30, 60, 120, 300]

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

function formatCurrency(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '$0.00'
  return currencyFmt.format(numeric)
}

function formatSeconds(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m <= 0) {
    return `${s}s`
  }
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

export default function BinaryTradePanel({ summary, timeframe, onTimeframeChange, onAccountRefresh, symbol = 'BTCUSDT', onPriceUpdate, onBalanceSnapshot }) {
  const { token } = useAuth()
  const [amount, setAmount] = useState(25)
  const [duration, setDuration] = useState(60)
  const [placingSide, setPlacingSide] = useState(null)
  const [message, setMessage] = useState('Loading binary overview…')
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const id = setInterval(() => setNowTs(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const durations = overview?.durations?.length ? overview.durations : FALLBACK_DURATIONS
  const payoutRate = overview?.payoutRate ?? 0.8

  const fetchOverview = useCallback(async () => {
    if (!token) {
      setOverview(null)
      setMessage('Sign in to trade binary options')
      return
    }
    try {
      setLoading(true)
      const res = await api(token).get('/api/binary-trades/overview', { params: { limit: 20 } })
      setOverview(res.data)
      if (res.data?.open?.length || res.data?.history?.length) {
        setMessage('')
      } else {
        setMessage('No binary trades yet — place your first position to see results here.')
      }
      if (res.data?.durations?.length && !res.data.durations.includes(duration)) {
        setDuration(res.data.durations[0])
      }
      if (res.data?.balance) {
        onBalanceSnapshot?.(res.data.balance)
      }
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Failed to load binary trades')
    } finally {
      setLoading(false)
    }
  }, [token, duration, onBalanceSnapshot])

  useEffect(() => {
    fetchOverview()
    const id = setInterval(() => fetchOverview(), 5000)
    return () => clearInterval(id)
  }, [fetchOverview])

  const openTrades = useMemo(() => {
    const now = nowTs
    return (overview?.open || []).map(trade => ({
      ...trade,
      time_left: Math.max(0, Number(trade.expiry_ts) - now)
    }))
  }, [overview?.open, nowTs])

  const history = useMemo(() => overview?.history || [], [overview?.history])
  const stats = overview?.stats || { total: 0, win: 0, lose: 0, push: 0, net: 0 }
  const balance = overview?.balance || null

  if (!token) {
    return (
      <div className="rounded-3xl bg-white text-slate-900 p-4 sm:p-5 space-y-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-500">Binary Options</div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-600">
          Sign in to trade binary options.
        </div>
      </div>
    )
  }

  async function place(direction) {
    if (!token) {
      setMessage('Sign in to trade binary options')
      return
    }
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setMessage('Enter a valid stake')
      return
    }
    setPlacingSide(direction)
    setMessage('')
    try {
      await api(token).post('/api/binary-trades', {
        direction,
        amount: numericAmount,
        duration
      })
      await fetchOverview()
      onAccountRefresh?.()
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Unable to place binary trade')
    } finally {
      setPlacingSide(null)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,320px)] items-start">
      <CandlestickChart
        symbol={symbol}
        summary={summary}
        timeframe={timeframe}
        onTimeframeChange={onTimeframeChange}
        onPriceUpdate={onPriceUpdate}
      />
      <div className="rounded-3xl bg-white text-slate-900 p-4 sm:p-5 space-y-4">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-500">Binary Options</div>
          <div className="text-sm text-slate-500">Fixed payout {Math.round(payoutRate * 100)}% · Instant expiry settlement</div>
        </div>
        {message && (
          <div
            className={`rounded-2xl border px-3 py-2 text-[12px] ${
              message.includes('Failed')
                ? 'border-rose-200 bg-rose-50 text-rose-600'
                : message.includes('Sign in')
                  ? 'border-amber-200 bg-amber-50 text-amber-600'
                  : message.includes('No binary trades')
                    ? 'border-slate-200 bg-slate-50 text-slate-600'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-600'
            }`}
          >
            {message}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {durations.map(value => (
            <button
              key={value}
              onClick={() => setDuration(value)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                duration === value
                  ? 'border-emerald-500 bg-emerald-100 text-emerald-700'
                  : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {value >= 60 ? `${value / 60}m` : `${value}s`}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Stake (USD)</div>
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
              disabled={!token}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => place('call')}
              disabled={placingSide === 'call' || !token}
              className="rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-2 transition disabled:opacity-70"
            >
              {placingSide === 'call' ? 'Placing…' : 'Call (↑)'}
            </button>
            <button
              onClick={() => place('put')}
              disabled={placingSide === 'put' || !token}
              className="rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-semibold py-2 transition disabled:opacity-70"
            >
              {placingSide === 'put' ? 'Placing…' : 'Put (↓)'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[12px] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Available</div>
            <div className="font-semibold">{balance ? formatCurrency(balance.available) : '--'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Locked</div>
            <div className="font-semibold">{balance ? formatCurrency(balance.locked) : '--'}</div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
          <div className="flex justify-between">
            <span>Trades</span>
            <span>{stats.total}</span>
          </div>
          <div className="flex justify-between">
            <span>Wins</span>
            <span className="text-emerald-500 font-semibold">{stats.win}</span>
          </div>
          <div className="flex justify-between">
            <span>Losses</span>
            <span className="text-rose-500 font-semibold">{stats.lose}</span>
          </div>
          <div className="flex justify-between">
            <span>Push</span>
            <span>{stats.push}</span>
          </div>
          <div className="mt-2 border-t border-slate-200 pt-2 flex justify-between font-semibold">
            <span>Net Payout</span>
            <span className={stats.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
              {formatCurrency(stats.net)}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Open positions</div>
          <div className="space-y-2">
            {openTrades.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-500">No open positions.</div>
            )}
            {openTrades.map(trade => (
              <div
                key={trade.id}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold">
                    {trade.direction === 'call' ? <span className="text-emerald-500">Call ↑</span> : <span className="text-rose-500">Put ↓</span>}
                  </div>
                  <div className="text-slate-500">Stake {formatCurrency(trade.stake)}</div>
                  <div className="text-slate-500">Potential {formatCurrency(trade.potential_return)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Time Left</div>
                  <div className="font-semibold text-slate-700">{formatSeconds(trade.time_left)}</div>
                  <div className="text-[11px] text-slate-400">Entry {formatCurrency(trade.entry_price)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Recent results</div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {history.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-500">No settlements yet.</div>
            )}
            {history.map(trade => (
              <div
                key={trade.id}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-700">
                    {new Date((trade.settled_ts || trade.expiry_ts) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-slate-500 capitalize">{trade.direction}</div>
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${trade.result === 'win' ? 'text-emerald-500' : trade.result === 'lose' ? 'text-rose-500' : trade.result === 'push' ? 'text-slate-500' : 'text-slate-400'}`}>
                    {trade.result === 'win'
                      ? `+${formatCurrency(trade.payout)}`
                      : trade.result === 'lose'
                        ? `-${formatCurrency(trade.stake)}`
                        : trade.result === 'push'
                          ? 'Push'
                          : 'Pending'}
                  </div>
                  <div className="text-[11px] text-slate-400">Close {formatCurrency(trade.settlement_price ?? trade.entry_price)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {loading && <div className="text-[11px] text-slate-400 text-right">Refreshing…</div>}
      </div>
    </div>
  )
}
