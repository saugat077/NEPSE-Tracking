import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, fmt } from '@/api'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
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

const EMPTY_FORM = { date: '', stock_id: '', fiscal_year: '', div_rate: '', shares: '', notes: '' }
const PAR = 100
const TDS = 0.05

export default function Dividends() {
  const [dividends, setDividends] = useState([])
  const [stocks, setStocks] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = () =>
    Promise.all([api.get('/dividends'), api.get('/stocks')])
      .then(([d, s]) => {
        setDividends(d)
        setStocks(s)
      })
      .catch((e) => toast.error(e.message))

  useEffect(() => {
    load()
  }, [])

  // live math preview: gross = rate x 100 par x shares; TDS 5%
  const preview = useMemo(() => {
    const rate = parseFloat(form.div_rate)
    const shares = parseFloat(form.shares)
    if (!rate || rate <= 0 || !shares || shares <= 0) return null
    const gross = rate * PAR * shares
    const tds = gross * TDS
    return { gross, tds, net: gross - tds }
  }, [form.div_rate, form.shares])

  const canSubmit =
    isValidBSDate(form.date) &&
    form.stock_id &&
    parseFloat(form.div_rate) > 0 &&
    parseFloat(form.shares) > 0

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/dividends', {
        ...form,
        stock_id: parseInt(form.stock_id, 10),
        div_rate: parseFloat(form.div_rate),
        shares: parseFloat(form.shares),
      })
      toast.success('Dividend recorded')
      setOpen(false)
      setForm(EMPTY_FORM)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    try {
      await api.delete(`/dividends/${confirmDelete.id}`)
      toast.success('Dividend deleted')
      setConfirmDelete(null)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const dim = 'text-[color:var(--text2)]'
  const columns = [
    { key: 'date', label: 'Date · BS', cellClass: dim, render: (d) => d.date },
    { key: 'symbol', label: 'Symbol', render: (d) => <span className="font-semibold">{d.symbol}</span> },
    { key: 'fiscal_year', label: 'Fiscal Year', cellClass: dim },
    {
      key: 'div_rate',
      label: 'Cash Rate %',
      align: 'right',
      render: (d) => `${(d.div_rate * 100).toFixed(2)}%`,
    },
    { key: 'shares', label: 'Shares', align: 'right', cellClass: dim, render: (d) => fmt.qty(d.shares) },
    { key: 'gross', label: 'Gross · Rs', align: 'right', render: (d) => fmt.money(d.gross) },
    { key: 'tds', label: 'TDS 5%', align: 'right', cellClass: 'down', render: (d) => fmt.money(d.tds) },
    {
      key: 'net',
      label: 'Net · Rs',
      align: 'right',
      cellClass: 'up',
      render: (d) => <span className="font-semibold">{fmt.money(d.net)}</span>,
    },
    { key: 'notes', label: 'Notes', cellClass: 'font-sans text-xs text-[color:var(--muted)]', render: (d) => d.notes },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (d) => (
        <Button
          size="icon"
          variant="ghost"
          className="size-8 text-destructive hover:text-destructive"
          onClick={() => setConfirmDelete(d)}
          aria-label={`Delete ${d.symbol} dividend on ${d.date}`}
        >
          <Trash2 className="size-4" />
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Dividends"
        description="Gross = rate × Rs 100 par × shares · 5% TDS"
        action={
          <Button
            onClick={() => setOpen(true)}
            disabled={!stocks.length}
           
          >
            + Record Dividend
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={dividends}
        empty={{
          title: 'No dividends recorded',
          hint: 'Record cash dividends as they are credited; net amounts feed the dashboard',
        }}
        footer={
          dividends.length ? (
            <TableRow className="bg-[color:var(--panel2)] hover:bg-[color:var(--panel2)]">
              <TableCell className="px-3 py-[9px] text-[10px] font-bold uppercase tracking-[1px]">
                Total
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell className="tnum px-3 py-[9px] text-right font-semibold">
                {fmt.money(dividends.reduce((a, d) => a + d.gross, 0))}
              </TableCell>
              <TableCell className="tnum down px-3 py-[9px] text-right font-semibold">
                {fmt.money(dividends.reduce((a, d) => a + d.tds, 0))}
              </TableCell>
              <TableCell className="tnum up px-3 py-[9px] text-right font-bold">
                {fmt.money(dividends.reduce((a, d) => a + d.net, 0))}
              </TableCell>
              <TableCell />
              <TableCell />
            </TableRow>
          ) : null
        }
      />

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) setForm(EMPTY_FORM)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Dividend</DialogTitle>
            <DialogDescription>
              Enter the rate as a decimal — 10% cash dividend is 0.10.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="div-stock">
                  Stock <span className="text-destructive">*</span>
                </Label>
                <Select value={form.stock_id} onValueChange={(v) => setForm({ ...form, stock_id: v })}>
                  <SelectTrigger id="div-stock" className="w-full">
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
              <div className="space-y-1.5">
                <Label htmlFor="div-fy">Fiscal Year</Label>
                <Input
                  id="div-fy"
                  value={form.fiscal_year}
                  onChange={(e) => setForm({ ...form, fiscal_year: e.target.value })}
                  placeholder="2081/82"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="div-date">
                Date (BS) <span className="text-destructive">*</span>
              </Label>
              <BSDateInput id="div-date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="div-rate">
                  Rate (decimal) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="div-rate"
                  value={form.div_rate}
                  onChange={(e) => setForm({ ...form, div_rate: e.target.value })}
                  inputMode="decimal"
                  placeholder="0.10"
                  required
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">10% → 0.10</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="div-shares">
                  Shares <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="div-shares"
                  value={form.shares}
                  onChange={(e) => setForm({ ...form, shares: e.target.value })}
                  inputMode="decimal"
                  placeholder="10"
                  required
                  className="font-mono"
                />
              </div>
            </div>

            {preview && (
              <div className="rounded-md border bg-muted/50 p-3 text-sm">
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Gross</span>
                  <span className="tnum font-mono">{fmt.money(preview.gross)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">TDS (5%)</span>
                  <span className="tnum font-mono">−{fmt.money(preview.tds)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t pt-1.5 font-medium">
                  <span>Net receivable</span>
                  <span className="tnum font-mono">{fmt.money(preview.net)}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="div-notes">Notes</Label>
              <Input
                id="div-notes"
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
                {saving ? 'Saving…' : 'Save dividend'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this dividend?</DialogTitle>
            <DialogDescription>
              {confirmDelete
                ? `${confirmDelete.symbol} — net Rs ${fmt.money(confirmDelete.net)} on ${confirmDelete.date}.`
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
