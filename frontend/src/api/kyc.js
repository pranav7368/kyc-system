import axios from 'axios'
import toast from 'react-hot-toast'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 300_000, // 5 minutes — DeepFace + EasyOCR on CPU takes 90-180s
})

// Request interceptor — attach timestamp
api.interceptors.request.use((config) => {
  config.metadata = { startTime: Date.now() }
  return config
})

// Response interceptor — extract data
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg =
      err.response?.data?.detail ||
      err.response?.data?.error ||
      err.message ||
      'An unexpected error occurred'
    toast.error(msg)
    return Promise.reject(err)
  }
)

export const verifyKYC = (formData, onUploadProgress) =>
  api.post('/api/kyc/verify', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  })

export const getHistory = (page = 1, limit = 20) =>
  api.get('/api/kyc/history', { params: { page, limit } })

export const getStats = () => api.get('/api/kyc/stats')

export const getVerification = (id) => api.get(`/api/kyc/${id}`)

export const healthCheck = () => api.get('/api/health')
