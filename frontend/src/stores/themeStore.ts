import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'light' | 'dark' | 'system'

type ThemeState = {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
  cyclePreference: () => void
}

const ORDER: ThemePreference[] = ['light', 'dark', 'system']

export function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    return getSystemPrefersDark() ? 'dark' : 'light'
  }
  return preference
}

export function applyDocumentTheme(preference: ThemePreference) {
  if (typeof document === 'undefined') return
  const resolved = resolveTheme(preference)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preference: 'system',
      setPreference: (preference) => {
        set({ preference })
        applyDocumentTheme(preference)
      },
      cyclePreference: () => {
        const current = get().preference
        const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]
        get().setPreference(next)
      },
    }),
    {
      name: 'moh-pms-theme',
      onRehydrateStorage: () => (state) => {
        applyDocumentTheme(state?.preference ?? 'system')
      },
    },
  ),
)
