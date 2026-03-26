import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { motion } from 'framer-motion'

const COLORS = ['#06D6A0', '#FFD166', '#EF476F']
const LABELS = ['Approved', 'Review', 'Rejected']

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl px-3 py-2 text-sm">
      <p className="font-medium" style={{ color: payload[0].payload.fill }}>{payload[0].name}</p>
      <p className="text-gray-300 font-mono">{payload[0].value} verifications</p>
    </div>
  )
}

const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontFamily="monospace">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function DecisionPieChart({ stats }) {
  if (!stats) return null

  const data = [
    { name: 'Approved', value: stats.approved_count || 0, fill: COLORS[0] },
    { name: 'Review',   value: stats.review_count   || 0, fill: COLORS[1] },
    { name: 'Rejected', value: stats.rejected_count || 0, fill: COLORS[2] },
  ].filter(d => d.value > 0)

  if (data.length === 0) {
    return (
      <div className="glass rounded-2xl p-5 h-64 flex items-center justify-center">
        <p className="text-gray-500 text-sm">No data yet</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass rounded-2xl p-5"
    >
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Decision Distribution</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
            labelLine={false}
            label={CustomLabel}
            animationBegin={0}
            animationDuration={1000}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} stroke="transparent"
                style={{ filter: `drop-shadow(0 0 6px ${entry.fill}60)` }}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span className="text-xs text-gray-400">{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  )
}
