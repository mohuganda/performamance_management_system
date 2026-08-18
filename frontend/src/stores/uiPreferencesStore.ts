import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type UiPreferencesState = {
  floatingLabels: boolean
  setFloatingLabels: (enabled: boolean) => void
}

export function applyFloatingLabels(enabled: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('floating-labels', enabled)
}

export const useUiPreferencesStore = create<UiPreferencesState>()(
  persist(
    (set) => ({
      floatingLabels: true,
      setFloatingLabels: (floatingLabels) => {
        set({ floatingLabels })
        applyFloatingLabels(floatingLabels)
      },
    }),
    {
      name: 'moh-pms-ui-preferences-v2',
      onRehydrateStorage: () => (state) => {
        applyFloatingLabels(state?.floatingLabels ?? true)
      },
    },
  ),
)
