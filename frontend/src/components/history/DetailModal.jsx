import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink } from 'lucide-react'
import { fmtDate, fmtPct, fmtScore, fmtMs, decisionBadge } from '../../utils/formatters'
import clsx from 'clsx'

function Row({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-gray-500 w-40 flex-shrink-0">{label}</span>
      <span className={clsx('text-sm text-right', mono ? 'font-mono text-accent-primary' : 'text-gray-200')}>
        {value ?? '—'}
      </span>
    </div>
  )
}

export default function DetailModal({ item, onClose }) {
  if (!item) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="glass rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <div>
              <h3 className="text-sm font-semibold text-white">Verification Details</h3>
              <p className="text-xs text-gray-500 font-mono mt-0.5">{item.id}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-mono', decisionBadge(item.decision))}>
                {item.decision}
              </span>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-gray-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="px-6 py-4 space-y-5">
            {/* Summary */}
            <div>
              <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Summary</p>
              <Row label="Created At"        value={fmtDate(item.created_at)} />
              <Row label="Document Type"     value={item.document_type?.toUpperCase()} />
              <Row label="Face Similarity"   value={fmtPct(item.face_similarity)} mono />
              <Row label="Liveness Score"    value={fmtPct(item.liveness_score)} mono />
              <Row label="Fraud Score"       value={fmtPct(item.fraud_score)} mono />
              <Row label="Risk Score"        value={fmtScore(item.risk_score)} mono />
              <Row label="Processing Time"   value={fmtMs(item.processing_time_ms)} mono />
            </div>

            {/* Decision reasons */}
            {item.decision_reasons?.length > 0 && (
              <div>
                <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Decision Reasons</p>
                <div className="space-y-1.5">
                  {item.decision_reasons.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-accent-primary mt-0.5">•</span>
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fraud flags */}
            {item.fraud_flags?.length > 0 && (
              <div>
                <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Fraud Flags</p>
                <div className="space-y-1.5">
                  {item.fraud_flags.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-accent-danger">
                      <span>⚠</span>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OCR fields */}
            {item.extracted_data?.fields && (
              <div>
                <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Extracted Fields</p>
                {Object.entries(item.extracted_data.fields)
                  .filter(([, v]) => v?.value)
                  .map(([k, v]) => (
                    <Row key={k} label={k.replace(/_/g, ' ')} value={`${v.value} (${Math.round(v.confidence * 100)}%)`} />
                  ))
                }
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
