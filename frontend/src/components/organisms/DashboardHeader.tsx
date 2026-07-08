import { Badge } from '@/components/atoms/Badge'
import { Card } from '@/components/atoms/Card'

interface DashboardHeaderProps {
  title: string
  welcome: string
  context: string
  quarter: string
}

export function DashboardHeader({ title, welcome, context, quarter }: DashboardHeaderProps) {
  return (
    <Card className="border-l-4 border-l-uganda-yellow">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ui-muted">
            Ministry of Health Uganda
          </p>
          <h1 className="text-xl font-semibold text-ui-text md:text-2xl">{title}</h1>
          <p className="text-sm text-ui-text">{welcome}</p>
          <p className="text-sm text-ui-muted">{context}</p>
        </div>
        <Badge label={quarter} tone="neutral" />
      </div>
    </Card>
  )
}
