import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, fmt } from '@/api'

/**
 * Bloomberg-style scrolling price tape. Prices are the manually entered LTPs;
 * change is vs the previous manual update (prev_price). Pauses on hover.
 */
export default function TickerTape() {
  const [stocks, setStocks] = useState([])
  const location = useLocation()

  // re-fetch on navigation and after any mutation so price updates show up
  useEffect(() => {
    const loadStocks = () =>
      api
        .get('/stocks')
        .then((rows) => setStocks(rows.filter((s) => s.current_price > 0)))
        .catch(() => {})
    loadStocks()
    window.addEventListener('portfolio:data-changed', loadStocks)
    return () => window.removeEventListener('portfolio:data-changed', loadStocks)
  }, [location.pathname])

  if (!stocks.length) return null

  const items = stocks.map((s) => {
    const pct =
      s.prev_price > 0 && s.prev_price !== s.current_price
        ? ((s.current_price - s.prev_price) / s.prev_price) * 100
        : null
    return { ...s, pct }
  })

  // The loop slides the track by -50%, so each half must be wider than any
  // viewport or the wrap-around shows as a gap + reset. Repeat the list until
  // one half holds at least 30 entries (~4500px).
  const reps = Math.max(1, Math.ceil(30 / items.length))
  const half = Array.from({ length: reps }, (_, r) => r).flatMap((r) =>
    items.map((s) => ({ ...s, key: `${r}-${s.id}` })),
  )

  // ~5s of travel per symbol keeps the speed steady regardless of list size
  const duration = Math.max(20, half.length * 5)

  const Item = ({ s }) => (
    <span className="flex shrink-0 items-center gap-2 px-5">
      <span className="text-[11.5px] font-bold tracking-[0.5px]">{s.symbol}</span>
      <span className="tnum text-[11.5px] font-medium text-[color:var(--text2)]">
        {fmt.money(s.current_price)}
      </span>
      {s.pct != null ? (
        <span className={`tnum text-[11px] font-semibold ${s.pct >= 0 ? 'up' : 'down'}`}>
          {s.pct >= 0 ? '▲' : '▼'} {fmt.pct(Math.abs(s.pct))}
        </span>
      ) : (
        <span className="text-[11px] text-[color:var(--muted)]">—</span>
      )}
      <span aria-hidden className="ml-3 text-[color:var(--border)]">
        |
      </span>
    </span>
  )

  return (
    <div
      className="ticker-tape sticky top-0 z-30 flex h-9 items-center overflow-hidden border-b bg-[color:var(--panel)]"
      role="marquee"
      aria-label="Latest stock prices"
    >
      <div className="ticker-track" style={{ '--ticker-duration': `${duration}s` }}>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
            {half.map((s) => (
              <Item key={`${copy}-${s.key}`} s={s} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
