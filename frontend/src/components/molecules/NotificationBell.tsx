import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Menu, MenuHandler, MenuItem, MenuList } from '@material-tailwind/react'
import { NavLink } from 'react-router-dom'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { notificationService, type NotificationRow } from '@/api/services/notifications'
import { cn } from '@/utils/cn'
import { mt } from '@/utils/mt'

function typeClass(type: NotificationRow['type']) {
  if (type === 'error') return 'text-moh-error'
  if (type === 'warning') return 'text-moh-warning'
  if (type === 'success') return 'text-moh-success'
  return 'text-ui-text'
}

export function NotificationBell({ className }: { className?: string }) {
  const queryClient = useQueryClient()

  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationService.unreadCount(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const { data: unreadList } = useQuery({
    queryKey: ['notifications', 'unread-preview'],
    queryFn: () => notificationService.list({ unread_only: true, per_page: 8 }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationService.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-preview'] })
    },
  })

  const markAllMutation = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-preview'] })
    },
  })

  const rows = unreadList?.data ?? []

  return (
    <Menu {...mt} placement="bottom-end">
      <MenuHandler>
        <button
          type="button"
          className={cn(
            'relative inline-flex h-10 w-10 items-center justify-center rounded-sm text-ui-muted transition-colors hover:bg-ui-subtle hover:text-ui-text',
            className,
          )}
          aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-moh-warning px-1 text-[10px] font-bold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      </MenuHandler>
      <MenuList
        {...mt}
        className="z-[80] max-h-[min(70vh,420px)] w-[min(100vw-2rem,360px)] overflow-y-auto rounded-sm border border-ui-border bg-ui-surface p-0 shadow-lg"
      >
        <div className="flex items-center justify-between gap-2 border-b border-ui-border px-3 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-ui-text">Notifications</p>
          {unread > 0 ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-moh-green hover:underline"
              disabled={markAllMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                markAllMutation.mutate()
              }}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-ui-muted">No unread notifications</div>
        ) : (
          <ul className="divide-y divide-ui-border">
            {rows.map((item) => (
              <li key={item.id} className="px-1 py-1">
                <div className="rounded-sm px-2 py-2 hover:bg-ui-subtle">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-xs font-semibold', typeClass(item.type))}>{item.title}</p>
                      <p className={cn('mt-0.5 line-clamp-2 text-xs', typeClass(item.type))}>{item.message}</p>
                      {item.action_url ? (
                        <NavLink
                          to={item.action_url}
                          className="mt-1 inline-block text-[11px] font-semibold text-moh-green hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open
                        </NavLink>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      title="Mark as read"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-ui-muted hover:bg-ui-surface hover:text-moh-green"
                      disabled={markReadMutation.isPending}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        markReadMutation.mutate(item.id)
                      }}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-ui-border p-1">
          <NavLink to="/notifications">
            <MenuItem {...mt} className="rounded-sm py-2.5 text-center text-sm font-semibold text-moh-green hover:bg-ui-subtle">
              View all notifications
            </MenuItem>
          </NavLink>
        </div>
      </MenuList>
    </Menu>
  )
}
