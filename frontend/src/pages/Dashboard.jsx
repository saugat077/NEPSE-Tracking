import { useEffect, useState } from 'react'
import {
  Banknote,
  Briefcase,
  Coins,
  Percent,
  PiggyBank,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { api, fmt } from '@/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StatCard from '@/components/StatCard'

// DESIGN.md blue-led categorical palette; green/red reserved for P&L semantics
const CHART_COLORS = ['#50b0ff', '#2789d8', '#8b7cf8', '#34d399', '#f59e0b', '#f472b6', '#22d3ee']
const AXIS_TICK = { fontSize: 12, fill: '#a1a1aa' }

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      {label ? <p className="mb-1 font-medium">{label}</p> : null}
      {payload.map((p) => (
        <p key={p.name} className="tnum font-mono" style={{ color: p.color || p.payload?.fill }}>
          {p.name}: {fmt.money(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/dashboard').then(setData).catch((e) => toast.error(e.message))
  }, [])

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>

  const { summary: s, allocation, holdings } = data
  const plData = holdings.map((h) => ({ symbol: h.symbol, 'P&L': h.unrealized_pl }))
  const investedVsValue = holdings.map((h) => ({
    symbol: h.symbol,
    Invested: h.invested,
    Value: h.current_value,
  }))

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-medium leading-tight tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {s.holdings_count} active holdings · {s.transactions_count} transactions ·{' '}
          {s.dividends_count} dividends recorded
        </p>
      </div>

      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Capital Invested" value={`Rs ${fmt.money(s.invested)}`} icon={Wallet} />
        <StatCard label="Current Value" value={`Rs ${fmt.money(s.current_value)}`} icon={Briefcase} />
        <StatCard
          label="Unrealized P&L"
          value={`Rs ${fmt.money(s.unrealized_pl)}`}
          sub={fmt.pct(s.unrealized_return_pct)}
          icon={s.unrealized_pl >= 0 ? TrendingUp : TrendingDown}
          tone="auto"
          rawValue={s.unrealized_pl}
        />
        <StatCard
          label="Total Return"
          value={`Rs ${fmt.money(s.total_return)}`}
          sub={`${fmt.pct(s.total_return_pct)} incl. realized + dividends`}
          icon={Percent}
          tone="auto"
          rawValue={s.total_return}
        />
        <StatCard
          label="Realized P&L"
          value={`Rs ${fmt.money(s.realized_pl)}`}
          icon={Coins}
          tone="auto"
          rawValue={s.realized_pl}
        />
        <StatCard label="Dividends (net)" value={`Rs ${fmt.money(s.dividends_net)}`} icon={Banknote} />
        <StatCard label="Fees Paid" value={`Rs ${fmt.money(s.fees_paid)}`} icon={Receipt} />
        <StatCard label="Stocks Tracked" value={String(s.stocks_count)} icon={PiggyBank} />
      </div>

      {holdings.length ? (
        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Portfolio Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={allocation}
                    dataKey="value"
                    nameKey="symbol"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    label={({ symbol, weight_pct }) => `${symbol} ${weight_pct.toFixed(1)}%`}
                  >
                    {allocation.map((entry, i) => (
                      <Cell key={entry.symbol} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invested vs Current Value</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={investedVsValue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="symbol" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} width={70} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)' }} />
                  <Legend />
                  <Bar dataKey="Invested" fill="#71717a" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Value" fill="#50b0ff" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Unrealized P&L by Holding</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={plData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="symbol" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} width={70} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)' }} />
                  <Bar dataKey="P&L" radius={[3, 3, 0, 0]}>
                    {plData.map((d) => (
                      <Cell key={d.symbol} fill={d['P&L'] >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed bg-card px-6 py-14 text-center">
          <p className="font-medium">Your portfolio is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add stocks and record transactions — charts and stats appear automatically.
          </p>
        </div>
      )}
    </>
  )
}
