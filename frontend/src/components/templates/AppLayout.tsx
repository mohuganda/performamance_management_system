import {
  Navbar,
  Button,
  Menu,
  MenuHandler,
  MenuList,
  MenuItem,
} from '@material-tailwind/react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronDown, LogOut } from 'lucide-react'
import { BrandLogo } from '@/components/atoms/BrandLogo'
import { UserAvatar } from '@/components/atoms/UserAvatar'
import { NotificationBell } from '@/components/molecules/NotificationBell'
import { useAuthStore } from '@/stores/appStore'
import {
  isGroupActive,
  type NavGroup,
  type NavItem,
  visibleNavGroups,
} from '@/app/navigation/navItems'
import { mt } from '@/utils/mt'
import { cn } from '@/utils/cn'

function NavGroupMenu({
  group,
  pathname,
}: {
  group: NavGroup
  pathname: string
}) {
  const active = isGroupActive(group, pathname)
  const GroupIcon = group.icon

  if (group.items.length === 1) {
    const item = group.items[0]
    const Icon = item.icon
    const itemActive = pathname.startsWith(item.path)
    return (
      <NavLink to={item.path}>
        <Button
          {...mt}
          variant="text"
          size="sm"
          className={cn(
            'relative flex items-center gap-1.5 rounded-sm px-3 py-2 normal-case',
            itemActive
              ? 'font-semibold text-ui-text after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-uganda-yellow'
              : 'text-ui-muted hover:bg-ui-subtle hover:text-ui-text',
          )}
        >
          <Icon className="h-4 w-4" />
          {group.label}
        </Button>
      </NavLink>
    )
  }

  return (
    <Menu {...mt} placement="bottom-start">
      <MenuHandler>
        <Button
          {...mt}
          variant="text"
          size="sm"
          className={cn(
            'relative flex items-center gap-1.5 rounded-sm px-3 py-2 normal-case',
            active
              ? 'font-semibold text-ui-text after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-uganda-yellow'
              : 'text-ui-muted hover:bg-ui-subtle hover:text-ui-text',
          )}
        >
          <GroupIcon className="h-4 w-4" />
          {group.label}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </MenuHandler>
      <MenuList {...mt} className="min-w-[240px] rounded-sm border border-ui-border p-1.5 shadow-lg">
        {group.items.map((item) => (
          <NavGroupMenuItem key={item.id} item={item} pathname={pathname} />
        ))}
      </MenuList>
    </Menu>
  )
}

function NavGroupMenuItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon
  const active = pathname.startsWith(item.path)
  return (
    <NavLink to={item.path}>
      <MenuItem
        {...mt}
        className={cn(
          'flex items-start gap-3 rounded-sm py-2.5',
          active ? 'bg-moh-green/10' : 'hover:bg-ui-subtle',
        )}
      >
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'text-moh-green' : 'text-ui-muted')} />
        <div>
          <p className={cn('text-sm font-medium', active ? 'text-moh-green' : 'text-ui-text')}>
            {item.label}
          </p>
          {item.description ? (
            <p className="text-xs text-ui-muted">{item.description}</p>
          ) : null}
        </div>
      </MenuItem>
    </NavLink>
  )
}

export function AppLayout() {
  const { displayName, permissions, logout, quarter, roles, profilePhoto } = useAuthStore()
  const location = useLocation()

  const groups = visibleNavGroups(permissions)
  const roleLabel = roles[0]?.replace(/_/g, ' ') ?? 'User'

  return (
    <div className="flex min-h-screen flex-col bg-ui-bg">
      <header className="border-b border-ui-border bg-ui-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <BrandLogo size="md" />
          <div className="flex items-center gap-2">
            <NotificationBell />
            <NavLink
              to="/profile"
              className="flex items-center gap-3 rounded-sm p-1 transition-colors hover:bg-ui-subtle"
            >
              <UserAvatar name={displayName} photoUrl={profilePhoto} size="md" />
              <div className="hidden text-right text-xs md:block">
                <p className="font-semibold text-ui-text">{displayName}</p>
                <p className="capitalize text-ui-muted">{roleLabel}</p>
              </div>
            </NavLink>
          </div>
        </div>
      </header>

      <Navbar
        {...mt}
        className="sticky top-0 z-40 rounded-none border-b border-ui-border bg-ui-surface px-4 py-0 shadow-sm"
        fullWidth
      >
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 py-2">
          <nav className="hidden items-center gap-0.5 lg:flex">
            {groups.map((group) => (
              <NavGroupMenu key={group.id} group={group} pathname={location.pathname} />
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-ui-muted lg:inline">{quarter}</span>
            <Button
              {...mt}
              variant="outlined"
              size="sm"
              className="flex items-center gap-1 rounded-sm border-ui-border text-ui-text"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-7xl pb-2 lg:hidden">
          {groups.map((group) => (
            <div key={group.id} className="mb-2">
              <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-ui-muted">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {group.items.map((item) => {
                  const active = location.pathname.startsWith(item.path)
                  return (
                    <NavLink key={item.id} to={item.path}>
                      <Button
                        {...mt}
                        size="sm"
                        variant={active ? 'filled' : 'outlined'}
                        className={cn(
                          'rounded-sm px-2 py-1 text-xs normal-case',
                          active ? 'bg-uganda-black' : 'border-ui-border text-ui-text',
                        )}
                      >
                        {item.label}
                      </Button>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Navbar>

      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        <Outlet />
      </main>

      <footer className="border-t border-ui-border bg-ui-surface px-4 py-3 text-center text-xs text-ui-muted">
        Ministry of Health Uganda · Performance Management System (iHRIS)
      </footer>
    </div>
  )
}
