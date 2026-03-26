import { useState, useCallback } from 'react'
import { verifyKYC } from '../api/kyc'
import toast from 'react-hot-toast'

export function useKYC() {
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [progress, setProgress] = useState(0)

  const verify = useCallback(async (docFile, selfieFile) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setProgress(0)

    const fd = new FormData()
    fd.append('id_document', docFile)
    fd.append('selfie', selfieFile)

    try {
      const data = await verifyKYC(fd, (evt) => {
        if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100))
      })
      setResult(data)
      return data
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Verification failed'
      setError(msg)
      toast.error(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
    setLoading(false)
    setProgress(0)
  }, [])

  return { verify, result, loading, error, progress, reset }
}
