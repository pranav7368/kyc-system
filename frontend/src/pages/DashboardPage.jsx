import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Activity } from 'lucide-react'
import { getStats, getHistory } from '../api/kyc'
import StatsCards    from '../components/dashboard/StatsCards'
import DecisionPieChart from '../components/dashboard/PieChart'
import TrendChart    from '../components/dashboard/TrendChart'
import RecentActivity from '../components/dashboard/RecentActivity'
import toast         from 'react-hot-toast'

export default function DashboardPage() {
  const [stats,   setStats]   = useState(null)
  const [recent,  setRecent]  = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [s, h] = await Promise.all([getStats(), getHistory(1, 5)])
      setStats(s)
      setRecent(h.items || [])
      setLastRefresh(new Date())
    } catch {
      if (!silent) toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), 30_000)
    return () => clearInterval(id)
  }, [load])

  if (loading && !stats) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading dashboard…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Real-time KYC verification intelligence
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <p className="text-xs text-gray-600 hidden sm:block">
                Updated {lastRefresh.toLocaleTimeString()}
              </p>
            )}
            <button
              onClick={() => load()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/[0.05] transition-colors border border-white/[0.06]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Stat cards */}
        <StatsCards stats={stats} />

        {/* Charts row */}
        <div className="grid lg:grid-cols-2 gap-6">
          <DecisionPieChart stats={stats} />
          <TrendChart stats={stats} />
        </div>

        {/* Recent activity */}
        <RecentActivity items={recent} />

        {/* Avg metrics strip */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass rounded-2xl p-5 grid grid-cols-3 gap-6"
          >
            {[
              { label: 'Avg Face Similarity',    value: `${((stats.avg_face_similarity || 0) * 100).toFixed(1)}%`,  color: 'text-accent-primary' },
              { label: 'Avg Risk Score',          value: (stats.avg_risk_score || 0).toFixed(1),                      color: 'text-accent-warning' },
              { label: 'Avg Processing Time',     value: `${(stats.avg_processing_time_ms || 0).toFixed(0)}ms`,       color: 'text-accent-info'    },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
