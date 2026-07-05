import { useCallback, useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import {
  ArrowLeftRight,
  Gift,
  LayoutDashboard,
  LineChart,
  Moon,
  SlidersHorizontal,
  Sun,
  Trophy,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { api, fmt } from '@/api'
import TickerTape from '@/components/TickerTape'
import Dashboard from '@/pages/Dashboard'
import Holdings from '@/pages/Holdings'
import Transactions from '@/pages/Transactions'
import Dividends from '@/pages/Dividends'
import Stocks from '@/pages/Stocks'
import Screener from '@/pages/Screener'
import RankHistory from '@/pages/RankHistory'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/holdings', label: 'Holdings', icon: Wallet },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/dividends', label: 'Dividends', icon: Gift },
  { to: '/markets', label: 'Markets', icon: LineChart },
  { to: '/screener', label: 'Screener', icon: SlidersHorizontal },
  { to: '/ranks', label: 'Rank History', icon: Trophy },
]

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('nepse-theme') || 'dark')
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('nepse-theme', theme)
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between px-3 py-[7px]">
      <span className="text-xs text-[color:var(--muted)]">{label}</span>
      <span className="tnum text-xs font-semibold text-[color:var(--text2)]">{value}</span>
    </div>
  )
}

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const [summary, setSummary] = useState(null)
  const location = useLocation()

  // refresh the sidebar summary whenever the user navigates (edits reflect)
  const loadSummary = useCallback(() => {
    api
      .get('/dashboard')
      .then((d) => {
        const shares = d.holdings.reduce((a, h) => a + h.shares, 0)
        setSummary({ ...d.summary, total_shares: shares })
      })
      .catch(() => {})
  }, [])
  useEffect(loadSummary, [loadSummary, location.pathname])
  // also refresh after in-page mutations (dialogs don't change the route)
  useEffect(() => {
    window.addEventListener('portfolio:data-changed', loadSummary)
    return () => window.removeEventListener('portfolio:data-changed', loadSummary)
  }, [loadSummary])

  const navLinks = NAV.map(({ to, label, icon: Icon }) => (
    <NavLink key={to} to={to}>
      {({ isActive }) => (
        <span className="side-item" data-active={isActive}>
          <Icon className="size-4 shrink-0" strokeWidth={2} />
          {label}
        </span>
      )}
    </NavLink>
  ))

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ===== FULL-WIDTH PRICE TAPE ===== */}
      <TickerTape />

      <div className="flex flex-1">
      {/* ===== SIDEBAR (desktop) ===== */}
      <aside className="sticky top-9 hidden h-[calc(100dvh-2.25rem)] w-[218px] shrink-0 flex-col border-r bg-[color:var(--panel)] lg:flex xl:w-[18%] xl:max-w-[300px]">
        <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#2563eb] to-[#1d4ed8]">
            <TrendingUp className="size-5 text-white" strokeWidth={2.4} />
          </span>
          <span className="text-[15px] font-bold tracking-[0.5px]">NEPSE_T</span>
        </div>

        <nav className="flex flex-col gap-0.5 px-3" aria-label="Main navigation">
          {navLinks}
        </nav>

        <div className="mt-6 px-3">
          <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[1.2px] text-[color:var(--muted)]">
            Portfolio summary
          </p>
          {summary ? (
            <div>
              <SummaryRow label="Total Stocks" value={summary.stocks_count} />
              <SummaryRow label="Total Holdings" value={summary.holdings_count} />
              <SummaryRow label="Total Shares" value={fmt.qty(summary.total_shares)} />
              <SummaryRow label="Account Value" value={`NPR ${fmt.money(summary.current_value)}`} />
            </div>
          ) : (
            <p className="px-3 py-2 text-xs text-[color:var(--muted)]">—</p>
          )}
        </div>

        <div className="mt-auto px-3 pb-4">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-2 rounded-[8px] border px-3 py-2 text-xs font-medium text-[color:var(--text2)] transition-colors hover:bg-[color:var(--hover)]"
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
            {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
          <div className="mt-4 flex items-center gap-2.5 border-t pt-4">
            <span className="flex size-9 items-center justify-center rounded-full bg-[color:var(--warn)]/90 text-sm font-bold text-[#131722]">
              S
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">Saugat</span>
              <span className="block truncate text-[11px] text-[color:var(--muted)]">Personal Portfolio</span>
            </span>
          </div>
        </div>
      </aside>

      {/* ===== MAIN COLUMN ===== */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* compact top bar on small screens */}
        <header className="sticky top-9 z-20 border-b bg-[color:var(--panel)] lg:hidden">
          <div className="flex h-12 items-center gap-3 px-4">
            <span className="flex size-7 items-center justify-center rounded-[8px] bg-gradient-to-br from-[#2563eb] to-[#1d4ed8]">
              <TrendingUp className="size-4 text-white" strokeWidth={2.4} />
            </span>
            <span className="text-sm font-bold">NEPSE_T</span>
            <button
              onClick={toggleTheme}
              className="ml-auto rounded-[8px] border p-1.5 text-[color:var(--text2)]"
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
            </button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Main navigation">
            {NAV.map(({ to, label }) => (
              <NavLink key={to} to={to}>
                {({ isActive }) => (
                  <span
                    className="side-item whitespace-nowrap !w-auto px-3 py-1.5 text-xs"
                    data-active={isActive}
                  >
                    {label}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="w-full flex-1 px-4 pb-14 pt-5 sm:px-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard onDataChange={loadSummary} />} />
            <Route path="/holdings" element={<Holdings />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/dividends" element={<Dividends />} />
            <Route path="/markets" element={<Stocks />} />
            <Route path="/screener" element={<Screener />} />
            <Route path="/ranks" element={<RankHistory />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
      </div>
      <Toaster position="top-right" richColors theme={theme} />
    </div>
  )
}
