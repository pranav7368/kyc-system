import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck, LayoutDashboard, History, Menu, X, LogOut, User, Shield } from 'lucide-react'
import { useState } from 'react'
import ThemeToggle from './ThemeToggle'
import clsx from 'clsx'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function Navbar() {
  const { pathname }         = useLocation()
  const navigate             = useNavigate()
  const { user, logout, isAdmin } = useAuth()
  const [open, setOpen]      = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const NAV_ITEMS = [
    { to: '/verify',    label: 'Verify',    icon: ShieldCheck,     show: true },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { to: '/history',   label: 'History',   icon: History,         show: !!user },
    { to: '/admin',     label: 'Admin',     icon: Shield,          show: isAdmin },
  ].filter((i) => i.show)

  const handleLogout = () => {
    logout()
    setShowUserMenu(false)
    toast.success('Signed out')
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 select-none">
          <div className="w-7 h-7 rounded-lg bg-accent-primary/20 border border-accent-primary/40 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-accent-primary" />
          </div>
          <span className="font-mono font-bold text-sm tracking-widest gradient-text">AI</span>
          <span className="text-xs text-gray-500 font-mono tracking-wider hidden sm:block">KYC</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-200',
                pathname === to
                  ? 'bg-accent-primary/15 text-accent-primary'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/[0.05] transition"
              >
                <div className="w-6 h-6 rounded-full bg-accent-primary/30 flex items-center justify-center text-xs font-bold text-accent-primary">
                  {user.username[0].toUpperCase()}
                </div>
                <span className="hidden sm:block max-w-[80px] truncate">{user.username}</span>
                {isAdmin && <Shield className="w-3 h-3 text-yellow-400" />}
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-bg-secondary border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-sm font-medium truncate">{user.full_name || user.username}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${
                      isAdmin ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>{user.role}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30 transition"
            >
              <User className="w-3.5 h-3.5" />
              Sign In
            </Link>
          )}

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-gray-400 hover:text-white"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/[0.06] bg-bg-secondary px-4 py-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm mb-1',
                pathname === to
                  ? 'bg-accent-primary/15 text-accent-primary'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
          {user && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-red-400 w-full mt-1"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          )}
        </div>
      )}
    </header>
  )
}
