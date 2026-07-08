import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { notificationService } from '@/api/services/notifications'
import { cn } from '@/utils/cn'

export function NotificationBell({ className }: { className?: string }) {
  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationService.unreadCount(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  return (
    <NavLink
      to="/notifications"
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
    </NavLink>
  )
}
