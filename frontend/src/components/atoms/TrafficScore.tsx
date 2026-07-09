import { cn } from '@/utils/cn'
import { getTrafficBand, parsePercent, trafficBandClasses } from '@/utils/trafficSignal'

type TrafficScoreProps = {
  value: string | number
  className?: string
}

export function TrafficScore({ value, className }: TrafficScoreProps) {
  const percent = parsePercent(value)
  if (percent === null) {
    return <span className={className}>{value}</span>
  }

  const band = getTrafficBand(percent)
  const styles = trafficBandClasses(band)
  const label = typeof value === 'string' && value.includes('%') ? value : `${percent}%`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ring-1 ring-inset',
        styles.pill,
        className,
      )}
      title={`${band === 'green' ? 'On track' : band === 'amber' ? 'At risk' : 'Off track'} (${percent}%)`}
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full', styles.dot)} aria-hidden />
      {label}
    </span>
  )
}
