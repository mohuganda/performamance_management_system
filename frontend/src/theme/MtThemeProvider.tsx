import { ThemeProvider } from '@material-tailwind/react'
import type { ReactNode } from 'react'

/**
 * Material Tailwind theme.
 * Floating labels are handled by CSS (html.floating-labels) with a full outline +
 * opaque label cutout — do not use MT `shrink` (it strips the top border).
 */
export function MtThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      value={{
        input: { defaultProps: { shrink: false } },
        textarea: { defaultProps: { shrink: false } },
      }}
    >
      {children}
    </ThemeProvider>
  )
}
