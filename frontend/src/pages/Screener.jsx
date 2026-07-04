import { useEffect, useMemo, useState } from 'react'
import { Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import PageHeader from '@/components/PageHeader'
import { cn } from '@/lib/utils'

const METRICS = [
  { key: 'eps', label: 'EPS (Rs)' },
  { key: 'pe', label: 'P/E' },
  { key: 'npl', label: 'NPL %' },
  { key: 'roe', label: 'ROE %' },
  { key: 'car', label: 'CAR %' },
  { key: 'div_cash', label: 'Cash Div %' },
  { key: 'div_bonus', label: 'Bonus Div %' },
]
const VERDICTS = ['BUY', 'WATCH', 'AVOID', 'STRONG AVOID']
const VERDICT_BADGE = {
  BUY: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  WATCH: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  AVOID: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  'STRONG AVOID': 'bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100',
}

export default function Screener() {
  const [rows, setRows] = useState([])
  const [edits, setEdits] = useState({}) // "symbol|quarter|field" -> value
  const [open, setOpen] = useState(false)
  const [addForm, setAddForm] = useState({ symbol: '', quarter: '' })
  const [saving, setSaving] = useState(false)

  const load = () => api.get('/screener').then(setRows).catch((e) => toast.error(e.message))
  useEffect(() => {
    load()
  }, [])

  const symbols = useMemo(() => [...new Set(rows.map((r) => r.symbol))].sort(), [rows])
  const quarters = useMemo(() => [...new Set(rows.map((r) => r.quarter))].sort(), [rows])
  const byKey = useMemo(() => {
    const m = {}
    for (const r of rows) m[`${r.symbol}|${r.quarter}`] = r
    return m
  }, [rows])

  const cellValue = (symbol, quarter, field) => {
    const editKey = `${symbol}|${quarter}|${field}`
    if (editKey in edits) return edits[editKey]
    const v = byKey[`${symbol}|${quarter}`]?.[field]
    return v ?? ''
  }

  const setCell = (symbol, quarter, field, value) =>
    setEdits((e) => ({ ...e, [`${symbol}|${quarter}|${field}`]: value }))

  const dirty = Object.keys(edits).length > 0

  const saveAll = async () => {
    // group edits into (symbol, quarter) entries merged over existing rows
    const entries = {}
    for (const [key, value] of Object.entries(edits)) {
      const [symbol, quarter, field] = key.split('|')
      const k = `${symbol}|${quarter}`
      entries[k] ??= { ...(byKey[k] || { symbol, quarter }) }
      entries[k][field] = value === '' ? null : value
    }
    setSaving(true)
    try {
      const updated = await api.put('/screener', Object.values(entries))
      setRows(updated)
      setEdits({})
      toast.success('Screener saved')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const addEntry = async (e) => {
    e.preventDefault()
    const symbol = addForm.symbol.trim().toUpperCase()
    const quarter = addForm.quarter.trim()
    if (!symbol || !quarter) return
    try {
      const updated = await api.put('/screener', [{ symbol, quarter }])
      setRows(updated)
      setOpen(false)
      setAddForm({ symbol: '', quarter: '' })
      toast.success(`${symbol} · ${quarter} added`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <>
      <PageHeader
        title="Bank Screener"
        description="Quarterly fundamentals per bank — banks as rows, quarters as columns. Edit cells, then Save."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Add bank / quarter
            </Button>
            <Button onClick={saveAll} disabled={!dirty || saving}>
              <Save className="size-4" /> {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </Button>
          </div>
        }
      />

      {!rows.length ? (
        <div className="rounded-lg border border-dashed bg-card px-6 py-14 text-center">
          <p className="font-medium">No screener data yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a bank and quarter (e.g. NABIL · Q3 2082/83) to start the fundamentals grid.
          </p>
          <Button className="mt-4" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add bank / quarter
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {METRICS.map((metric) => (
            <section key={metric.key}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{metric.label}</h2>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Bank</TableHead>
                      {quarters.map((q) => (
                        <TableHead key={q} className="text-right whitespace-nowrap">
                          {q}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {symbols.map((sym) => (
                      <TableRow key={sym}>
                        <TableCell className="font-mono font-semibold">{sym}</TableCell>
                        {quarters.map((q) => (
                          <TableCell key={q} className="p-1.5 text-right">
                            {byKey[`${sym}|${q}`] ? (
                              <Input
                                value={cellValue(sym, q, metric.key)}
                                onChange={(e) => setCell(sym, q, metric.key, e.target.value)}
                                inputMode="decimal"
                                className="tnum h-8 w-24 text-right font-mono ml-auto"
                                aria-label={`${metric.label} for ${sym} ${q}`}
                              />
                            ) : (
                              <span className="pr-3 text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ))}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Verdict</h2>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Bank</TableHead>
                    {quarters.map((q) => (
                      <TableHead key={q} className="text-right whitespace-nowrap">
                        {q}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {symbols.map((sym) => (
                    <TableRow key={sym}>
                      <TableCell className="font-mono font-semibold">{sym}</TableCell>
                      {quarters.map((q) => {
                        const row = byKey[`${sym}|${q}`]
                        if (!row)
                          return (
                            <TableCell key={q} className="text-right">
                              <span className="pr-3 text-muted-foreground">—</span>
                            </TableCell>
                          )
                        const value = cellValue(sym, q, 'verdict') || ''
                        return (
                          <TableCell key={q} className="p-1.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {value ? (
                                <Badge
                                  variant="outline"
                                  className={cn('border-transparent', VERDICT_BADGE[value])}
                                >
                                  {value}
                                </Badge>
                              ) : null}
                              <Select
                                value={value}
                                onValueChange={(v) => setCell(sym, q, 'verdict', v)}
                              >
                                <SelectTrigger
                                  className="h-8 w-36"
                                  aria-label={`Verdict for ${sym} ${q}`}
                                >
                                  <SelectValue placeholder="Set verdict" />
                                </SelectTrigger>
                                <SelectContent>
                                  {VERDICTS.map((v) => (
                                    <SelectItem key={v} value={v}>
                                      {v}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add bank / quarter</DialogTitle>
            <DialogDescription>
              Creates an empty row you can fill in the grid. Existing rows are kept.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={addEntry} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="scr-symbol">
                  Bank symbol <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="scr-symbol"
                  value={addForm.symbol}
                  onChange={(e) => setAddForm({ ...addForm, symbol: e.target.value.toUpperCase() })}
                  placeholder="NABIL"
                  required
                  autoFocus
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scr-quarter">
                  Quarter <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="scr-quarter"
                  value={addForm.quarter}
                  onChange={(e) => setAddForm({ ...addForm, quarter: e.target.value })}
                  placeholder="Q3 2082/83"
                  required
                  className="font-mono"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
