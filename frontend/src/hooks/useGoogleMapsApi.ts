/// <reference path="../types/google-maps.d.ts" />

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'

type GoogleMapsConfig = {
  api_key?: string
  country_code?: string
}

type PublicConfig = {
  settings?: {
    google_maps?: GoogleMapsConfig
  }
  overrides?: Record<string, unknown>
}

let mapsLoader: Promise<void> | null = null
let mapsLoaderKey = ''

function configString(config: PublicConfig | undefined, key: keyof GoogleMapsConfig): string {
  const fromSettings = config?.settings?.google_maps?.[key]
  if (typeof fromSettings === 'string' && fromSettings.trim()) return fromSettings.trim()
  const override = config?.overrides?.[`google_maps.${key}`]
  if (typeof override === 'string' && override.trim()) return override.trim()
  return ''
}

export function parseCountryCodes(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((code) => code.trim().toLowerCase())
    .filter((code) => /^[a-z]{2}$/.test(code))
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps?.places?.AutocompleteService) return Promise.resolve()
  if (mapsLoader && mapsLoaderKey === apiKey) return mapsLoader

  mapsLoaderKey = apiKey
  mapsLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })

  return mapsLoader
}

export function useGoogleMapsApi() {
  const configQuery = useQuery({
    queryKey: ['public-config', 'maps'],
    queryFn: async () => {
      const { data } = await apiClient.get<PublicConfig>('/config')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })

  const apiKey = configString(configQuery.data, 'api_key')
  const countryCode = configString(configQuery.data, 'country_code')
  const countryCodes = parseCountryCodes(countryCode)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey) {
      setReady(false)
      setError(null)
      return
    }
    let cancelled = false
    loadGoogleMaps(apiKey)
      .then(() => {
        if (!cancelled) {
          setReady(true)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setReady(false)
          setError(err instanceof Error ? err.message : 'Could not load Google Maps')
        }
      })
    return () => {
      cancelled = true
    }
  }, [apiKey])

  return {
    apiKey,
    countryCode,
    countryCodes,
    ready: Boolean(apiKey) && ready,
    loading: configQuery.isLoading || (Boolean(apiKey) && !ready && !error),
    error: !apiKey ? 'Google Maps API key is not configured in Settings.' : error,
  }
}
