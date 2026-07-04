import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Dashboard stat tile. `tone` colors the value: 'auto' colors by sign,
 * 'neutral' leaves it in foreground color.
 */
export default function StatCard({ label, value, sub, icon: Icon, tone = 'neutral', rawValue = 0 }) {
  const signClass =
    tone === 'auto'
      ? rawValue > 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : rawValue < 0
          ? 'text-red-600 dark:text-red-400'
          : ''
      : ''
  return (
    <Card className="lift">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="label-mono">{label}</p>
          <p className={cn('tnum mt-2 truncate font-mono text-2xl font-medium', signClass)}>
            {value}
          </p>
          {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
        </div>
        {Icon ? (
          <div className="rounded-md bg-accent p-2 text-accent-foreground">
            <Icon className="size-5" aria-hidden="true" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
