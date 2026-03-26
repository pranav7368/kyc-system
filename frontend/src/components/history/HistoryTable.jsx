import { motion } from 'framer-motion'
import { fmtDate, fmtPct, fmtScore, fmtMs, truncateId, decisionBadge } from '../../utils/formatters'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const COLS = [
  { label: 'ID',          w: 'w-24' },
  { label: 'Time',        w: 'w-40' },
  { label: 'Doc Type',    w: 'w-28' },
  { label: 'Face Match',  w: 'w-24' },
  { label: 'Risk Score',  w: 'w-24' },
  { label: 'Time (ms)',   w: 'w-24' },
  { label: 'Decision',    w: 'w-28' },
]

export default function HistoryTable({
  items = [], total, page, totalPages, limit, onPage, onSelect
}) {
  return (
    <div className="space-y-3">
      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 gap-3 px-5 py-3 text-xs font-mono text-gray-500 uppercase tracking-widest border-b border-white/[0.06]">
          {COLS.map(c => <span key={c.label} className={c.w}>{c.label}</span>)}
        </div>

        {/* Rows */}
        {items.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-sm">No verification records found</div>
        ) : (
          items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onSelect(item)}
              className="grid grid-cols-7 gap-3 items-center px-5 py-3.5 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.04] cursor-pointer transition-colors group"
            >
              <span className="font-mono text-xs text-accent-primary group-hover:text-white transition-colors">
                #{truncateId(item.id)}
              </span>
              <span className="text-xs text-gray-400">{fmtDate(item.created_at)}</span>
              <span className="text-xs">
                {item.document_type
                  ? <span className="px-2 py-0.5 rounded-full bg-accent-info/10 text-accent-info text-xs font-mono uppercase">
                      {item.document_type}
                    </span>
                  : <span className="text-gray-600">—</span>
                }
              </span>
              <span className={clsx(
                'text-sm font-mono',
                item.face_similarity >= 0.7 ? 'text-accent-primary'
                : item.face_similarity >= 0.5 ? 'text-accent-warning'
                : 'text-accent-danger'
              )}>
                {fmtPct(item.face_similarity)}
              </span>
              <span className={clsx(
                'text-sm font-mono',
                item.risk_score <= 25 ? 'text-accent-primary'
                : item.risk_score <= 55 ? 'text-accent-warning'
                : 'text-accent-danger'
              )}>
                {fmtScore(item.risk_score)}
              </span>
              <span className="text-xs font-mono text-gray-400">{fmtMs(item.processing_time_ms)}</span>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-mono inline-block', decisionBadge(item.decision))}>
                {item.decision || '—'}
              </span>
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-xs text-gray-500">
            Showing {((page-1)*limit)+1}–{Math.min(page*limit, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => onPage(p)}
                className={clsx(
                  'w-7 h-7 rounded-lg text-xs font-mono transition-colors',
                  p === page
                    ? 'bg-accent-primary text-bg-primary font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                )}
              >
                {p}
              </button>
            ))}
            <button
              disabled={page >= totalPages}
              onClick={() => onPage(page + 1)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
