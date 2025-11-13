import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../adminStore'
import { api } from '../api'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const login = useAdminAuth(state => state.login)
  const nav = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api().post('/api/auth/admin/login', { email, password })
      login(res.data.token, res.data.user)
      nav('/admin', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.error || 'Invalid admin credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-100 p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="text-sm uppercase tracking-[0.4em] text-slate-400">Administrator</div>
          <h1 className="text-3xl font-semibold text-slate-900">Secure Console</h1>
          <p className="text-sm text-slate-500">Sign in with your admin credentials to orchestrate the market.</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.2em]">Email</label>
            <input
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-800"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com"
              type="email"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.2em]">Password</label>
            <input
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-800"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••"
              type="password"
              required
            />
          </div>
          {error ? (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-600">{error}</div>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-indigo-600 text-white font-semibold py-3 shadow-lg shadow-indigo-200 hover:bg-indigo-500 transition disabled:opacity-60"
          >
            {loading ? 'Authorizing…' : 'Enter Console'}
          </button>
        </form>
      </div>
    </div>
  )
}
