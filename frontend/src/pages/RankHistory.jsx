import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

// DESIGN.md blue-led categorical palette (matches Dashboard)
const CHART_COLORS = [
  '#50b0ff', '#2789d8', '#8b7cf8', '#34d399', '#f59e0b', '#f472b6', '#22d3ee',
  '#a78bfa', '#facc15', '#fb7185', '#2dd4bf', '#93c5fd', '#e879f9', '#bef264',
  '#fdba74', '#67e8f9', '#f9a8d4', '#86efac', '#c4b5fd',
]
const AXIS_TICK = { fontSize: 12, fill: '#a1a1aa' }

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
  const symbols = useMemo(() => [...new Set(rows.map((r) => r.symbol))].sort(), [rows])
  const byKey = useMemo(() => {
    const m = {}
    for (const r of rows) m[`${r.symbol}|${r.quarter}`] = r
    return m
  }, [rows])

  // rank trend: one line per bank, lower rank = better (reversed axis)
  const trendData = useMemo(
    () =>
      quarters.map((q) => {
        const point = { quarter: q }
        for (const s of symbols) {
          const r = byKey[`${s}|${q}`]
          if (r) point[s] = r.rank
        }
        return point
      }),
    [quarters, symbols, byKey],
  )

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

  return (
    <>
      <PageHeader
        title="Rank History"
        description="Enter each bank's composite score per quarter — rank is computed by sorting scores within the quarter."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add / update score
          </Button>
        }
      />

      {!rows.length ? (
        <div className="rounded-lg border border-dashed bg-card px-6 py-14 text-center">
          <p className="font-medium">No scores yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add composite scores per bank per quarter; ranks and the trend chart build themselves.
          </p>
          <Button className="mt-4" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add first score
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
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
                      const r = byKey[`${sym}|${q}`]
                      return (
                        <TableCell key={q} className="tnum text-right font-mono">
                          {r ? (
                            <span>
                              <span className="mr-1.5 inline-flex size-5 items-center justify-center rounded bg-secondary text-xs font-semibold">
                                {r.rank}
                              </span>
                              {r.score.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Badge = computed rank within the quarter · number = entered composite score.
          </p>

          {quarters.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rank Trend (1 = best)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="quarter" tick={AXIS_TICK} />
                    <YAxis
                      reversed
                      allowDecimals={false}
                      domain={[1, Math.max(symbols.length, 2)]}
                      tick={AXIS_TICK}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        color: 'var(--popover-foreground)',
                      }}
                      labelStyle={{ color: 'var(--muted-foreground)' }}
                    />
                    <Legend />
                    {symbols.map((s, i) => (
                      <Line
                        key={s}
                        type="monotone"
                        dataKey={s}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add / update score</DialogTitle>
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
                placeholder="72.50"
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Higher score = better rank within the quarter.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save score'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
