import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, RefreshCw } from 'lucide-react'
import { getHistory, getVerification } from '../api/kyc'
import HistoryTable from '../components/history/HistoryTable'
import DetailModal  from '../components/history/DetailModal'
import toast from 'react-hot-toast'

export default function HistoryPage() {
  const [items,      setItems]      = useState([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState(null)
  const [detail,     setDetail]     = useState(null)
  const [filter,     setFilter]     = useState('ALL')
  const LIMIT = 20

  const load = useCallback(async (p = 1, silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await getHistory(p, LIMIT)
      setItems(data.items || [])
      setTotal(data.total_count || 0)
      setTotalPages(data.total_pages || 1)
      setPage(p)
    } catch {
      if (!silent) toast.error('Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSelect = async (item) => {
    setSelected(item)
    try {
      const full = await getVerification(item.id)
      setDetail(full)
    } catch {
      setDetail(item)
    }
  }

  const filtered = filter === 'ALL'
    ? items
    : items.filter(i => i.decision === filter)

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
            <h1 className="text-2xl font-bold">Verification History</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {total} total record{total !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => load(page)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/[0.05] transition-colors border border-white/[0.06]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </motion.div>

        {/* Filter bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-3"
        >
          <div className="flex items-center gap-1 bg-bg-secondary rounded-xl p-1 border border-white/[0.06]">
            {['ALL', 'APPROVED', 'REVIEW', 'REJECTED'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  filter === f
                    ? 'bg-accent-primary/20 text-accent-primary'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-secondary border border-white/[0.06] text-xs text-gray-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Click a row to view details</span>
          </div>
        </motion.div>

        {/* Table */}
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading…
          </div>
        ) : (
          <HistoryTable
            items={filtered}
            total={total}
            page={page}
            totalPages={totalPages}
            limit={LIMIT}
            onPage={load}
            onSelect={handleSelect}
          />
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <DetailModal
          item={detail || selected}
          onClose={() => { setSelected(null); setDetail(null) }}
        />
      )}
    </div>
  )
}
