import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Clock, Eye, RefreshCw, Shield, Users, FileCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getReviewQueue, submitReview, getAdminStats, getUsers, setUserRole } from '../api/auth'

// Use relative path so images are proxied through Vite (works on any device/network)
const BASE_URL = ''

export default function AdminPage() {
  const [tab, setTab]           = useState('queue')   // 'queue' | 'users' | 'stats'
  const [queue, setQueue]       = useState([])
  const [stats, setStats]       = useState(null)
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter]     = useState('pending')

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getReviewQueue(1, filter)
      setQueue(res.items || [])
    } catch { /* toast shown by interceptor */ }
    finally { setLoading(false) }
  }, [filter])

  const fetchStats = useCallback(async () => {
    try { setStats(await getAdminStats()) } catch {}
  }, [])

  const fetchUsers = useCallback(async () => {
    try { setUsers(await getUsers()) } catch {}
  }, [])

  useEffect(() => { fetchQueue(); fetchStats() }, [fetchQueue, fetchStats])
  useEffect(() => { if (tab === 'users') fetchUsers() }, [tab, fetchUsers])

  const handleReview = async (verificationId, decision, notes = '') => {
    try {
      await submitReview(verificationId, decision, notes)
      toast.success(`Marked as ${decision}`)
      setSelected(null)
      fetchQueue()
      fetchStats()
    } catch {}
  }

  const imageUrl = (id, type) =>
    `${BASE_URL}/api/kyc/${id}/images/${type}?token=${localStorage.getItem('kyc_token')}`

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-accent-primary/20 flex items-center justify-center">
          <Shield className="w-4 h-4 text-accent-primary" />
        </div>
        <h1 className="text-xl font-bold">Admin Panel</h1>
        {stats?.pending_review > 0 && (
          <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full font-medium">
            {stats.pending_review} pending
          </span>
        )}
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total_verifications, color: 'text-white' },
            { label: 'Pending Review', value: stats.pending_review, color: 'text-yellow-400' },
            { label: 'Reviewed', value: stats.completed_review, color: 'text-green-400' },
            { label: 'Users', value: stats.total_users, color: 'text-accent-primary' },
          ].map((s) => (
            <div key={s.label} className="glass rounded-xl p-4 border border-white/[0.06]">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 bg-bg-secondary rounded-xl w-fit">
        {[['queue', 'Review Queue', Clock], ['users', 'Users', Users]].map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm transition-all ${
              tab === id ? 'bg-accent-primary/20 text-accent-primary' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* REVIEW QUEUE */}
      {tab === 'queue' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex gap-1 p-1 bg-bg-secondary rounded-lg">
              {['pending', 'done', null].map((f, i) => (
                <button
                  key={i}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs transition-all ${
                    filter === f ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {f === null ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <button onClick={fetchQueue} className="text-gray-400 hover:text-white ml-auto">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="text-center text-gray-500 py-10">Loading…</div>
          ) : queue.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              <FileCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No verifications in this queue</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((item) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  onSelect={() => setSelected(item)}
                  onApprove={() => handleReview(item.id, 'APPROVED')}
                  onReject={() => handleReview(item.id, 'REJECTED')}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* USERS TAB */}
      {tab === 'users' && (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="glass rounded-xl p-4 border border-white/[0.06] flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center text-xs font-bold text-accent-primary">
                {u.username[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{u.username} {u.full_name && <span className="text-gray-400">({u.full_name})</span>}</p>
                <p className="text-xs text-gray-500">{u.email}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                u.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
              }`}>{u.role}</span>
              <button
                onClick={async () => {
                  const newRole = u.role === 'admin' ? 'user' : 'admin'
                  try {
                    await setUserRole(u.id, newRole)
                    toast.success(`${u.username} is now ${newRole}`)
                    fetchUsers()
                  } catch {}
                }}
                className="text-xs text-gray-500 hover:text-white border border-white/10 rounded-lg px-3 py-1 transition"
              >
                Toggle Role
              </button>
            </div>
          ))}
        </div>
      )}

      {/* REVIEW MODAL */}
      <AnimatePresence>
        {selected && (
          <ReviewModal
            item={selected}
            imageUrl={imageUrl}
            onClose={() => setSelected(null)}
            onSubmit={handleReview}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function QueueRow({ item, onSelect, onApprove, onReject }) {
  return (
    <div className="glass rounded-xl p-4 border border-white/[0.06] flex items-center gap-4 hover:border-white/10 transition">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        item.reviewed ? 'bg-gray-500' : 'bg-yellow-400 animate-pulse'
      }`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-gray-400">{item.id.slice(0, 8)}…</span>
          <span className="text-xs bg-white/5 px-2 py-0.5 rounded">{item.document_type || 'unknown'}</span>
          {item.admin_decision && (
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              item.admin_decision === 'APPROVED' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>{item.admin_decision}</span>
          )}
        </div>
        <div className="flex gap-3 mt-1 text-xs text-gray-500">
          <span>Face: {item.face_similarity != null ? `${(item.face_similarity * 100).toFixed(0)}%` : 'N/A'}</span>
          <span>Risk: {item.risk_score?.toFixed(0) ?? 'N/A'}</span>
          <span>Liveness: {item.liveness_score != null ? `${(item.liveness_score * 100).toFixed(0)}%` : 'N/A'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onSelect} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition">
          <Eye className="w-4 h-4" />
        </button>
        {!item.reviewed && (
          <>
            <button onClick={onApprove} className="p-1.5 text-green-400 hover:bg-green-500/10 rounded-lg transition">
              <CheckCircle className="w-4 h-4" />
            </button>
            <button onClick={onReject} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition">
              <XCircle className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ReviewModal({ item, imageUrl, onClose, onSubmit }) {
  const [notes, setNotes]   = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (decision) => {
    setLoading(true)
    await onSubmit(item.id, decision, notes)
    setLoading(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-bg-secondary rounded-2xl border border-white/10 max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-lg">Manual Review</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        {/* Images */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          {item.has_document_image && (
            <div>
              <p className="text-xs text-gray-400 mb-2">ID Document</p>
              <img
                src={`${imageUrl(item.id, 'document')}`}
                alt="Document"
                className="w-full rounded-xl border border-white/10 object-contain bg-black/20 max-h-48"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            </div>
          )}
          {item.has_selfie_image && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Selfie</p>
              <img
                src={`${imageUrl(item.id, 'selfie')}`}
                alt="Selfie"
                className="w-full rounded-xl border border-white/10 object-contain bg-black/20 max-h-48"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            </div>
          )}
        </div>

        {/* Scores */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Face Match', value: `${((item.face_similarity ?? 0) * 100).toFixed(1)}%` },
            { label: 'Liveness', value: `${((item.liveness_score ?? 0) * 100).toFixed(1)}%` },
            { label: 'Risk Score', value: item.risk_score?.toFixed(1) ?? 'N/A' },
          ].map((s) => (
            <div key={s.label} className="bg-bg-primary rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-lg font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Extracted document fields */}
        {item.extracted_fields && Object.keys(item.extracted_fields).length > 0 && (
          <div className="mb-5">
            <p className="text-xs text-gray-400 mb-2">Extracted Document Data</p>
            <div className="bg-bg-primary rounded-xl p-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {Object.entries(item.extracted_fields).map(([k, v]) => (
                <div key={k} className="text-xs">
                  <span className="text-gray-500 capitalize">{k.replace(/_/g,' ')}: </span>
                  <span className="text-white font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pattern validation */}
        {item.pattern_warnings?.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
              <p className="text-xs text-yellow-400 font-medium">Document Pattern Issues</p>
            </div>
            <ul className="space-y-1">
              {item.pattern_warnings.map((w, i) => (
                <li key={i} className="text-xs text-yellow-300 bg-yellow-500/10 rounded-lg px-3 py-1.5">• {w}</li>
              ))}
            </ul>
          </div>
        )}
        {item.pattern_warnings?.length === 0 && item.pattern_valid && (
          <div className="mb-5 flex items-center gap-2 p-2.5 bg-green-500/10 rounded-xl">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            <p className="text-xs text-green-400">All government document format rules passed</p>
          </div>
        )}

        {/* Decision reasons */}
        {item.decision_reasons?.length > 0 && (
          <div className="mb-5">
            <p className="text-xs text-gray-400 mb-2">System flagged reasons:</p>
            <ul className="space-y-1">
              {item.decision_reasons.map((r, i) => (
                <li key={i} className="text-xs text-yellow-400 bg-yellow-500/10 rounded-lg px-3 py-1.5">{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes */}
        <div className="mb-5">
          <label className="block text-xs text-gray-400 mb-1.5">Review Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Add notes for this decision…"
            className="w-full bg-bg-primary border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary/50 resize-none transition"
          />
        </div>

        {/* Actions */}
        {!item.reviewed ? (
          <div className="flex gap-3">
            <button
              onClick={() => submit('APPROVED')}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 rounded-xl py-2.5 text-sm font-medium transition disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              Approve
            </button>
            <button
              onClick={() => submit('REJECTED')}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-xl py-2.5 text-sm font-medium transition disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          </div>
        ) : (
          <div className={`text-center py-2.5 rounded-xl text-sm font-medium ${
            item.admin_decision === 'APPROVED' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            Already reviewed: {item.admin_decision}
            {item.review_notes && <p className="text-xs text-gray-400 mt-1">{item.review_notes}</p>}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
