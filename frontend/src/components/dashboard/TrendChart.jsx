import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts'
import { motion } from 'framer-motion'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className="text-accent-primary font-mono">{payload[0].value} verifications</p>
    </div>
  )
}

export default function TrendChart({ stats }) {
  if (!stats?.hourly_distribution) return null

  const data = stats.hourly_distribution

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass rounded-2xl p-5"
    >
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Verifications — Last 24 Hours</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#06D6A0" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06D6A0" stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
          <XAxis
            dataKey="hour"
            tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            interval={3}
          />
          <YAxis
            tick={{ fill: '#6B7280', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#06D6A0"
            strokeWidth={2}
            fill="url(#areaGrad)"
            animationDuration={1200}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  )
}
