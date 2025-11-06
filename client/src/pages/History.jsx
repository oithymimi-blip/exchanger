import { useEffect, useState } from 'react'
import { useAuth } from '../store'
import { api } from '../api'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

function formatCurrency(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '$0.00'
  return currencyFormatter.format(num)
}

export default function History() {
  const { token } = useAuth()
  const [rows, setRows] = useState([])

  useEffect(() => {
    api(token).get('/api/trades').then(r=>setRows(r.data))
  }, [token])

  return (
    <div className="card">
      <div className="text-lg font-bold mb-2">Your trades</div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-white/60">
            <tr>
              <th className="text-left p-2">Time</th>
              <th className="text-right p-2">Side</th>
              <th className="text-right p-2">Amount ($)</th>
              <th className="text-right p-2">Size</th>
              <th className="text-right p-2">Entry</th>
              <th className="text-right p-2">Exit</th>
              <th className="text-right p-2">Pips</th>
              <th className="text-right p-2">PnL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const qty = Number(r.qty || 0)
              const amount = Number(r.stake_amount ?? r.notional ?? r.price * qty)
              const pipSize = Number(r.pip_size ?? 0.0001)
              const pipValue = Number(r.pip_value ?? qty * pipSize)
              const pnlUsd = Number(r.pnl ?? 0)
              const pipsRealized = Number(r.pips_realized ?? (pipValue > 0 ? pnlUsd / pipValue : 0))
              return (
                <tr key={r.id} className="border-t border-white/10">
                  <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2 text-right">{r.side}</td>
                  <td className="p-2 text-right font-mono">{formatCurrency(amount)}</td>
                  <td className="p-2 text-right font-mono">{qty.toFixed(6)}</td>
                  <td className="p-2 text-right font-mono">{Number(r.price || 0).toFixed(2)}</td>
                  <td className="p-2 text-right font-mono">{Number((r.exit_price ?? r.price ?? 0)).toFixed(2)}</td>
                  <td className="p-2 text-right font-mono">{`${pipsRealized >= 0 ? '+' : ''}${pipsRealized.toFixed(2)}`}</td>
                  <td className="p-2 text-right font-mono">{formatCurrency(pnlUsd)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
