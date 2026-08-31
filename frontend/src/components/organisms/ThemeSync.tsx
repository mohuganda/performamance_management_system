import { useEffect } from 'react'
import {
  applyDocumentTheme,
  useThemeStore,
} from '@/stores/themeStore'
import {
  applyFloatingLabels,
  applyHeaderChrome,
  applyNavTheme,
  useUiPreferencesStore,
} from '@/stores/uiPreferencesStore'
import { canManagePreferencesAdmin } from '@/constants/settingsPermissions'
import { useAuthStore } from '@/stores/appStore'

const STAFF_DEFAULT_NAV_PRESET = 'teal' as const
const STAFF_DEFAULT_FLOATING_LABELS = true
const STAFF_DEFAULT_HEADER_CHROME = 'inherit' as const

/**
 * Applies persisted theme + UI preferences to <html>.
 * Nav colors, brand header, and floating labels are admin-managed —
 * other users always get the organisation defaults.
 */
export function ThemeSync() {
  const preference = useThemeStore((s) => s.preference)
  const floatingLabels = useUiPreferencesStore((s) => s.floatingLabels)
  const navPresetId = useUiPreferencesStore((s) => s.navPresetId)
  const customNav = useUiPreferencesStore((s) => s.customNav)
  const headerChrome = useUiPreferencesStore((s) => s.headerChrome)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const isAuthenticated = useAuthStore((s) => Boolean(s.token))
  const canManageChrome = !isAuthenticated || canManagePreferencesAdmin(hasPermission)

  useEffect(() => {
    applyDocumentTheme(preference)

    if (preference !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyDocumentTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  useEffect(() => {
    applyFloatingLabels(canManageChrome ? floatingLabels : STAFF_DEFAULT_FLOATING_LABELS)
  }, [floatingLabels, canManageChrome])

  useEffect(() => {
    if (canManageChrome) {
      applyNavTheme(navPresetId, customNav)
      return
    }
    applyNavTheme(STAFF_DEFAULT_NAV_PRESET, customNav)
  }, [navPresetId, customNav, canManageChrome])

  useEffect(() => {
    applyHeaderChrome(canManageChrome ? headerChrome : STAFF_DEFAULT_HEADER_CHROME)
  }, [headerChrome, canManageChrome])

  return null
}
