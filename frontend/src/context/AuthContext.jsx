import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getMe } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // Attach token to all kyc api requests
  const setToken = useCallback((token) => {
    if (token) {
      localStorage.setItem('kyc_token', token)
    } else {
      localStorage.removeItem('kyc_token')
    }
  }, [])

  const login = useCallback((token, userData) => {
    setToken(token)
    setUser(userData)
  }, [setToken])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [setToken])

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('kyc_token')
    if (!token) { setLoading(false); return }

    getMe()
      .then((u) => setUser(u))
      .catch(() => { localStorage.removeItem('kyc_token') })
      .finally(() => setLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
