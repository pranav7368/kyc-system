import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertTriangle, XCircle, Clock, RotateCcw, Download } from 'lucide-react'
import { fmtMs, fmtDate, truncateId } from '../../utils/formatters'
import clsx from 'clsx'
import { useEffect, useState } from 'react'

// Confetti particle
function Particle({ x, y, color, delay }) {
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-sm"
      style={{ left: x, top: y, backgroundColor: color }}
      initial={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
      animate={{ y: 300, opacity: 0, rotate: 720, scale: 0.3 }}
      transition={{ duration: 2, delay, ease: 'easeIn' }}
    />
  )
}

function Confetti() {
  const particles = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    x: `${Math.random() * 100}%`,
    y: `${Math.random() * 40}%`,
    color: ['#06D6A0', '#FFD166', '#118AB2', '#FFFFFF', '#06D6A099'][Math.floor(Math.random() * 5)],
    delay: Math.random() * 0.8,
  }))
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => <Particle key={p.id} {...p} />)}
    </div>
  )
}

export default function DecisionStep({ result, onReset }) {
  const { risk, processing_time_ms, id, created_at } = result
  const decision = risk?.decision || 'REVIEW'
  const reasons  = risk?.decision_reasons || []
  const action   = risk?.recommended_action || ''

  const isApproved = decision === 'APPROVED'
  const isReview   = decision === 'REVIEW'
  const isRejected = decision === 'REJECTED'

  const [showConfetti, setShowConfetti] = useState(isApproved)
  useEffect(() => {
    if (isApproved) {
      const t = setTimeout(() => setShowConfetti(false), 3000)
      return () => clearTimeout(t)
    }
  }, [isApproved])

  const Icon = isApproved ? CheckCircle : isReview ? AlertTriangle : XCircle

  const bgGlow = isApproved
    ? 'shadow-[0_0_80px_rgba(6,214,160,0.15)]'
    : isReview
    ? 'shadow-[0_0_80px_rgba(255,209,102,0.15)]'
    : 'shadow-[0_0_80px_rgba(239,71,111,0.15)]'

  const iconColor  = isApproved ? 'text-accent-primary' : isReview ? 'text-accent-warning' : 'text-accent-danger'
  const ringColor  = isApproved ? 'border-accent-primary/30' : isReview ? 'border-accent-warning/30' : 'border-accent-danger/30'
  const glowColor  = isApproved ? 'rgba(6,214,160,0.2)' : isReview ? 'rgba(255,209,102,0.2)' : 'rgba(239,71,111,0.2)'

  const handleDownload = () => {
    const data = JSON.stringify(result, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `kyc-report-${truncateId(id)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={clsx('relative glass rounded-2xl p-8 overflow-hidden text-center', bgGlow)}
    >
      {showConfetti && <Confetti />}

      {/* Icon with pulse rings */}
      <div className="relative flex items-center justify-center mb-6">
        {isApproved && (
          <>
            <motion.div
              className={clsx('absolute rounded-full border-2', ringColor)}
              initial={{ width: 80, height: 80, opacity: 0.6 }}
              animate={{ width: 160, height: 160, opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              className={clsx('absolute rounded-full border-2', ringColor)}
              initial={{ width: 80, height: 80, opacity: 0.4 }}
              animate={{ width: 140, height: 140, opacity: 0 }}
              transition={{ duration: 2, delay: 0.5, repeat: Infinity, ease: 'easeOut' }}
            />
          </>
        )}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
          className={clsx(
            'relative w-20 h-20 rounded-2xl flex items-center justify-center',
            isApproved ? 'bg-accent-primary/15' : isReview ? 'bg-accent-warning/15' : 'bg-accent-danger/15'
          )}
          style={{ boxShadow: `0 0 40px ${glowColor}` }}
        >
          <motion.div
            animate={isRejected ? { x: [0, -6, 6, -4, 4, 0] } : {}}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Icon className={clsx('w-10 h-10', iconColor)} />
          </motion.div>
        </motion.div>
      </div>

      {/* Decision label */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h2 className={clsx('text-2xl font-bold font-mono tracking-widest mb-1', iconColor)}>
          {isApproved ? 'IDENTITY VERIFIED' : isReview ? 'MANUAL REVIEW REQUIRED' : 'VERIFICATION FAILED'}
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          {isApproved
            ? 'All checks passed. Customer can be onboarded.'
            : isReview
            ? 'Some checks need manual inspection.'
            : 'Verification could not be completed automatically.'}
        </p>
      </motion.div>

      {/* Reasons */}
      {reasons.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className={clsx(
            'text-left rounded-xl p-4 mb-6 space-y-1.5',
            isApproved ? 'bg-accent-primary/5 border border-accent-primary/10' : 'bg-white/[0.03] border border-white/[0.06]'
          )}
        >
          {reasons.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className={clsx('mt-0.5 text-xs', iconColor)}>{'•'}</span>
              <span className="text-gray-300">{r}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Recommended action */}
      {action && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-xs text-gray-500 mb-6 bg-white/[0.03] rounded-lg px-3 py-2"
        >
          Recommended: {action}
        </motion.p>
      )}

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="grid grid-cols-2 gap-3 mb-6"
      >
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <Clock className="w-3 h-3" /> Processing Time
          </div>
          <p className="text-lg font-bold font-mono text-accent-primary">{fmtMs(processing_time_ms)}</p>
          <p className="text-xs text-gray-600 mt-0.5">vs 2-3 business days traditional</p>
        </div>
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Verification ID</p>
          <p className="text-sm font-mono text-white">{truncateId(id)}…</p>
          <p className="text-xs text-gray-600 mt-0.5">{fmtDate(created_at)}</p>
        </div>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="flex gap-3"
      >
        <button
          onClick={handleDownload}
          className="flex-1 py-2.5 rounded-xl border border-white/[0.1] text-gray-300 hover:text-white hover:bg-white/[0.05] text-sm flex items-center justify-center gap-2 transition-all"
        >
          <Download className="w-4 h-4" /> Download Report
        </button>
        <button
          onClick={onReset}
          className="flex-1 py-2.5 rounded-xl bg-accent-primary text-bg-primary font-medium text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all"
        >
          <RotateCcw className="w-4 h-4" /> Verify Another
        </button>
      </motion.div>
    </motion.div>
  )
}
