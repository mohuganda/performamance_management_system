import { useEffect, useState } from 'react'
import {
  Navbar,
  Button,
  Menu,
  MenuHandler,
  MenuList,
  MenuItem,
} from '@material-tailwind/react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronDown, LogOut, Menu as MenuIcon, X } from 'lucide-react'
import { BrandLogo } from '@/components/atoms/BrandLogo'
import { UserAccountMenu } from '@/components/molecules/UserAccountMenu'
import { useAuthStore } from '@/stores/appStore'
import { useOrgUiChrome } from '@/hooks/useOrgUiChrome'
import { redirectToLogin } from '@/utils/authRedirect'
import {
  collectNavPaths,
  isGroupActive,
  isNavPathActive,
  type NavGroup,
  type NavItem,
  visibleNavGroups,
} from '@/app/navigation/navItems'
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
      <MenuList
        {...mt}
        className="min-w-[240px] rounded-sm border border-ui-border bg-ui-surface p-1.5 text-ui-text shadow-lg"
      >
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
        <Icon
          className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'text-uganda-yellow' : 'text-ui-muted')}
        />
        <div>
          <p className={cn('text-sm font-medium', active ? 'text-ui-text' : 'text-ui-text')}>
            {item.label}
          </p>
          {item.description ? <p className="text-xs text-ui-muted">{item.description}</p> : null}
        </div>
      </MenuItem>
    </NavLink>
  )
}

function MobileNavDrawer({
  open,
  onClose,
  groups,
  pathname,
  navPaths,
  quarter,
  onSignOut,
}: {
  open: boolean
  onClose: () => void
  groups: NavGroup[]
  pathname: string
  navPaths: string[]
  quarter: string
  onSignOut: () => void
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="lg:hidden" role="dialog" aria-modal="true" aria-label="Main menu">
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/45"
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside
        id="mobile-main-nav"
        className={cn(
          'app-chrome fixed inset-y-0 left-0 z-[70] flex w-[min(100vw-3rem,20rem)] flex-col',
          'border-r border-[color:var(--nav-border)] bg-[color:var(--nav-bg)] text-[color:var(--nav-fg)] shadow-xl',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[color:var(--nav-border)] px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Menu</p>
            {quarter ? <p className="app-nav-muted text-xs">{quarter}</p> : null}
          </div>
          <button
            type="button"
            className="app-nav-outline inline-flex h-10 w-10 items-center justify-center rounded-sm border"
            aria-label="Close menu"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          {groups.map((group) => (
            <div key={group.id} className="mb-4">
              <p className="app-nav-muted mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide">
                {group.label}
              </p>
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = isNavPathActive(pathname, item.path, navPaths)
                  return (
                    <li key={item.id}>
                      <NavLink
                        to={item.path}
                        onClick={onClose}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex min-h-11 items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors',
                          active
                            ? 'app-nav-chip-active font-semibold'
                            : 'app-nav-outline border border-transparent hover:border-[color:var(--nav-border)]',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-90" />
                        <span className="leading-snug">{item.label}</span>
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-[color:var(--nav-border)] p-3">
          <Button
            {...mt}
            variant="outlined"
            className="app-nav-outline flex w-full items-center justify-center gap-2 rounded-sm normal-case"
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>
    </div>
  )
}

export function AppLayout() {
  const { displayName, permissions, logout, quarter, roles, profilePhoto } = useAuthStore()
  const { chrome } = useOrgUiChrome()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const groups = visibleNavGroups(permissions)
  const navPaths = collectNavPaths(groups)
  const roleLabel = roles[0]?.replace(/_/g, ' ') ?? 'User'
  const headerInherits = chrome.headerChrome !== 'light'

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  const handleSignOut = async () => {
    setMobileNavOpen(false)
    await logout()
    redirectToLogin()
  }

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
        <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-2 py-2">
          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 lg:flex">
            {groups.map((group) => (
              <NavGroupMenu
                key={group.id}
                group={group}
                pathname={location.pathname}
                navPaths={navPaths}
              />
            ))}
          </nav>

          {/* Mobile: hamburger only */}
          <div className="flex flex-1 items-center gap-2 lg:hidden">
            <Button
              {...mt}
              variant="outlined"
              size="sm"
              className="app-nav-outline flex min-h-10 items-center gap-2 rounded-sm normal-case"
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-main-nav"
              onClick={() => setMobileNavOpen(true)}
            >
              <MenuIcon className="h-4 w-4" />
              Menu
            </Button>
            <span className="app-nav-muted truncate text-xs">{quarter}</span>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <span className="app-nav-muted text-xs">{quarter}</span>
            <Button
              {...mt}
              variant="outlined"
              size="sm"
              className="app-nav-outline flex items-center gap-1 rounded-sm"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </Navbar>

      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        groups={groups}
        pathname={location.pathname}
        navPaths={navPaths}
        quarter={quarter}
        onSignOut={handleSignOut}
      />

      <main className="mx-auto w-full max-w-[90rem] flex-1 p-4 md:p-6">
        <Outlet />
      </main>

      <footer className="border-t border-ui-border bg-ui-surface px-4 py-3 text-center text-xs text-ui-muted">
        Ministry of Health Uganda · Performance Management System (iHRIS)
      </footer>
    </div>
  )
}
