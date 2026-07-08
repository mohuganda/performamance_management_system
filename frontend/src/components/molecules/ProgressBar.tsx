interface ProgressBarProps {
  value: number
  label?: string
  sublabel?: string
}

export function ProgressBar({ value, label, sublabel }: ProgressBarProps) {
  return (
    <div className="space-y-2">
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
    </div>
  )
}
