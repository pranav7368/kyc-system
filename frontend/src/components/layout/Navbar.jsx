import { Link, useLocation } from 'react-router-dom'
import { ShieldCheck, LayoutDashboard, History, Menu, X } from 'lucide-react'
import { useState } from 'react'
import ThemeToggle from './ThemeToggle'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/verify',    label: 'Verify',    icon: ShieldCheck },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/history',   label: 'History',   icon: History },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 select-none">
          <div className="w-7 h-7 rounded-lg bg-accent-primary/20 border border-accent-primary/40 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-accent-primary" />
          </div>
          <span className="font-mono font-bold text-sm tracking-widest gradient-text">CIPHER</span>
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
        </div>
      )}
    </header>
  )
}
