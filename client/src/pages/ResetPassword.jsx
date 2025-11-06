import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'

export default function ResetPassword() {
  const [qp] = useSearchParams()
  const token = qp.get('token') || ''
  const [email, setEmail] = useState('')
  const [newPass, setNewPass] = useState('')
  const [sent, setSent] = useState(false)
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState('')

  async function requestLink() {
    setErr('')
    try {
      await api().post('/api/auth/request-password-reset', { email })
      setSent(true)
    } catch {
      setErr('Failed to request reset')
    }
  }
  async function reset() {
    setErr('')
    try {
      await api().post('/api/auth/reset-password', { token, new_password: newPass })
      setOk(true)
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to reset')
    }
  }

  if (token) {
    return (
      <div className="max-w-md mx-auto card">
        <h2 className="text-xl font-bold mb-4">Set a new password</h2>
        {ok ? <div className="text-green-400">Password updated. You can now log in.</div> : (
          <div className="space-y-3">
            <div>
              <div className="label">New password</div>
              <input className="input" type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} />
            </div>
            <button className="btn w-full" onClick={reset}>Update password</button>
            {err && <div className="text-red-400">{err}</div>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto card">
      <h2 className="text-xl font-bold mb-2">Reset your password</h2>
      <p className="text-white/70 mb-4 text-sm">Enter your email. A reset link (for dev) is printed in the server logs.</p>
      <div className="space-y-3">
        <div>
          <div className="label">Email</div>
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <button className="btn w-full" onClick={requestLink}>Send reset link</button>
        {sent && <div className="text-green-400 text-sm">If that email exists, a link has been generated (see server logs).</div>}
        {err && <div className="text-red-400">{err}</div>}
      </div>
    </div>
  )
}
