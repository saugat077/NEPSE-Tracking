import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarClock,
  CircleCheck,
  Coins,
  Gift,
  LineChart,
  Plus,
  Receipt,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, fmt } from '@/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import PortfolioChart from '@/components/PortfolioChart'
import UpdatePricesDialog from '@/components/UpdatePricesDialog'

const SERIES_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899', '#eab308']

const avatarColor = (symbol) => {
  let h = 0
  for (const c of symbol) h = (h * 31 + c.charCodeAt(0)) % 997
  return SERIES_COLORS[h % SERIES_COLORS.length]
}

function signed(v, text) {
  return `${v >= 0 ? '+' : ''}${text}`
}

function StockAvatar({ symbol, size = 'size-8 text-[11px]' }) {
  const c = avatarColor(symbol)
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full font-bold', size)}
      style={{ background: `${c}26`, color: c }}
    >
      {symbol.slice(0, 2)}
    </span>
  )
}

function DeltaBadge({ pct, className }) {
  if (pct == null) return <span className="text-xs text-[color:var(--muted)]">—</span>
  const up = pct >= 0
  return (
    <span className={cn('tnum text-xs font-semibold', up ? 'up' : 'down', className)}>
      {up ? '▲' : '▼'} {signed(pct, fmt.pct(Math.abs(pct)))}
    </span>
  )
}

