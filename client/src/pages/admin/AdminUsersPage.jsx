import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAdminAuth } from '../../adminStore'

const currency = (value = 0) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value) || 0)

export default function AdminUsersPage() {
  const { token, admin } = useAdminAuth()
  const canManage = admin?.role === 'admin' || (admin?.permissions || []).includes('all') || (admin?.permissions || []).includes('users')
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [balanceForm, setBalanceForm] = useState({ email: '', amount: '' })
  const [message, setMessage] = useState('')

  const loadUsers = async (search = '') => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api(token).get('/api/admin/users', { params: { q: search } })
      setUsers(res.data)
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canManage) loadUsers()
  }, [token, canManage])

  const updateBalance = async () => {
    if (!token) return
    setMessage('')
    try {
      await api(token).post('/api/admin/users/set-balance', {
        email: balanceForm.email,
        amount: Number(balanceForm.amount)
      })
      setBalanceForm({ email: '', amount: '' })
      setMessage('Balance updated')
      loadUsers(query)
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Failed to update balance')
    }
  }

  const deleteUser = async (id) => {
    if (!token || !canManage || !window.confirm('Delete this user?')) return
    try {
      await api(token).delete(`/api/admin/users/${id}`)
      loadUsers(query)
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Delete failed')
    }
  }

  if (!canManage) {
    return <div className="rounded-3xl bg-white border border-dashed border-slate-200 p-6 text-slate-500">You do not have permission to manage users.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Admin</div>
          <h1 className="text-3xl font-semibold text-slate-900">User Management</h1>
        </div>
        <input
          className="input bg-white border-slate-200 text-slate-800 w-64"
          placeholder="Search users"
          value={query}
          onChange={e => {
            const value = e.target.value
            setQuery(value)
            loadUsers(value)
          }}
        />
      </div>
      {message ? (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-2 text-sm text-indigo-700">{message}</div>
      ) : null}
      <div className="rounded-3xl bg-white shadow-soft border border-slate-100 p-5 space-y-4">
        <div className="text-sm font-semibold text-slate-600 uppercase tracking-[0.2em]">Adjust Balance</div>
        <div className="grid md:grid-cols-3 gap-3">
          <input
            className="input bg-white border-slate-200 text-slate-800"
            placeholder="user@example.com"
            value={balanceForm.email}
            onChange={e => setBalanceForm(prev => ({ ...prev, email: e.target.value }))}
          />
          <input
            className="input bg-white border-slate-200 text-slate-800"
            placeholder="Amount"
            value={balanceForm.amount}
            onChange={e => setBalanceForm(prev => ({ ...prev, amount: e.target.value }))}
          />
          <button className="btn" onClick={updateBalance}>Set Balance</button>
        </div>
      </div>
      <div className="rounded-3xl bg-white shadow-soft border border-slate-100 p-5">
        <div className="text-sm font-semibold text-slate-600 uppercase tracking-[0.2em] mb-4">Accounts</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2 text-left">User</th>
                <th className="py-2 text-left">Role</th>
                <th className="py-2 text-left">Balance</th>
                <th className="py-2 text-left">Trades</th>
                <th className="py-2 text-left">Realized</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="py-6 text-center text-slate-500">Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-slate-500">No users</td></tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="text-slate-700">
                    <td className="py-2">
                      <div className="font-semibold">{user.name || user.email}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="py-2 capitalize">{user.role}</td>
                    <td className="py-2">{currency((user.available || 0) + (user.locked || 0))}</td>
                    <td className="py-2">{user.trade_count}</td>
                    <td className="py-2">
                      <span className={Number(user.realized_pnl) >= 0 ? 'text-emerald-600' : 'text-rose-500'}>
                        {currency(user.realized_pnl)}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <button className="text-xs text-rose-500 font-semibold" onClick={() => deleteUser(user.id)}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
