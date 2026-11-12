import { Calendar, MapPin, CheckCircle2, AlertTriangle, Clock, RefreshCw, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/utils/cn'

export interface OosRequestItem {
  id: number | string
  remote_id?: number | null
  reason_id?: number | string
  reason_name?: string
  start_date: string
  end_date: string
  destination_name: string
  destination_address?: string | null
  status: string
  sync_error?: string | null
  [key: string]: unknown
}

interface OosHistoryCardProps {
  request: OosRequestItem
  reasonsMap?: Map<number | string, string>
  onClick?: () => void
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function OosHistoryCard({ request, reasonsMap, onClick }: OosHistoryCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const rawStatus = (request.status || 'pending').toLowerCase()
  const reasonLabel =
    request.reason_name ||
    (request.reason_id && reasonsMap?.get(String(request.reason_id))) ||
    'Travel Assignment'

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          bg: 'bg-green-500/10 dark:bg-green-500/20',
          border: 'border-green-500/30',
          text: 'text-green-700 dark:text-green-400',
          Icon: CheckCircle2,
          label: t('oos_approved_status', 'Approved'),
        }
      case 'rejected':
        return {
          bg: 'bg-red-500/10 dark:bg-red-500/20',
          border: 'border-red-500/30',
          text: 'text-red-700 dark:text-red-400',
          Icon: AlertTriangle,
          label: t('oos_rejected_status', 'Rejected'),
        }
      case 'pending_sync':
        return {
          bg: 'bg-blue-500/10 dark:bg-blue-500/20',
          border: 'border-blue-500/30',
          text: 'text-blue-700 dark:text-blue-400',
          Icon: RefreshCw,
          label: t('oos_pending_sync_status', 'Pending Sync'),
        }
      case 'sync_failed':
        return {
          bg: 'bg-red-500/10 dark:bg-red-500/20',
          border: 'border-red-500/30',
          text: 'text-red-700 dark:text-red-400',
          Icon: AlertTriangle,
          label: 'Sync Failed',
        }
      case 'draft':
        return {
          bg: 'bg-gray-500/10 dark:bg-gray-500/20',
          border: 'border-gray-500/30',
          text: 'text-gray-700 dark:text-gray-400',
          Icon: Clock,
          label: t('oos_draft_status', 'Draft'),
        }
      default:
        return {
          bg: 'bg-amber-500/10 dark:bg-amber-500/20',
          border: 'border-amber-500/30',
          text: 'text-amber-700 dark:text-amber-400',
          Icon: Clock,
          label: t('oos_pending_status', 'Pending'),
        }
    }
  }

  const statusStyle = getStatusStyles(rawStatus)
  const StatusIcon = statusStyle.Icon
  const isSyncFailed = rawStatus === 'sync_failed'

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      const targetId = request.remote_id || request.id
      navigate(`/out-of-station/${targetId}`)
    }
  }

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      className={cn(
        'p-4 border shadow-sm rounded-none bg-ui-surface border-ui-border transition-all cursor-pointer hover:border-ui-muted/50 focus:outline-none focus:ring-1 focus:ring-emerald-600',
        isSyncFailed && 'border-l-4 border-l-red-500',
      )}
    >
      {/* Header: Reason & Status */}
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-base font-bold text-ui-text flex-1 mr-2 leading-tight">
          {reasonLabel}
        </h3>
        <div
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 border shrink-0',
            statusStyle.bg,
            statusStyle.border,
          )}
        >
          <StatusIcon size={12} className={statusStyle.text} />
          <span className={cn('text-[10px] font-bold capitalize', statusStyle.text)}>
            {statusStyle.label}
          </span>
        </div>
      </div>

      {/* Travel Period */}
      <div className="flex items-center gap-2 mb-2">
        <Calendar size={14} className="text-ui-muted shrink-0" />
        <span className="text-xs font-medium text-ui-text">
          {formatDate(request.start_date)} to {formatDate(request.end_date)}
        </span>
      </div>

      {/* Destination */}
      <div className="flex items-start gap-2 mb-3">
        <MapPin size={14} className="text-ui-muted shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-ui-text truncate">
            {request.destination_name}
          </p>
          {request.destination_address && (
            <p className="text-[11px] text-ui-muted mt-0.5 line-clamp-2">
              {request.destination_address}
            </p>
          )}
        </div>
      </div>

      {/* Sync Error Banner if applicable */}
      {isSyncFailed && request.sync_error && (
        <div className="bg-red-50 dark:bg-red-900/20 p-2 border border-red-200 dark:border-red-800 rounded-none mt-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 dark:text-red-400 flex-1">
            {request.sync_error}
          </p>
        </div>
      )}

      {/* View Details Footer matching Mobile */}
      <div className="mt-3 pt-2.5 border-t border-ui-border/50 flex justify-between items-center">
        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
          {rawStatus === 'approved'
            ? t('oos_action_view_and_clockin', 'View Details & Duty Attendance →')
            : t('oos_action_view_details', 'View Trip Details →')}
        </span>
        <ChevronRight size={14} className="text-emerald-700 dark:text-emerald-400" />
      </div>
    </div>
  )
}
