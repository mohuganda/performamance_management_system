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
import { UserAccountMenu } from '@/components/molecules/UserAccountMenu'
import { useAuthStore } from '@/stores/appStore'
import { useUiPreferencesStore } from '@/stores/uiPreferencesStore'
import { redirectToLogin } from '@/utils/authRedirect'
import {
  collectNavPaths,
  isGroupActive,
  isNavPathActive,
  type NavGroup,
  type NavItem,
  visibleNavGroups,
} from '@/app/navigation/navItems'
import { canManagePreferencesAdmin } from '@/constants/settingsPermissions'
import { mt } from '@/utils/mt'
import { cn } from '@/utils/cn'

function NavGroupMenu({
  group,
  pathname,
  navPaths,
}: {
  group: NavGroup
  pathname: string
  navPaths: string[]
}) {
  const active = isGroupActive(group, pathname, navPaths)
  const GroupIcon = group.icon

  if (group.items.length === 1) {
    const item = group.items[0]
    const Icon = item.icon
    const itemActive = isNavPathActive(pathname, item.path, navPaths)
    return (
      <NavLink to={item.path}>
        <Button
          {...mt}
          variant="text"
          size="sm"
          className={cn(
            'app-nav-item relative flex items-center gap-1.5 rounded-sm px-3 py-2 normal-case',
            itemActive ? 'app-nav-item-active font-semibold' : '',
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
            'app-nav-item relative flex items-center gap-1.5 rounded-sm px-3 py-2 normal-case',
            active ? 'app-nav-item-active font-semibold' : '',
          )}
        >
          <GroupIcon className="h-4 w-4" />
          {group.label}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </MenuHandler>
      <MenuList {...mt} className="min-w-[240px] rounded-sm border border-ui-border bg-ui-surface p-1.5 text-ui-text shadow-lg">
        {group.items.map((item) => (
          <NavGroupMenuItem key={item.id} item={item} pathname={pathname} navPaths={navPaths} />
        ))}
      </MenuList>
    </Menu>
  )
}

function NavGroupMenuItem({
  item,
  pathname,
  navPaths,
}: {
  item: NavItem
  pathname: string
  navPaths: string[]
}) {
  const Icon = item.icon
  const active = isNavPathActive(pathname, item.path, navPaths)
  return (
    <NavLink to={item.path} aria-current={active ? 'page' : undefined}>
      <MenuItem
        {...mt}
        className={cn(
          'flex items-start gap-3 rounded-sm py-2.5 text-ui-text',
          active
            ? 'bg-ui-subtle ring-1 ring-inset ring-uganda-yellow/50'
            : 'hover:bg-ui-subtle',
        )}
      >
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'text-uganda-yellow' : 'text-ui-muted')} />
        <div>
          <p className={cn('text-sm font-medium', active ? 'text-ui-text' : 'text-ui-text')}>
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
  const { displayName, permissions, logout, quarter, roles, profilePhoto, hasPermission } = useAuthStore()
  const headerChrome = useUiPreferencesStore((s) => s.headerChrome)
  const location = useLocation()

  const groups = visibleNavGroups(permissions)
  const navPaths = collectNavPaths(groups)
  const roleLabel = roles[0]?.replace(/_/g, ' ') ?? 'User'
  const canManageChrome = canManagePreferencesAdmin(hasPermission)
  const headerInherits = canManageChrome ? headerChrome !== 'light' : true

  return (
    <div className="flex min-h-screen flex-col bg-ui-bg">
      <header
        className={cn(
          'app-header border-b',
          headerInherits
            ? 'app-chrome border-[color:var(--nav-border)] bg-[color:var(--nav-bg)] text-[color:var(--nav-fg)]'
            : 'border-ui-border bg-ui-surface text-ui-text',
        )}
      >
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 py-3">
          <BrandLogo size="md" tone={headerInherits ? 'nav' : 'default'} />
          <div className="flex items-center gap-2">
            <UserAccountMenu
              displayName={displayName}
              roleLabel={roleLabel}
              profilePhoto={profilePhoto}
              onColoredChrome={headerInherits}
            />
          </div>
        </div>
      </header>

      <Navbar
        {...mt}
        className="app-chrome sticky top-0 z-40 rounded-none border-b border-[color:var(--nav-border)] bg-[color:var(--nav-bg)] px-4 py-0 text-[color:var(--nav-fg)] shadow-sm"
        fullWidth
      >
        <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-center justify-between gap-2 py-2">
          <nav className="hidden items-center gap-0.5 lg:flex">
            {groups.map((group) => (
              <NavGroupMenu key={group.id} group={group} pathname={location.pathname} navPaths={navPaths} />
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="app-nav-muted hidden text-xs lg:inline">{quarter}</span>
            <Button
              {...mt}
              variant="outlined"
              size="sm"
              className="app-nav-outline flex items-center gap-1 rounded-sm"
              onClick={async () => {
                await logout()
                redirectToLogin()
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[90rem] pb-2 lg:hidden">
          {groups.map((group) => (
            <div key={group.id} className="mb-2">
              <p className="app-nav-muted mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {group.items.map((item) => {
                  const active = isNavPathActive(location.pathname, item.path, navPaths)
                  return (
                    <NavLink key={item.id} to={item.path}>
                      <Button
                        {...mt}
                        size="sm"
                        variant={active ? 'filled' : 'outlined'}
                        className={cn(
                          'rounded-sm px-2 py-1 text-xs normal-case',
                          active ? 'app-nav-chip-active' : 'app-nav-outline',
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

      <main className="mx-auto w-full max-w-[90rem] flex-1 p-4 md:p-6">
        <Outlet />
      </main>

      <footer className="border-t border-ui-border bg-ui-surface px-4 py-3 text-center text-xs text-ui-muted">
        Ministry of Health Uganda · Performance Management System (iHRIS)
      </footer>
    </div>
  )
}
