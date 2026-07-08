import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, Typography, Button, Chip } from '@material-tailwind/react'
import { AlertTriangle, Bell, CheckCircle, Clock, CheckCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { notificationService, type NotificationRow } from '@/api/services/notifications'
import { PageHeader } from '@/components/organisms/PageHeader'
import { QueryState } from '@/components/organisms/QueryState'
import { mt } from '@/utils/mt'
import { cn } from '@/utils/cn'

const iconMap = {
  warning: AlertTriangle,
  info: Clock,
  success: CheckCircle,
  error: AlertTriangle,
} as const

const colorMap = {
  warning: 'text-moh-warning',
  info: 'text-moh-green',
  success: 'text-moh-success',
  error: 'text-moh-error',
} as const

function formatWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const listQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.list({ per_page: 50 }),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationService.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })

  const markAllMutation = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })

  const rows = listQuery.data?.data ?? []
  const unread = rows.filter((r) => !r.is_read).length

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Approvals, deadlines, and system alerts for your account"
        actions={
          unread > 0 ? (
            <Button
              {...mt}
              size="sm"
              variant="outlined"
              className="flex items-center gap-1 rounded-sm border-moh-green/30 normal-case text-moh-green"
              disabled={markAllMutation.isPending}
              onClick={() => markAllMutation.mutate()}
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <QueryState
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        error={listQuery.error}
        label="notifications"
        variant="cards"
        onRetry={() => listQuery.refetch()}
      >
        <Card {...mt} className="rounded-sm border border-moh-green/15 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-moh-gold" />
              <Typography {...mt} className="text-sm font-bold uppercase text-moh-green">
                Inbox
              </Typography>
              {unread > 0 ? (
                <Chip
                  {...mt}
                  value={`${unread} unread`}
                  size="sm"
                  className="rounded-sm bg-moh-warning/15 text-moh-warning"
                />
              ) : null}
            </div>
          </div>

          {rows.length === 0 ? (
            <Typography {...mt} className="py-8 text-center text-sm text-gray-500">
              No notifications yet. Alerts for leave, performance, and approvals will appear here.
            </Typography>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map((alert) => (
                <NotificationItem
                  key={alert.id}
                  alert={alert}
                  onMarkRead={(id) => markReadMutation.mutate(id)}
                  marking={markReadMutation.isPending}
                />
              ))}
            </ul>
          )}
        </Card>
      </QueryState>
    </div>
  )
}

function NotificationItem({
  alert,
  onMarkRead,
  marking,
}: {
  alert: NotificationRow
  onMarkRead: (id: number) => void
  marking: boolean
}) {
  const Icon = iconMap[alert.type as keyof typeof iconMap] ?? Clock
  const content = (
    <>
      <Icon
        className={cn(
          'mt-0.5 h-5 w-5 shrink-0',
          colorMap[alert.type as keyof typeof colorMap] ?? 'text-gray-500',
        )}
      />
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Typography {...mt} className="font-semibold text-gray-800">
            {alert.title}
          </Typography>
          {!alert.is_read ? (
            <span className="h-2 w-2 rounded-full bg-moh-warning" aria-label="Unread" />
          ) : null}
          <span className="rounded-sm bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
            {alert.category}
          </span>
        </div>
        <Typography {...mt} className="text-sm text-gray-600">
          {alert.message}
        </Typography>
        <Typography {...mt} className="mt-1 text-xs text-gray-400">
          {formatWhen(alert.created_at)}
        </Typography>
        <div className="mt-2 flex flex-wrap gap-2">
          {alert.action_url ? (
            <Link
              to={alert.action_url}
              className="text-xs font-medium text-moh-green hover:underline"
            >
              View details →
            </Link>
          ) : null}
          {!alert.is_read ? (
            <button
              type="button"
              className="text-xs font-medium text-gray-500 hover:text-moh-green"
              disabled={marking}
              onClick={() => onMarkRead(alert.id)}
            >
              Mark as read
            </button>
          ) : null}
        </div>
      </div>
    </>
  )

  return (
    <li
      className={cn(
        'flex gap-3 py-4',
        !alert.is_read && 'bg-moh-green/[0.03] -mx-2 rounded-sm px-2',
      )}
    >
      {content}
    </li>
  )
}
