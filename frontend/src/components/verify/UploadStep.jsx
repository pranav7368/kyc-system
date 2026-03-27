import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Upload, Camera, AlertCircle, FlipHorizontal } from 'lucide-react'
import DropZone from './DropZone'
import DocumentCapture from './DocumentCapture'
import LivenessCapture from './LivenessCapture'
import clsx from 'clsx'

// Document types that require back side for complete data extraction
const NEEDS_BACK = ['aadhaar', 'driving_license', 'voter_id']

const BACK_MESSAGES = {
  aadhaar:         'Aadhaar physical card has the full address on the back. Upload it for complete extraction. (Skip if you have an e-Aadhaar printout — it has all details on one page.)',
  driving_license: 'Driving Licence (smart card) has address and vehicle classes on the back. Upload both sides.',
  voter_id:        'Voter ID has residential address on the back. Upload both sides for complete data.',
}

// Quick client-side doc type guess from filename or manual selection
const DOC_TYPES = [
  { id: 'aadhaar',         label: 'Aadhaar Card',      backNeeded: true  },
  { id: 'pan',             label: 'PAN Card',           backNeeded: false },
  { id: 'passport',        label: 'Passport',           backNeeded: false },
  { id: 'driving_license', label: 'Driving Licence',    backNeeded: true  },
  { id: 'voter_id',        label: 'Voter ID',           backNeeded: true  },
]

