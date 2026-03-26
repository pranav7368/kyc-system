import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import Navbar       from './components/layout/Navbar'
import VerifyPage   from './pages/VerifyPage'
import DashboardPage from './pages/DashboardPage'
import HistoryPage  from './pages/HistoryPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg-primary text-text-primary font-sans">
        <Navbar />
        <main>
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/"          element={<Navigate to="/verify" replace />} />
              <Route path="/verify"    element={<VerifyPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/history"   element={<HistoryPage />} />
              <Route path="*"          element={<Navigate to="/verify" replace />} />
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
    </BrowserRouter>
  )
}
