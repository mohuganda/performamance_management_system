import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/utils/cn'

export type FormStatusType = 'success' | 'error' | 'warning' | 'info'

const STYLES: Record<FormStatusType, { box: string; icon: string }> = {
  success: {
    box: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: 'text-emerald-600',
  },
  error: {
    box: 'border-red-200 bg-red-50 text-red-900',
    icon: 'text-red-600',
  },
  warning: {
    box: 'border-amber-200 bg-amber-50 text-amber-950',
    icon: 'text-amber-700',
  },
  info: {
    box: 'border-blue-200 bg-blue-50 text-blue-900',
    icon: 'text-blue-700',
  },
}

function StatusIcon({ type }: { type: FormStatusType }) {
  const className = cn('mt-0.5 h-4 w-4 shrink-0', STYLES[type].icon)
  if (type === 'success') return <CheckCircle2 className={className} aria-hidden />
  if (type === 'error') return <AlertCircle className={className} aria-hidden />
  if (type === 'warning') return <AlertCircle className={className} aria-hidden />
  return <Info className={className} aria-hidden />
}

export function FormStatusAlert({
  type,
  title,
  message,
  onDismiss,
  className,
}: {
  type: FormStatusType
  title?: string
  message: string
  onDismiss?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-sm border px-4 py-3 text-sm',
        STYLES[type].box,
        className,
      )}
    >
      <StatusIcon type={type} />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <p className={cn(title ? 'mt-0.5' : '')}>{message}</p>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-sm p-0.5 opacity-70 transition hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}
