/** Granular settings tab permissions — assign via Access Control. */
export const SETTINGS_PERMISSIONS = {
  preferences: 'settings.preferences.manage',
  lists: 'settings.lists.manage',
  dataSources: 'settings.data_sources.manage',
  email: 'settings.email.manage',
  notifications: 'settings.notifications.manage',
  performance: 'settings.performance.manage',
  kpi: 'settings.kpi.manage',
  /** Legacy umbrella — grants all settings tabs */
  all: 'settings.manage',
} as const

export type SettingsTabId =
  | 'preferences'
  | 'lists'
  | 'kpi'
  | 'data-sources'
  | 'email'
  | 'notifications'
  | 'performance'

const TAB_PERMISSION_MAP: Record<Exclude<SettingsTabId, 'preferences'>, string[]> = {
  lists: [SETTINGS_PERMISSIONS.lists, SETTINGS_PERMISSIONS.all],
  kpi: [SETTINGS_PERMISSIONS.kpi, SETTINGS_PERMISSIONS.all],
  'data-sources': [SETTINGS_PERMISSIONS.dataSources, SETTINGS_PERMISSIONS.all],
  email: [SETTINGS_PERMISSIONS.email, SETTINGS_PERMISSIONS.all],
  notifications: [SETTINGS_PERMISSIONS.notifications, SETTINGS_PERMISSIONS.all],
  performance: [SETTINGS_PERMISSIONS.performance, SETTINGS_PERMISSIONS.all],
}

export function canAccessSettingsTab(
  hasPermission: (code: string | string[]) => boolean,
  tab: SettingsTabId,
): boolean {
  if (tab === 'preferences') return true
  return hasPermission(TAB_PERMISSION_MAP[tab])
}

export function canManagePreferencesAdmin(
  hasPermission: (code: string | string[]) => boolean,
): boolean {
  return hasPermission([SETTINGS_PERMISSIONS.preferences, SETTINGS_PERMISSIONS.all])
}

export function hasAnyAdminSettingsPermission(
  hasPermission: (code: string | string[]) => boolean,
): boolean {
  return hasPermission([
    SETTINGS_PERMISSIONS.all,
    SETTINGS_PERMISSIONS.preferences,
    SETTINGS_PERMISSIONS.lists,
    SETTINGS_PERMISSIONS.dataSources,
    SETTINGS_PERMISSIONS.email,
    SETTINGS_PERMISSIONS.notifications,
    SETTINGS_PERMISSIONS.performance,
    SETTINGS_PERMISSIONS.kpi,
  ])
}
