import axios from 'axios'
import toast from 'react-hot-toast'

// Empty baseURL → all requests are relative → Vite proxy forwards /api/* to backend.
// This works from any device on the same network (phone, tablet, etc.)
const api = axios.create({
  baseURL: '',
  timeout: 300_000, // 5 minutes — DeepFace + EasyOCR on CPU takes 90-180s
})

// Request interceptor — attach timestamp + auth token
api.interceptors.request.use((config) => {
  config.metadata = { startTime: Date.now() }
  const token = localStorage.getItem('kyc_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
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
