import { ArrowLeftRight, Building2, MapPin, Satellite } from 'lucide-react'
import type { AttendanceIntegration } from '@/types/dashboard'
import { Card } from '@/components/atoms/Card'
import { cn } from '@/utils/cn'

const STATUS_STYLES: Record<string, string> = {
  connected: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  demo: 'bg-amber-50 text-amber-900 border-amber-200',
  disabled: 'bg-gray-100 text-gray-700 border-gray-200',
  needs_configuration: 'bg-orange-50 text-orange-900 border-orange-200',
}

export function AttendanceIntegrationBanner({ data }: { data: AttendanceIntegration }) {
  const statusClass = STATUS_STYLES[data.connection.status] ?? STATUS_STYLES.demo

  return (
    <Card className="overflow-hidden border border-moh-green/20 p-0">
      <div className="bg-gradient-to-r from-moh-green/10 via-white to-amber-50/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-moh-green">{data.title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-700">{data.combined_outcome}</p>
          </div>
          <span className={cn('rounded-sm border px-2 py-1 text-xs font-semibold uppercase', statusClass)}>
            HRM Attend: {data.connection.status}
          </span>
        </div>
        {data.connection.message ? (
          <p className="mt-2 text-xs text-gray-500">{data.connection.message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 border-t border-gray-100 p-5 md:grid-cols-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-moh-green">
            <MapPin className="h-4 w-4" />
            PMS tracks
          </div>
          <ul className="space-y-1 text-sm text-gray-700">
            {data.pms_tracks.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-moh-green">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-blue-800">
            <Building2 className="h-4 w-4" />
            HRM Attend provides
          </div>
          <ul className="space-y-1 text-sm text-gray-700">
            {data.hrm_attend_provides.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-blue-600">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-amber-800">
            <ArrowLeftRight className="h-4 w-4" />
            Exported to HRM
          </div>
          <ul className="space-y-1 text-sm text-gray-700">
            {data.pms_exports_to_hrm.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-amber-600">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50/80 px-5 py-2 text-xs text-gray-500">
        <Satellite className="h-3.5 w-3.5" />
        Endpoint: {data.connection.base_url}
        {data.connection.last_sync_at ? ` · Last sync ${data.connection.last_sync_at}` : ''}
      </div>
    </Card>
  )
}
