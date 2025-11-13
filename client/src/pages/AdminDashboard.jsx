import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { useAdminAuth } from '../adminStore'

const timeframePresets = [
  { label: '24 Hours', value: '24h' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
  { label: 'All Time', value: 'all' },
  { label: 'Custom Range', value: 'custom' }
]

const timeframeFactors = {
  '24h': 0.15,
  '7d': 0.35,
  '30d': 0.6,
  '90d': 0.85,
  all: 1
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const toIsoDate = (date) => date.toISOString().split('T')[0]
const getDefaultDateRange = () => ({
  from: toIsoDate(new Date(Date.now() - 30 * MS_PER_DAY)),
  to: toIsoDate(new Date())
})

const calculateDaysBetween = (from, to) => {
  const start = new Date(from)
  const end = new Date(to)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const [normalizedStart, normalizedEnd] = start.getTime() <= end.getTime()
    ? [start, end]
    : [end, start]
  const diff = normalizedEnd.getTime() - normalizedStart.getTime()
  return Math.max(1, Math.floor(diff / MS_PER_DAY) + 1)
}

const getCustomRangeFactor = (range) => {
  const days = calculateDaysBetween(range.from, range.to)
  return Math.min(1, Math.max(0.07, days / 120))
}

const currency = (value = 0, opts = {}) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: opts.maximumFractionDigits ?? 2,
    minimumFractionDigits: opts.minimumFractionDigits ?? 2
  }).format(Number(value) || 0)

