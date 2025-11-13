import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAdminAuth } from '../../adminStore'

const availablePermissions = ['analytics', 'market', 'users', 'notifications', 'audit']

export default function AdminRolesPage() {
  const { token, admin } = useAdminAuth()
  const [subAdmins, setSubAdmins] = useState([])
  const [form, setForm] = useState({ email: '', name: '', password: '', permissions: ['analytics'] })
  const [status, setStatus] = useState('')

  const loadSubAdmins = async () => {
    if (!token || admin?.role !== 'admin') return
    try {
      const res = await api(token).get('/api/admin/subadmins')
      setSubAdmins(res.data)
    } catch (err) {
      setStatus(err?.response?.data?.error || 'Failed to load sub admins')
    }
  }

  useEffect(() => {
    loadSubAdmins()
  }, [token])

  const createSubAdmin = async () => {
    if (!token || admin?.role !== 'admin') return
    if (!form.email || !form.password) {
      setStatus('Email and password required')
      return
    }
    try {
      await api(token).post('/api/admin/subadmins', form)
      setStatus('Sub admin created')
      setForm({ email: '', name: '', password: '', permissions: ['analytics'] })
      loadSubAdmins()
    } catch (err) {
      setStatus(err?.response?.data?.error || 'Failed to create sub admin')
    }
  }

  const updatePermissions = async (id, perms) => {
    if (!token || admin?.role !== 'admin') return
    try {
      await api(token).put(`/api/admin/subadmins/${id}`, { permissions: perms })
      loadSubAdmins()
    } catch (err) {
      setStatus(err?.response?.data?.error || 'Failed to update permissions')
    }
  }

  const removeSubAdmin = async (id) => {
    if (!token || admin?.role !== 'admin') return
    if (!window.confirm('Remove this sub admin?')) return
    try {
      await api(token).delete(`/api/admin/subadmins/${id}`)
      loadSubAdmins()
    } catch (err) {
      setStatus(err?.response?.data?.error || 'Failed to remove sub admin')
    }
  }

  if (admin?.role !== 'admin') {
    return <div className="rounded-3xl bg-white border border-dashed border-slate-200 p-6 text-slate-500">Only the main admin can manage roles.</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Admin</div>
        <h1 className="text-3xl font-semibold text-slate-900">Role Management</h1>
      </div>
      {status ? (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-2 text-sm text-indigo-700">{status}</div>
      ) : null}
      <div className="rounded-3xl bg-white shadow-soft border border-slate-100 p-5 space-y-4">
        <div className="text-sm font-semibold text-slate-600 uppercase tracking-[0.2em]">Create Sub Admin</div>
        <div className="grid md:grid-cols-3 gap-3">
          <input
            className="input bg-white border-slate-200 text-slate-800"
            placeholder="Email"
            value={form.email}
            onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
          />
          <input
            className="input bg-white border-slate-200 text-slate-800"
            placeholder="Name"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
          />
          <input
            className="input bg-white border-slate-200 text-slate-800"
            placeholder="Temp password"
            type="password"
            value={form.password}
            onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          {availablePermissions.map(perm => {
            const checked = form.permissions.includes(perm)
            return (
              <label key={perm} className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => {
                    setForm(prev => ({
                      ...prev,
                      permissions: e.target.checked
                        ? Array.from(new Set([...prev.permissions, perm]))
                        : prev.permissions.filter(p => p !== perm)
                    }))
                  }}
                />
                {perm}
              </label>
            )
          })}
        </div>
        <button className="btn" onClick={createSubAdmin}>Create</button>
      </div>
      <div className="rounded-3xl bg-white shadow-soft border border-slate-100 p-5 space-y-3">
        <div className="text-sm font-semibold text-slate-600 uppercase tracking-[0.2em]">Existing Sub Admins</div>
        <div className="grid gap-4">
          {subAdmins.map(sub => (
            <div key={sub.id} className="border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">{sub.name || sub.email}</div>
                  <div className="text-xs text-slate-500">{sub.email}</div>
                </div>
                <button className="text-xs text-rose-500 font-semibold" onClick={() => removeSubAdmin(sub.id)}>Remove</button>
              </div>
              <div className="flex flex-wrap gap-3 mt-3">
                {availablePermissions.map(perm => {
                  const checked = (sub.permissions || []).includes(perm)
                  return (
                    <label key={`${sub.id}-${perm}`} className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          const next = e.target.checked
                            ? Array.from(new Set([...(sub.permissions || []), perm]))
                            : (sub.permissions || []).filter(p => p !== perm)
                          updatePermissions(sub.id, next)
                        }}
                      />
                      {perm}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
          {subAdmins.length === 0 ? (
            <div className="text-sm text-slate-500">No sub admins yet.</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
