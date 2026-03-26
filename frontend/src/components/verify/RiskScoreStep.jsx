import { motion } from 'framer-motion'
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import clsx from 'clsx'

function Speedometer({ score }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let current = 0
    const id = setInterval(() => {
      current += 1
      if (current >= score) { setDisplay(score); clearInterval(id) }
      else setDisplay(current)
    }, 18)
    return () => clearInterval(id)
  }, [score])

  const color = score <= 25 ? '#06D6A0' : score <= 55 ? '#FFD166' : '#EF476F'
  const bgGlow = score <= 25 ? 'rgba(6,214,160,0.15)' : score <= 55 ? 'rgba(255,209,102,0.15)' : 'rgba(239,71,111,0.15)'

  // Semicircle needle — angle from -135deg to +135deg
  const angle = -135 + (display / 100) * 270
  const rad   = (angle * Math.PI) / 180
  const cx = 100, cy = 90, r = 70
  const nx = cx + r * Math.cos(rad)
  const ny = cy + r * Math.sin(rad)

  const arcDesc = (a1, a2, outerR) => {
    const r1 = (a1 * Math.PI) / 180
    const r2 = (a2 * Math.PI) / 180
    const x1 = cx + outerR * Math.cos(r1)
    const y1 = cy + outerR * Math.sin(r1)
    const x2 = cx + outerR * Math.cos(r2)
    const y2 = cy + outerR * Math.sin(r2)
    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 1 1 ${x2} ${y2}`
  }

  return (
    <div
      className="relative w-52 h-36 mx-auto flex flex-col items-center justify-end pb-2"
      style={{ filter: `drop-shadow(0 0 20px ${bgGlow})` }}
    >
      <svg viewBox="0 0 200 110" className="w-full">
        {/* Track */}
        <path d={arcDesc(-135, 45, 68)} fill="none" stroke="#1F2937" strokeWidth="12" strokeLinecap="round" />
        {/* Green zone */}
        <path d={arcDesc(-135, -67.5, 68)} fill="none" stroke="#06D6A0" strokeWidth="12" strokeLinecap="round" strokeOpacity="0.4" />
        {/* Amber zone */}
        <path d={arcDesc(-67.5, 22.5, 68)} fill="none" stroke="#FFD166" strokeWidth="12" strokeLinecap="round" strokeOpacity="0.4" />
        {/* Red zone */}
        <path d={arcDesc(22.5, 45, 68)} fill="none" stroke="#EF476F" strokeWidth="12" strokeLinecap="round" strokeOpacity="0.4" />
        {/* Needle */}
        <motion.line
          x1={cx} y1={cy}
          x2={nx} y2={ny}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ x2: cx + r * Math.cos((-135 * Math.PI) / 180), y2: cy + r * Math.sin((-135 * Math.PI) / 180) }}
          animate={{ x2: nx, y2: ny }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
        {/* Centre dot */}
        <circle cx={cx} cy={cy} r="5" fill={color} />
        {/* Score text */}
        <text x={cx} y={cy + 28} textAnchor="middle" fill={color} fontSize="22" fontWeight="bold" fontFamily="monospace">
          {display}
        </text>
        <text x={cx} y={cy + 40} textAnchor="middle" fill="#9CA3AF" fontSize="7" fontFamily="monospace">
          RISK SCORE
        </text>
      </svg>
    </div>
  )
}

const BREAKDOWN_ROWS = [
  { key: 'face_match',        label: 'Face Match',       max: 30 },
  { key: 'document_quality',  label: 'Document Quality', max: 25 },
  { key: 'liveness',          label: 'Liveness',         max: 20 },
  { key: 'data_consistency',  label: 'Data Consistency', max: 15 },
  { key: 'fraud_indicators',  label: 'Fraud Indicators', max: 10 },
]

export default function RiskScoreStep({ result, onNext }) {
  const { risk } = result
  const score     = risk?.risk_score ?? 0
  const breakdown = risk?.breakdown  ?? {}

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="space-y-5"
    >
      <div>
        <h2 className="text-xl font-semibold">Risk Assessment</h2>
        <p className="text-sm text-gray-400 mt-1">Weighted scoring across all verification dimensions</p>
      </div>

      <div className="glass rounded-2xl p-6">
        <Speedometer score={Math.round(score)} />

        <div className="flex justify-center gap-6 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent-primary inline-block" />Low (0-25)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent-warning inline-block" />Medium (26-55)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent-danger inline-block" />High (56+)</span>
        </div>
      </div>

      {/* Breakdown table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr,60px,60px,100px] gap-2 px-5 py-3 text-xs font-mono text-gray-500 uppercase tracking-widest border-b border-white/[0.06]">
          <span>Category</span>
          <span className="text-right">Penalty</span>
          <span className="text-right">Max</span>
          <span className="text-right">Status</span>
        </div>
        {BREAKDOWN_ROWS.map(({ key, label, max }, i) => {
          const row     = breakdown[key] || {}
          const penalty = row.penalty ?? max
          const good    = penalty === 0
          const partial = penalty > 0 && penalty < max

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              className="grid grid-cols-[1fr,60px,60px,100px] gap-2 items-center px-5 py-3 border-b border-white/[0.04] last:border-0"
            >
              <span className="text-sm text-gray-300">{label}</span>
              <span className={clsx(
                'text-right text-sm font-mono',
                good ? 'text-accent-primary' : partial ? 'text-accent-warning' : 'text-accent-danger'
              )}>
                {penalty}
              </span>
              <span className="text-right text-xs text-gray-600">{max}</span>
              <span className={clsx(
                'text-right text-xs font-mono',
                good ? 'text-accent-primary' : partial ? 'text-accent-warning' : 'text-accent-danger'
              )}>
                {row.status || '—'}
              </span>
            </motion.div>
          )
        })}
        <div className="grid grid-cols-[1fr,60px,60px,100px] gap-2 items-center px-5 py-3 bg-white/[0.02] border-t border-white/[0.08]">
          <span className="text-sm font-semibold text-white">Total</span>
          <span className={clsx(
            'text-right text-sm font-bold font-mono',
            score <= 25 ? 'text-accent-primary' : score <= 55 ? 'text-accent-warning' : 'text-accent-danger'
          )}>
            {Math.round(score)}
          </span>
          <span className="text-right text-xs text-gray-500">100</span>
          <span className={clsx(
            'text-right text-xs font-mono font-bold',
            score <= 25 ? 'text-accent-primary' : score <= 55 ? 'text-accent-warning' : 'text-accent-danger'
          )}>
            {score <= 25 ? 'LOW RISK' : score <= 55 ? 'MEDIUM' : 'HIGH RISK'}
          </span>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-xl bg-accent-primary text-bg-primary font-medium text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-[0_0_20px_rgba(6,214,160,0.2)]"
      >
        View Final Decision <ArrowRight className="w-4 h-4" />
      </button>
    </motion.div>
  )
}
