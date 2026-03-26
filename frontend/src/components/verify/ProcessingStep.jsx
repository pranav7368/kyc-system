import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'

const STEPS = [
  { label: 'Securing connection…',               duration: 300 },
  { label: 'Uploading documents…',               duration: 600 },
  { label: 'Reading document with AI OCR…',       duration: 1200 },
  { label: 'Extracting personal details…',        duration: 400 },
  { label: 'Analysing face biometrics…',          duration: 1100 },
  { label: 'Running liveness detection…',         duration: 500 },
  { label: 'Checking document authenticity…',     duration: 800 },
  { label: 'Calculating risk score…',             duration: 200 },
  { label: 'Generating verification report…',     duration: 100 },
]

export default function ProcessingStep({ apiDone }) {
  const [currentStep, setCurrentStep]   = useState(0)
  const [completedSteps, setCompleted]  = useState([])
  const [elapsed, setElapsed]           = useState(0)
  const [stepTimes, setStepTimes]       = useState({})
  const [stepStart, setStepStart]       = useState(Date.now())

  // Timer
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 100), 100)
    return () => clearInterval(id)
  }, [])

  // Step progression
  useEffect(() => {
    if (currentStep >= STEPS.length) return
    const step = STEPS[currentStep]
    const delay = apiDone ? 80 : step.duration

    const id = setTimeout(() => {
      const t = ((Date.now() - stepStart) / 1000).toFixed(1)
      setStepTimes((prev) => ({ ...prev, [currentStep]: t }))
      setCompleted((prev) => [...prev, currentStep])
      setCurrentStep((s) => s + 1)
      setStepStart(Date.now())
    }, delay)

    return () => clearTimeout(id)
  }, [currentStep, apiDone, stepStart])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-[480px] space-y-8"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-accent-info/10 border border-accent-info/30 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-8 h-8 text-accent-info animate-pulse" />
        </div>
        <h2 className="text-xl font-semibold">Verifying Identity</h2>
        <p className="text-sm text-gray-400">AI pipeline running — please wait</p>
      </div>

      {/* Steps list */}
      <div className="w-full max-w-md space-y-2">
        <AnimatePresence>
          {STEPS.map((step, i) => {
            const done    = completedSteps.includes(i)
            const active  = currentStep === i
            const pending = i > currentStep

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: pending ? 0.4 : 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={clsx(
                  'flex items-center justify-between px-4 py-2.5 rounded-xl transition-all',
                  done   ? 'bg-accent-primary/5'  : '',
                  active ? 'bg-accent-info/10 border border-accent-info/20' : '',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                    {done ? (
                      <CheckCircle className="w-4 h-4 text-accent-primary" />
                    ) : active ? (
                      <Loader2 className="w-4 h-4 text-accent-info animate-spin" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-gray-700" />
                    )}
                  </div>
                  <span className={clsx(
                    'text-sm font-mono',
                    done   ? 'text-gray-300' : '',
                    active ? 'text-white' : '',
                    pending ? 'text-gray-600' : '',
                  )}>
                    {step.label}
                  </span>
                </div>
                {done && stepTimes[i] && (
                  <span className="text-xs font-mono text-accent-primary">{stepTimes[i]}s</span>
                )}
                {active && (
                  <span className="text-xs font-mono text-accent-info animate-pulse">…</span>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Total timer */}
      <div className="text-center">
        <p className="text-xs text-gray-500 font-mono">
          Processing:
          <span className="text-accent-primary ml-1">
            {(elapsed / 1000).toFixed(1)}s
          </span>
        </p>
        <div className="mt-2 w-40 h-1 bg-gray-800 rounded-full mx-auto overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-accent-info to-accent-primary rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${(completedSteps.length / STEPS.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  )
}
