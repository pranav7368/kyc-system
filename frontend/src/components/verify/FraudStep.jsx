import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle, AlertTriangle, Shield } from 'lucide-react'
import clsx from 'clsx'

const CHECKS = [
  { key: 'ela_score',           label: 'Error Level Analysis',  invert: true },
  { key: 'edge_consistency',    label: 'Edge Consistency',       invert: true },
  { key: 'noise_uniformity',    label: 'Noise Uniformity',       invert: true },
  { key: 'jpeg_ghost_score',    label: 'JPEG Ghost Detection',   invert: true },
  { key: 'copy_move_detected',  label: 'Copy-Move Detection',    isBool: true },
  { key: 'metadata_suspicious', label: 'Metadata Check',         isBool: true },
  { key: 'resolution_adequate', label: 'Resolution Check',       isBool: true, goodTrue: true },
]

function CheckRow({ label, value, isBool, goodTrue, invert, index }) {
  let score, statusText, isGood

  if (isBool) {
    isGood      = goodTrue ? value === true : value === false
    score       = isGood ? 0 : 1
    statusText  = goodTrue ? (value ? 'Pass' : 'Fail') : (value ? 'Detected' : 'Clean')
  } else {
    score      = typeof value === 'number' ? value : 0
    isGood     = invert ? score < 0.35 : score > 0.65
    statusText = isGood ? (score < 0.2 ? 'Clean' : 'Low Risk') : (score > 0.6 ? 'High Risk' : 'Suspicious')
  }

  const barWidth = isBool ? (isGood ? 5 : 95) : Math.round(score * 100)
  const barColor = isGood ? '#06D6A0' : score > 0.6 ? '#EF476F' : '#FFD166'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      className="flex items-center gap-3 py-3 border-b border-white/[0.04] last:border-0"
    >
      <div className="w-5 flex-shrink-0">
        {isGood
          ? <CheckCircle className="w-4 h-4 text-accent-primary" />
          : <AlertTriangle className="w-4 h-4 text-accent-danger" />
        }
      </div>
      <span className="text-sm text-gray-300 w-44 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: index * 0.07 + 0.3 }}
          className="h-full rounded-full"
          style={{ backgroundColor: barColor }}
        />
      </div>
      <span className={clsx(
        'text-xs font-mono w-20 text-right',
        isGood ? 'text-accent-primary' : 'text-accent-danger'
      )}>
        {statusText}
      </span>
    </motion.div>
  )
}

export default function FraudStep({ result, onNext }) {
  const { fraud } = result
  const checks    = fraud?.checks    || {}
  const flags     = fraud?.flags     || []
  const isSusp    = fraud?.is_suspicious

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="space-y-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Document Forensics</h2>
          <p className="text-sm text-gray-400 mt-1">7-layer tamper detection analysis</p>
        </div>
        <div className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-semibold',
          isSusp
            ? 'bg-accent-danger/10 border-accent-danger/30 text-accent-danger'
            : 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary'
        )}>
          <Shield className="w-3.5 h-3.5" />
          {isSusp ? 'SUSPICIOUS' : 'AUTHENTIC'}
        </div>
      </div>

      {/* Fraud score gauge */}
      <div className="glass rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">Fraud Score</p>
          <p className={clsx(
            'text-3xl font-bold font-mono',
            (fraud?.fraud_score || 0) < 0.35 ? 'text-accent-primary' : (fraud?.fraud_score || 0) < 0.6 ? 'text-accent-warning' : 'text-accent-danger'
          )}>
            {Math.round((fraud?.fraud_score || 0) * 100)}
            <span className="text-base font-normal text-gray-500">/100</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-1">Verdict</p>
          <p className="text-sm font-medium">{fraud?.analysis_details || '—'}</p>
        </div>
      </div>

      {/* Checks list */}
      <div className="glass rounded-2xl px-5 py-2">
        {CHECKS.map(({ key, label, isBool, goodTrue, invert }, i) => (
          <CheckRow
            key={key}
            label={label}
            value={checks[key]}
            isBool={isBool}
            goodTrue={goodTrue}
            invert={invert}
            index={i}
          />
        ))}
      </div>

      {/* Flags */}
      {flags.length > 0 && (
        <div className="bg-accent-danger/5 border border-accent-danger/20 rounded-xl p-4 space-y-1.5">
          <p className="text-xs font-mono text-accent-danger uppercase tracking-wider mb-2">Flags Detected</p>
          {flags.map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
              <AlertTriangle className="w-3.5 h-3.5 text-accent-danger mt-0.5 flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onNext}
        className="w-full py-3 rounded-xl bg-accent-primary text-bg-primary font-medium text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-[0_0_20px_rgba(6,214,160,0.2)]"
      >
        View Risk Score <ArrowRight className="w-4 h-4" />
      </button>
    </motion.div>
  )
}
