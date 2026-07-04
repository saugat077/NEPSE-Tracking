import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import {
  ArrowLeftRight,
  Banknote,
  Briefcase,
  LayoutDashboard,
  LineChart,
  ListOrdered,
  SearchCheck,
  TrendingUp,
} from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import Dashboard from '@/pages/Dashboard'
import Transactions from '@/pages/Transactions'
import Holdings from '@/pages/Holdings'
import Stocks from '@/pages/Stocks'
import Dividends from '@/pages/Dividends'
import Screener from '@/pages/Screener'
import RankHistory from '@/pages/RankHistory'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/holdings', label: 'Holdings', icon: Briefcase },
  { to: '/stocks', label: 'Stocks & Prices', icon: LineChart },
  { to: '/dividends', label: 'Dividends', icon: Banknote },
  { to: '/screener', label: 'Bank Screener', icon: SearchCheck },
  { to: '/rank-history', label: 'Rank History', icon: ListOrdered },
]

export default function App() {
  return (
    <div className="flex min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#50b0ff] to-[#2789d8] text-white shadow-[0_0_18px_rgba(80,176,255,0.35)]">
            <TrendingUp className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-mono text-sm font-semibold tracking-wide text-white">NEPSE</p>
            <p className="text-xs text-sidebar-foreground">Portfolio Tracker</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Main navigation">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'hover:bg-sidebar-accent/60 hover:text-white',
                )
              }
            >
              <Icon className="size-4.5 shrink-0" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="label-mono px-5 py-4">BS · Bikram Sambat dates</p>
      </aside>

      {/* Mobile top nav */}
      <div className="fixed inset-x-0 top-0 z-20 flex items-center gap-1 overflow-x-auto border-b bg-sidebar px-2 py-2 md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium',
                isActive
                  ? 'bg-sidebar-accent text-white'
                  : 'text-sidebar-foreground hover:text-white',
              )
            }
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </div>

      <main className="min-w-0 flex-1 px-4 pb-12 pt-16 md:ml-60 md:px-8 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/holdings" element={<Holdings />} />
            <Route path="/stocks" element={<Stocks />} />
            <Route path="/dividends" element={<Dividends />} />
            <Route path="/screener" element={<Screener />} />
            <Route path="/rank-history" element={<RankHistory />} />
          </Routes>
        </div>
      </main>
      <Toaster position="top-right" richColors />
    </div>
  )
}
