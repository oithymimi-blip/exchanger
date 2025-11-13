import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAdminAuth } from '../../adminStore'

export default function AdminNotificationsPage() {
  const { token, admin } = useAdminAuth()
  const canNotify = admin?.role === 'admin' || (admin?.permissions || []).includes('all') || (admin?.permissions || []).includes('notifications')
  const [notifications, setNotifications] = useState([])
  const [audit, setAudit] = useState([])
  const [form, setForm] = useState({ title: '', message: '', email: '' })
  const [status, setStatus] = useState('')

  const loadData = async () => {
    if (!token) return
    try {
      const [dash, auditLog] = await Promise.all([
        api(token).get('/api/admin/dashboard'),
        api(token).get('/api/admin/audit')
      ])
      setNotifications(dash.data?.notifications ?? [])
      setAudit(auditLog.data ?? [])
    } catch (err) {
      setStatus(err?.response?.data?.error || 'Failed to load notifications')
    }
  }

  useEffect(() => {
    if (canNotify) loadData()
  }, [token, canNotify])

  const sendNotification = async () => {
    if (!token || !canNotify) return
    if (!form.title || !form.message) {
      setStatus('Title and message required')
      return
    }
    try {
      await api(token).post('/api/admin/notifications', {
        title: form.title,
        message: form.message,
        email: form.email || undefined
      })
      setStatus('Notification sent')
      setForm({ title: '', message: '', email: '' })
      loadData()
    } catch (err) {
      setStatus(err?.response?.data?.error || 'Failed to send notification')
    }
  }

  if (!canNotify) {
    return <div className="rounded-3xl bg-white border border-dashed border-slate-200 p-6 text-slate-500">Notifications permission required.</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Admin</div>
        <h1 className="text-3xl font-semibold text-slate-900">Messaging Center</h1>
      </div>
      {status ? (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-2 text-sm text-indigo-700">{status}</div>
      ) : null}
      <div className="rounded-3xl bg-white shadow-soft border border-slate-100 p-5 space-y-3">
        <div className="text-sm font-semibold text-slate-600 uppercase tracking-[0.2em]">Broadcast</div>
        <div className="grid md:grid-cols-3 gap-3">
          <input
            className="input bg-white border-slate-200 text-slate-800"
            placeholder="Optional email"
            value={form.email}
            onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
          />
          <input
            className="input bg-white border-slate-200 text-slate-800"
            placeholder="Title"
            value={form.title}
            onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
          />
          <button className="btn" onClick={sendNotification}>Send</button>
        </div>
        <textarea
          className="input bg-white border-slate-200 text-slate-800 min-h-[120px]"
          placeholder="Message body"
          value={form.message}
          onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white shadow-soft border border-slate-100 p-5 space-y-4">
          <div className="text-sm font-semibold text-slate-600 uppercase tracking-[0.2em]">Recent Notifications</div>
          <div className="space-y-3">
            {(notifications || []).map(note => (
              <div key={note.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{note.email || 'Broadcast'}</span>
                  <span>{new Date(note.created_at).toLocaleString()}</span>
                </div>
                <div className="text-sm font-semibold text-slate-800 mt-1">{note.title}</div>
                <div className="text-sm text-slate-600">{note.message}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl bg-white shadow-soft border border-slate-100 p-5 space-y-4">
          <div className="text-sm font-semibold text-slate-600 uppercase tracking-[0.2em]">Audit Log</div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {(audit || []).map(item => (
              <div key={item.id} className="text-sm text-slate-600 border-b border-slate-100 pb-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{item.actor_role}</span>
                  <span>{new Date(item.ts).toLocaleString()}</span>
                </div>
                <div className="font-semibold text-slate-800">{item.action.replace(/_/g, ' ')}</div>
                {item.meta ? (
                  <pre className="bg-slate-100 rounded-xl px-3 py-2 text-[11px] mt-1">{item.meta}</pre>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
