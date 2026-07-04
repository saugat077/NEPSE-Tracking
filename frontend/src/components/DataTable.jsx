import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

/**
 * Generic data table.
 * columns: [{ key, label, align ('right'|'left'), render(row), cellClass }]
 * `empty` is shown when rows is empty. `footer` is an optional <TableRow>.
 */
export default function DataTable({ columns, rows, rowKey = 'id', empty, footer }) {
  if (!rows.length && empty) {
    return (
      <div className="rounded-lg border border-dashed bg-card px-6 py-14 text-center">
        <p className="font-medium">{empty.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{empty.hint}</p>
        {empty.action}
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={cn('whitespace-nowrap', c.align === 'right' && 'text-right')}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row[rowKey]}>
              {columns.map((c) => (
                <TableCell
                  key={c.key}
                  className={cn(
                    'whitespace-nowrap',
                    c.align === 'right' && 'tnum text-right font-mono',
                    typeof c.cellClass === 'function' ? c.cellClass(row) : c.cellClass,
                  )}
                >
                  {c.render ? c.render(row) : row[c.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {footer}
        </TableBody>
      </Table>
    </div>
  )
}

export function plClass(v) {
  if (v > 0) return 'text-emerald-600 dark:text-emerald-400'
  if (v < 0) return 'text-red-600 dark:text-red-400'
  return ''
}
