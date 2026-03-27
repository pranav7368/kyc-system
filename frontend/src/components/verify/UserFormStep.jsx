/**
 * UserFormStep — collects user-submitted identity details before verification.
 * These are matched against OCR-extracted fields to detect discrepancies.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, User, Calendar, Hash, MapPin, Info } from 'lucide-react'
import clsx from 'clsx'

const FIELD_CONFIG = [
  {
    key: 'name',
    label: 'Full Name',
    placeholder: 'As printed on your ID document',
    icon: User,
    type: 'text',
    required: true,
  },
  {
    key: 'dob',
    label: 'Date of Birth',
    placeholder: 'DD/MM/YYYY',
    icon: Calendar,
    type: 'text',
    required: true,
    hint: 'Enter exactly as shown on your document',
  },
  {
    key: 'document_number',
    label: 'Document Number',
    placeholder: 'e.g. XXXX XXXX XXXX or ABCDE1234F',
    icon: Hash,
    type: 'text',
    required: true,
    hint: 'The main ID number on your document',
  },
  {
    key: 'address',
    label: 'Address (optional)',
    placeholder: 'Street, City, State, PIN code',
    icon: MapPin,
    type: 'text',
    required: false,
  },
]

export default function UserFormStep({ onNext, onSkip }) {
  const [form, setForm] = useState({ name: '', dob: '', document_number: '', address: '' })
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.name.trim())            e.name = 'Name is required'
    if (!form.dob.trim())             e.dob  = 'Date of birth is required'
    if (!form.document_number.trim()) e.document_number = 'Document number is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    onNext(form)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-white">Your Identity Details</h2>
        <p className="text-sm text-gray-400 mt-1">
          Enter your details exactly as they appear on your ID document. We'll verify they match the extracted data.
        </p>
      </div>

      <div className="glass rounded-2xl p-6 border border-white/[0.06]">
        <div className="flex items-start gap-2 mb-5 p-3 bg-accent-primary/5 border border-accent-primary/15 rounded-xl">
          <Info className="w-4 h-4 text-accent-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400">
            This information is matched against your ID document using AI. Discrepancies may affect your verification score.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {FIELD_CONFIG.map(({ key, label, placeholder, icon: Icon, type, required, hint }) => (
            <div key={key}>
              <label className="block text-sm text-gray-400 mb-1.5">
                {label}
                {required && <span className="text-red-400 ml-1">*</span>}
              </label>
              <div className="relative">
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => {
                    setForm({ ...form, [key]: e.target.value })
                    if (errors[key]) setErrors({ ...errors, [key]: null })
                  }}
                  placeholder={placeholder}
                  className={clsx(
                    'w-full bg-bg-secondary border rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition',
                    errors[key]
                      ? 'border-red-500/50 focus:border-red-500'
                      : 'border-white/10 focus:border-accent-primary/50'
                  )}
                />
              </div>
              {hint && !errors[key] && (
                <p className="text-xs text-gray-600 mt-1">{hint}</p>
              )}
              {errors[key] && (
                <p className="text-xs text-red-400 mt-1">{errors[key]}</p>
              )}
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onSkip}
              className="flex-1 py-2.5 rounded-xl text-sm text-gray-500 border border-white/[0.06] hover:border-white/10 hover:text-gray-300 transition"
            >
              Skip (not recommended)
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-accent-primary text-bg-primary hover:brightness-110 transition shadow-[0_0_20px_rgba(6,214,160,0.2)]"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  )
}
