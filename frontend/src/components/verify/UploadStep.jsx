import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Camera, Upload } from 'lucide-react'
import DropZone from './DropZone'
import WebcamCapture from './WebcamCapture'
import clsx from 'clsx'

export default function UploadStep({ onNext }) {
  const [docFile, setDocFile]       = useState(null)
  const [selfieFile, setSelfieFile] = useState(null)
  const [selfieMode, setSelfieMode] = useState('webcam')  // 'webcam' | 'upload'

  const canProceed = docFile && selfieFile

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
          Upload your government-issued ID and a live selfie to begin verification.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ID Document */}
        <div className="glass rounded-2xl p-5">
          <DropZone
            label="Government ID"
            file={docFile}
            onFile={setDocFile}
            hint="Aadhaar, PAN, Passport, Driving Licence"
          />
        </div>

        {/* Selfie */}
        <div className="glass rounded-2xl p-5 space-y-3">
          <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Live Selfie</p>

          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/[0.08] text-xs">
            {[
              { value: 'webcam', icon: Camera, label: 'Webcam' },
              { value: 'upload', icon: Upload, label: 'Upload' },
            ].map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => { setSelfieMode(value); setSelfieFile(null) }}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors',
                  selfieMode === value
                    ? 'bg-accent-primary/20 text-accent-primary'
                    : 'text-gray-500 hover:text-gray-300'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {selfieMode === 'webcam' ? (
            <WebcamCapture onCapture={setSelfieFile} />
          ) : (
            <DropZone
              label=""
              file={selfieFile}
              onFile={setSelfieFile}
              hint="Clear face photo, front-facing"
            />
          )}
        </div>
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className={clsx('flex items-center gap-1', docFile ? 'text-accent-primary' : '')}>
          <span className={clsx('w-2 h-2 rounded-full', docFile ? 'bg-accent-primary' : 'bg-gray-600')} />
          ID Document
        </span>
        <span className={clsx('flex items-center gap-1', selfieFile ? 'text-accent-primary' : '')}>
          <span className={clsx('w-2 h-2 rounded-full', selfieFile ? 'bg-accent-primary' : 'bg-gray-600')} />
          Selfie
        </span>
      </div>

      <button
        disabled={!canProceed}
        onClick={() => onNext(docFile, selfieFile)}
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
