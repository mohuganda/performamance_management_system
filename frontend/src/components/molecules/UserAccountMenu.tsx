import { useQuery } from '@tanstack/react-query'
import { Menu, MenuHandler, MenuItem, MenuList } from '@material-tailwind/react'
import { Bell, ChevronDown, Monitor, Moon, Sun, User } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { notificationService } from '@/api/services/notifications'
import { UserAvatar } from '@/components/atoms/UserAvatar'
import { NotificationBell } from '@/components/molecules/NotificationBell'
import { ThemeAppearancePicker } from '@/components/molecules/ThemeAppearancePicker'
import {
  resolveTheme,
  useThemeStore,
  type ThemePreference,
} from '@/stores/themeStore'
import { mt } from '@/utils/mt'

type UserAccountMenuProps = {
  displayName: string
  roleLabel: string
  profilePhoto: string | null
}

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  const resolved = resolveTheme(preference)
  if (preference === 'system') return <Monitor className="h-4 w-4 text-ui-muted" />
  if (resolved === 'dark') return <Moon className="h-4 w-4 text-ui-muted" />
  return <Sun className="h-4 w-4 text-ui-muted" />
}

export function UserAccountMenu({ displayName, roleLabel, profilePhoto }: UserAccountMenuProps) {
  const preference = useThemeStore((s) => s.preference)
  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationService.unreadCount(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  return (
    <div className="flex items-center gap-1">
      <NotificationBell />
      <Menu {...mt} placement="bottom-end">
        <MenuHandler>
          <button
            type="button"
            className="flex items-center gap-2 rounded-sm p-1 text-left transition-colors hover:bg-ui-subtle"
            aria-label="Account menu"
          >
            <UserAvatar name={displayName} photoUrl={profilePhoto} size="md" />
            <div className="hidden min-w-0 md:block">
              <p className="truncate text-sm font-semibold text-ui-text">{displayName}</p>
              <p className="truncate text-xs capitalize text-ui-muted">{roleLabel}</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 shrink-0 text-ui-muted md:block" />
          </button>
        </MenuHandler>
        <MenuList {...mt} className="min-w-[260px] rounded-sm border border-ui-border bg-ui-surface p-1.5 shadow-lg">
          <div className="border-b border-ui-border px-3 py-2 md:hidden">
            <p className="text-sm font-semibold text-ui-text">{displayName}</p>
            <p className="text-xs capitalize text-ui-muted">{roleLabel}</p>
          </div>
          <NavLink to="/notifications">
            <MenuItem
              {...mt}
              className="flex items-center gap-3 rounded-sm py-2.5 hover:bg-ui-subtle"
            >
              <Bell className="h-4 w-4 text-ui-muted" />
              <span className="flex flex-1 items-center justify-between gap-2 text-sm font-medium text-ui-text">
                Notifications
                {unread > 0 ? (
                  <span className="rounded-full bg-moh-warning px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                ) : null}
              </span>
            </MenuItem>
          </NavLink>
          <NavLink to="/profile">
            <MenuItem
              {...mt}
              className="flex items-center gap-3 rounded-sm py-2.5 hover:bg-ui-subtle"
            >
              <User className="h-4 w-4 text-ui-muted" />
              <span className="text-sm font-medium text-ui-text">My Profile</span>
            </MenuItem>
          </NavLink>
          <div className="mt-1 border-t border-ui-border px-2 pt-2">
            <div className="mb-2 flex items-center gap-2 px-1">
              <ThemeIcon preference={preference} />
              <p className="text-xs font-bold uppercase tracking-wide text-ui-muted">Appearance</p>
            </div>
            <ThemeAppearancePicker compact />
          </div>
        </MenuList>
      </Menu>
    </div>
  )
}
