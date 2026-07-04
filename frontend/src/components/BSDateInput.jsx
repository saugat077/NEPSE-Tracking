import { Input } from '@/components/ui/input'

const BS_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidBSDate(value) {
  return BS_RE.test(value)
}

/** Text input for Nepali (BS) dates like 2083-01-31 — no calendar conversion. */
export default function BSDateInput({ value, onChange, id, required }) {
  const invalid = value !== '' && !isValidBSDate(value)
  return (
    <div>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="2083-01-31"
        inputMode="numeric"
        required={required}
        aria-invalid={invalid}
        className={invalid ? 'border-destructive focus-visible:ring-destructive/40' : ''}
      />
      {invalid ? (
        <p className="mt-1 text-xs text-destructive" role="alert">
          Use BS date format YYYY-MM-DD, e.g. 2083-01-31
        </p>
      ) : null}
    </div>
  )
}
