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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import PageHeader from '@/components/PageHeader'
import { cn } from '@/lib/utils'

function rankBadge(rank, total) {
  if (rank == null) return 'tbadge-outline'
  if (rank <= 3) return 'tbadge-up'
  if (rank > total - 3) return 'tbadge-down'
  return 'tbadge-outline'
}

export default function RankHistory() {
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ symbol: '', quarter: '', score: '' })
  const [saving, setSaving] = useState(false)

  const load = () => api.get('/rank-history').then(setRows).catch((e) => toast.error(e.message))
  useEffect(() => {
    load()
  }, [])

  const quarters = useMemo(() => [...new Set(rows.map((r) => r.quarter))].sort(), [rows])
  const latest = quarters[quarters.length - 1]
  const prev = quarters[quarters.length - 2]
  const maxScore = Math.max(1, ...rows.map((r) => r.score))

  const banks = useMemo(() => {
    const bySym = {}
    for (const r of rows) {
      bySym[r.symbol] = bySym[r.symbol] || {}
      bySym[r.symbol][r.quarter] = r
    }
    const list = Object.entries(bySym).map(([symbol, byQ]) => ({
      symbol,
      byQ,
      rank: byQ[latest]?.rank ?? null,
      delta: byQ[latest] && prev && byQ[prev] ? byQ[prev].rank - byQ[latest].rank : null,
    }))
    list.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || a.symbol.localeCompare(b.symbol))
    return list
  }, [rows, latest, prev])

  const latestCount = rows.filter((r) => r.quarter === latest).length

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await api.put('/rank-history', [
        {
          symbol: form.symbol.trim().toUpperCase(),
          quarter: form.quarter.trim(),
          score: parseFloat(form.score),
        },
      ])
      setRows(updated)
      setOpen(false)
      setForm({ symbol: '', quarter: '', score: '' })
      toast.success('Score saved — ranks recomputed')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const thCls =
    'h-auto px-3 py-[9px] font-mono text-[9px] font-medium uppercase tracking-[1.5px] text-[color:var(--muted)]'

  return (
    <>
      <PageHeader
        title="Rank History"
        description="Composite score per bank per quarter · rank by sorted score"
        action={
          <Button
            onClick={() => setOpen(true)}
           
          >
            + Add / Update Score
          </Button>
        }
      />

      {!rows.length ? (
        <div className="border border-dashed bg-[color:var(--panel)] px-6 py-14 text-center">
          <p className="font-mono text-[12px] font-semibold uppercase tracking-[1.5px]">No scores yet</p>
          <p className="mt-2 font-mono text-[10.5px] uppercase text-[color:var(--muted)]">
            Add composite scores per bank per quarter; ranks and trend bars build themselves
          </p>
          <Button
            className="mt-4"
            onClick={() => setOpen(true)}
          >
            + Add First Score
          </Button>
        </div>
      ) : (
        <>
          <div className="panel overflow-x-auto">
            <Table className="font-mono text-[11.5px]">
              <TableHeader>
                <TableRow className="border-b hover:bg-transparent">
                  <TableHead className={cn(thCls, 'text-center')}>Rank</TableHead>
                  <TableHead className={thCls}>Bank</TableHead>
                  {quarters.map((q) => (
                    <TableHead key={q} className={cn(thCls, 'whitespace-nowrap text-right')}>
                      {q}
                    </TableHead>
                  ))}
                  <TableHead className={cn(thCls, 'pl-5')}>Trend</TableHead>
                  <TableHead className={cn(thCls, 'text-right')}>Δ Rank</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.map((b) => (
                  <TableRow
                    key={b.symbol}
                    className="border-b border-[color:var(--border-soft)] hover:bg-[color:var(--hover)]"
                  >
                    <TableCell className="px-3 py-2 text-center">
                      <span className={cn('tbadge', rankBadge(b.rank, latestCount))}>
                        {b.rank ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 font-semibold">{b.symbol}</TableCell>
                    {quarters.map((q, i) => {
                      const r = b.byQ[q]
                      const isLatest = i === quarters.length - 1
                      return (
                        <TableCell
                          key={q}
                          className={cn(
                            'tnum whitespace-nowrap px-3 py-2 text-right',
                            isLatest ? 'font-semibold' : 'text-[color:var(--text2)]',
                          )}
                        >
                          {r ? r.score.toFixed(2) : '—'}
                        </TableCell>
                      )
                    })}
                    <TableCell className="px-3 py-2 pl-5">
                      <div className="flex h-4 items-end gap-[3px]">
                        {quarters.map((q, i) => {
                          const r = b.byQ[q]
                          const isLatest = i === quarters.length - 1
                          return (
                            <div
                              key={q}
                              className="w-[5px]"
                              style={{
                                height: r ? `${Math.max(12, (r.score / maxScore) * 100)}%` : '2px',
                                background: r
                                  ? isLatest
                                    ? 'var(--accent)'
                                    : 'var(--muted)'
                                  : 'var(--border-soft)',
                              }}
                            />
                          )
                        })}
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'tnum px-3 py-2 text-right font-semibold',
                        b.delta > 0 ? 'up' : b.delta < 0 ? 'down' : 'text-[color:var(--muted)]',
                      )}
                    >
                      {b.delta == null ? '—' : b.delta > 0 ? `▲ ${b.delta}` : b.delta < 0 ? `▼ ${-b.delta}` : '0'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.5px] text-[color:var(--muted)]">
            Rank = position in {latest} · Δ vs {prev || '—'} · bars show score by quarter
          </p>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono text-[13px] uppercase tracking-[2px]">
              Add / Update Score
            </DialogTitle>
            <DialogDescription>
              Upserts by bank + quarter; the quarter's ranks are recomputed on save.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="rank-symbol">
                  Bank symbol <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="rank-symbol"
                  value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                  placeholder="NABIL"
                  required
                  autoFocus
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rank-quarter">
                  Quarter <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="rank-quarter"
                  value={form.quarter}
                  onChange={(e) => setForm({ ...form, quarter: e.target.value })}
                  placeholder="Q3 2082/83"
                  required
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rank-score">
                Composite score <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rank-score"
                value={form.score}
                onChange={(e) => setForm({ ...form, score: e.target.value })}
                inputMode="decimal"
                placeholder="7.25"
                required
                className="font-mono"
              />
              <p className="text-xs text-[color:var(--muted)]">
                Higher score = better rank within the quarter.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
               
              >
                {saving ? 'Saving…' : 'Save Score'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
