export const fmtPct = (v) =>
  v != null ? `${(v * 100).toFixed(1)}%` : '—'

export const fmtScore = (v) =>
  v != null ? v.toFixed(1) : '—'

export const fmtMs = (ms) => {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export const fmtDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export const decisionColor = (d) => {
  if (d === 'APPROVED') return '#06D6A0'
  if (d === 'REVIEW')   return '#FFD166'
  return '#EF476F'
}

export const decisionBadge = (d) => {
  if (d === 'APPROVED') return 'badge-approved'
  if (d === 'REVIEW')   return 'badge-review'
  return 'badge-rejected'
}

export const confidenceColor = (c) => {
  if (c >= 0.8) return 'text-emerald-400'
  if (c >= 0.6) return 'text-amber-400'
  return 'text-rose-400'
}

export const truncateId = (id) =>
  id ? id.substring(0, 8).toUpperCase() : '—'
