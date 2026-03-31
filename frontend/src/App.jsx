import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar          from './components/layout/Navbar'
import VerifyPage      from './pages/VerifyPage'
import DashboardPage   from './pages/DashboardPage'
import HistoryPage     from './pages/HistoryPage'
import LoginPage       from './pages/LoginPage'
import RegisterPage    from './pages/RegisterPage'
import AdminPage       from './pages/AdminPage'

// Guard: redirect to /login if not authenticated
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Guard: redirect to /verify if not admin
function RequireAdmin({ children }) {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/verify" replace />
  return children
}

function AppRoutes() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary font-sans">
      <Navbar />
      <main>
        <AnimatePresence mode="wait">
          <Routes>
            {/* Public */}
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Semi-public — works without auth but better with */}
            <Route path="/verify"    element={<VerifyPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* Auth required */}
            <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />

            {/* Admin only */}
            <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />

            {/* Default */}
            <Route path="/"  element={<Navigate to="/verify" replace />} />
            <Route path="*"  element={<Navigate to="/verify" replace />} />
          </Routes>
        </AnimatePresence>
      </main>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#111827',
            color: '#F9FAFB',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '13px',
          },
          success: { iconTheme: { primary: '#06D6A0', secondary: '#0A0F1C' } },
          error:   { iconTheme: { primary: '#EF476F', secondary: '#0A0F1C' } },
        }}
      />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
