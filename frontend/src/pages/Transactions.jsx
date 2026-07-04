import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, fmt } from '@/api'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import BSDateInput, { isValidBSDate } from '@/components/BSDateInput'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import { cn } from '@/lib/utils'

const TYPES = ['BUY', 'SELL', 'BONUS', 'RIGHT', 'IPO']
const TYPE_BADGE = {
  BUY: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  SELL: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  BONUS: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  RIGHT: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  IPO: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
}

const EMPTY_FORM = { date: '', stock_id: '', type: 'BUY', quantity: '', price: '', notes: '' }

export default function Transactions() {
  const [txns, setTxns] = useState([])
  const [stocks, setStocks] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const isBonus = form.type === 'BONUS'
  const hasBrokerFees = form.type === 'BUY' || form.type === 'SELL'

  const load = () =>
    Promise.all([api.get('/transactions'), api.get('/stocks')])
      .then(([t, s]) => {
        setTxns(t)
        setStocks(s)
      })
      .catch((e) => toast.error(e.message))

  useEffect(() => {
    load()
  }, [])

  // Live fee preview — mirrors Excel's auto-calculated fee columns
  useEffect(() => {
    if (!open) return
    const qty = parseFloat(form.quantity)
    const price = isBonus ? 0 : parseFloat(form.price)
    if (!qty || qty <= 0 || (!isBonus && (!price || price <= 0))) {
      setPreview(null)
      return
    }
    const t = setTimeout(() => {
      api
        .post('/transactions/preview', { type: form.type, quantity: qty, price })
        .then(setPreview)
        .catch(() => setPreview(null))
    }, 200)
    return () => clearTimeout(t)
  }, [open, form.type, form.quantity, form.price, isBonus])

  const canSubmit = useMemo(() => {
    const qty = parseFloat(form.quantity)
    const price = parseFloat(form.price)
    return (
      isValidBSDate(form.date) &&
      form.stock_id &&
      qty > 0 &&
      (isBonus || price > 0)
    )
  }, [form, isBonus])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/transactions', {
        ...form,
        stock_id: parseInt(form.stock_id, 10),
        quantity: parseFloat(form.quantity),
        price: isBonus ? 0 : parseFloat(form.price),
      })
      toast.success('Transaction saved')
      setOpen(false)
      setForm(EMPTY_FORM)
      setPreview(null)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    try {
      await api.delete(`/transactions/${confirmDelete.id}`)
      toast.success('Transaction deleted')
      setConfirmDelete(null)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const columns = [
    { key: 'date', label: 'Date (BS)', render: (t) => <span className="font-mono text-sm">{t.date}</span> },
    { key: 'symbol', label: 'Symbol', render: (t) => <span className="font-mono font-semibold">{t.symbol}</span> },
    {
      key: 'type',
      label: 'Type',
      render: (t) => (
        <Badge variant="outline" className={cn('border-transparent', TYPE_BADGE[t.type])}>
          {t.type}
        </Badge>
      ),
    },
    { key: 'quantity', label: 'Qty', align: 'right', render: (t) => fmt.qty(t.quantity) },
    { key: 'price', label: 'Price', align: 'right', render: (t) => fmt.money(t.price) },
    { key: 'gross', label: 'Gross', align: 'right', render: (t) => fmt.money(t.gross) },
    { key: 'commission', label: 'Commission', align: 'right', render: (t) => fmt.money(t.commission) },
    { key: 'sebon_fee', label: 'SEBON', align: 'right', render: (t) => fmt.money(t.sebon_fee) },
    { key: 'dp_fee', label: 'DP', align: 'right', render: (t) => fmt.money(t.dp_fee) },
    {
      key: 'net_amount',
      label: 'Net Amount',
      align: 'right',
      render: (t) => <span className="font-semibold">{fmt.money(t.net_amount)}</span>,
    },
    { key: 'notes', label: 'Notes', render: (t) => <span className="text-sm text-muted-foreground">{t.notes}</span> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (t) => (
        <Button
          size="icon"
          variant="ghost"
          className="size-8 text-destructive hover:text-destructive"
          onClick={() => setConfirmDelete(t)}
          aria-label={`Delete ${t.symbol} ${t.type} on ${t.date}`}
        >
          <Trash2 className="size-4" />
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Transactions"
        description="All buys, sells, bonuses, rights and IPOs. Fees are computed automatically on save."
        action={
          <Button onClick={() => setOpen(true)} disabled={!stocks.length}>
            <Plus className="size-4" /> Add Transaction
          </Button>
        }
      />
      {!stocks.length && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          Add a stock on the Stocks page first — transactions reference the stock master.
        </p>
      )}
      <DataTable
        columns={columns}
        rows={txns}
        empty={{
          title: 'No transactions yet',
          hint: 'Record your first BUY, IPO or BONUS to start tracking holdings.',
        }}
      />

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) {
            setForm(EMPTY_FORM)
            setPreview(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>
              Fees are previewed live and stored with the transaction, like the Excel sheet.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="txn-type">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger id="txn-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="txn-stock">
                  Stock <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.stock_id}
                  onValueChange={(v) => setForm({ ...form, stock_id: v })}
                >
                  <SelectTrigger id="txn-stock" className="w-full">
                    <SelectValue placeholder="Select stock" />
                  </SelectTrigger>
                  <SelectContent>
                    {stocks.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="txn-date">
                Date (BS) <span className="text-destructive">*</span>
              </Label>
              <BSDateInput id="txn-date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="txn-qty">
                  Quantity <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="txn-qty"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  inputMode="decimal"
                  placeholder="10"
                  required
                  className="font-mono"
                />
              </div>
              {!isBonus && (
                <div className="space-y-1.5">
                  <Label htmlFor="txn-price">
                    Price (Rs) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="txn-price"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    inputMode="decimal"
                    placeholder="400.00"
                    required
                    className="font-mono"
                  />
                </div>
              )}
            </div>
            {isBonus && (
              <p className="text-xs text-muted-foreground">
                Bonus shares have no price and no fees — they increase share count and lower your
                average cost.
              </p>
            )}
            {form.type === 'RIGHT' && (
              <p className="text-xs text-muted-foreground">
                Rights are treated like IPO: net = qty × price, no broker fees.
              </p>
            )}

            {preview && !isBonus && (
              <div className="rounded-md border bg-muted/50 p-3 text-sm">
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Gross</span>
                  <span className="tnum font-mono">{fmt.money(preview.gross)}</span>
                </div>
                {hasBrokerFees && (
                  <>
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">Broker commission</span>
                      <span className="tnum font-mono">{fmt.money(preview.commission)}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">SEBON fee (0.015%)</span>
                      <span className="tnum font-mono">{fmt.money(preview.sebon_fee)}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">DP fee</span>
                      <span className="tnum font-mono">{fmt.money(preview.dp_fee)}</span>
                    </div>
                  </>
                )}
                <div className="mt-1 flex justify-between border-t pt-1.5 font-medium">
                  <span>{form.type === 'SELL' ? 'Net proceeds' : 'Net cost'}</span>
                  <span className="tnum font-mono">{fmt.money(preview.net_amount)}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="txn-notes">Notes</Label>
              <Input
                id="txn-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit || saving}>
                {saving ? 'Saving…' : 'Save transaction'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this transaction?</DialogTitle>
            <DialogDescription>
              {confirmDelete
                ? `${confirmDelete.type} ${fmt.qty(confirmDelete.quantity)} × ${confirmDelete.symbol} on ${confirmDelete.date}. Holdings will be recalculated.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
