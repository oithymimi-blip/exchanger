import { useEffect, useState } from 'react'
import { useAuth } from '../store'
import { api } from '../api'

export default function AdminDashboard() {
  const { token, user } = useAuth()
  const [state, setState] = useState(null)
  const [price, setPrice] = useState('')
  const [vol, setVol] = useState('')
  const [pump, setPump] = useState('')
  const [msg, setMsg] = useState('')
  const [balanceEmail, setBalanceEmail] = useState('')
  const [balanceAmount, setBalanceAmount] = useState('')
  const [balanceMsg, setBalanceMsg] = useState('')
  const [notifTitle, setNotifTitle] = useState('')
  const [notifMessage, setNotifMessage] = useState('')
  const [notifEmail, setNotifEmail] = useState('')
  const [notifMsg, setNotifMsg] = useState('')
  const [resetBase, setResetBase] = useState('')
  const [resetVol, setResetVol] = useState('')
  const [resetSymbol, setResetSymbol] = useState('')
  const [resetPip, setResetPip] = useState('')
  const [resetting, setResetting] = useState(false)
  const [spotMarkets, setSpotMarkets] = useState([])
  const [selectedSpot, setSelectedSpot] = useState('')
  const [spotPrice, setSpotPrice] = useState('')
  const [spotChange, setSpotChange] = useState('')
  const [spotVolume, setSpotVolume] = useState('')
  const [spotMsg, setSpotMsg] = useState('')

  async function load() {
    const s = await api(token).get('/api/admin/market')
    setState(s.data)
    try {
      const marketsRes = await api(token).get('/api/spot/markets')
      const list = marketsRes.data?.markets || []
      setSpotMarkets(list)
      if (list.length) {
        const first = list[0]
        setSelectedSpot(first.symbol)
        setSpotPrice(String(first.price))
        setSpotChange(String(first.change_24h ?? ''))
        setSpotVolume(String(first.volume_24h ?? ''))
      }
    } catch (err) {
      setSpotMsg(err?.response?.data?.error || 'Failed to load spot markets')
    }
  }
  useEffect(()=>{ load() }, [])

  async function setP() {
    setMsg('')
    try {
      await api(token).post('/api/admin/market/set-price', { price: Number(price) })
      setMsg('Price updated')
      load()
    } catch (e) { setMsg(e?.response?.data?.error || 'Failed') }
  }
  async function setV() {
    setMsg('')
    try {
      await api(token).post('/api/admin/market/set-volatility', { volatility: Number(vol) })
      setMsg('Volatility updated')
      load()
    } catch (e) { setMsg(e?.response?.data?.error || 'Failed') }
  }
  async function doPump() {
    setMsg('')
    try {
      await api(token).post('/api/admin/market/pump', { percentage: Number(pump) })
      setMsg('Pump/Dump applied')
      load()
    } catch (e) { setMsg(e?.response?.data?.error || 'Failed') }
  }
  async function pause() {
    await api(token).post('/api/admin/market/pause'); load()
  }
  async function resume() {
    await api(token).post('/api/admin/market/resume'); load()
  }
  async function updateBalance() {
    setBalanceMsg('')
    try {
      await api(token).post('/api/admin/users/set-balance', {
        email: balanceEmail || undefined,
        amount: Number(balanceAmount)
      })
      setBalanceMsg('Balance updated')
      setBalanceAmount('')
    } catch (e) {
      setBalanceMsg(e?.response?.data?.error || 'Failed to update balance')
    }
  }
  async function sendNotification() {
    setNotifMsg('')
    try {
      await api(token).post('/api/admin/notifications', {
        title: notifTitle,
        message: notifMessage,
        email: notifEmail || undefined
      })
      setNotifMsg('Notification sent')
      setNotifTitle('')
      setNotifMessage('')
      setNotifEmail('')
    } catch (e) {
      setNotifMsg(e?.response?.data?.error || 'Failed to send notification')
    }
  }

  async function resetMarket() {
    setMsg('')
    setResetting(true)
    try {
      const payload = {}
      const baseValue = Number(resetBase)
      if (resetBase && Number.isFinite(baseValue) && baseValue > 0) payload.base_price = baseValue
      const volValue = Number(resetVol)
      if (resetVol && Number.isFinite(volValue) && volValue >= 0 && volValue <= 1) payload.volatility = volValue
      if (resetSymbol && resetSymbol.trim()) payload.symbol = resetSymbol.trim()
      const pipValue = Number(resetPip)
      if (resetPip && Number.isFinite(pipValue) && pipValue > 0) payload.pip_size = pipValue

      await api(token).post('/api/admin/market/reset', payload)
      setMsg('Market reset')
      setResetBase('')
      setResetVol('')
      setResetSymbol('')
      setResetPip('')
      load()
    } catch (e) {
      setMsg(e?.response?.data?.error || 'Failed to reset market')
    } finally {
      setResetting(false)
    }
  }

  async function updateSpotPrice() {
    if (!selectedSpot) return
    setSpotMsg('')
    const payload = {}
    if (spotPrice !== '') {
      const priceVal = Number(spotPrice)
      if (!Number.isFinite(priceVal) || priceVal <= 0) {
        setSpotMsg('Enter a valid price override or leave blank to reset')
        return
      }
      payload.price = priceVal
    }
    if (spotChange !== '') {
      const changeVal = Number(spotChange)
      if (!Number.isFinite(changeVal)) {
        setSpotMsg('Invalid 24h change override')
        return
      }
      payload.change_24h = changeVal
    }
    if (spotVolume !== '') {
      const volVal = Number(spotVolume)
      if (!Number.isFinite(volVal) || volVal < 0) {
        setSpotMsg('Invalid volume override')
        return
      }
      payload.volume_24h = volVal
    }
    try {
      await api(token).post(`/api/spot/markets/${selectedSpot}/price`, payload)
      setSpotMsg('Spot market updated')
      load()
    } catch (err) {
      setSpotMsg(err?.response?.data?.error || 'Failed to update spot market')
    }
  }

  function handleSelectSpot(symbol) {
    setSelectedSpot(symbol)
    const market = spotMarkets.find(m => m.symbol === symbol)
    if (market) {
      setSpotPrice(String(market.price))
      setSpotChange(String(market.change_24h ?? ''))
      setSpotVolume(String(market.volume_24h ?? ''))
    }
  }

  if (!user || user.role !== 'admin') {
    return <div className="card">You must be an admin.</div>
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="card space-y-3">
        <div className="text-lg font-bold">Market Controls</div>
        <div className="text-sm text-white/70">Symbol: <span className="text-white">{state?.symbol}</span></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">Set Price</div>
            <input className="input" value={price} onChange={e=>setPrice(e.target.value)} placeholder={String(state?.base_price || '')} />
          </div>
          <div className="flex items-end"><button className="btn w-full" onClick={setP}>Apply</button></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">Set Volatility (0..1)</div>
            <input className="input" value={vol} onChange={e=>setVol(e.target.value)} placeholder={String(state?.volatility || '')} />
          </div>
          <div className="flex items-end"><button className="btn w-full" onClick={setV}>Apply</button></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">Pump/Dump % (e.g. 5 or -5)</div>
            <input className="input" value={pump} onChange={e=>setPump(e.target.value)} placeholder="%" />
          </div>
          <div className="flex items-end"><button className="btn w-full" onClick={doPump}>Execute</button></div>
        </div>
        <div className="flex gap-3">
          <button className="btn bg-white/10 text-white" onClick={pause}>Pause</button>
          <button className="btn" onClick={resume}>Resume</button>
        </div>
        <div className="border-t border-white/10 pt-3 space-y-3">
          <div className="text-sm font-semibold">Reset Market</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label">Base Price</div>
              <input className="input" value={resetBase} onChange={e=>setResetBase(e.target.value)} placeholder={String(state?.base_price || '')} />
            </div>
            <div>
              <div className="label">Volatility (0..1)</div>
              <input className="input" value={resetVol} onChange={e=>setResetVol(e.target.value)} placeholder={String(state?.volatility || '')} />
            </div>
            <div>
              <div className="label">Symbol</div>
              <input className="input" value={resetSymbol} onChange={e=>setResetSymbol(e.target.value)} placeholder={state?.symbol || 'BTCUSDT'} />
            </div>
            <div>
              <div className="label">Pip Size</div>
              <input className="input" value={resetPip} onChange={e=>setResetPip(e.target.value)} placeholder={String(state?.pip_size || 0.0001)} />
            </div>
          </div>
          <button className="btn bg-rose-500 text-white" onClick={resetMarket} disabled={resetting}>
            {resetting ? 'Resetting…' : 'Reset Market'}
          </button>
        </div>
        {msg && <div className="text-xs text-white/60">{msg}</div>}
        <div className="border-t border-white/10 pt-3 space-y-3">
          <div className="text-lg font-bold">Set User Balance</div>
          <div className="text-xs text-white/50">Provide user email and new demo balance.</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="label">User Email</div>
              <input className="input" value={balanceEmail} onChange={e=>setBalanceEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div>
              <div className="label">Balance (USD)</div>
              <input className="input" value={balanceAmount} onChange={e=>setBalanceAmount(e.target.value)} placeholder="10000" />
            </div>
          </div>
          <button className="btn" onClick={updateBalance}>Apply Balance</button>
          {balanceMsg && <div className="text-xs text-white/60">{balanceMsg}</div>}
        </div>
        <div className="border-t border-white/10 pt-3 space-y-3">
          <div className="text-lg font-bold">Send Notification</div>
          <div className="text-xs text-white/50">Leave email empty to broadcast to all users.</div>
          <div>
            <div className="label">Title</div>
            <input className="input" value={notifTitle} onChange={e=>setNotifTitle(e.target.value)} placeholder="Announcement" />
          </div>
          <div>
            <div className="label">Message</div>
            <textarea className="input min-h-[100px]" value={notifMessage} onChange={e=>setNotifMessage(e.target.value)} placeholder="Details..." />
          </div>
          <div>
            <div className="label">Target Email (optional)</div>
            <input className="input" value={notifEmail} onChange={e=>setNotifEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <button className="btn bg-brand text-black" onClick={sendNotification}>Send Notification</button>
          {notifMsg && <div className="text-xs text-white/60">{notifMsg}</div>}
        </div>
      </div>
      <div className="card space-y-3">
        <div className="text-lg font-bold">Spot Markets</div>
        <div className="text-xs text-white/60">Update spot pair prices controlled by admin.</div>
        <div>
          <div className="label">Select Pair</div>
          <select
            className="input"
            value={selectedSpot}
            onChange={e => handleSelectSpot(e.target.value)}
          >
            {spotMarkets.map(mkt => (
              <option key={mkt.symbol} value={mkt.symbol}>{mkt.symbol}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="label">Price</div>
            <input className="input" value={spotPrice} onChange={e => setSpotPrice(e.target.value)} placeholder="0" />
          </div>
          <div>
            <div className="label">24h Change %</div>
            <input className="input" value={spotChange} onChange={e => setSpotChange(e.target.value)} placeholder="0" />
          </div>
          <div>
            <div className="label">24h Volume</div>
            <input className="input" value={spotVolume} onChange={e => setSpotVolume(e.target.value)} placeholder="0" />
          </div>
        </div>
        <button className="btn" onClick={updateSpotPrice}>Apply Spot Update</button>
        {spotMsg && <div className="text-xs text-white/60">{spotMsg}</div>}
        <div className="border-t border-white/10 pt-3">
          <div className="text-xs text-white/50">Tracked markets: {spotMarkets.length}</div>
        </div>
      </div>
      <div className="card">
        <div className="font-bold mb-2">Current State</div>
        <pre className="text-xs bg-black/40 rounded-xl p-3 overflow-auto">{JSON.stringify(state, null, 2)}</pre>
      </div>
    </div>
  )
}
