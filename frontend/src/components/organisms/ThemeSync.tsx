import { useEffect } from 'react'
import {
  applyDocumentTheme,
  useThemeStore,
} from '@/stores/themeStore'
import {
  applyFloatingLabels,
  useUiPreferencesStore,
} from '@/stores/uiPreferencesStore'

/**
 * Applies persisted theme + UI preferences to <html>.
 */
export function ThemeSync() {
  const preference = useThemeStore((s) => s.preference)
  const floatingLabels = useUiPreferencesStore((s) => s.floatingLabels)

  useEffect(() => {
    applyDocumentTheme(preference)

    if (preference !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyDocumentTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  useEffect(() => {
    applyFloatingLabels(floatingLabels)
  }, [floatingLabels])

  return null
}
