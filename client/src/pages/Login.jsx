import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../store'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const { login } = useAuth()
  const nav = useNavigate()

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true); setErr('')
    try {
      const res = await api().post('/api/auth/login', { email, password })
      login(res.data.token, res.data.user)
      nav('/dashboard')
    } catch (e) {
      setErr(e?.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto card">
      <h2 className="text-xl font-bold mb-4">Sign in</h2>
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
        <button className="btn w-full" disabled={loading}>{loading ? '...' : 'Login'}</button>
      </form>
      <div className="mt-3 text-sm">
        <Link className="link" to="/reset-password">Forgot password?</Link>
      </div>
      <div className="mt-2 text-sm text-white/60">
        No account? <Link className="link" to="/signup">Sign up</Link>
      </div>
    </div>
  )
}
