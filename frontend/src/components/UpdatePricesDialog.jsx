import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api, fmt, notifyDataChanged } from '@/api'
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
  const inited = useRef(false)

  const rows = useMemo(
    () => [...stocks].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [stocks],
  )

  // Initialise once per open. A background stocks reload (e.g. after a partial
  // save) must not re-run this and wipe the user's in-progress edits. The date
  // starts empty on purpose — pre-filling the last date risks overwriting a
  // prior day's price_history snapshot via the (stock_id, date) upsert.
  useEffect(() => {
    if (!open) {
      inited.current = false
      return
    }
    if (inited.current || !stocks.length) return
    inited.current = true
    const init = {}
    for (const s of stocks) init[s.id] = s.current_price ? String(s.current_price) : ''
    setPrices(init)
    setDate('')
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
    const batch = changed
    let saved = 0
    let failure = null
    for (const s of batch) {
      try {
        await api.put(`/stocks/${s.id}/price`, {
          current_price: parseFloat(prices[s.id]),
          price_updated: date,
        })
        saved += 1
      } catch (err) {
        failure = { symbol: s.symbol, message: err.message }
        break
      }
    }
    setSaving(false)
    // refresh the app for whatever committed, even on partial failure
    if (saved > 0) {
      notifyDataChanged()
      onSaved?.()
    }
    if (failure) {
      // keep the dialog open so the user can retry the rows that didn't save
      toast.error(`Saved ${saved} of ${batch.length} — ${failure.symbol} failed: ${failure.message}`)
    } else {
      toast.success(`Updated ${saved} price${saved > 1 ? 's' : ''}`)
      onOpenChange(false)
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
