import { cn } from '@/utils/cn'

interface BadgeProps {
  label: string
  tone?: 'success' | 'warning' | 'error' | 'neutral'
}

const tones = {
  success: 'bg-moh-success/15 text-moh-success',
  warning: 'bg-moh-warning/15 text-moh-warning',
  error: 'bg-moh-error/15 text-moh-error',
  neutral: 'bg-gray-100 text-gray-700',
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-1 text-xs font-semibold', tones[tone])}>
      {label}
    </span>
  )
}
