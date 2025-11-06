import { useState } from 'react'
import { useAuth } from '../store'
import { api } from '../api'

export default function OrderTicket({ onPlaced, className = '', variant = 'standalone' }) {
  const { token } = useAuth()
  const [amount, setAmount] = useState(100)
  const [loadingSide, setLoadingSide] = useState(null)
  const [msg, setMsg] = useState('')

  async function submit(side) {
    if (!token) {
      setMsg('Login required')
      return
    }
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setMsg('Enter a valid amount')
      return
    }
    setLoadingSide(side)
    setMsg('')
    try {
      const res = await api(token).post('/api/trades', { side, amount: numericAmount })
      const fillPrice = Number(res.data?.price)
      if (!Number.isFinite(fillPrice)) {
        throw new Error('Invalid fill price')
      }
      const verb = side === 'buy' ? 'Bought' : 'Sold'
      setMsg(`${verb} $${numericAmount.toFixed(2)} @ ${fillPrice.toFixed(2)}`)
      onPlaced && onPlaced(res.data)
    } catch (e) {
      setMsg(e?.response?.data?.error || 'Failed')
    } finally {
      setLoadingSide(null)
    }
  }

  const containerClass = ['space-y-3', variant === 'embedded' ? '' : 'md:space-y-4', className].filter(Boolean).join(' ')

  return (
    <div className={containerClass}>
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Amount (USD)</div>
        <input
          className="input text-sm"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          className="trade-btn trade-btn-buy text-sm"
          onClick={() => submit('buy')}
          disabled={loadingSide === 'buy'}
        >
          {loadingSide === 'buy' ? 'Buying…' : 'Buy @ Market'}
        </button>
        <button
          className="trade-btn trade-btn-sell text-sm"
          onClick={() => submit('sell')}
          disabled={loadingSide === 'sell'}
        >
          {loadingSide === 'sell' ? 'Selling…' : 'Sell @ Market'}
        </button>
      </div>
      {msg && <div className="text-[11px] text-white/60">{msg}</div>}
    </div>
  )
}
