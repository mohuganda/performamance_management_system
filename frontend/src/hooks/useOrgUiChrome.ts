import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'
import {
  DEFAULT_CUSTOM_NAV,
  type HeaderChrome,
  type NavPresetId,
  type NavThemeColors,
  type OrgUiChrome,
} from '@/stores/uiPreferencesStore'

type PublicConfig = {
  settings?: {
    ui?: Partial<{
      nav_preset_id: string
      nav_custom: Partial<NavThemeColors>
      header_chrome: string
      floating_labels: boolean
    }>
  }
}

const VALID_PRESETS = new Set<NavPresetId>([
  'neutral',
  'teal',
  'crimson',
  'forest',
  'navy',
  'charcoal',
  'sand',
  'uganda',
  'slate',
  'custom',
])

const VALID_HEADER_CHROME = new Set<HeaderChrome>(['inherit', 'light'])

export const DEFAULT_ORG_UI_CHROME: OrgUiChrome = {
  navPresetId: 'teal',
  customNav: DEFAULT_CUSTOM_NAV,
  headerChrome: 'inherit',
  floatingLabels: true,
}

export function parseOrgUiChrome(raw: PublicConfig | undefined): OrgUiChrome {
  const ui = raw?.settings?.ui
  if (!ui) return DEFAULT_ORG_UI_CHROME

  const navPresetId = VALID_PRESETS.has(ui.nav_preset_id as NavPresetId)
    ? (ui.nav_preset_id as NavPresetId)
    : DEFAULT_ORG_UI_CHROME.navPresetId

  const customNav: NavThemeColors = {
    bg: ui.nav_custom?.bg ?? DEFAULT_ORG_UI_CHROME.customNav.bg,
    fg: ui.nav_custom?.fg ?? DEFAULT_ORG_UI_CHROME.customNav.fg,
    active: ui.nav_custom?.active ?? DEFAULT_ORG_UI_CHROME.customNav.active,
  }

  const headerChrome = VALID_HEADER_CHROME.has(ui.header_chrome as HeaderChrome)
    ? (ui.header_chrome as HeaderChrome)
    : DEFAULT_ORG_UI_CHROME.headerChrome

  return {
    navPresetId,
    customNav,
    headerChrome,
    floatingLabels: ui.floating_labels ?? DEFAULT_ORG_UI_CHROME.floatingLabels,
  }
}

export function useOrgUiChrome() {
  const query = useQuery({
    queryKey: ['public-config', 'ui-chrome'],
    queryFn: async () => {
      const { data } = await apiClient.get<PublicConfig>('/config')
      return parseOrgUiChrome(data)
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    chrome: query.data ?? DEFAULT_ORG_UI_CHROME,
    isLoading: query.isLoading,
  }
}
