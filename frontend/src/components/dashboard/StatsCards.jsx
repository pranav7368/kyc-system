import { motion } from 'framer-motion'
import { ShieldCheck, CheckCircle, AlertTriangle, XCircle, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import clsx from 'clsx'

function CountUp({ target, duration = 1200 }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) return
    let start = 0
    const step = target / (duration / 16)
    const id = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(id) }
      else setVal(Math.floor(start))
    }, 16)
    return () => clearInterval(id)
  }, [target, duration])
  return <>{val.toLocaleString()}</>
}

const CARDS = [
  {
    key:    'total',
    label:  'Total Verifications',
    icon:   ShieldCheck,
    color:  'text-accent-info',
    glow:   'rgba(17,138,178,0.15)',
    border: 'border-accent-info/20',
    getValue: (s) => s.total_verifications,
    getSub:   (s) => `This hour: ${s.verifications_this_hour}`,
  },
  {
    key:    'approved',
    label:  'Approved',
    icon:   CheckCircle,
    color:  'text-accent-primary',
    glow:   'rgba(6,214,160,0.15)',
    border: 'border-accent-primary/20',
    getValue: (s) => s.approved_count,
    getSub:   (s) => s.total_verifications
      ? `${Math.round((s.approved_count / s.total_verifications) * 100)}% approval rate`
      : '—',
  },
  {
    key:    'review',
    label:  'Under Review',
    icon:   AlertTriangle,
    color:  'text-accent-warning',
    glow:   'rgba(255,209,102,0.15)',
    border: 'border-accent-warning/20',
    getValue: (s) => s.review_count,
    getSub:   (s) => `Avg risk: ${s.avg_risk_score?.toFixed(1) || '—'}`,
  },
  {
    key:    'rejected',
    label:  'Rejected',
    icon:   XCircle,
    color:  'text-accent-danger',
    glow:   'rgba(239,71,111,0.15)',
    border: 'border-accent-danger/20',
    getValue: (s) => s.rejected_count,
    getSub:   (s) => `Today: ${s.verifications_today}`,
  },
]

export default function StatsCards({ stats }) {
  if (!stats) return null
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {CARDS.map(({ key, label, icon: Icon, color, glow, border, getValue, getSub }, i) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className={clsx('glass rounded-2xl p-5 border glow-border', border)}
          style={{ boxShadow: `0 0 30px ${glow}` }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.05]', color)}>
              <Icon className="w-4.5 h-4.5" />
            </div>
            <TrendingUp className="w-3.5 h-3.5 text-gray-600" />
          </div>
          <p className={clsx('text-3xl font-bold font-mono', color)}>
            <CountUp target={getValue(stats)} />
          </p>
          <p className="text-sm text-gray-400 mt-0.5">{label}</p>
          <p className="text-xs text-gray-600 mt-1">{getSub(stats)}</p>
        </motion.div>
      ))}
    </div>
  )
}
