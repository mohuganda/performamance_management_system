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

/** Public Maps settings from `/config` (api key + country filter). */
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
  const countryCode = configString(configQuery.data, 'country_code') || 'ug'
  const countryCodes = parseCountryCodes(countryCode)

  return {
    apiKey,
    countryCode,
    countryCodes,
    ready: Boolean(apiKey) && !configQuery.isLoading,
    loading: configQuery.isLoading,
    error: !configQuery.isLoading && !apiKey ? 'Google Maps API key is not configured in Settings.' : null,
  }
}