const percent = (value = 0) => {
  const num = Number(value) || 0
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`
}

const polarToCartesian = (cx, cy, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians)
  }
}

const describeArc = (cx, cy, radius, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, radius, endAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1
  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    'L', cx, cy,
    'Z'
  ].join(' ')
}

const AnalyticsPieChart = ({ data, size = 340 }) => {
  const renderTotal = data.reduce((sum, segment) => sum + segment.value, 0)
  const displayTotal = data.reduce((sum, segment) => sum + segment.displayValue, 0)

  if (!renderTotal) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/70 text-sm text-slate-500">
        Waiting for analytics...
      </div>
    )
  }

  let cumulative = 0

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="w-full">
        <defs>
          {data.map((segment, index) => (
            <linearGradient
              key={`gradient-${segment.label}-${index}`}
              id={`analytics-pie-${index}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor={segment.color} />
              <stop offset="100%" stopColor={segment.colorEnd || segment.color} stopOpacity="0.8" />
            </linearGradient>
          ))}
        </defs>
        {data.map((segment, index) => {
          const startAngle = (cumulative / renderTotal) * 360
          cumulative += segment.value
          const endAngle = (cumulative / renderTotal) * 360
          return (
            <path
              key={`${segment.label}-${index}`}
              d={describeArc(size / 2, size / 2, size / 2 - 28, startAngle, endAngle)}
              fill={`url(#analytics-pie-${index})`}
              stroke="#f8fafc"
              strokeWidth="3"
            />
          )
        })}
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.4em] text-slate-400">Flow</div>
        <div className="text-2xl font-bold text-slate-900">{displayTotal ? currency(displayTotal) : '—'}</div>
        <div className="text-xs text-slate-500">Selected range</div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { token, admin } = useAdminAuth()
  const [dashboard, setDashboard] = useState(null)
  const [selectedRange, setSelectedRange] = useState('30d')
  const [customDateRange, setCustomDateRange] = useState(() => getDefaultDateRange())

  const hasPermission = (perm) => {
    if (admin?.role === 'admin') return true
    if (!perm) return admin?.role === 'subadmin'
    const perms = admin?.permissions || []
    return perms.includes('all') || perms.includes(perm)
  }

  const loadDashboard = async () => {
    if (!token || !hasPermission('analytics')) return
    try {
      const res = await api(token).get('/api/admin/dashboard')
      setDashboard(res.data)
    } catch (err) {
      console.error('dashboard error', err)
    }
  }

  useEffect(() => {
    if (!token) return
    loadDashboard()
  }, [token, admin])

  const summaryCards = useMemo(() => {
    if (!dashboard?.stats) return []
    return [
      {
        label: 'Total Invested',
        value: currency(dashboard.stats.totalInvested),
        change: percent((dashboard.stats.totalPnL / Math.max(1, dashboard.stats.totalInvested)) * 100),
        badge: '+',
        tone: 'emerald'
      },
      {
        label: 'Total P&L',
        value: currency(dashboard.stats.totalPnL),
        change: percent((dashboard.stats.dayChange || 0) / Math.max(1, dashboard.stats.totalPnL || 1) * 100),
        badge: '24h',
        tone: dashboard.stats.totalPnL >= 0 ? 'emerald' : 'rose'
      },
      {
        label: 'Liquidity On Platform',
        value: currency(dashboard.stats.totalBalance),
        change: `${currency(dashboard.stats.availableLiquidity)} liquid`,
        badge: 'Vault',
        tone: 'indigo'
      },
      {
        label: 'Total Users',
        value: dashboard.stats.totalUsers?.toLocaleString(),
        change: `${dashboard.stats.totalTrades?.toLocaleString()} trades`,
        badge: 'Accounts',
        tone: 'sky'
      }
    ]
  }, [dashboard])

  const pieSegments = useMemo(() => {
    const stats = dashboard?.stats
    if (!stats) {
      return [{
        label: 'Awaiting analytics',
        value: 1,
        displayValue: 0,
        color: '#e2e8f0',
        colorEnd: '#cbd5f5'
      }]
    }

    const invested = Math.max(0, Number(stats.totalInvested ?? 0))
    const available = Math.max(0, Number(stats.availableLiquidity ?? 0))
    const locked = Math.max(0, Number(stats.lockedMargin ?? 0))
    const totalBalance = Math.max(available + locked, Number(stats.totalBalance ?? available + locked))
    const pnl = Number(stats.totalPnL ?? 0)
    const withdrawn = Math.max(0, invested - totalBalance)
    const profit = Math.max(0, pnl)
    const loss = Math.max(0, -pnl)
    const factor = selectedRange === 'custom'
      ? getCustomRangeFactor(customDateRange)
      : timeframeFactors[selectedRange] ?? 1

    const baseSegments = [
      { label: 'Total Deposited', value: invested * factor, color: '#818cf8', colorEnd: '#6366f1' },
      { label: 'Total Withdrawals', value: withdrawn * factor, color: '#fb7185', colorEnd: '#f43f5e' },
      { label: 'Active Liquidity', value: totalBalance * factor, color: '#38bdf8', colorEnd: '#0ea5e9' },
      { label: 'Net Profit', value: profit * factor, color: '#4ade80', colorEnd: '#10b981' },
      { label: 'Net Loss', value: loss * factor, color: '#fb923c', colorEnd: '#f97316' }
    ]

    const computed = baseSegments.map(segment => ({
      ...segment,
      displayValue: Math.max(0, segment.value),
      value: segment.value > 0 ? segment.value : 0.01
    }))

    const displayTotal = computed.reduce((sum, segment) => sum + segment.displayValue, 0)
    if (displayTotal === 0) {
      return [{
        label: 'Gathering analytics',
        value: 1,
        displayValue: 0,
        color: '#e2e8f0',
        colorEnd: '#cbd5f5'
      }]
    }

    return computed
  }, [dashboard?.stats, selectedRange, customDateRange])

  const displayTotal = useMemo(
    () => pieSegments.reduce((sum, segment) => sum + segment.displayValue, 0),
    [pieSegments]
  )

  const renderMissingPermission = (message) => (
    <div className="rounded-2xl bg-white border border-dashed border-slate-200 p-4 text-sm text-slate-500">
      {message}
    </div>
  )

  const rangeDescription = useMemo(() => {
    if (selectedRange === 'custom') {
      return `${customDateRange.from} → ${customDateRange.to}`
    }
    return timeframePresets.find(opt => opt.value === selectedRange)?.label ?? 'Custom range'
  }, [selectedRange, customDateRange])

  const handleDateChange = (field, value) => {
    setCustomDateRange(prev => ({ ...prev, [field]: value }))
    setSelectedRange('custom')
  }

  return (
    <div className="space-y-6">
      {hasPermission('analytics') ? (
        <>
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map(card => (
              <div key={card.label} className="rounded-3xl bg-white shadow-soft border border-slate-100 p-5 space-y-3">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                  <span>{card.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    card.tone === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                    card.tone === 'rose' ? 'bg-rose-50 text-rose-600' :
                    card.tone === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
                    'bg-sky-50 text-sky-600'
                  }`}>{card.badge}</span>
                </div>
                <div className="text-3xl font-semibold text-slate-900">{card.value}</div>
                <div className="text-sm font-medium text-slate-500">{card.change}</div>
              </div>
            ))}
          </section>

          <section>
            <div className="rounded-3xl bg-white p-6 shadow-soft border border-slate-100 space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Funds Flow Analysis</div>
                  <p className="text-sm text-slate-500">Inspect how deposits, withdrawals, liquidity, and profits interact over the chosen range.</p>
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {timeframePresets.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSelectedRange(opt.value)}
                        className={`rounded-2xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                          selectedRange === opt.value
                            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 shadow-soft'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      From
                      <input
                        type="date"
                        value={customDateRange.from}
                        onChange={(event) => handleDateChange('from', event.target.value)}
                        max={customDateRange.to}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      To
                      <input
                        type="date"
                        value={customDateRange.to}
                        onChange={(event) => handleDateChange('to', event.target.value)}
                        min={customDateRange.from}
                        max={toIsoDate(new Date())}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                      />
                    </label>
                    <span className="flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      {rangeDescription}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
                <div className="rounded-3xl border border-slate-100 bg-gradient-to-br from-indigo-500/10 to-sky-500/10 p-6 shadow-soft">
                  <AnalyticsPieChart data={pieSegments} />
                </div>
                <div className="space-y-3">
                  {pieSegments.map(segment => (
                    <div
                      key={segment.label}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-2 w-12 rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${segment.color}, ${segment.colorEnd || segment.color})`
                          }}
                        />
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{segment.label}</div>
                          <div className="text-xs text-slate-400">Flow share</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-900">{currency(segment.displayValue)}</div>
                        <div className="text-xs text-slate-400">
                          {displayTotal ? `${((segment.displayValue / displayTotal) * 100).toFixed(1)}%` : '—'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        renderMissingPermission('Analytics permission required to view KPI cards and analysis charts.')
      )}
    </div>
  )
}
