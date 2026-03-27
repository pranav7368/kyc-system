import { useState, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useKYC } from '../hooks/useKYC'
import UserFormStep   from '../components/verify/UserFormStep'
import UploadStep     from '../components/verify/UploadStep'
import ProcessingStep from '../components/verify/ProcessingStep'
import OCRResultStep  from '../components/verify/OCRResultStep'
import FaceMatchStep  from '../components/verify/FaceMatchStep'
import FraudStep      from '../components/verify/FraudStep'
import RiskScoreStep  from '../components/verify/RiskScoreStep'
import DecisionStep   from '../components/verify/DecisionStep'
import clsx           from 'clsx'

const STEP_LABELS = [
  'Your Details',
  'Upload & Selfie',
  'Processing',
  'Document Scan',
  'Face Match',
  'Fraud Check',
  'Risk Score',
  'Decision',
]

function ProgressBar({ current }) {
  const pct = (current / (STEP_LABELS.length - 1)) * 100
  return (
    <div className="mb-8">
      <div className="flex justify-between text-xs font-mono text-gray-600 mb-2">
        {STEP_LABELS.map((label, i) => (
          <span
            key={i}
            className={clsx(
              'hidden sm:block transition-colors',
              i < current  ? 'text-accent-primary'
              : i === current ? 'text-white'
              : 'text-gray-600'
            )}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-accent-info to-accent-primary rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1.5 sm:hidden">
        Step {current + 1} of {STEP_LABELS.length}:{' '}
        <span className="text-white">{STEP_LABELS[current]}</span>
      </p>
    </div>
  )
}

export default function VerifyPage() {
  const [step, setStep]         = useState(0)
  const [userForm, setUserForm] = useState(null)
  const { verify, result, reset } = useKYC()
  const [apiDone, setApiDone]   = useState(false)

  const handleFormNext = useCallback((formData) => {
    setUserForm(formData)
    setStep(1)
  }, [])

  const handleFormSkip = useCallback(() => {
    setUserForm(null)
    setStep(1)
  }, [])

  const handleUpload = useCallback(async (docFile, selfieFile, meta = {}) => {
    setStep(2)
    setApiDone(false)
    try {
      await verify(docFile, selfieFile, {
        ...meta,
        userFormData: userForm,
      })
      setApiDone(true)
      setTimeout(() => setStep(3), 1200)
    } catch {
      setStep(1)
    }
  }, [verify, userForm])

  const handleReset = useCallback(() => {
    reset()
    setStep(0)
    setUserForm(null)
    setApiDone(false)
  }, [reset])

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <ProgressBar current={step} />

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <UserFormStep onNext={handleFormNext} onSkip={handleFormSkip} />
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <UploadStep onNext={handleUpload} />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProcessingStep apiDone={apiDone} />
            </motion.div>
          )}

          {step === 3 && result && (
            <motion.div key="ocr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <OCRResultStep result={result} onNext={() => setStep(4)} />
            </motion.div>
          )}

          {step === 4 && result && (
            <motion.div key="face" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <FaceMatchStep result={result} onNext={() => setStep(5)} />
            </motion.div>
          )}

          {step === 5 && result && (
            <motion.div key="fraud" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <FraudStep result={result} onNext={() => setStep(6)} />
            </motion.div>
          )}

          {step === 6 && result && (
            <motion.div key="risk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RiskScoreStep result={result} onNext={() => setStep(7)} />
            </motion.div>
          )}

          {step === 7 && result && (
            <motion.div key="decision" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DecisionStep result={result} onReset={handleReset} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
