import { cn } from '@/utils/cn'

interface SummaryCardProps {
  title: string
  value: string | number
  hint?: string
  onClick?: () => void
  active?: boolean
  accent?: 'default' | 'green' | 'amber' | 'red'
}

const ACCENT_BAR = {
  default: 'bg-ui-text',
  green: 'bg-moh-green',
  amber: 'bg-amber-500',
  red: 'bg-red-600',
} as const

export function SummaryCard({ title, value, hint, onClick, active, accent = 'default' }: SummaryCardProps) {
  const clickable = Boolean(onClick)
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={cn(
        'dashboard-stat-card relative min-w-[140px] flex-1 overflow-hidden rounded-sm bg-ui-surface p-4 pl-5 transition',
        clickable && 'cursor-pointer hover:bg-ui-subtle/80',
        active && 'bg-moh-green/10',
      )}
    >
      <span
        aria-hidden
        className={cn('pointer-events-none absolute inset-y-0 left-0 w-1', ACCENT_BAR[accent])}
      />
      <p className="text-xs font-semibold uppercase tracking-wide text-ui-muted">{title}</p>
      <p className="mt-2 text-2xl font-bold text-ui-text">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ui-muted">{hint}</p> : null}
      {clickable ? <p className="mt-2 text-[10px] font-medium text-moh-green">View details →</p> : null}
    </div>
  )
}
