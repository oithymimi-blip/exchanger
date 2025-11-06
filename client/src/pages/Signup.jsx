import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../store'

export default function Signup() {
  const [qp] = useSearchParams()
  const ref = qp.get('ref') || ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const { login } = useAuth()
  const nav = useNavigate()

  useEffect(() => {}, [ref])

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true); setErr('')
    try {
      const res = await api().post('/api/auth/signup', { email, password, name, handle, ref })
      login(res.data.token, res.data.user)
      nav('/dashboard')
    } catch (e) {
      setErr(e?.response?.data?.error || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto card">
      <h2 className="text-xl font-bold mb-4">Create account</h2>
      {ref && <div className="text-xs text-white/60 mb-2">Referred by code: <span className="text-brand">{ref}</span></div>}
      {err && <div className="text-red-400 mb-2">{err}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <div className="label">Email</div>
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <div className="label">Password</div>
          <input type="password" className="input" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <div>
          <div className="label">Display name</div>
          <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" />
        </div>
        <div>
          <div className="label">Handle (unique)</div>
          <input className="input" value={handle} onChange={e=>setHandle(e.target.value)} placeholder="e.g. satoshi" />
        </div>
        <button className="btn w-full" disabled={loading}>{loading ? '...' : 'Create account'}</button>
      </form>
      <div className="mt-2 text-sm text-white/60">
        Have an account? <Link className="link" to="/login">Sign in</Link>
      </div>
    </div>
  )
}
