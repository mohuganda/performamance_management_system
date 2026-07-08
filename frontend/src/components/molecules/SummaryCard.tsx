import { Card } from '@/components/atoms/Card'
import { cn } from '@/utils/cn'

interface SummaryCardProps {
  title: string
  value: string | number
  hint?: string
  onClick?: () => void
  active?: boolean
  accent?: 'default' | 'green' | 'amber' | 'red'
}

const ACCENT_BORDER = {
  default: 'border-l-ui-border',
  green: 'border-l-moh-green',
  amber: 'border-l-amber-500',
  red: 'border-l-red-600',
} as const

export function SummaryCard({ title, value, hint, onClick, active, accent = 'default' }: SummaryCardProps) {
  const clickable = Boolean(onClick)
  return (
    <Card
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
        'min-w-[140px] flex-1 border-l-4 p-4 transition',
        ACCENT_BORDER[accent],
        clickable && 'cursor-pointer hover:shadow-md hover:ring-2 hover:ring-moh-green/25',
        active && 'ring-2 ring-moh-green shadow-md',
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-ui-muted">{title}</p>
      <p className="mt-2 text-2xl font-bold text-ui-text">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ui-muted">{hint}</p> : null}
      {clickable ? <p className="mt-2 text-[10px] font-medium text-moh-green">View details →</p> : null}
    </Card>
  )
}
