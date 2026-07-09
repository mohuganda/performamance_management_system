import { ToastAlert } from '@/components/molecules/ToastAlert'
import { useToastStore } from '@/features/toast/store'

export function ToastViewport() {
  const items = useToastStore((state) => state.items)
  const dismiss = useToastStore((state) => state.dismiss)

  if (items.length === 0) return null

  return (
    <div className="toast-viewport" id="customToastContainer" aria-label="Notifications">
      {items.map((item) => (
        <ToastAlert key={item.id} toast={item} onDismiss={dismiss} />
      ))}
    </div>
  )
}
