import { NavLink } from 'react-router-dom'
import { BarChart3, CalendarDays, ClipboardList, MapPin } from 'lucide-react'
import { useAuthStore } from '@/stores/appStore'

const modules = [
  {
    path: '/performance',
    label: 'Performance',
    sub: 'PPA & quarterly KPIs',
    icon: BarChart3,
    accent: 'border-uganda-yellow',
  },
  {
    path: '/leave',
    label: 'Leave',
    sub: 'Balances & requests',
    icon: CalendarDays,
    permission: 'leave.requests.view',
    accent: 'border-ui-text',
  },
  {
    path: '/out-of-station',
    label: 'Out of Station',
    sub: 'Travel with GPS',
    icon: MapPin,
    permission: 'oos.requests.view',
    accent: 'border-uganda-red',
  },
  {
    path: '/attendance',
    label: 'Attendance',
    sub: 'Clock in / out',
    icon: ClipboardList,
    permission: ['attendance.view', 'attendance.clock'],
    accent: 'border-ui-muted',
  },
]

export function ModuleQuickLinks() {
  const { hasPermission } = useAuthStore()

  const visible = modules.filter((m) => {
    if (!m.permission) return true
    return hasPermission(m.permission)
  })

  if (visible.length === 0) return null

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {visible.map((mod) => {
        const Icon = mod.icon
        return (
          <NavLink
            key={mod.path}
            to={mod.path}
            className={`block rounded-sm border border-ui-border border-l-4 bg-ui-surface p-4 shadow-sm transition hover:bg-ui-subtle ${mod.accent}`}
          >
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-ui-muted" />
              <div>
                <p className="font-semibold text-ui-text">{mod.label}</p>
                <p className="text-xs text-ui-muted">{mod.sub}</p>
              </div>
            </div>
          </NavLink>
        )
      })}
    </div>
  )
}