function KpiCard({ icon: Icon, color, label, value, delta, deltaLabel, sub }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2.5">
        <span className="kpi-tile" style={{ background: `${color}1f`, color }}>
          <Icon className="size-[18px]" strokeWidth={2} />
        </span>
        <span className="text-xs font-medium leading-tight text-[color:var(--muted)]">{label}</span>
      </div>
      <p className="tnum mt-3 truncate text-[17px] font-bold tracking-[-0.2px]">{value}</p>
      <div className="mt-1.5 flex min-h-4 items-center gap-2">
        {delta !== undefined ? <DeltaBadge pct={delta} /> : null}
        {sub ? <span className="text-xs text-[color:var(--muted)]">{sub}</span> : null}
        {delta != null && deltaLabel ? (
          <span className="text-[10px] font-medium uppercase tracking-[0.4px] text-[color:var(--muted)]">
            {deltaLabel}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function Sparkline({ series, positive }) {
  if (series.length < 2) return null
  const ys = series.map((s) => s.value)
  const min = Math.min(...ys)
  const max = Math.max(...ys)
  const span = max - min || 1
  const pts = series.map((s, i) => `${(i / (series.length - 1)) * 100},${28 - ((s.value - min) / span) * 26}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-24" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={positive ? 'var(--up)' : 'var(--down)'}
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function arcPath(cx, cy, r, a0, a1) {
  const rad = (a) => ((a - 90) * Math.PI) / 180
  const x0 = cx + r * Math.cos(rad(a0))
  const y0 = cy + r * Math.sin(rad(a0))
  const x1 = cx + r * Math.cos(rad(a1))
  const y1 = cy + r * Math.sin(rad(a1))
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`
}

/** SVG donut — one stroke arc per slice so each segment gets a native hover tooltip. */
function DonutChart({ rows, center }) {
  let acc = 0
  const segs = rows
    .map((r, i) => {
      const a0 = acc
      acc += (r.pct / 100) * 360
      // cap just under 360° — a full-circle arc collapses to a point in SVG
      return { ...r, a0, a1: a0 + Math.min((r.pct / 100) * 360, 359.98), color: SERIES_COLORS[i % SERIES_COLORS.length] }
    })
    .filter((s) => s.a1 - s.a0 > 0.05)
  return (
    <div className="relative size-32 shrink-0">
      <svg viewBox="0 0 128 128" className="size-full">
        {segs.map((s) => (
          <path
            key={s.name}
            d={arcPath(64, 64, 52, s.a0, s.a1)}
            fill="none"
            stroke={s.color}
            strokeWidth="21"
            className="cursor-pointer transition-opacity hover:opacity-70"
          >
            <title>{`${s.name}: ${fmt.pct(s.pct)} — NPR ${fmt.money(s.value)}`}</title>
          </path>
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-[24px] flex flex-col items-center justify-center text-center">
        {center}
      </div>
    </div>
  )
}

/** Donut + 4-column breakdown (name / holding value / allocation / unrealized gain). */
function Donut({ title, label, rows, center, footer }) {
  const th =
    'whitespace-nowrap pb-2 pl-3 text-right text-[10px] font-semibold uppercase tracking-[0.4px] text-[color:var(--muted)]'
  const td = 'tnum whitespace-nowrap border-t border-[color:var(--border-soft)] py-2.5 pl-3 text-right'
  return (
    <section className="panel flex flex-col">
      <h2 className="panel-head">{title}</h2>
      {rows.length ? (
        <>
          <div className="flex flex-1 flex-col items-center gap-5 px-5 py-4 sm:flex-row sm:items-start">
            <div className="flex shrink-0 justify-center self-center sm:w-32">
              <DonutChart rows={rows} center={center} />
            </div>
            <div className="max-h-[228px] w-full min-w-0 flex-1 overflow-auto">
              <table className="w-full text-[12.5px]">
                <thead className="sticky top-0 z-[1] bg-[color:var(--panel)]">
                  <tr>
                    <th className={cn(th, 'text-left')}>{label}</th>
                    <th className={th}>Holding <br/>Value</th>
                    <th className={th}>Allocation</th>
                    <th className={cn(th, 'pr-2')}>Unrealized <br/>Gain</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.name}>
                      <td className="whitespace-nowrap border-t border-[color:var(--border-soft)] py-2.5">
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                          />
                          <span className="font-semibold">{r.name}</span>
                        </span>
                      </td>
                      <td className={td}>
                        {fmt.money(r.value)}
                      </td>
                      <td className={cn(td, 'font-semibold')}>{fmt.pct(r.pct)}</td>
                      <td className={cn(td, 'pr-2 font-semibold', r.gain > 0 ? 'up' : r.gain < 0 ? 'down' : 'text-[color:var(--muted)]')}>
                        {signed(r.gain, fmt.money(r.gain))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {footer}
        </>
      ) : (
        <p className="px-5 py-10 text-center text-sm text-[color:var(--muted)]">No holdings yet</p>
      )}
    </section>
  )
}

export default function Dashboard({ onDataChange }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [series, setSeries] = useState([])
  const [stocks, setStocks] = useState([])
  const [pricesOpen, setPricesOpen] = useState(false)

  const load = useCallback(() => {
    Promise.all([api.get('/dashboard'), api.get('/history'), api.get('/stocks')])
      .then(([d, h, s]) => {
        setData(d)
        setSeries(h)
        setStocks(s)
      })
      .catch((e) => toast.error(e.message))
  }, [])
  useEffect(load, [load])

  const derived = useMemo(() => {
    if (!data) return null
    const active = data.holdings
    const withReturn = active.filter((h) => h.invested > 0)
    const best = withReturn.length ? withReturn.reduce((a, b) => (b.return_pct > a.return_pct ? b : a)) : null
    const worst = withReturn.length ? withReturn.reduce((a, b) => (b.return_pct < a.return_pct ? b : a)) : null

    const bySector = {}
    for (const h of active) {
      const key = (h.sector || 'Other').trim() || 'Other'
      bySector[key] = bySector[key] || { value: 0, gain: 0 }
      bySector[key].value += h.current_value
      bySector[key].gain += h.unrealized_pl
    }
    const totalValue = data.summary.current_value
    const sectors = Object.entries(bySector)
      .sort((a, b) => b[1].value - a[1].value)
      .map(([name, x]) => ({
        name,
        value: x.value,
        gain: x.gain,
        pct: totalValue > 0 ? (x.value / totalValue) * 100 : 0,
      }))

    const byValue = [...active].sort((a, b) => b.current_value - a.current_value)
    const assets = byValue.map((h) => ({
      name: h.symbol,
      value: h.current_value,
      gain: h.unrealized_pl,
      pct: h.weight_pct,
    }))

    const lastUpdated = stocks.map((s) => s.price_updated).filter(Boolean).sort().at(-1) || null
    return { best, worst, sectors, assets, lastUpdated, byValue }
  }, [data, stocks])

  if (!data || !derived) return <p className="text-sm text-[color:var(--muted)]">Loading…</p>

  const s = data.summary
  const yieldOnCost = s.invested > 0 ? (s.dividends_net / s.invested) * 100 : 0
  const realizedPct = s.invested > 0 ? (s.realized_pl / s.invested) * 100 : null
  const holdings = data.holdings

  const refresh = () => {
    load()
    onDataChange?.()
  }

  const kpis = [
    {
      icon: Wallet,
      color: '#3b82f6',
      label: 'Portfolio Value',
      value: `NPR ${fmt.money(s.current_value)}`,
      delta: s.day_change_pct,
      deltaLabel: 'today',
    },
    { icon: Coins, color: '#8b5cf6', label: 'Total Investment', value: `NPR ${fmt.money(s.invested)}` },
    {
      icon: TrendingUp,
      color: '#22c55e',
      label: 'Unrealized P&L',
      value: `NPR ${fmt.money(s.unrealized_pl)}`,
      delta: holdings.length ? s.unrealized_return_pct : undefined,
      deltaLabel: 'vs invested',
    },
    {
      icon: LineChart,
      color: '#14b8a6',
      label: 'Realized P&L',
      value: `NPR ${fmt.money(s.realized_pl)}`,
      delta: s.realized_pl ? realizedPct : undefined,
      deltaLabel: 'of invested',
    },
    { icon: Gift, color: '#f59e0b', label: 'Dividends Received', value: `NPR ${fmt.money(s.dividends_net)}` },
    { icon: Receipt, color: '#ef4444', label: 'Fees Paid', value: `NPR ${fmt.money(s.fees_paid)}` },
  ]

  const topSector = derived.sectors[0] || null

  return (
    <div className="xl:flex">
      {/* ============ MAIN COLUMN ============ */}
      <div className="min-w-0 flex-1 xl:pr-5">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.3px]">Portfolio Overview</h1>
            <p className="mt-0.5 flex items-center gap-2 text-[12.5px] text-[color:var(--muted)]">
              Last updated: {derived.lastUpdated ? `BS ${derived.lastUpdated}` : 'never'}
              <button onClick={refresh} aria-label="Refresh data" className="text-[color:var(--muted)] hover:text-[color:var(--text)]">
                <RefreshCw className="size-3.5" />
              </button>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/transactions?add=1')}>
              <Plus className="size-4" /> Add
            </Button>
            <Button onClick={() => setPricesOpen(true)}>
              <RefreshCw className="size-4" /> Update Prices
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
          {kpis.map((k) => (
            <KpiCard key={k.label} {...k} />
          ))}
        </div>

        {/* stats strip */}
        <div className="panel mt-4 grid grid-cols-2 divide-y divide-[color:var(--border-soft)] md:grid-cols-3 md:divide-x xl:grid-cols-6 xl:divide-y-0">
          <div className="px-4 py-3.5">
            <p className="tlabel">Today&apos;s Change</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <span>
                <span className={cn('tnum block text-sm font-bold', s.day_change == null ? '' : s.day_change >= 0 ? 'up' : 'down')}>
                  {s.day_change == null ? '—' : signed(s.day_change, `NPR ${fmt.money(Math.abs(s.day_change))}`)}
                </span>
                <DeltaBadge pct={s.day_change_pct} className="!text-[11px]" />
              </span>
              <Sparkline series={series.slice(-12)} positive={(s.day_change ?? 0) >= 0} />
            </div>
          </div>
          <div className="px-4 py-3.5">
            <p className="tlabel">All Time Return</p>
            <p className={cn('tnum mt-1 text-sm font-bold', s.total_return >= 0 ? 'up' : 'down')}>
              {signed(s.total_return_pct, fmt.pct(s.total_return_pct))}
            </p>
            <p className="tnum mt-0.5 text-[11px] text-[color:var(--muted)]">
              (NPR {fmt.money(s.total_return)})
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="tlabel">Yield on Cost</p>
            <p className="tnum mt-1 text-sm font-bold">{fmt.pct(yieldOnCost)}</p>
            <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">net dividends / invested</p>
          </div>
          <div className="px-4 py-3.5">
            <p className="tlabel">Best Performer</p>
            <p className="mt-1 text-sm font-bold">{derived.best?.symbol ?? '—'}</p>
            {derived.best && (
              <p>
                <DeltaBadge pct={derived.best.return_pct} className="!text-[11px]" />{' '}
                <span className="text-[10px] text-[color:var(--muted)]">all time</span>
              </p>
            )}
          </div>
          <div className="px-4 py-3.5">
            <p className="tlabel">Worst Performer</p>
            <p className="mt-1 text-sm font-bold">{derived.worst?.symbol ?? '—'}</p>
            {derived.worst && (
              <p>
                <DeltaBadge pct={derived.worst.return_pct} className="!text-[11px]" />{' '}
                <span className="text-[10px] text-[color:var(--muted)]">all time</span>
              </p>
            )}
          </div>
          <div className="px-4 py-3.5">
            <p className="tlabel">Top Sector</p>
            <p className="mt-1 truncate text-sm font-bold">{topSector?.name ?? '—'}</p>
            {topSector && <p className="tnum mt-0.5 text-[11px] text-[color:var(--muted)]">{fmt.pct(topSector.pct)} of value</p>}
          </div>
        </div>

        {/* allocations */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Donut
            title="Asset Allocation"
            label="Asset"
            rows={derived.assets}
            center={
              <>
                <span className="tnum text-lg font-bold">{holdings.length}</span>
                <span className="text-[10px] text-[color:var(--muted)]">{holdings.length === 1 ? 'Holding' : 'Holdings'}</span>
              </>
            }
          />
          <Donut
            title="Sector Allocation"
            label="Sector"
            rows={derived.sectors}
            center={
              <>
                <span className="tnum text-lg font-bold">{derived.sectors.length}</span>
                <span className="text-[10px] text-[color:var(--muted)]">{derived.sectors.length === 1 ? 'Sector' : 'Sectors'}</span>
              </>
            }
          />
        </div>

        {/* holdings preview */}
        <section className="panel mt-4 overflow-hidden">
          <h2 className="panel-head">
            Holdings <span className="text-[color:var(--muted)]">({holdings.length})</span>
          </h2>
          {holdings.length ? (
            <>
              <div className="max-h-[312px] overflow-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="sticky top-0 z-[1] bg-[color:var(--panel)]">
                    <tr className="text-left text-[11px] text-[color:var(--muted)]">
                      <th className="px-4 py-2.5 font-medium">Stock</th>
                      <th className="px-3 py-2.5 text-right font-medium">Shares</th>
                      <th className="px-3 py-2.5 text-right font-medium">Avg. Cost (NPR)</th>
                      <th className="px-3 py-2.5 text-right font-medium">LTP (NPR)</th>
                      <th className="px-3 py-2.5 text-right font-medium">Market Value (NPR)</th>
                      <th className="px-3 py-2.5 text-right font-medium">P&amp;L (NPR)</th>
                      <th className="px-3 py-2.5 text-right font-medium">P&amp;L (%)</th>
                      <th className="px-4 py-2.5 text-right font-medium">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {derived.byValue.map((h) => (
                      <tr key={h.stock_id} className="border-t border-[color:var(--border-soft)] hover:bg-[color:var(--hover)]">
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2.5">
                            <StockAvatar symbol={h.symbol} />
                            <span className="min-w-0">
                              <span className="block font-semibold">{h.symbol}</span>
                              <span className="block truncate text-[11px] text-[color:var(--muted)]">{h.company}</span>
                            </span>
                          </span>
                        </td>
                        <td className="tnum px-3 py-2.5 text-right">{fmt.qty(h.shares)}</td>
                        <td className="tnum px-3 py-2.5 text-right text-[color:var(--text2)]">{fmt.money(h.avg_cost)}</td>
                        <td className="tnum px-3 py-2.5 text-right">{fmt.money(h.current_price)}</td>
                        <td className="tnum px-3 py-2.5 text-right">{fmt.money(h.current_value)}</td>
                        <td className={cn('tnum px-3 py-2.5 text-right font-semibold', h.unrealized_pl >= 0 ? 'up' : 'down')}>
                          {signed(h.unrealized_pl, fmt.money(h.unrealized_pl))}
                        </td>
                        <td className={cn('tnum px-3 py-2.5 text-right font-semibold', h.return_pct >= 0 ? 'up' : 'down')}>
                          {signed(h.return_pct, fmt.pct(h.return_pct))}
                        </td>
                        <td className="tnum px-4 py-2.5 text-right text-[color:var(--text2)]">{fmt.pct(h.weight_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link
                to="/holdings"
                className="flex items-center justify-center gap-1.5 border-t border-[color:var(--border-soft)] py-3 text-[13px] font-medium text-[color:var(--accent-2)] hover:bg-[color:var(--hover)]"
              >
                View all holdings <ArrowRight className="size-4" />
              </Link>
            </>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-[color:var(--muted)]">
              No holdings yet — add stocks in Markets, then record transactions.
            </p>
          )}
        </section>

        {/* performance chart */}
        <div className="panel mt-4 pb-0">
          <PortfolioChart series={series} />
        </div>

        <p className="mt-4 text-[11.5px] text-[color:var(--muted)]">
          All values are in NPR. Prices are manually updated. Not real-time.
        </p>
      </div>

      {/* ============ RIGHT RAIL (full-height divider like the sidebar) ============ */}
      <div className="w-full shrink-0 xl:w-1/4 xl:min-w-[280px] xl:max-w-[360px] xl:border-l xl:pl-5">
        <aside className="mt-5 space-y-4 xl:sticky xl:top-[3.5rem] xl:mt-0 xl:max-h-[calc(100dvh-4.75rem)] xl:overflow-y-auto">
        {/* my stocks (current holdings, manual rates) */}
        <section className="panel">
          <div className="flex items-center justify-between px-4 pt-3.5">
            <h2 className="text-[13.5px] font-semibold">My Stocks</h2>
            <Link to="/holdings" className="text-xs font-medium text-[color:var(--accent-2)] hover:underline">
              View all
            </Link>
          </div>
          <p className="px-4 pb-1 text-[10.5px] text-[color:var(--muted)]">LTP · change today</p>
          <ul className="max-h-[340px] overflow-y-auto">
            {derived.byValue.map((h) => (
              <li key={h.stock_id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-[color:var(--hover)]">
                <StockAvatar symbol={h.symbol} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">{h.symbol}</span>
                  <span className="block truncate text-[11px] text-[color:var(--muted)]">{h.company}</span>
                </span>
                <span className="text-right">
                  <span className="tnum block text-[13px] font-semibold">{fmt.money(h.current_price)}</span>
                  <DeltaBadge pct={h.day_change_pct} className="!text-[10.5px]" />
                </span>
              </li>
            ))}
            {!holdings.length && (
              <li className="px-4 py-6 text-center text-xs text-[color:var(--muted)]">No holdings yet</li>
            )}
          </ul>
          <Link
            to="/markets"
            className="flex items-center justify-center gap-1 border-t border-[color:var(--border-soft)] py-2.5 text-[12.5px] font-medium text-[color:var(--accent-2)] hover:bg-[color:var(--hover)]"
          >
            <Plus className="size-3.5" /> Add Stock
          </Link>
        </section>

        {/* manual price update */}
        <section className="panel p-4">
          <h2 className="flex items-center gap-2 text-[13.5px] font-semibold">
            <CalendarClock className="size-4 text-[color:var(--accent-2)]" /> Manual Price Update
          </h2>
          <div className="mt-3 flex items-center justify-between">
            <span>
              <span className="block text-xs text-[color:var(--muted)]">Last updated</span>
              <span className="block text-[13px] font-semibold">
                {derived.lastUpdated ? `BS ${derived.lastUpdated}` : 'Never'}
              </span>
            </span>
            {derived.lastUpdated && <CircleCheck className="size-5 text-[color:var(--up)]" />}
          </div>
          <Button className="mt-3 w-full" onClick={() => setPricesOpen(true)}>
            Update Prices
          </Button>
          <p className="mt-3 text-[11px] leading-relaxed text-[color:var(--muted)]">
            Rates are entered manually — update them to refresh portfolio values, day change and history.
          </p>
        </section>

        </aside>
      </div>

      <UpdatePricesDialog open={pricesOpen} onOpenChange={setPricesOpen} stocks={stocks} onSaved={refresh} />
    </div>
  )
}
