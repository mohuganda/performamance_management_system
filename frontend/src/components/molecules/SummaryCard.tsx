import { Card } from '@/components/atoms/Card'

interface SummaryCardProps {
  title: string
  value: string | number
  hint?: string
}

export function SummaryCard({ title, value, hint }: SummaryCardProps) {
  return (
    <Card className="min-w-[140px] flex-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-ui-muted">{title}</p>
      <p className="mt-2 text-2xl font-bold text-ui-text">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ui-muted">{hint}</p> : null}
    </Card>
  )
}