export default function UploadStep({ onNext }) {
  const [docFile, setDocFile]         = useState(null)
  const [docBackFile, setDocBackFile] = useState(null)
  const [selfieFile, setSelfieFile]   = useState(null)
  const [selfieMode, setSelfieMode]   = useState('live')   // 'live' | 'upload'
  const [docMode, setDocMode]         = useState('upload') // 'upload' | 'camera'
  const [liveMeta, setLiveMeta]       = useState(null)
  const [selectedDocType, setSelectedDocType] = useState(null)

  const needsBack = selectedDocType ? NEEDS_BACK.includes(selectedDocType) : false
  // Aadhaar back side is optional (e-Aadhaar has all data on front)
  // DL and Voter ID back side is required for address data
  const backRequired = needsBack && selectedDocType !== 'aadhaar'
  const canProceed = docFile && selfieFile && (!backRequired || docBackFile)

  const handleLivenessComplete = (file, meta) => {
    setSelfieFile(file)
    setLiveMeta(meta)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-white">Upload Documents</h2>
        <p className="text-sm text-gray-400 mt-1">
          Upload your ID and complete the live selfie challenge to begin verification.
        </p>
      </div>

      {/* Document type selector */}
      <div className="glass rounded-2xl p-5 border border-white/[0.06]">
        <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-3">
          Select Document Type
        </p>
        <div className="flex flex-wrap gap-2">
          {DOC_TYPES.map((dt) => (
            <button
              key={dt.id}
              onClick={() => setSelectedDocType(dt.id === selectedDocType ? null : dt.id)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs border transition-all',
                selectedDocType === dt.id
                  ? 'bg-accent-primary/20 border-accent-primary/40 text-accent-primary'
                  : 'bg-white/[0.03] border-white/[0.06] text-gray-400 hover:text-white hover:border-white/10'
              )}
            >
              {dt.label}
              {dt.backNeeded && (
                <span className="ml-1.5 text-yellow-400 opacity-80">·both sides</span>
              )}
            </button>
          ))}
        </div>

        {/* Both-side notice */}
        <AnimatePresence>
          {needsBack && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl"
            >
              <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-300">
                {BACK_MESSAGES[selectedDocType] || 'This document has additional details on the back. Please upload both sides.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Document upload */}
      <div className="glass rounded-2xl p-5 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">
            ID Document {needsBack ? '(Front)' : ''}
          </p>
          {/* Camera / Upload toggle for document */}
          <div className="flex gap-1 p-0.5 bg-bg-secondary rounded-lg text-xs">
            {[['upload', Upload, 'Upload'], ['camera', Camera, 'Camera']].map(([m, Icon, lbl]) => (
              <button
                key={m}
                onClick={() => { setDocMode(m); setDocFile(null) }}
                className={clsx(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md transition',
                  docMode === m ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                )}
              >
                <Icon className="w-3 h-3" /> {lbl}
              </button>
            ))}
          </div>
        </div>

        {docMode === 'camera' ? (
          <DocumentCapture onCapture={setDocFile} label="ID Document Front" />
        ) : (
          <DropZone
            label=""
            file={docFile}
            onFile={setDocFile}
            hint="Aadhaar, PAN, Passport, Driving Licence, Voter ID"
          />
        )}
      </div>

      {/* Back side upload — only shown when needed */}
      <AnimatePresence>
        {needsBack && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-2xl p-5 border border-yellow-500/20"
          >
            <div className="flex items-center gap-2 mb-3">
              <FlipHorizontal className="w-4 h-4 text-yellow-400" />
              <p className="text-xs font-mono text-yellow-400 uppercase tracking-widest">
                ID Document (Back)
              </p>
            </div>
            {docMode === 'camera' ? (
              <DocumentCapture onCapture={setDocBackFile} label="ID Document Back" />
            ) : (
              <DropZone
                label=""
                file={docBackFile}
                onFile={setDocBackFile}
                hint="Flip document and upload the back"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selfie */}
      <div className="glass rounded-2xl p-5 border border-white/[0.06] space-y-3">
        <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Live Selfie</p>
        <div className="flex rounded-lg overflow-hidden border border-white/[0.08] text-xs">
          {[['live', 'Live Liveness Check'], ['upload', 'Upload Photo']].map(([m, lbl]) => (
            <button
              key={m}
              onClick={() => { setSelfieMode(m); setSelfieFile(null); setLiveMeta(null) }}
              className={clsx(
                'flex-1 py-2 transition-colors',
                selfieMode === m ? 'bg-accent-primary/20 text-accent-primary' : 'text-gray-500 hover:text-gray-300'
              )}
            >
              {lbl}
            </button>
          ))}
        </div>

        {selfieMode === 'live' ? (
          <LivenessCapture onComplete={handleLivenessComplete} />
        ) : (
          <div className="space-y-2">
            <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <p className="text-xs text-yellow-400">Uploading a photo skips liveness detection and may lower your score.</p>
            </div>
            <DropZone label="" file={selfieFile} onFile={setSelfieFile} hint="Clear face photo, front-facing" />
          </div>
        )}
      </div>

      {/* Status row */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <StatusDot active={!!docFile}     label="ID Front" />
        {needsBack && <StatusDot active={!!docBackFile} label="ID Back" />}
        <StatusDot active={!!selfieFile}  label={selfieMode === 'live' ? 'Liveness Check' : 'Selfie'} />
        {liveMeta?.challenge_completed && <StatusDot active color="#4ade80" label="Challenges Passed" />}
      </div>

      <button
        disabled={!canProceed}
        onClick={() => onNext(docFile, selfieFile, {
          challenge_completed: liveMeta?.challenge_completed ?? false,
          docBackFile: docBackFile || null,
        })}
        className={clsx(
          'w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-300',
          canProceed
            ? 'bg-accent-primary text-bg-primary hover:brightness-110 shadow-[0_0_20px_rgba(6,214,160,0.3)]'
            : 'bg-white/[0.05] text-gray-600 cursor-not-allowed'
        )}
      >
        Start Verification
        <ArrowRight className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

function StatusDot({ active, label, color }) {
  return (
    <span className={clsx('flex items-center gap-1.5', active ? 'text-accent-primary' : '')}>
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: active ? (color || '#06D6A0') : '#4B5563' }}
      />
      {label}
    </span>
  )
}
