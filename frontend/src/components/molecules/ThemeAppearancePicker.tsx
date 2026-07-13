import { Monitor, Moon, Sun } from 'lucide-react'
import { useThemeStore, type ThemePreference } from '@/stores/themeStore'
import { cn } from '@/utils/cn'

const OPTIONS: Array<{
  value: ThemePreference
  label: string
  description: string
  icon: typeof Sun
}> = [
  {
    value: 'light',
    label: 'Light',
    description: 'Bright surfaces for daytime use',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Low glare for evening work',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'System',
    description: 'Match your device setting',
    icon: Monitor,
  },
]

type ThemeAppearancePickerProps = {
  compact?: boolean
  className?: string
}

export function ThemeAppearancePicker({ compact = false, className }: ThemeAppearancePickerProps) {
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)

  return (
    <div className={cn(compact ? 'grid grid-cols-3 gap-2' : 'grid gap-2', className)}>
      {OPTIONS.map((option) => {
        const Icon = option.icon
        const active = preference === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setPreference(option.value)}
            aria-pressed={active}
            className={cn(
              'rounded-sm border px-3 py-2.5 text-left transition',
              active
                ? 'border-uganda-yellow bg-uganda-yellow/15 text-ui-text ring-1 ring-uganda-yellow/40'
                : 'border-ui-border bg-ui-surface text-ui-muted hover:border-ui-text/20 hover:bg-ui-subtle hover:text-ui-text',
              compact && 'flex flex-col items-center gap-1.5 px-2 py-2 text-center',
            )}
          >
            <Icon className={cn('h-4 w-4', active ? 'text-ui-text' : 'text-ui-muted')} />
            <span className={cn('block text-sm font-semibold', compact && 'text-xs')}>
              {option.label}
            </span>
            {!compact ? (
              <span className="mt-0.5 block text-xs text-ui-muted">{option.description}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
