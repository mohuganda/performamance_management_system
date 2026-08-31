import { Satellite } from 'lucide-react'
import type { AttendanceIntegration } from '@/types/dashboard'
import { Card } from '@/components/atoms/Card'
import { cn } from '@/utils/cn'

const STATUS_STYLES: Record<string, string> = {
  connected: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  demo: 'bg-amber-50 text-amber-900 border-amber-200',
  disabled: 'bg-gray-100 text-gray-700 border-gray-200',
  needs_configuration: 'bg-orange-50 text-orange-900 border-orange-200',
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ')
}

function formatSync(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function AttendanceIntegrationBanner({ data }: { data: AttendanceIntegration }) {
  const status = data.connection.status
  const statusClass = STATUS_STYLES[status] ?? STATUS_STYLES.demo
  const lastSync = formatSync(data.connection.last_sync_at)

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 border border-moh-green/20 px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-bold uppercase tracking-wide text-moh-green">HRM Attend</h2>
        <p className="mt-0.5 text-xs text-ui-muted">
          {data.connection.message || 'Duty-station attendance summaries connection'}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ui-muted">
          {data.connection.base_url ? (
            <span className="inline-flex items-center gap-1 truncate">
              <Satellite className="h-3.5 w-3.5 shrink-0" />
              {data.connection.base_url}
            </span>
          ) : null}
          {lastSync ? <span>Last sync {lastSync}</span> : null}
        </div>
      </div>
      <span className={cn('shrink-0 rounded-sm border px-2.5 py-1 text-xs font-semibold uppercase', statusClass)}>
        {formatStatus(status)}
      </span>
    </Card>
  )
}
