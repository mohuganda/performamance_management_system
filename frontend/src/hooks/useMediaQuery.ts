import { useEffect, useState } from 'react'

/** Subscribe to a CSS media query. SSR-safe default is `false`. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Desktop layout — standard Tailwind `lg` (1024px). */
export const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)'
