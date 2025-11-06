import { useEffect, useState } from 'react'
import { api } from '../api'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

export default function Leaderboard() {
  const [rows, setRows] = useState([])

  useEffect(() => {
    api().get('/api/trades/leaderboard')
      .then(res => setRows(res.data || []))
      .catch(err => console.error('Failed to load leaderboard', err))
  }, [])

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Top Traders</div>
          <div className="text-lg font-semibold">Leaderboard</div>
        </div>
        <span className="text-[11px] text-white/50">{rows.length} entries</span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-black/15 px-3 py-4 text-center text-[12px] text-white/55">
          No leaderboard entries yet.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const pnl = Number(r.realized_pnl || 0)
            const pnlClass = pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            return (
              <div key={r.user_id ?? i} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/15 px-3 py-2.5 text-[13px]">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-[12px] text-white/45 font-medium">#{i + 1}</span>
                  <span className="font-semibold text-white/80">{r.handle || r.email || 'anon'}</span>
                </div>
                <div className={`font-mono ${pnlClass}`}>{currency.format(pnl)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
