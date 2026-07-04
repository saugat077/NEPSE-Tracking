import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api, fmt } from '@/api'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'
import DataTable, { plClass } from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import { cn } from '@/lib/utils'

export default function Holdings() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/holdings').then(setData).catch((e) => toast.error(e.message))
  }, [])

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>

  const { holdings, totals } = data

  const columns = [
    {
      key: 'symbol',
      label: 'Symbol',
      render: (h) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-mono font-semibold">{h.symbol}</span>
          {!h.active && (
            <Badge variant="outline" className="text-muted-foreground">
              Sold out
            </Badge>
          )}
        </span>
      ),
    },
    { key: 'shares', label: 'Shares', align: 'right', render: (h) => fmt.qty(h.shares) },
    { key: 'invested', label: 'Invested', align: 'right', render: (h) => fmt.money(h.invested) },
    { key: 'avg_cost', label: 'Avg Cost', align: 'right', render: (h) => fmt.money(h.avg_cost) },
    { key: 'current_price', label: 'Price', align: 'right', render: (h) => fmt.money(h.current_price) },
    { key: 'current_value', label: 'Value', align: 'right', render: (h) => fmt.money(h.current_value) },
    {
      key: 'unrealized_pl',
      label: 'Unrealized P&L',
      align: 'right',
      cellClass: (h) => plClass(h.unrealized_pl),
      render: (h) => fmt.money(h.unrealized_pl),
    },
    {
      key: 'return_pct',
      label: 'Return %',
      align: 'right',
      cellClass: (h) => plClass(h.return_pct),
      render: (h) => fmt.pct(h.return_pct),
    },
    { key: 'weight_pct', label: 'Weight', align: 'right', render: (h) => fmt.pct(h.weight_pct) },
    {
      key: 'realized_pl',
      label: 'Realized P&L',
      align: 'right',
      cellClass: (h) => plClass(h.realized_pl),
      render: (h) => fmt.money(h.realized_pl),
    },
    { key: 'dividends_net', label: 'Dividends (net)', align: 'right', render: (h) => fmt.money(h.dividends_net) },
  ]

  return (
    <>
      <PageHeader
        title="Holdings"
        description="Derived live from transactions using weighted-average cost (fees included). Read-only."
      />
      <DataTable
        columns={columns}
        rows={holdings}
        rowKey="stock_id"
        empty={{
          title: 'No holdings yet',
          hint: 'Holdings appear automatically once you record transactions.',
        }}
        footer={
          holdings.length ? (
            <TableRow className="bg-muted/50 font-medium hover:bg-muted/50">
              <TableCell>Total</TableCell>
              <TableCell />
              <TableCell className="tnum text-right font-mono">{fmt.money(totals.invested)}</TableCell>
              <TableCell />
              <TableCell />
              <TableCell className="tnum text-right font-mono">{fmt.money(totals.current_value)}</TableCell>
              <TableCell className={cn('tnum text-right font-mono', plClass(totals.unrealized_pl))}>
                {fmt.money(totals.unrealized_pl)}
              </TableCell>
              <TableCell className={cn('tnum text-right font-mono', plClass(totals.return_pct))}>
                {fmt.pct(totals.return_pct)}
              </TableCell>
              <TableCell className="tnum text-right font-mono">100.00%</TableCell>
              <TableCell className={cn('tnum text-right font-mono', plClass(totals.realized_pl))}>
                {fmt.money(totals.realized_pl)}
              </TableCell>
              <TableCell className="tnum text-right font-mono">{fmt.money(totals.dividends_net)}</TableCell>
            </TableRow>
          ) : null
        }
      />
    </>
  )
}
