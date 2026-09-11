import { format, parseISO } from 'date-fns'

/** Read the first present value from PascalCase / snake_case API fields. */
export function pickField(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

export function pickString(row: Record<string, unknown>, ...keys: string[]): string {
  const value = pickField(row, ...keys)
  return value == null ? '' : String(value)
}

export function formatRequestDate(value: unknown): string {
  if (value == null || value === '') return '—'
  const raw = String(value).trim()
  try {
    const date = raw.includes('T') ? parseISO(raw) : parseISO(raw.slice(0, 10))
    if (Number.isNaN(date.getTime())) return raw.slice(0, 10) || '—'
    return format(date, 'dd MMM yyyy')
  } catch {
    return raw.slice(0, 10) || '—'
  }
}

export function formatRequestPeriod(row: Record<string, unknown>): string {
  const start = formatRequestDate(pickField(row, 'start_date', 'StartDate'))
  const end = formatRequestDate(pickField(row, 'end_date', 'EndDate'))
  if (start === '—' && end === '—') return '—'
  return `${start} – ${end}`
}

export function requestStatus(row: Record<string, unknown>): string {
  return pickString(row, 'status', 'Status') || 'pending'
}

export function statusTone(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  const normalized = status.trim().toLowerCase()
  if (['approved', 'completed', 'finalized', 'active'].includes(normalized)) return 'success'
  if (['pending', 'submitted', 'in_review', 'in-review'].includes(normalized)) return 'warning'
  if (['rejected', 'returned', 'cancelled', 'canceled', 'declined'].includes(normalized)) return 'error'
  return 'neutral'
}
