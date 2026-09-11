import { useEffect } from 'react'
import {
  applyDocumentTheme,
  useThemeStore,
} from '@/stores/themeStore'
import { applyOrgUiChrome } from '@/stores/uiPreferencesStore'
import { useOrgUiChrome } from '@/hooks/useOrgUiChrome'

/**
 * Applies persisted theme preference and organisation-wide UI chrome to <html>.
 * Nav colors, brand header, and floating labels come from admin settings on the server.
 */
export function ThemeSync() {
  const preference = useThemeStore((s) => s.preference)
  const { chrome } = useOrgUiChrome()

  useEffect(() => {
    applyDocumentTheme(preference)

    if (preference !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyDocumentTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  useEffect(() => {
    applyOrgUiChrome(chrome)
  }, [chrome])

  return null
}
