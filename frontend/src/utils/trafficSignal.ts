export type TrafficBand = 'green' | 'amber' | 'red'

const ON_TRACK_THRESHOLD = 80
const AT_RISK_THRESHOLD = 60

export function parsePercent(value: string | number): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = String(value).trim().replace('%', '')
  const n = Number.parseFloat(text)
  return Number.isFinite(n) ? n : null
}

export function getTrafficBand(percent: number): TrafficBand {
  if (percent >= ON_TRACK_THRESHOLD) return 'green'
  if (percent >= AT_RISK_THRESHOLD) return 'amber'
  return 'red'
}

export function trafficBandClasses(band: TrafficBand) {
  switch (band) {
    case 'green':
      return {
        dot: 'bg-emerald-500',
        text: 'text-emerald-700',
        pill: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
      }
    case 'amber':
      return {
        dot: 'bg-amber-500',
        text: 'text-amber-800',
        pill: 'bg-amber-50 text-amber-900 ring-amber-200',
      }
    case 'red':
      return {
        dot: 'bg-red-500',
        text: 'text-red-700',
        pill: 'bg-red-50 text-red-800 ring-red-200',
      }
  }
}

const SCORE_COLUMNS = new Set([
  'Task %',
  'Attendance',
  'Avg Task %',
  '% Complete',
  'Combined',
  'OOS rate',
  'HRM summary',
  'PMS OOS',
])

export function isScoreColumn(column: string) {
  return SCORE_COLUMNS.has(column) || column.includes('%')
}

export function statusTone(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  const s = status.toLowerCase()
  if (s.includes('off')) return 'error'
  if (s.includes('risk') || s.includes('below')) return 'warning'
  if (s.includes('on track') || s.includes('on target') || s.includes('exceed')) return 'success'
  return 'neutral'
}
