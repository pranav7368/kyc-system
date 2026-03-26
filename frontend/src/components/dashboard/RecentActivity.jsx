import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { fmtDate, fmtPct, truncateId, decisionBadge } from '../../utils/formatters'
import clsx from 'clsx'
import { ArrowRight } from 'lucide-react'

export default function RecentActivity({ items = [] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="glass rounded-2xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300">Recent Activity</h3>
        <Link
          to="/history"
          className="text-xs text-accent-primary hover:text-accent-primary/80 flex items-center gap-1 transition-colors"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No verifications yet</p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-mono text-gray-400">{truncateId(item.id).substring(0, 2)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white font-mono truncate">#{truncateId(item.id)}</p>
                  <p className="text-xs text-gray-500">{fmtDate(item.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-gray-400 font-mono hidden sm:block">
                  {fmtPct(item.face_similarity)}
                </span>
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-mono', decisionBadge(item.decision))}>
                  {item.decision}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
