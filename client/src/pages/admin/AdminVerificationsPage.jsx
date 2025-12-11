import { Fragment, useEffect, useState } from 'react'
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
  const [expandedId, setExpandedId] = useState(null)
  const [preview, setPreview] = useState(null) // { src, title }

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

  const editDetails = async (row) => {
    if (!token) return
    const document_name = window.prompt('Full name', row.document_name || '') ?? row.document_name
    const document_number = window.prompt('Document number', row.document_number || '') ?? row.document_number
    const document_country = window.prompt('Country', row.document_country || '') ?? row.document_country
    const document_birthdate = window.prompt('Birthdate (YYYY-MM-DD)', row.document_birthdate || '') ?? row.document_birthdate
    const document_expires_at = window.prompt('Expires (MM/YYYY or YYYY-MM-DD)', row.document_expires_at || '') ?? row.document_expires_at
    const notes = window.prompt('Notes', row.notes || '') ?? row.notes
    setProcessingId(row.user_id)
    try {
      await api(token).put(`/api/admin/verifications/${row.user_id}`, {
        document_name,
        document_number,
        document_country,
        document_birthdate,
        document_expires_at,
        notes
      })
      setStatus('Verification details updated')
      loadVerifications()
    } catch (err) {
      console.error(err)
      setStatus(err?.response?.data?.error || 'Failed to update verification details')
    } finally {
      setProcessingId(null)
    }
  }

  const deleteVerification = async (userId) => {
    if (!token) return
    if (!window.confirm('Delete this verification record? This cannot be undone.')) return
    setProcessingId(userId)
    try {
      await api(token).delete(`/api/admin/verifications/${userId}`)
      setStatus('Verification deleted')
      loadVerifications()
    } catch (err) {
      console.error(err)
      setStatus(err?.response?.data?.error || 'Failed to delete verification')
    } finally {
      setProcessingId(null)
    }
  }

  if (!canManage) {
    return <div className="rounded-3xl bg-white border border-dashed border-slate-200 p-6 text-slate-500">Permissions required to view verifications.</div>
  }

  const renderImage = (b64, title) => {
    if (!b64) return null
    return (
      <img
        src={`data:image/jpeg;base64,${b64}`}
        alt={title || 'document'}
        className="h-28 w-44 object-cover rounded-lg border border-slate-200 cursor-zoom-in transition hover:shadow-lg"
        onClick={() => setPreview({ src: `data:image/jpeg;base64,${b64}`, title })}
      />
    )
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
                <tr><td colSpan={7} className="py-6 text-center text-slate-500">Loading…</td></tr>
              ) : verifications.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-slate-500">No verification requests yet.</td></tr>
              ) : (
                verifications.map(row => {
                  const statusKey = row.status || 'pending'
                  const badge = STATUS_BADGES[statusKey] ?? STATUS_BADGES.pending
                  const label = STATUS_LABELS[statusKey] ?? STATUS_LABELS.pending
                  const isProcessing = processingId === row.user_id
                  const expanded = expandedId === row.user_id
                  return (
                    <Fragment key={`${row.user_id}-${row.id}`}>
                      <tr className="text-slate-700">
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
                            className="btn text-[11px] px-3 py-1 rounded-full bg-slate-100 text-slate-700"
                            onClick={() => setExpandedId(expanded ? null : row.user_id)}
                          >
                            {expanded ? 'Hide' : 'Details'}
                          </button>
                          <button
                            className="btn text-[11px] px-3 py-1 rounded-full bg-indigo-500 text-white"
                            disabled={isProcessing}
                            onClick={() => editDetails(row)}
                          >
                            Edit
                          </button>
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
                          <button
                            className="btn text-[11px] px-3 py-1 rounded-full bg-slate-200 text-slate-700"
                            disabled={isProcessing}
                            onClick={() => deleteVerification(row.user_id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="bg-slate-50/60">
                          <td colSpan={7} className="py-3 px-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-slate-500">Document front</div>
                                {renderImage(row.document_front, 'Document front') || <div className="text-xs text-slate-400">No image</div>}
                              </div>
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-slate-500">Document back</div>
                                {renderImage(row.document_back, 'Document back') || <div className="text-xs text-slate-400">No image</div>}
                              </div>
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-slate-500">Selfie</div>
                                {renderImage(row.selfie, 'Selfie') || <div className="text-xs text-slate-400">No selfie</div>}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-sm text-slate-700">
                              <div>
                                <div className="text-xs text-slate-500">Full name</div>
                                <div className="font-semibold">{row.document_name || '—'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">Country</div>
                                <div className="font-semibold">{row.document_country || '—'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">Birthdate</div>
                                <div className="font-semibold">{row.document_birthdate || '—'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">Expires</div>
                                <div className="font-semibold">{row.document_expires_at || '—'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">Doc number</div>
                                <div className="font-semibold">{row.document_number || '—'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">Face notes</div>
                                <div className="font-semibold">{row.face_check_notes || '—'}</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {preview ? (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="font-semibold text-slate-800">{preview.title || 'Preview'}</div>
              <div className="flex items-center gap-3">
                <a
                  href={preview.src}
                  download={`${(preview.title || 'image').replace(/\s+/g, '-').toLowerCase()}.jpg`}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Download
                </a>
                <button
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                  onClick={() => setPreview(null)}
                  aria-label="Close preview"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-50 flex items-center justify-center">
              <img
                src={preview.src}
                alt={preview.title || 'Preview'}
                className="max-h-[80vh] max-w-full rounded-xl shadow-lg object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
