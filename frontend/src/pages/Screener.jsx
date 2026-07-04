import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/api'
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
  { key: 'eps', label: 'EPS · RS' },
  { key: 'pe', label: 'P/E' },
  { key: 'npl', label: 'NPL' },
  { key: 'roe', label: 'ROE' },
  { key: 'car', label: 'CAR' },
  { key: 'div_cash', label: 'DIV C' },
  { key: 'div_bonus', label: 'DIV B' },
]
const VERDICTS = ['BUY', 'WATCH', 'AVOID', 'STRONG AVOID']
const VERDICT_BADGE = {
  BUY: 'tbadge-up',
  WATCH: 'tbadge-accent',
  AVOID: 'tbadge-down',
  'STRONG AVOID': 'tbadge-solid-down',
}

// NPL stored as decimal (0.04 = 4%): >4% red, >2.5% amber, else green
function nplColor(value) {
  const v = parseFloat(value)
  if (Number.isNaN(v)) return ''
  if (v > 0.04) return 'down'
  if (v > 0.025) return 'text-[color:var(--accent)]'
  return 'up'
}

export default function Screener() {
  const [rows, setRows] = useState([])
  const [edits, setEdits] = useState({}) // "symbol|quarter|field" -> value
  const [quarter, setQuarter] = useState(null)
  const [open, setOpen] = useState(false)
  const [addForm, setAddForm] = useState({ symbol: '', quarter: '' })
  const [saving, setSaving] = useState(false)

  const load = () => api.get('/screener').then(setRows).catch((e) => toast.error(e.message))
  useEffect(() => {
    load()
  }, [])

  const quarters = useMemo(() => [...new Set(rows.map((r) => r.quarter))].sort(), [rows])
  const active = quarter && quarters.includes(quarter) ? quarter : quarters[quarters.length - 1]
  const banks = useMemo(
    () => rows.filter((r) => r.quarter === active).sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [rows, active],
  )
  const byKey = useMemo(() => {
    const m = {}
    for (const r of rows) m[`${r.symbol}|${r.quarter}`] = r
    return m
  }, [rows])

  const cellValue = (symbol, field) => {
    const editKey = `${symbol}|${active}|${field}`
    if (editKey in edits) return edits[editKey]
    const v = byKey[`${symbol}|${active}`]?.[field]
    return v ?? ''
  }
  const setCell = (symbol, field, value) =>
    setEdits((e) => ({ ...e, [`${symbol}|${active}|${field}`]: value }))

  const dirty = Object.keys(edits).length > 0

  const saveAll = async () => {
    const entries = {}
    for (const [key, value] of Object.entries(edits)) {
      const [symbol, q, field] = key.split('|')
      const k = `${symbol}|${q}`
      entries[k] ??= { ...(byKey[k] || { symbol, quarter: q }) }
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
    const q = addForm.quarter.trim()
    if (!symbol || !q) return
    try {
      const updated = await api.put('/screener', [{ symbol, quarter: q }])
      setRows(updated)
      setQuarter(q)
      setOpen(false)
      setAddForm({ symbol: '', quarter: '' })
      toast.success(`${symbol} · ${q} added`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const inputCls =
    'tnum h-7 w-[72px] rounded-[2px] border-transparent bg-transparent px-1 text-right font-mono text-[11.5px] hover:border-[color:var(--border)] focus-visible:ring-1'

  return (
    <>
      <PageHeader
        title="Bank Screener"
        description={active ? `${active} quarterly fundamentals · values as decimals (0.04 = 4%)` : 'Quarterly fundamentals'}
        action={
          <div className="flex items-center gap-2">
            {quarters.length > 0 && (
              <>
                <span className="tlabel">Quarter</span>
                <div className="flex overflow-hidden rounded-[6px] border">
                  {quarters.map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuarter(q)}
                      className={cn(
                        'px-[11px] py-[5px] font-mono text-[9.5px] font-semibold tracking-[1px]',
                        q === active
                          ? 'bg-[color:var(--accent)] text-[color:var(--accent-text)]'
                          : 'bg-[color:var(--panel)] text-[color:var(--muted)] hover:text-[color:var(--text)]',
                      )}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </>
            )}
            <Button
              variant="outline"
              onClick={() => setOpen(true)}
             
            >
              + Bank / Quarter
            </Button>
            <Button
              onClick={saveAll}
              disabled={!dirty || saving}
             
            >
              {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
            </Button>
          </div>
        }
      />

      {!rows.length ? (
        <div className="border border-dashed bg-[color:var(--panel)] px-6 py-14 text-center">
          <p className="font-mono text-[12px] font-semibold uppercase tracking-[1.5px]">No screener data</p>
          <p className="mt-2 font-mono text-[10.5px] uppercase text-[color:var(--muted)]">
            Add a bank and quarter (e.g. NABIL · Q3 2082/83) to start the fundamentals grid
          </p>
          <Button
            className="mt-4"
            onClick={() => setOpen(true)}
          >
            + Bank / Quarter
          </Button>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <Table className="font-mono text-[11.5px]">
            <TableHeader>
              <TableRow className="border-b hover:bg-transparent">
                <TableHead className="h-auto px-3 py-[9px] font-mono text-[9px] font-medium uppercase tracking-[1.5px] text-[color:var(--muted)]">
                  Bank
                </TableHead>
                {METRICS.map((m) => (
                  <TableHead
                    key={m.key}
                    className="h-auto px-3 py-[9px] text-right font-mono text-[9px] font-medium uppercase tracking-[1.5px] text-[color:var(--muted)]"
                  >
                    {m.label}
                  </TableHead>
                ))}
                <TableHead className="h-auto px-3 py-[9px] text-center font-mono text-[9px] font-medium uppercase tracking-[1.5px] text-[color:var(--muted)]">
                  Verdict
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banks.map((b) => {
                const verdict = cellValue(b.symbol, 'verdict') || ''
                return (
                  <TableRow
                    key={b.symbol}
                    className="border-b border-[color:var(--border-soft)] hover:bg-[color:var(--hover)]"
                  >
                    <TableCell className="px-3 py-1.5 font-semibold">{b.symbol}</TableCell>
                    {METRICS.map((m) => (
                      <TableCell key={m.key} className="px-1.5 py-1 text-right">
                        <Input
                          value={cellValue(b.symbol, m.key)}
                          onChange={(e) => setCell(b.symbol, m.key, e.target.value)}
                          inputMode="decimal"
                          className={cn(inputCls, m.key === 'npl' && nplColor(cellValue(b.symbol, m.key)))}
                          aria-label={`${m.label} for ${b.symbol} ${active}`}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="px-3 py-1 text-center">
                      <span className="inline-flex items-center justify-end gap-2">
                        {verdict ? <span className={cn('tbadge', VERDICT_BADGE[verdict])}>{verdict}</span> : null}
                        <Select value={verdict} onValueChange={(v) => setCell(b.symbol, 'verdict', v)}>
                          <SelectTrigger
                            className="h-7 w-[130px] font-mono text-[11px]"
                            aria-label={`Verdict for ${b.symbol} ${active}`}
                          >
                            <SelectValue placeholder="SET" />
                          </SelectTrigger>
                          <SelectContent>
                            {VERDICTS.map((v) => (
                              <SelectItem key={v} value={v} className="font-mono text-[11px]">
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono text-[13px] uppercase tracking-[2px]">
              Add Bank / Quarter
            </DialogTitle>
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
              <Button type="submit">
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
