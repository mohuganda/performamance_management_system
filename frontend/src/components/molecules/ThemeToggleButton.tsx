import { Moon, Sun } from 'lucide-react'
import { resolveTheme, useThemeStore } from '@/stores/themeStore'
import { cn } from '@/utils/cn'

type ThemeToggleButtonProps = {
  className?: string
}

/** Header control: toggles light ↔ dark (placed before the notification bell). */
export function ThemeToggleButton({ className }: ThemeToggleButtonProps) {
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)
  const resolved = resolveTheme(preference)
  const isDark = resolved === 'dark'

  return (
    <button
      type="button"
      onClick={() => setPreference(isDark ? 'light' : 'dark')}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-sm text-ui-muted transition-colors hover:bg-ui-subtle hover:text-ui-text',
        className,
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}
