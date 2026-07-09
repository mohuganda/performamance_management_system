import { ToastCloseButton } from '@/components/atoms/ToastCloseButton'
import { ToastTypeIcon } from '@/components/atoms/ToastTypeIcon'
import type { ToastRecord } from '@/features/toast/types'
import { cn } from '@/utils/cn'

type ToastAlertProps = {
  toast: ToastRecord
  onDismiss: (id: string) => void
}

export function ToastAlert({ toast, onDismiss }: ToastAlertProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('toast-item', toast.type, toast.visible && 'show')}
    >
      <ToastTypeIcon type={toast.type} />
      <div className="toast-content">
        <p className="toast-title">{toast.title}</p>
        <p className="toast-message">{toast.message}</p>
      </div>
      <ToastCloseButton onClick={() => onDismiss(toast.id)} />
    </div>
  )
}
