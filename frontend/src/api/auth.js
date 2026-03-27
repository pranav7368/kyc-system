import axios from 'axios'
import toast from 'react-hot-toast'

const authApi = axios.create({ baseURL: '', timeout: 15_000 })

authApi.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'Request failed'
    toast.error(msg)
    return Promise.reject(err)
  }
)

const getAuthHeader = () => {
  const token = localStorage.getItem('kyc_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const login = (username, password) => {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)
  return authApi.post('/api/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
}

export const register = (data) =>
  authApi.post('/api/auth/register', data)

export const getMe = () =>
  authApi.get('/api/auth/me', { headers: getAuthHeader() })

export const getUsers = () =>
  authApi.get('/api/auth/users', { headers: getAuthHeader() })

export const setUserRole = (userId, role) =>
  authApi.patch(`/api/auth/users/${userId}/role`, { role }, { headers: getAuthHeader() })

export const getReviewQueue = (page = 1, status = 'pending') =>
  authApi.get('/api/admin/review-queue', { params: { page, status }, headers: getAuthHeader() })

export const submitReview = (verificationId, decision, notes = '') =>
  authApi.post(`/api/admin/review/${verificationId}`, { decision, notes }, { headers: getAuthHeader() })

export const getAdminStats = () =>
  authApi.get('/api/admin/stats', { headers: getAuthHeader() })
