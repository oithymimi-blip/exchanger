import { useCallback, useEffect, useRef } from 'react'
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts'
import { socket } from '../socket'

const defaultBase = (() => {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:4000`
  }
  return 'http://localhost:4000'
})()

const API_BASE = import.meta.env.VITE_API_BASE || defaultBase
const MAX_CANDLES = 500
const DEFAULT_TIMEFRAMES = ['15s', '30s', '1m', '5m', '10m', '15m', '1h', '1d']

function tfToSeconds(tf) {
  const match = String(tf).match(/^(\d+)([smhdwy])$/i)
  if (!match) return 60
  const value = Number(match[1])
  if (!Number.isFinite(value) || value <= 0) return 60
  const unit = match[2].toLowerCase()
  const MULTIPLIERS = { s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31536000 }
  return value * (MULTIPLIERS[unit] ?? 60)
}

export default function CandlestickChart({
  symbol = 'BTCUSDT',
  trades = [],
  onPriceUpdate,
  timeframe = '1m',
  onTimeframeChange,
  summary = [],
  timeframes = DEFAULT_TIMEFRAMES
}) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const candlesRef = useRef([])
  const priceLinesRef = useRef([])
  const priceUpdateRef = useRef(onPriceUpdate)
  const intervalSec = tfToSeconds(timeframe)
  const TARGET_VISIBLE_BARS = 70

  const applyZoom = useCallback(() => {
    const chart = chartRef.current
    const candles = candlesRef.current
    if (!chart || !candles || candles.length === 0) return
    const total = candles.length
    const to = total + 3
    const from = Math.max(0, total - TARGET_VISIBLE_BARS)
    chart.timeScale().setVisibleLogicalRange({ from, to })
  }, [TARGET_VISIBLE_BARS])

  useEffect(() => {
    priceUpdateRef.current = onPriceUpdate
  }, [onPriceUpdate])

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: '#ffffff' }, textColor: '#0f172a' },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.18)' },
        horzLines: { color: 'rgba(148,163,184,0.18)' }
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: intervalSec < 60,
        borderVisible: false,
        barSpacing: 12,
        rightOffset: 8
      },
      rightPriceScale: { borderVisible: false },
      crosshair: { mode: CrosshairMode.Magnet }
    })

    const series = chart.addCandlestickSeries({
      upColor: '#0ddf9a',
      borderUpColor: '#0ddf9a',
      wickUpColor: '#0ddf9a',
      downColor: '#f87171',
      borderDownColor: '#f87171',
      wickDownColor: '#f87171'
    })

    chartRef.current = chart
    seriesRef.current = series
    candlesRef.current = []

    let disposed = false

    async function loadInitial() {
      try {
        const res = await fetch(`${API_BASE}/api/market/candles?symbol=${symbol}&limit=${MAX_CANDLES}&tf=${timeframe}`)
        const rows = await res.json()
        if (disposed) return
        const formatted = rows.map(r => ({
          time: r.time ?? r.ts,
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close
        }))
        candlesRef.current = formatted
        series.setData(formatted)
        applyZoom()
      } catch (err) {
        console.error('Failed to load candles', err)
      }
    }
    loadInitial()

    const handleTick = (msg) => {
      if (msg.symbol !== symbol) return
      const price = Number(msg.price)
      if (!Number.isFinite(price)) return

      priceUpdateRef.current?.(price)

      const bucketTime = Math.floor(msg.ts / intervalSec) * intervalSec
      let candles = candlesRef.current.slice()
      let last = candles[candles.length - 1]

      if (!last) {
        const first = { time: bucketTime, open: price, high: price, low: price, close: price }
        candles = [first]
        candlesRef.current = candles
        series.setData(candles)
        applyZoom()
        return
      }

      if (last.time === bucketTime) {
        last = {
          ...last,
          high: Math.max(last.high, price),
          low: Math.min(last.low, price),
          close: price
        }
        candles[candles.length - 1] = last
        candlesRef.current = candles
        series.update(last)
        applyZoom()
        return
      }

      if (bucketTime > last.time) {
        const newCandle = {
          time: bucketTime,
          open: last.close ?? price,
          high: price,
          low: price,
          close: price
        }
        candles.push(newCandle)
        if (candles.length > MAX_CANDLES) {
          candles = candles.slice(-MAX_CANDLES)
        }
        candlesRef.current = candles
        series.update(newCandle)
        applyZoom()
      }
    }

    socket.on('tick', handleTick)

    return () => {
      disposed = true
      socket.off('tick', handleTick)
      chart.remove()
      seriesRef.current = null
      chartRef.current = null
      candlesRef.current = []
      priceLinesRef.current = []
    }
  }, [symbol, timeframe, intervalSec, applyZoom])

  useEffect(() => {
    if (!seriesRef.current) return
    priceLinesRef.current.forEach(line => seriesRef.current.removePriceLine(line))
    const lines = (trades || [])
      .filter(t => Number.isFinite(t?.price) && (t?.remaining_qty ?? t?.qty ?? 0) > 1e-8)
      .map(t => {
        const remainingStake = Number(t.pip_value ?? t.stake_amount ?? 0)
        const sideLabel = t.side === 'sell' ? 'Sell' : 'Buy'
        const amountLabel = Number.isFinite(remainingStake)
          ? `$${remainingStake.toFixed(2)}`
          : ''
        return seriesRef.current.createPriceLine({
          price: t.price,
          color: t.side === 'sell' ? '#f97316' : '#00df9a',
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: true,
          title: `${sideLabel}${amountLabel ? ` ${amountLabel}` : ''} @ ${t.price.toFixed(2)}`
        })
      })
    priceLinesRef.current = lines
  }, [trades])

  return (
    <div className="rounded-3xl bg-white text-slate-900 p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.14em] text-slate-400">
        <span>Time Unit</span>
        <select
          value={timeframe}
          onChange={(e) => onTimeframeChange?.(e.target.value)}
          className="rounded-xl border border-emerald-400/70 bg-emerald-50/30 px-3 py-1.5 text-[11px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand"
        >
          {timeframes.map(tf => (
            <option key={tf} value={tf} className="text-slate-900">{tf.toUpperCase()}</option>
          ))}
        </select>
      </div>
      {summary.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[9px] uppercase tracking-[0.12em] text-slate-400">
          {summary.map(item => {
            let tone = 'text-slate-600'
            if (item.tone === 'primary') tone = 'text-slate-900'
            if (item.tone === 'success') tone = 'text-emerald-500'
            if (item.tone === 'danger') tone = 'text-rose-500'
            if (item.tone === 'muted') tone = 'text-slate-500'
            const font = item.monospace ? 'font-mono' : 'font-semibold'
            return (
              <div key={item.label} className="space-y-1">
                <div>{item.label}</div>
                <div className={`text-[12px] tracking-normal ${tone} ${font}`}>{item.value}</div>
              </div>
            )
          })}
        </div>
      )}
      <div className="w-full h-[360px] sm:h-[480px]" ref={containerRef} />
    </div>
  )
}
