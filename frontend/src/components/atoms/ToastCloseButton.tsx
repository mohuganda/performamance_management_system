type ToastCloseButtonProps = {
  onClick: () => void
  label?: string
}

export function ToastCloseButton({ onClick, label = 'Dismiss notification' }: ToastCloseButtonProps) {
  return (
    <button type="button" className="toast-close" onClick={onClick} aria-label={label}>
      &times;
    </button>
  )
}
