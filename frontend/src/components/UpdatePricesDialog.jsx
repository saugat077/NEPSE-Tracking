import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api, fmt } from '@/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import BSDateInput, { isValidBSDate } from '@/components/BSDateInput'

/**
 * Bulk manual price update (ref.png "Update Prices" button).
 * One BS date for the batch; only stocks whose price actually changed are saved.
 */
export default function UpdatePricesDialog({ open, onOpenChange, stocks, onSaved }) {
  const [date, setDate] = useState('')
  const [prices, setPrices] = useState({})
  const [saving, setSaving] = useState(false)

  const rows = useMemo(
    () => [...stocks].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [stocks],
  )

  useEffect(() => {
    if (!open) return
    const init = {}
    for (const s of stocks) init[s.id] = s.current_price ? String(s.current_price) : ''
    setPrices(init)
    const dates = stocks.map((s) => s.price_updated).filter(Boolean).sort()
    setDate(dates[dates.length - 1] || '')
  }, [open, stocks])

  const changed = rows.filter((s) => {
    const v = parseFloat(prices[s.id])
    return !Number.isNaN(v) && v > 0 && v !== s.current_price
  })

  const save = async (e) => {
    e.preventDefault()
    if (!isValidBSDate(date)) {
      toast.error('Enter the BS price date, e.g. 2083-01-31')
      return
    }
    if (!changed.length) {
      toast.info('No prices changed')
      return
    }
    setSaving(true)
    try {
      for (const s of changed) {
        await api.put(`/stocks/${s.id}/price`, {
          current_price: parseFloat(prices[s.id]),
          price_updated: date,
        })
      }
      toast.success(`Updated ${changed.length} price${changed.length > 1 ? 's' : ''}`)
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update prices</DialogTitle>
          <DialogDescription>
            Enter today&apos;s LTP for each stock. Only changed prices are saved.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bulk-price-date">Price date (BS)</Label>
            <BSDateInput id="bulk-price-date" value={date} onChange={setDate} />
          </div>

          <div className="space-y-2">
            {rows.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-[13px] font-semibold">{s.symbol}</span>
                <span className="tnum w-20 shrink-0 text-right text-xs text-[color:var(--muted)]">
                  {s.current_price ? fmt.money(s.current_price) : '—'}
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  aria-label={`New price for ${s.symbol}`}
                  value={prices[s.id] ?? ''}
                  onChange={(e) => setPrices((p) => ({ ...p, [s.id]: e.target.value }))}
                  className="tnum text-right"
                />
              </div>
            ))}
            {!rows.length && (
              <p className="py-4 text-center text-sm text-[color:var(--muted)]">
                No stocks yet — add them in Markets first.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !rows.length}>
              {saving ? 'Saving…' : `Save${changed.length ? ` (${changed.length})` : ''}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
