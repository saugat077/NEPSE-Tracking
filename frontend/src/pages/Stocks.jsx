import { useEffect, useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
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
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'

const EMPTY_FORM = { symbol: '', company: '', sector: '', current_price: '' }

export default function Stocks() {
  const [stocks, setStocks] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editing, setEditing] = useState(null) // stock being edited in the modal
  const [saving, setSaving] = useState(false)
  const [priceEdit, setPriceEdit] = useState(null) // { id, price, date }
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = () => api.get('/stocks').then(setStocks).catch((e) => toast.error(e.message))
  useEffect(() => {
    load()
  }, [])

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }
  const openEdit = (s) => {
    setEditing(s)
    setForm({
      symbol: s.symbol,
      company: s.company,
      sector: s.sector,
      current_price: String(s.current_price ?? 0),
    })
    setOpen(true)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = { ...form, current_price: parseFloat(form.current_price) || 0 }
      if (editing) {
        await api.put(`/stocks/${editing.id}`, { ...editing, ...body })
        toast.success(`${body.symbol.toUpperCase()} updated`)
      } else {
        await api.post('/stocks', body)
        toast.success(`${body.symbol.toUpperCase()} added`)
      }
      setOpen(false)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const savePrice = async () => {
    if (priceEdit.date && !isValidBSDate(priceEdit.date)) {
      toast.error('Price date must be a BS date like 2083-01-31')
      return
    }
    try {
      await api.put(`/stocks/${priceEdit.id}/price`, {
        current_price: parseFloat(priceEdit.price) || 0,
        price_updated: priceEdit.date || null,
      })
      toast.success('Price updated')
      setPriceEdit(null)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const remove = async () => {
    try {
      await api.delete(`/stocks/${confirmDelete.id}`)
      toast.success(`${confirmDelete.symbol} deleted`)
      setConfirmDelete(null)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const columns = [
    { key: 'symbol', label: 'Symbol', render: (s) => <span className="font-mono font-semibold">{s.symbol}</span> },
    { key: 'company', label: 'Company' },
    { key: 'sector', label: 'Sector' },
    {
      key: 'current_price',
      label: 'Current Price (Rs)',
      align: 'right',
      render: (s) =>
        priceEdit?.id === s.id ? (
          <span className="inline-flex items-center gap-1.5">
            <Input
              autoFocus
              value={priceEdit.price}
              onChange={(e) => setPriceEdit({ ...priceEdit, price: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && savePrice()}
              inputMode="decimal"
              className="h-8 w-24 text-right font-mono"
              aria-label={`New price for ${s.symbol}`}
            />
            <Input
              value={priceEdit.date}
              onChange={(e) => setPriceEdit({ ...priceEdit, date: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && savePrice()}
              placeholder="2083-01-31"
              className="h-8 w-28 font-mono text-xs"
              aria-label={`Price date (BS) for ${s.symbol}`}
            />
            <Button size="icon" variant="ghost" className="size-8" onClick={savePrice} aria-label="Save price">
              <Check className="size-4 text-emerald-600" />
            </Button>
            <Button size="icon" variant="ghost" className="size-8" onClick={() => setPriceEdit(null)} aria-label="Cancel">
              <X className="size-4" />
            </Button>
          </span>
        ) : (
          <button
            className="rounded px-1 underline decoration-dotted underline-offset-4 hover:bg-secondary"
            onClick={() =>
              setPriceEdit({ id: s.id, price: String(s.current_price ?? 0), date: s.price_updated || '' })
            }
            title="Click to update price"
          >
            {fmt.money(s.current_price)}
          </button>
        ),
    },
    { key: 'price_updated', label: 'Price Date (BS)', render: (s) => s.price_updated || '—' },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (s) => (
        <span className="inline-flex gap-1">
          <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(s)} aria-label={`Edit ${s.symbol}`}>
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(s)}
            aria-label={`Delete ${s.symbol}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Stocks & Prices"
        description="Stock master list — click a price to update it manually."
        action={
          <Button onClick={openAdd}>
            <Plus className="size-4" /> Add Stock
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={stocks}
        empty={{
          title: 'No stocks yet',
          hint: 'Add the stocks you own or track; transactions and dividends reference them.',
          action: (
            <Button className="mt-4" onClick={openAdd}>
              <Plus className="size-4" /> Add your first stock
            </Button>
          ),
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.symbol}` : 'Add Stock'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update stock details.' : 'Register a stock so you can record transactions for it.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="symbol">
                  Symbol <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="symbol"
                  value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                  placeholder="NABIL"
                  required
                  autoFocus
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sector">Sector</Label>
                <Input
                  id="sector"
                  value={form.sector}
                  onChange={(e) => setForm({ ...form, sector: e.target.value })}
                  placeholder="Commercial Bank"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Nabil Bank Ltd."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="current_price">Current Price (Rs)</Label>
              <Input
                id="current_price"
                value={form.current_price}
                onChange={(e) => setForm({ ...form, current_price: e.target.value })}
                inputMode="decimal"
                placeholder="0.00"
                className="font-mono"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add stock'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {confirmDelete?.symbol}?</DialogTitle>
            <DialogDescription>
              This removes the stock from the master list. Stocks with transactions or dividends
              cannot be deleted.
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
