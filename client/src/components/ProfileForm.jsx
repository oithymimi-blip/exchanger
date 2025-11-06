import { useEffect, useState } from 'react'
import { useAuth } from '../store'
import { api } from '../api'

export default function ProfileForm() {
  const { token, user, login } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [handle, setHandle] = useState(user?.handle || '')
  const [msg, setMsg] = useState('')

  async function save() {
    setMsg('')
    try {
      const res = await api(token).put('/api/me', { name, handle })
      // merge back to local user
      const updated = { ...user, ...res.data }
      login(localStorage.getItem('token'), updated)
      setMsg('Saved')
    } catch (e) {
      setMsg(e?.response?.data?.error || 'Failed')
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <div className="label">Display name</div>
        <input className="input" value={name} onChange={e=>setName(e.target.value)} />
      </div>
      <div>
        <div className="label">Handle</div>
        <input className="input" value={handle} onChange={e=>setHandle(e.target.value)} />
      </div>
      <button className="btn" onClick={save}>Save changes</button>
      {msg && <div className="text-xs text-white/60">{msg}</div>}
    </div>
  )
}
