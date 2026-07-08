import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  MapPin,
  Settings,
  Shield,
  Target,
  User,
  Users,
  Clock,
  UserCircle,
  Briefcase,
} from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  path: string
  icon: LucideIcon
  description?: string
  permission?: string | string[]
  anyPermission?: boolean
}

/** A navigation group — single-item groups render as a direct link. */
export interface NavGroup {
  id: string
  label: string
  icon: LucideIcon
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    id: 'home',
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        description: 'Role-based overview and quick actions',
        permission: [
          'dashboard.staff',
          'dashboard.supervisor',
          'dashboard.department_head',
          'dashboard.hr',
          'dashboard.director',
          'dashboard.executive',
        ],
        anyPermission: true,
      },
    ],
  },
  {
    id: 'performance',
    label: 'Performance',
    icon: BarChart3,
    items: [
      {
        id: 'performance',
        label: 'Performance',
        path: '/performance',
        icon: BarChart3,
        description: 'PPA, KPIs, and quarterly reporting',
        permission: 'performance.view',
      },
    ],
  },
  {
    id: 'time-attendance',
    label: 'Time & Attendance',
    icon: Clock,
    items: [
      {
        id: 'leave',
        label: 'Leave',
        path: '/leave',
        icon: CalendarDays,
        description: 'Apply for and track leave requests',
        permission: 'leave.requests.view',
      },
      {
        id: 'oos',
        label: 'Out of Station',
        path: '/out-of-station',
        icon: MapPin,
        description: 'Request approval for off-site duty',
        permission: 'oos.requests.view',
      },
      {
        id: 'attendance',
        label: 'Attendance',
        path: '/attendance',
        icon: ClipboardList,
        description: 'Clock in/out and view attendance records',
        permission: ['attendance.view', 'attendance.clock'],
        anyPermission: true,
      },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    items: [
      {
        id: 'notifications',
        label: 'Notifications',
        path: '/notifications',
        icon: Bell,
        description: 'System alerts and approval updates',
      },
    ],
  },
  {
    id: 'account',
    label: 'My Account',
    icon: UserCircle,
    items: [
      {
        id: 'profile',
        label: 'Profile',
        path: '/profile',
        icon: User,
        description: 'Photo, signature, and account details',
      },
      {
        id: 'settings',
        label: 'Settings',
        path: '/settings',
        icon: Settings,
        description: 'Preferences and system configuration',
      },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    icon: Briefcase,
    items: [
      {
        id: 'leave-admin',
        label: 'Leave Management',
        path: '/admin/leave',
        icon: CalendarDays,
        description: 'Balances, requests, statements, and policy configuration',
        permission: 'leave.config.manage',
      },
      {
        id: 'staff-mgmt',
        label: 'Staff Management',
        path: '/admin/staff',
        icon: Users,
        description: 'Staff directory, HR profiles, and supervisors',
        permission: 'auth.users.manage',
      },
      {
        id: 'kpi-admin',
        label: 'KPI Management',
        path: '/admin/kpi',
        icon: Target,
        description: 'KPI catalog and staff assignments',
        permission: [
          'kpi.catalog.view',
          'kpi.catalog.manage',
          'kpi.assignments.view',
          'kpi.assignments.manage',
        ],
        anyPermission: true,
      },
      {
        id: 'rbac',
        label: 'Access Control',
        path: '/admin/rbac',
        icon: Shield,
        description: 'Roles, permissions, and user access',
        permission: 'auth.roles.manage',
      },
    ],
  },
]

/** @deprecated Use navGroups — kept for any legacy imports */
export const mainNavItems: NavItem[] = navGroups
  .filter((g) => g.id !== 'administration')
  .flatMap((g) => g.items)
  .filter((item) => item.id !== 'settings')

export const adminNavItems: NavItem[] =
  navGroups.find((g) => g.id === 'administration')?.items ?? []

export const settingsNavItem: NavItem =
  navGroups.find((g) => g.id === 'account')?.items.find((i) => i.id === 'settings') ?? {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: Settings,
  }

export function hasNavPermission(
  permissions: string[],
  item: NavItem,
): boolean {
  if (!item.permission) return true
  const required = Array.isArray(item.permission) ? item.permission : [item.permission]
  if (item.anyPermission) {
    return required.some((p) => permissions.includes(p))
  }
  return required.every((p) => permissions.includes(p))
}

export function visibleNavGroups(permissions: string[]): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasNavPermission(permissions, item)),
    }))
    .filter((group) => group.items.length > 0)
}

export function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) => pathname.startsWith(item.path))
}

export function resolveDashboardPermission(permissions: string[]): string {
  if (permissions.includes('dashboard.executive')) return 'executive'
  if (permissions.includes('dashboard.director')) return 'director'
  if (permissions.includes('dashboard.hr')) return 'hr_manager'
  if (permissions.includes('dashboard.department_head')) return 'department_head'
  if (permissions.includes('dashboard.supervisor')) return 'supervisor'
  return 'health_worker'
}
