import { motion } from 'framer-motion'
import { ArrowRight, QrCode, FileText, AlertTriangle, CheckCircle2, Brain } from 'lucide-react'
import { confidenceColor } from '../../utils/formatters'
import clsx from 'clsx'

const FIELD_LABELS = {
  name:            'Full Name',
  dob:             'Date of Birth',
  document_number: 'Document Number',
  gender:          'Gender',
  address:         'Address',
  pincode:         'PIN Code',
  father_name:     'Father / Guardian',
  issue_date:      'Issue Date',
  expiry_date:     'Expiry Date',
  nationality:     'Nationality',
  state:           'State',
  district:        'District',
  blood_group:     'Blood Group',
  vehicle_classes: 'Vehicle Classes',
}

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100)
  const color = value >= 0.8 ? '#06D6A0' : value >= 0.6 ? '#FFD166' : '#EF476F'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className={clsx('text-xs font-mono w-10 text-right', confidenceColor(value))}>
        {pct}%
      </span>
    </div>
  )
}

function TypewriterText({ text, delay = 0 }) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.4 }}
      className="font-mono text-sm text-white"
    >
      {text}
    </motion.span>
  )
}

export default function OCRResultStep({ result, onNext }) {
  const { ocr } = result
  const fields  = ocr?.fields || {}
  const entries = Object.entries(fields).filter(([, v]) => v?.value)
  const patternValidation = ocr?.pattern_validation
  const patternWarnings   = patternValidation?.warnings || []
  const patternValid      = patternValidation?.valid ?? true
  const llmExtracted      = ocr?.llm_extracted

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="space-y-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Document Scan Results</h2>
          <p className="text-sm text-gray-400 mt-1">AI-extracted fields from your ID document</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className="px-2.5 py-1 rounded-full bg-accent-info/10 border border-accent-info/20 text-accent-info text-xs font-mono uppercase tracking-wide">
            {ocr?.document_type || 'Unknown'}
          </span>
          {llmExtracted && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs">
              <Brain className="w-3 h-3" /> AI OCR
            </span>
          )}
          {ocr?.qr_verified && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-xs">
              <QrCode className="w-3 h-3" /> QR Verified
            </span>
          )}
        </div>
      </div>

      {/* Pattern validation result */}
      {patternValidation && (
        <div className={clsx(
          'rounded-xl p-4 border flex items-start gap-3',
          patternValid && patternWarnings.length === 0
            ? 'bg-green-500/10 border-green-500/20'
            : patternValid
              ? 'bg-yellow-500/10 border-yellow-500/20'
              : 'bg-red-500/10 border-red-500/20'
        )}>
          {patternValid && patternWarnings.length === 0
            ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            : <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          }
          <div className="flex-1 min-w-0">
            <p className={clsx(
              'text-xs font-medium mb-1',
              patternValid && patternWarnings.length === 0 ? 'text-green-400'
              : patternValid ? 'text-yellow-400' : 'text-red-400'
            )}>
              {patternValid && patternWarnings.length === 0
                ? 'Document patterns verified — all government format rules passed'
                : patternValid
                  ? 'Document valid with warnings'
                  : 'Document format issues detected'}
            </p>
            {patternWarnings.length > 0 && (
              <ul className="space-y-1">
                {patternWarnings.map((w, i) => (
                  <li key={i} className="text-xs text-yellow-300/80">• {w}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Fields table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[auto,1fr,150px] gap-x-4 px-5 py-3 text-xs font-mono text-gray-500 uppercase tracking-widest border-b border-white/[0.06]">
          <span>Field</span>
          <span>Value</span>
          <span>Confidence</span>
        </div>
        {entries.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-500 text-sm">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No fields extracted — try a clearer image
          </div>
        ) : (
          entries.map(([key, field], i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="grid grid-cols-[auto,1fr,150px] gap-x-4 items-center px-5 py-3.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-xs text-gray-400 w-36">
                {FIELD_LABELS[key] || key}
              </span>
              <TypewriterText text={field.value} delay={i * 0.08 + 0.2} />
              <ConfidenceBar value={field.confidence} />
            </motion.div>
          ))
        )}
      </div>

      {/* Overall confidence */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Overall OCR Confidence</span>
        <span className={clsx('font-mono font-semibold', confidenceColor(ocr?.overall_confidence || 0))}>
          {Math.round((ocr?.overall_confidence || 0) * 100)}%
        </span>
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-xl bg-accent-primary text-bg-primary font-medium text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-[0_0_20px_rgba(6,214,160,0.2)]"
      >
        View Face Match <ArrowRight className="w-4 h-4" />
      </button>
    </motion.div>
  )
}
