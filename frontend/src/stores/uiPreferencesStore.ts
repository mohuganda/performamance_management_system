export type NavThemeColors = {
  bg: string
  fg: string
  active: string
}

export type NavPresetId =
  | 'neutral'
  | 'teal'
  | 'crimson'
  | 'forest'
  | 'navy'
  | 'charcoal'
  | 'sand'
  | 'uganda'
  | 'slate'
  | 'custom'

export type NavPresetOption = {
  id: NavPresetId
  label: string
  description: string
  colors: NavThemeColors
}

export const NAV_PRESET_OPTIONS: NavPresetOption[] = [
  {
    id: 'neutral',
    label: 'Neutral',
    description: 'Light bar, dark text',
    colors: { bg: '#ffffff', fg: '#18181b', active: '#fcdc04' },
  },
  {
    id: 'teal',
    label: 'Teal',
    description: '#0b4f4a + white',
    colors: { bg: '#0b4f4a', fg: '#ffffff', active: '#fcdc04' },
  },
  {
    id: 'crimson',
    label: 'Crimson',
    description: '#98033a + white',
    colors: { bg: '#98033a', fg: '#ffffff', active: '#fcdc04' },
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Deep green + white',
    colors: { bg: '#14532d', fg: '#ffffff', active: '#fcdc04' },
  },
  {
    id: 'navy',
    label: 'Navy',
    description: 'Blue navy + white',
    colors: { bg: '#1e3a5f', fg: '#ffffff', active: '#fcdc04' },
  },
  {
    id: 'charcoal',
    label: 'Charcoal',
    description: 'Dark grey + white',
    colors: { bg: '#27272a', fg: '#ffffff', active: '#fcdc04' },
  },
  {
    id: 'uganda',
    label: 'Uganda black',
    description: 'Black bar + yellow active',
    colors: { bg: '#1a1a1a', fg: '#ffffff', active: '#fcdc04' },
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Cool slate + amber active',
    colors: { bg: '#334155', fg: '#ffffff', active: '#fbbf24' },
  },
  {
    id: 'sand',
    label: 'Sand',
    description: 'Warm light + crimson active',
    colors: { bg: '#f5f0e8', fg: '#1a1a1a', active: '#98033a' },
  },
]

export const DEFAULT_CUSTOM_NAV: NavThemeColors = {
  bg: '#0b4f4a',
  fg: '#ffffff',
  active: '#fcdc04',
}

export type HeaderChrome = 'inherit' | 'light'

export type OrgUiChrome = {
  navPresetId: NavPresetId
  customNav: NavThemeColors
  headerChrome: HeaderChrome
  floatingLabels: boolean
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  }
}

function isLightHex(hex: string): boolean {
  const rgb = parseHex(hex)
  if (!rgb) return false
  const lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
  return lum > 0.62
}

function normalizeHex(value: string, fallback: string): string {
  const trimmed = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`
  return fallback
}

export function resolveNavColors(
  presetId: NavPresetId,
  customNav: NavThemeColors,
): NavThemeColors {
  if (presetId === 'custom') {
    return {
      bg: normalizeHex(customNav.bg, DEFAULT_CUSTOM_NAV.bg),
      fg: normalizeHex(customNav.fg, DEFAULT_CUSTOM_NAV.fg),
      active: normalizeHex(customNav.active, DEFAULT_CUSTOM_NAV.active),
    }
  }
  const preset = NAV_PRESET_OPTIONS.find((p) => p.id === presetId)
  return preset?.colors ?? NAV_PRESET_OPTIONS.find((p) => p.id === 'teal')!.colors
}

export function applyFloatingLabels(enabled: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('floating-labels', enabled)
}

export function applyNavTheme(presetId: NavPresetId, customNav: NavThemeColors) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const colors = resolveNavColors(presetId, customNav)
  const lightBar = isLightHex(colors.bg)

  root.dataset.navPalette = presetId
  root.style.setProperty('--nav-bg', colors.bg)
  root.style.setProperty('--nav-fg', colors.fg)
  root.style.setProperty('--nav-active', colors.active)
  root.style.setProperty(
    '--nav-muted',
    lightBar ? 'color-mix(in srgb, var(--nav-fg) 68%, transparent)' : 'rgba(255, 255, 255, 0.75)',
  )
  root.style.setProperty(
    '--nav-border',
    lightBar ? 'color-mix(in srgb, var(--nav-fg) 14%, transparent)' : 'rgba(255, 255, 255, 0.18)',
  )
  root.style.setProperty(
    '--nav-hover',
    lightBar ? 'color-mix(in srgb, var(--nav-fg) 6%, transparent)' : 'rgba(255, 255, 255, 0.12)',
  )
  root.style.setProperty(
    '--nav-outline',
    lightBar ? 'color-mix(in srgb, var(--nav-fg) 28%, transparent)' : 'rgba(255, 255, 255, 0.45)',
  )
  root.style.setProperty(
    '--nav-active-fg',
    isLightHex(colors.active) ? '#1a1a1a' : '#ffffff',
  )
}

export function applyHeaderChrome(mode: HeaderChrome) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.headerChrome = mode
}

export function applyOrgUiChrome(chrome: OrgUiChrome) {
  applyFloatingLabels(chrome.floatingLabels)
  applyNavTheme(chrome.navPresetId, chrome.customNav)
  applyHeaderChrome(chrome.headerChrome)
}

export function orgUiChromeToPayload(chrome: OrgUiChrome) {
  return {
    nav_preset_id: chrome.navPresetId,
    nav_custom: chrome.customNav,
    header_chrome: chrome.headerChrome,
    floating_labels: chrome.floatingLabels,
  }
}

export function orgUiChromeFromAdminSettings(
  ui: Partial<{
    nav_preset_id?: string
    nav_custom?: Partial<NavThemeColors>
    header_chrome?: string
    floating_labels?: boolean
  }> | undefined,
): OrgUiChrome {
  return parseOrgUiChromeFromPartial(ui)
}

function parseOrgUiChromeFromPartial(
  ui:
    | Partial<{
        nav_preset_id?: string
        nav_custom?: Partial<NavThemeColors>
        header_chrome?: string
        floating_labels?: boolean
      }>
    | undefined,
): OrgUiChrome {
  return {
    navPresetId: (['neutral', 'teal', 'crimson', 'forest', 'navy', 'charcoal', 'sand', 'uganda', 'slate', 'custom'] as const).includes(
      ui?.nav_preset_id as NavPresetId,
    )
      ? (ui?.nav_preset_id as NavPresetId)
      : 'teal',
    customNav: {
      bg: ui?.nav_custom?.bg ?? DEFAULT_CUSTOM_NAV.bg,
      fg: ui?.nav_custom?.fg ?? DEFAULT_CUSTOM_NAV.fg,
      active: ui?.nav_custom?.active ?? DEFAULT_CUSTOM_NAV.active,
    },
    headerChrome: ui?.header_chrome === 'light' ? 'light' : 'inherit',
    floatingLabels: ui?.floating_labels ?? true,
  }
}
