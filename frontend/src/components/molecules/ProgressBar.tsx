interface ProgressBarProps {
  value: number
  label?: string
  sublabel?: string
  onClick?: () => void
  active?: boolean
}

export function ProgressBar({ value, label, sublabel, onClick, active }: ProgressBarProps) {
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
      className={clickable ? `space-y-2 rounded-sm p-2 transition hover:bg-moh-green/5 ${active ? 'ring-2 ring-moh-green' : ''}` : 'space-y-2'}
    >
      {(label || sublabel) && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-ui-text">{label}</span>
          <span className="text-ui-muted">{sublabel}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-sm bg-ui-border">
        <div
          className="h-full rounded-sm bg-uganda-black transition-all"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <p className="text-sm font-semibold text-ui-text">{value}%</p>
      {clickable ? <p className="text-[10px] font-medium text-moh-green">View on-track detail →</p> : null}
    </div>
  )
}
