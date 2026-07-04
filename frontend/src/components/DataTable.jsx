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
 * Terminal data table: dense mono figures, 9px letter-spaced uppercase headers,
 * soft row separators, hover highlight.
 * columns: [{ key, label, align, render(row), cellClass }]
 */
export default function DataTable({ columns, rows, rowKey = 'id', empty, footer }) {
  if (!rows.length && empty) {
    return (
      <div className="rounded-[6px] border border-dashed bg-[color:var(--panel)] px-6 py-14 text-center">
        <p className="text-sm font-semibold">{empty.title}</p>
        <p className="mt-1.5 text-xs text-[color:var(--muted)]">{empty.hint}</p>
        {empty.action}
      </div>
    )
  }
  return (
    <div className="panel overflow-x-auto">
      <Table className="font-mono text-xs">
        <TableHeader>
          <TableRow className="border-b hover:bg-transparent">
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={cn(
                  'h-auto whitespace-nowrap px-3 py-2.5 font-sans text-[11px] font-medium text-[color:var(--muted)]',
                  c.align === 'right' && 'text-right',
                  c.align === 'center' && 'text-center',
                )}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row[rowKey]}
              className="border-b border-[color:var(--border-soft)] hover:bg-[color:var(--hover)]"
            >
              {columns.map((c) => (
                <TableCell
                  key={c.key}
                  className={cn(
                    'whitespace-nowrap px-3 py-2',
                    c.align === 'right' && 'tnum text-right',
                    c.align === 'center' && 'text-center',
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
  if (v > 0) return 'up font-semibold'
  if (v < 0) return 'down font-semibold'
  return ''
}

export function signed(v, formatted) {
  return `${v >= 0 ? '+' : ''}${formatted}`
}
