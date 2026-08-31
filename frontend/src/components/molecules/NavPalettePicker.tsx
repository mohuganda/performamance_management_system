import {
  NAV_PRESET_OPTIONS,
  useUiPreferencesStore,
  type NavPresetId,
} from '@/stores/uiPreferencesStore'
import { cn } from '@/utils/cn'

type NavPalettePickerProps = {
  className?: string
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
}) {
  return (
    <label className="block rounded-sm border border-ui-border bg-ui-subtle/40 p-3">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-ui-muted">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-sm border border-ui-border bg-white p-0.5"
          aria-label={`${label} color picker`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="min-w-0 flex-1 rounded-sm border border-ui-border bg-ui-surface px-2.5 py-2 font-mono text-sm text-ui-text outline-none focus:border-moh-green"
          placeholder="#000000"
        />
      </div>
    </label>
  )
}

export function NavPalettePicker({ className }: NavPalettePickerProps) {
  const navPresetId = useUiPreferencesStore((s) => s.navPresetId)
  const customNav = useUiPreferencesStore((s) => s.customNav)
  const setNavPresetId = useUiPreferencesStore((s) => s.setNavPresetId)
  const setCustomNav = useUiPreferencesStore((s) => s.setCustomNav)

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_PRESET_OPTIONS.map((option) => {
          const selected = navPresetId === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setNavPresetId(option.id)}
              aria-pressed={selected}
              className={cn(
                'rounded-sm border px-3 py-2.5 text-left transition',
                selected
                  ? 'border-uganda-yellow bg-uganda-yellow/15 text-ui-text ring-1 ring-uganda-yellow/40'
                  : 'border-ui-border bg-ui-surface text-ui-muted hover:border-ui-text/20 hover:bg-ui-subtle hover:text-ui-text',
              )}
            >
              <span
                className="mb-2 flex h-9 w-full items-center justify-between gap-2 rounded-sm border border-black/10 px-2 text-xs font-semibold"
                style={{ backgroundColor: option.colors.bg, color: option.colors.fg }}
                aria-hidden
              >
                <span>Nav</span>
                <span
                  className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: option.colors.active, color: '#1a1a1a' }}
                >
                  Active
                </span>
              </span>
              <span className="block text-sm font-semibold text-ui-text">{option.label}</span>
              <span className="mt-0.5 block text-xs text-ui-muted">{option.description}</span>
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => setNavPresetId('custom' as NavPresetId)}
          aria-pressed={navPresetId === 'custom'}
          className={cn(
            'rounded-sm border px-3 py-2.5 text-left transition',
            navPresetId === 'custom'
              ? 'border-uganda-yellow bg-uganda-yellow/15 text-ui-text ring-1 ring-uganda-yellow/40'
              : 'border-ui-border bg-ui-surface text-ui-muted hover:border-ui-text/20 hover:bg-ui-subtle hover:text-ui-text',
          )}
        >
          <span
            className="mb-2 flex h-9 w-full items-center justify-between gap-2 rounded-sm border border-dashed border-black/20 px-2 text-xs font-semibold"
            style={{ backgroundColor: customNav.bg, color: customNav.fg }}
            aria-hidden
          >
            <span>Custom</span>
            <span
              className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold"
              style={{ backgroundColor: customNav.active, color: '#1a1a1a' }}
            >
              Active
            </span>
          </span>
          <span className="block text-sm font-semibold text-ui-text">Custom</span>
          <span className="mt-0.5 block text-xs text-ui-muted">
            Build your own bar, text, and active colors
          </span>
        </button>
      </div>

      {navPresetId === 'custom' ? (
        <div className="rounded-sm border border-ui-border bg-ui-surface p-4">
          <p className="mb-3 text-sm font-semibold text-ui-text">Custom navigation colors</p>
          <div className="grid gap-3 md:grid-cols-3">
            <ColorField
              label="Bar background"
              value={customNav.bg}
              onChange={(bg) => setCustomNav({ bg })}
            />
            <ColorField
              label="Text / icons"
              value={customNav.fg}
              onChange={(fg) => setCustomNav({ fg })}
            />
            <ColorField
              label="Active accent"
              value={customNav.active}
              onChange={(active) => setCustomNav({ active })}
            />
          </div>
          <div
            className="mt-4 flex items-center justify-between gap-3 rounded-sm px-3 py-3"
            style={{ backgroundColor: customNav.bg, color: customNav.fg }}
          >
            <span className="text-sm font-medium">Preview</span>
            <span className="relative pb-1 text-sm font-semibold">
              Dashboard
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: customNav.active }}
              />
            </span>
            <span
              className="rounded-sm px-2 py-1 text-xs font-bold"
              style={{
                backgroundColor: customNav.active,
                color: '#1a1a1a',
              }}
            >
              Active chip
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
