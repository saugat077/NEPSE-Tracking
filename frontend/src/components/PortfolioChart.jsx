import { useMemo, useRef, useState } from 'react'
import { fmt } from '@/api'
import { cn } from '@/lib/utils'

const PERIODS = [
  { key: '1M', months: 1, label: '1 month' },
  { key: '3M', months: 3, label: '3 months' },
  { key: '6M', months: 6, label: '6 months' },
  { key: '1Y', months: 12, label: '1 year' },
  { key: 'ALL', months: null, label: 'All time' },
]

// BS dates are plain y-m-d text; subtracting months numerically is fine for cutoffs
function monthsBefore(bsDate, months) {
  const [y, m, d] = bsDate.split('-').map(Number)
  const total = y * 12 + (m - 1) - months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function periodReturn(series, mode) {
  if (series.length < 2) return null
  const first = series[0]
  const last = series[series.length - 1]
  if (mode === 'performance') {
    const a = first.invested > 0 ? (first.value / first.invested - 1) * 100 : 0
    const b = last.invested > 0 ? (last.value / last.invested - 1) * 100 : 0
    return b - a
  }
  return first.value > 0 ? (last.value / first.value - 1) * 100 : null
}

/** TradingView-style area chart of portfolio value / performance over BS dates. */
export default function PortfolioChart({ series }) {
  const [mode, setMode] = useState('value')
  const [period, setPeriod] = useState('ALL')
  const [hover, setHover] = useState(null) // index into visible points
  const boxRef = useRef(null)

  const visible = useMemo(() => {
    const p = PERIODS.find((x) => x.key === period)
    if (!p?.months || !series.length) return series
    const cutoff = monthsBefore(series[series.length - 1].date, p.months)
    const win = series.filter((s) => s.date >= cutoff)
    return win.length >= 2 ? win : series.slice(-2)
  }, [series, period])

  const points = useMemo(
    () =>
      visible.map((s) => ({
        ...s,
        y: mode === 'performance' ? (s.invested > 0 ? (s.value / s.invested - 1) * 100 : 0) : s.value,
      })),
    [visible, mode],
  )

  if (series.length < 2) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-[color:var(--muted)]">
        Not enough history yet — the chart grows as you record transactions and update prices.
      </div>
    )
  }

  const ys = points.map((p) => p.y)
  let min = Math.min(...ys)
  let max = Math.max(...ys)
  if (mode === 'performance') {
    min = Math.min(min, 0)
    max = Math.max(max, 0)
  }
  const pad = (max - min || Math.abs(max) || 1) * 0.08
  min -= pad
  max += pad
  const W = 1000
  const H = 100
  const X = (i) => (i / (points.length - 1)) * W
  const Y = (v) => H - ((v - min) / (max - min)) * H
  const line = points.map((p, i) => `${X(i)},${Y(p.y)}`).join(' ')
  const area = `${line} ${W},${H} 0,${H}`
  const ticks = [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3)

  const fmtY = (v) => (mode === 'performance' ? `${v.toFixed(2)}%` : fmt.money(v))

  const onMove = (e) => {
    const box = boxRef.current?.getBoundingClientRect()
    if (!box) return
    const frac = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))
    setHover(Math.round(frac * (points.length - 1)))
  }

  const h = hover != null ? points[hover] : null

  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-[13.5px] font-semibold">Portfolio Performance</h2>
        <div className="flex overflow-hidden rounded-[6px] border">
          {['value', 'performance'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium capitalize',
                m === mode
                  ? 'bg-[color:var(--hover)] text-[color:var(--text)]'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--text)]',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mx-4 mt-4 h-[240px]" ref={boxRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {/* gridlines + y labels */}
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0" style={{ top: `${(Y(t) / H) * 100}%` }}>
            <div className="border-t border-[color:var(--border-soft)]" />
            <span className="tnum absolute right-0 -translate-y-1/2 bg-[color:var(--panel)] pl-2 font-mono text-[10px] text-[color:var(--muted)]">
              {fmtY(t)}
            </span>
          </div>
        ))}
        {mode === 'performance' && (
          <div
            className="absolute inset-x-0 border-t border-dashed border-[color:var(--muted)]/50"
            style={{ top: `${(Y(0) / H) * 100}%` }}
          />
        )}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#areaFill)" />
          <polyline
            points={line}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
        {/* crosshair */}
        {h && (
          <>
            <div
              className="pointer-events-none absolute bottom-0 top-0 w-px bg-[color:var(--muted)]/60"
              style={{ left: `${(X(hover) / W) * 100}%` }}
            />
            <div
              className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#3b82f6] bg-[color:var(--panel)]"
              style={{ left: `${(X(hover) / W) * 100}%`, top: `${(Y(h.y) / H) * 100}%` }}
            />
            <div
              className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-[4px] border bg-[color:var(--panel2)] px-2 py-1 font-mono text-[10.5px]"
              style={{ left: `${(X(hover) / W) * 100}%` }}
            >
              <span className="text-[color:var(--muted)]">{h.date}</span>{' '}
              <span className="font-semibold">{mode === 'performance' ? `${h.y.toFixed(2)}%` : `Rs ${fmt.money(h.y)}`}</span>
            </div>
          </>
        )}
      </div>

      {/* x labels */}
      <div className="mx-4 mt-1 flex justify-between font-mono text-[10px] text-[color:var(--muted)]">
        <span>{points[0].date}</span>
        {points.length > 2 && <span>{points[Math.floor(points.length / 2)].date}</span>}
        <span>{points[points.length - 1].date}</span>
      </div>

      {/* period selector with window returns */}
      <div className="mt-3 grid grid-cols-5 border-t">
        {PERIODS.map((p) => {
          const win =
            p.months == null
              ? series
              : (() => {
                  const cutoff = monthsBefore(series[series.length - 1].date, p.months)
                  return series.filter((s) => s.date >= cutoff)
                })()
          const r = periodReturn(win, mode)
          return (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'flex flex-col items-center gap-0.5 border-b-2 px-2 py-2.5 text-xs font-medium',
                p.key === period
                  ? 'border-[color:var(--accent)] bg-[color:var(--hover)] text-[color:var(--text)]'
                  : 'border-transparent text-[color:var(--muted)] hover:text-[color:var(--text)]',
              )}
            >
              {p.label}
              <span className={cn('tnum font-mono text-[10.5px]', r == null ? '' : r >= 0 ? 'up' : 'down')}>
                {r == null ? '—' : `${r >= 0 ? '+' : ''}${r.toFixed(2)}%`}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
