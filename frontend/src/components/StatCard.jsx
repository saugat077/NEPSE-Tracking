import { cn } from '@/lib/utils'

/**
 * Terminal stat cell — flat panel tile for the 1px-gap stat grid.
 * `tone` 'auto' colors the value by sign of rawValue; 'dim' mutes it.
 */
export default function StatCard({ label, value, sub, tone = 'neutral', rawValue = 0 }) {
  const valueClass =
    tone === 'auto' ? (rawValue > 0 ? 'up' : rawValue < 0 ? 'down' : '') : tone === 'dim' ? 'text-[color:var(--text2)]' : ''
  return (
    <div className="bg-[color:var(--panel)] px-3.5 py-3">
      <div className="tlabel mb-1.5">{label}</div>
      <div className={cn('tnum truncate font-mono text-base font-semibold tracking-[0.3px]', valueClass)}>
        {value}
      </div>
      <div className="tnum mt-[3px] min-h-3 font-mono text-[10px] uppercase text-[color:var(--muted)]">
        {sub || ''}
      </div>
    </div>
  )
}
