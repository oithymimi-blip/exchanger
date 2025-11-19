import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAdminAuth } from '../../adminStore'

const STATUS_LABELS = {
  awaiting_approval: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
  pending: 'Pending'
}
const STATUS_BADGES = {
  awaiting_approval: 'bg-amber-50 text-amber-600',
  approved: 'bg-emerald-50 text-emerald-600',
  rejected: 'bg-rose-50 text-rose-600',
  pending: 'bg-slate-50 text-slate-500'
}

export default function AdminVerificationsPage() {
  const { token, admin } = useAdminAuth()
  const canManage = admin?.role === 'admin' || (admin?.permissions || []).includes('all') || (admin?.permissions || []).includes('users')
  const [verifications, setVerifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [processingId, setProcessingId] = useState(null)

  const loadVerifications = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api(token).get('/api/admin/verifications')
      setVerifications(res.data)
    } catch (err) {
      console.error(err)
      setStatus(err?.response?.data?.error || 'Failed to load verifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canManage) loadVerifications()
  }, [token, canManage])

  const updateStatus = async (userId, nextStatus, currentNotes) => {
    if (!token) return
    const note = window.prompt('Add an optional note', currentNotes || '')
    setProcessingId(userId)
    try {
      await api(token).patch(`/api/admin/verifications/${userId}`, {
        status: nextStatus,
        notes: note || undefined
      })
      setStatus('Verification status updated')
      loadVerifications()
    } catch (err) {
      console.error(err)
      setStatus(err?.response?.data?.error || 'Failed to update verification')
    } finally {
      setProcessingId(null)
    }
  }

  if (!canManage) {
    return <div className="rounded-3xl bg-white border border-dashed border-slate-200 p-6 text-slate-500">Permissions required to view verifications.</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Verifications</div>
        <h1 className="text-3xl font-semibold text-slate-900">Identity requests</h1>
        <p className="text-slate-500 mt-1">Approve or reject uploaded IDs and selfies.</p>
      </div>
      {status ? (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-2 text-sm text-indigo-700">{status}</div>
      ) : null}
      <div className="rounded-3xl bg-white shadow-soft border border-slate-100 p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2 text-left">User</th>
                <th className="py-2 text-left">Document</th>
                <th className="py-2 text-left">Face match</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left">Submitted</th>
                <th className="py-2 text-left">Notes</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="py-6 text-center text-slate-500">Loading…</td></tr>
              ) : verifications.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-slate-500">No verification requests yet.</td></tr>
              ) : (
                verifications.map(row => {
                  const statusKey = row.status || 'pending'
                  const badge = STATUS_BADGES[statusKey] ?? STATUS_BADGES.pending
                  const label = STATUS_LABELS[statusKey] ?? STATUS_LABELS.pending
                  const isProcessing = processingId === row.user_id
                  return (
                    <tr key={`${row.user_id}-${row.id}`} className="text-slate-700">
                      <td className="py-2">
                        <div className="font-semibold">{row.name || row.email}</div>
                        <div className="text-xs text-slate-400">{row.email}</div>
                      </td>
                      <td className="py-2">
                        <div className="font-semibold">{row.document_type?.replace('_', ' ')?.toUpperCase() || 'Document'}</div>
                        <div className="text-xs text-slate-400">{row.document_number || '—'}</div>
                      </td>
                      <td className="py-2">
                        <div className="text-xs text-slate-500">{row.face_similarity ? `${row.face_similarity.toFixed(1)}% similarity` : 'Pending'}</div>
                        <div className="text-[11px] text-slate-400">{row.face_confidence ? `${row.face_confidence.toFixed(1)}% confidence` : '—'}</div>
                        {row.face_checked_at ? (
                          <div className="text-[10px] text-slate-400">{new Date(row.face_checked_at).toLocaleString()}</div>
                        ) : null}
                      </td>
                      <td className="py-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badge}`}>
                          {label}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-slate-400">
                        {row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-2">
                        <div className="text-xs text-slate-500 max-w-[220px] break-words">
                          {row.notes || 'No notes yet'}
                        </div>
                      </td>
                      <td className="py-2 text-right flex justify-end gap-2">
                        <button
                          className="btn text-[11px] px-3 py-1 rounded-full bg-emerald-500 text-white"
                          disabled={isProcessing}
                          onClick={() => updateStatus(row.user_id, 'approved', row.notes)}
                        >
                          Approve
                        </button>
                        <button
                          className="btn text-[11px] px-3 py-1 rounded-full bg-rose-500 text-white"
                          disabled={isProcessing}
                          onClick={() => updateStatus(row.user_id, 'rejected', row.notes)}
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
