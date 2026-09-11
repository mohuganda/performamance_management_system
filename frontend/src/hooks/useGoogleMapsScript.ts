import { useEffect, useState } from 'react'

type MapsLoaderState = {
  ready: boolean
  error: string | null
}

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (
          el: HTMLElement,
          opts: Record<string, unknown>,
        ) => {
          fitBounds: (b: unknown, padding?: number) => void
          setCenter: (c: { lat: number; lng: number }) => void
          setZoom: (z: number) => void
        }
        Marker: new (opts: Record<string, unknown>) => { setMap: (m: unknown) => void }
        Circle: new (opts: Record<string, unknown>) => { setMap: (m: unknown) => void }
        LatLngBounds: new () => {
          extend: (c: { lat: number; lng: number }) => void
          isEmpty: () => boolean
        }
        SymbolPath: { CIRCLE: unknown }
      }
    }
    __mohPmsMapsLoader?: Promise<void>
  }
}

function loadMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.google?.maps?.Map) return Promise.resolve()
  if (window.__mohPmsMapsLoader) return window.__mohPmsMapsLoader

  window.__mohPmsMapsLoader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-moh-pms-maps="1"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps')))
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`
    script.async = true
    script.defer = true
    script.dataset.mohPmsMaps = '1'
    script.onload = () => resolve()
    script.onerror = () => {
      window.__mohPmsMapsLoader = undefined
      reject(new Error('Failed to load Google Maps'))
    }
    document.head.appendChild(script)
  })

  return window.__mohPmsMapsLoader
}

/** Loads Maps JavaScript API once when an API key is available. */
export function useGoogleMapsScript(apiKey: string) {
  const [state, setState] = useState<MapsLoaderState>({ ready: false, error: null })

  useEffect(() => {
    if (!apiKey) {
      setState({ ready: false, error: null })
      return
    }
    let cancelled = false
    setState({ ready: false, error: null })
    loadMapsScript(apiKey)
      .then(() => {
        if (!cancelled) setState({ ready: true, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            ready: false,
            error: err instanceof Error ? err.message : 'Failed to load Google Maps',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [apiKey])

  return state
}
