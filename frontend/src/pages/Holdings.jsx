import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api, fmt } from '@/api'
import { TableCell, TableRow } from '@/components/ui/table'
import DataTable, { plClass, signed } from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import { cn } from '@/lib/utils'

export default function Holdings() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/holdings').then(setData).catch((e) => toast.error(e.message))
  }, [])

  if (!data)
    return <p className="font-mono text-[11px] uppercase tracking-[1px] text-[color:var(--muted)]">Loading…</p>

  const { holdings, totals } = data
  const dim = 'text-[color:var(--text2)]'

  const columns = [
    {
      key: 'symbol',
      label: 'Symbol',
      render: (h) => (
        <span className="inline-flex items-center gap-2 font-semibold">
          {h.symbol}
          {!h.active && <span className="tbadge tbadge-outline">Sold Out</span>}
        </span>
      ),
    },
    { key: 'shares', label: 'Shares', align: 'right', render: (h) => fmt.qty(h.shares) },
    { key: 'avg_cost', label: 'Avg Cost', align: 'right', cellClass: dim, render: (h) => fmt.money(h.avg_cost) },
    { key: 'current_price', label: 'LTP', align: 'right', render: (h) => fmt.money(h.current_price) },
    { key: 'invested', label: 'Invested', align: 'right', cellClass: dim, render: (h) => fmt.money(h.invested) },
    { key: 'current_value', label: 'Value', align: 'right', render: (h) => fmt.money(h.current_value) },
    {
      key: 'unrealized_pl',
      label: 'Unrl P&L',
      align: 'right',
      cellClass: (h) => plClass(h.unrealized_pl),
      render: (h) => signed(h.unrealized_pl, fmt.money(h.unrealized_pl)),
    },
    {
      key: 'return_pct',
      label: 'Ret %',
      align: 'right',
      cellClass: (h) => plClass(h.return_pct),
      render: (h) => signed(h.return_pct, fmt.pct(h.return_pct)),
    },
    { key: 'weight_pct', label: 'Weight', align: 'right', cellClass: dim, render: (h) => fmt.pct(h.weight_pct) },
    {
      key: 'realized_pl',
      label: 'Real P&L',
      align: 'right',
      cellClass: (h) => plClass(h.realized_pl),
      render: (h) => (h.realized_pl ? signed(h.realized_pl, fmt.money(h.realized_pl)) : '—'),
    },
    {
      key: 'dividends_net',
      label: 'Div Net',
      align: 'right',
      cellClass: dim,
      render: (h) => (h.dividends_net ? fmt.money(h.dividends_net) : '—'),
    },
  ]

  const totCell = 'tnum whitespace-nowrap px-3 py-[9px] text-right font-semibold'

  return (
    <>
      <PageHeader title="Holdings" description="Weighted-avg cost · fees included · read-only" />
      <DataTable
        columns={columns}
        rows={holdings}
        rowKey="stock_id"
        empty={{
          title: 'No holdings yet',
          hint: 'Holdings appear automatically once you record transactions',
        }}
        footer={
          holdings.length ? (
            <TableRow className="bg-[color:var(--panel2)] hover:bg-[color:var(--panel2)]">
              <TableCell className="px-3 py-[9px] text-[10px] font-bold uppercase tracking-[1px]">
                Total
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell className={totCell}>{fmt.money(totals.invested)}</TableCell>
              <TableCell className={totCell}>{fmt.money(totals.current_value)}</TableCell>
              <TableCell className={cn(totCell, plClass(totals.unrealized_pl))}>
                {signed(totals.unrealized_pl, fmt.money(totals.unrealized_pl))}
              </TableCell>
              <TableCell className={cn(totCell, plClass(totals.return_pct))}>
                {signed(totals.return_pct, fmt.pct(totals.return_pct))}
              </TableCell>
              <TableCell className={totCell}>100.00%</TableCell>
              <TableCell className={cn(totCell, plClass(totals.realized_pl))}>
                {totals.realized_pl ? signed(totals.realized_pl, fmt.money(totals.realized_pl)) : '—'}
              </TableCell>
              <TableCell className={totCell}>{fmt.money(totals.dividends_net)}</TableCell>
            </TableRow>
          ) : null
        }
      />
    </>
  )
}
