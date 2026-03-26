import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle, AlertTriangle, XCircle, Eye, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import clsx from 'clsx'

function AnimatedGauge({ value }) {
  const [display, setDisplay] = useState(0)
  const pct = Math.round(value * 100)

  useEffect(() => {
    let current = 0
    const id = setInterval(() => {
      current += 2
      if (current >= pct) { setDisplay(pct); clearInterval(id) }
      else setDisplay(current)
    }, 20)
    return () => clearInterval(id)
  }, [pct])

  const color = value >= 0.7 ? '#06D6A0' : value >= 0.55 ? '#FFD166' : '#EF476F'
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDash = (display / 100) * circumference

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#1F2937" strokeWidth="10" />
        <motion.circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - strokeDash }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
        />
      </svg>
      <div className="relative text-center">
        <p className="text-3xl font-bold font-mono" style={{ color }}>{display}%</p>
        <p className="text-xs text-gray-400 mt-0.5">Match</p>
      </div>
    </div>
  )
}

function QualityBadge({ label, value, good = true }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
      <span className={clsx('w-2 h-2 rounded-full', good ? 'bg-accent-primary' : 'bg-accent-warning')} />
      <span className="text-xs text-gray-400">{label}:</span>
      <span className="text-xs text-white font-mono">{value}</span>
    </div>
  )
}

export default function FaceMatchStep({ result, onNext }) {
  const { face, liveness } = result

  const similarity = face?.similarity ?? 0
  const match = face?.match
  const selfieQ = face?.selfie_face_quality || {}
  const docQ = face?.doc_face_quality || {}

  let MatchIcon, matchLabel, matchClass
  if (similarity >= 0.70) {
    MatchIcon = CheckCircle; matchLabel = 'MATCH CONFIRMED'; matchClass = 'text-accent-primary'
  } else if (similarity >= 0.55) {
    MatchIcon = AlertTriangle; matchLabel = 'PARTIAL MATCH'; matchClass = 'text-accent-warning'
  } else {
    MatchIcon = XCircle; matchLabel = 'NO MATCH'; matchClass = 'text-accent-danger'
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="space-y-5"
    >
      <div>
        <h2 className="text-xl font-semibold">Biometric Verification</h2>
        <p className="text-sm text-gray-400 mt-1">Face matching between document and selfie</p>
      </div>

      {/* Face match display */}
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-col items-center gap-6">
          {/* Gauge */}
          <AnimatedGauge value={similarity} />

          {/* Match label */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-2"
          >
            <MatchIcon className={clsx('w-5 h-5', matchClass)} />
            <span className={clsx('font-mono font-bold text-sm tracking-wider', matchClass)}>
              {matchLabel}
            </span>
          </motion.div>

          {/* Age / Gender chips */}
          {(face?.estimated_age || face?.estimated_gender) && (
            <div className="flex items-center gap-3">
              {face.estimated_age && (
                <span className="text-xs px-3 py-1 rounded-full bg-white/[0.05] text-gray-300">
                  Est. Age: <strong>{face.estimated_age}</strong>
                </span>
              )}
              {face.estimated_gender && (
                <span className="text-xs px-3 py-1 rounded-full bg-white/[0.05] text-gray-300">
                  Gender: <strong>{face.estimated_gender === 'M' ? 'Male' : 'Female'}</strong>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quality metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-4 space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Document Face</p>
          <div className="space-y-1.5">
            <QualityBadge label="Detected" value={docQ.detected ? 'Yes' : 'No'} good={docQ.detected} />
            <QualityBadge label="Frontal"  value={docQ.frontal ? 'Yes' : 'No'}   good={docQ.frontal} />
          </div>
        </div>
        <div className="glass rounded-xl p-4 space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Selfie</p>
          <div className="space-y-1.5">
            <QualityBadge label="Blur"       value={selfieQ.blur > 50 ? 'Sharp' : 'Blurry'} good={selfieQ.blur > 50} />
            <QualityBadge label="Brightness" value={selfieQ.brightness > 0.3 && selfieQ.brightness < 0.9 ? 'OK' : 'Off'} good={selfieQ.brightness > 0.3 && selfieQ.brightness < 0.9} />
          </div>
        </div>
      </div>

      {/* Liveness */}
      <div className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-xl border',
        liveness?.is_live
          ? 'bg-accent-primary/5 border-accent-primary/20'
          : 'bg-accent-danger/5 border-accent-danger/20'
      )}>
        <Eye className={clsx('w-5 h-5', liveness?.is_live ? 'text-accent-primary' : 'text-accent-danger')} />
        <div>
          <p className={clsx('text-sm font-medium', liveness?.is_live ? 'text-accent-primary' : 'text-accent-danger')}>
            Liveness Check: {liveness?.is_live ? 'PASSED' : 'FAILED'}
          </p>
          <p className="text-xs text-gray-500">
            Score: {Math.round((liveness?.liveness_score || 0) * 100)}% — {liveness?.anti_spoof_confidence ? `Anti-spoof: ${Math.round(liveness.anti_spoof_confidence * 100)}%` : ''}
          </p>
        </div>
        <Zap className={clsx('w-4 h-4 ml-auto', liveness?.is_live ? 'text-accent-primary' : 'text-gray-600')} />
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-xl bg-accent-primary text-bg-primary font-medium text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-[0_0_20px_rgba(6,214,160,0.2)]"
      >
        View Fraud Analysis <ArrowRight className="w-4 h-4" />
      </button>
    </motion.div>
  )
}
