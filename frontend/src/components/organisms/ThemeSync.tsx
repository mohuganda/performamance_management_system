import { useEffect } from 'react'
import {
  applyDocumentTheme,
  useThemeStore,
} from '@/stores/themeStore'

/**
 * Applies the persisted theme preference to <html> and keeps it in sync
 * with OS changes when preference is "system".
 */
export function ThemeSync() {
  const preference = useThemeStore((s) => s.preference)

  useEffect(() => {
    applyDocumentTheme(preference)

    if (preference !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyDocumentTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  return null
}
