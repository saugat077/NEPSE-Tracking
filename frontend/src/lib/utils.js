import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// NEPSE quarters read "Q3 2082/83". Plain string sort is wrong across fiscal
// years ("Q1 2083/84" < "Q4 2082/83"), so sort by [start year, quarter number].
export function quarterKey(q) {
  const m = /^Q(\d)\s+(\d{4})\/(\d{2})$/i.exec((q || '').trim())
  return m ? [parseInt(m[2], 10), parseInt(m[1], 10)] : null
}

// Comparator: parseable quarters sort chronologically; unparseable ones sort
// after, by plain string compare (stable fallback, never throws).
export function compareQuarters(a, b) {
  const ka = quarterKey(a)
  const kb = quarterKey(b)
  if (ka && kb) return ka[0] - kb[0] || ka[1] - kb[1]
  if (ka) return -1
  if (kb) return 1
  return String(a).localeCompare(String(b))
}
