import { useMemo } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { oosService } from '@/api/services/mobile'
import { useAuthStore } from '@/stores/appStore'
import { OosHistoryCard, type OosRequestItem } from './OosHistoryCard'

interface OosHistoryTabProps {
  onSelectRequest?: (req: OosRequestItem) => void
}

export function OosHistoryTab({ onSelectRequest }: OosHistoryTabProps) {
  const { t } = useTranslation()
  const { staffId } = useAuthStore()

  const requestsQuery = useQuery({
    queryKey: ['oos', 'requests'],
    queryFn: () => oosService.listRequests(),
    enabled: Boolean(staffId),
  })

  const reasonsQuery = useQuery({
    queryKey: ['oos', 'reasons'],
    queryFn: () => oosService.listReasons(),
  })

  const requests: OosRequestItem[] = useMemo(() => {
    const raw = Array.isArray(requestsQuery.data)
      ? requestsQuery.data
      : (requestsQuery.data as { data?: unknown[] })?.data
    if (!Array.isArray(raw)) return []

    return raw.map((row: any) => ({
      id: row.id ?? row.ID,
      remote_id: row.remote_id ?? row.RemoteID ?? row.id ?? row.ID,
      reason_id: row.reason_id ?? row.ReasonID,
      reason_name: row.reason_name ?? row.ReasonName ?? row.reason,
      start_date: row.start_date ?? row.StartDate,
      end_date: row.end_date ?? row.EndDate,
      destination_name: row.destination_name ?? row.DestinationName ?? '',
      destination_address: row.destination_address ?? row.DestinationAddress,
      destination_latitude: row.destination_latitude ?? row.DestinationLatitude,
      destination_longitude: row.destination_longitude ?? row.DestinationLongitude,
      expected_deliverables: row.expected_deliverables ?? row.ExpectedDeliverables,
      remarks: row.remarks ?? row.Remarks,
      status: row.status ?? row.Status ?? 'pending',
      sync_error: row.sync_error ?? row.SyncError,
    }))
  }, [requestsQuery.data])

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const dateA = new Date(a.start_date).getTime()
      const dateB = new Date(b.start_date).getTime()
      return dateB - dateA
    })
  }, [requests])

  const reasonsMap = useMemo(() => {
    const map = new Map<number | string, string>()
    const list = Array.isArray(reasonsQuery.data)
      ? reasonsQuery.data
      : (reasonsQuery.data as { data?: any[] })?.data
    if (Array.isArray(list)) {
      list.forEach((r: any) => {
        const id = r.id ?? r.ID
        const reason = r.reason ?? r.Reason
        if (id && reason) {
          map.set(String(id), String(reason))
        }
      })
    }
    return map
  }, [reasonsQuery.data])

  if (requestsQuery.isLoading && requests.length === 0) {
    return (
      <div className="flex-1 justify-center items-center py-16 flex flex-col">
        <Loader2 size={24} className="animate-spin text-emerald-600 mb-3" />
        <p className="text-xs text-ui-muted font-medium">
          {t('oos_history_loading', 'Loading travel requests...')}
        </p>
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="flex-1 px-4 py-16 flex flex-col justify-center items-center text-center">
        <FileText size={36} className="text-ui-border mb-3" />
        <h3 className="text-sm font-medium text-ui-text">
          {t('oos_history_empty_title', 'No travel requests found.')}
        </h3>
        <p className="text-xs text-ui-muted mt-1">
          {t('oos_history_empty_subtitle', "Tap 'New Application' to submit an out of station request.")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 px-4 py-3">
      <h2 className="text-xs font-bold uppercase tracking-wider mb-4 text-ui-muted">
        {t('oos_history_title', 'Travel History')}
      </h2>

      <div className="space-y-4 pb-12">
        {sortedRequests.map((req) => (
          <OosHistoryCard
            key={req.remote_id || req.id}
            request={req}
            reasonsMap={reasonsMap}
            onClick={onSelectRequest ? () => onSelectRequest(req) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
