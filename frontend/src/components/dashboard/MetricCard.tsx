import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/atoms/Card'
import { cn } from '@/utils/cn'

const ACCENT_STYLES = {
  green: 'border-l-moh-green bg-emerald-50/60',
  amber: 'border-l-amber-500 bg-amber-50/50',
  blue: 'border-l-blue-600 bg-blue-50/50',
  red: 'border-l-red-600 bg-red-50/40',
  purple: 'border-l-purple-600 bg-purple-50/40',
} as const

const ICON_STYLES = {
  green: 'bg-moh-green/10 text-moh-green',
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-blue-100 text-blue-800',
  red: 'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-800',
} as const

type Accent = keyof typeof ACCENT_STYLES

interface MetricCardProps {
  title: string
  value: string | number
  hint?: string
  icon: LucideIcon
  accent?: Accent
  onClick?: () => void
  active?: boolean
}

export function MetricCard({ title, value, hint, icon: Icon, accent = 'green', onClick, active }: MetricCardProps) {
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
        ACCENT_STYLES[accent],
        clickable && 'cursor-pointer hover:shadow-md hover:ring-2 hover:ring-moh-green/25',
        active && 'ring-2 ring-moh-green shadow-md',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{title}</p>
          <p className="mt-2 text-2xl font-bold text-ui-text">{value}</p>
          {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
          {clickable ? <p className="mt-2 text-[10px] font-medium text-moh-green">View details →</p> : null}
        </div>
        <div className={cn('rounded-sm p-2', ICON_STYLES[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}
