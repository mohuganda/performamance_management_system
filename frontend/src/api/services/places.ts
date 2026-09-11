import apiClient from '../client'

export type PlacePrediction = {
  place_id: string
  description: string
  structured_formatting?: {
    main_text: string
    secondary_text?: string
  }
  cached_place_id?: number
  latitude?: number
  longitude?: number
  name?: string
  address?: string
}

export type PlaceDetails = {
  name: string
  address: string
  latitude: number
  longitude: number
  cached_place_id?: number
}

type CachedPlaceRow = {
  id: number
  name: string
  address?: string | null
  latitude: number
  longitude: number
  country_code?: string
  google_place_id?: string | null
  source?: string
}

/** Local-first place search via PMS API (Google only on cache miss). */
export async function fetchPlacePredictions(options: {
  input: string
  countryCodes?: string[]
  signal?: AbortSignal
}): Promise<PlacePrediction[]> {
  const { input, countryCodes = [], signal } = options
  if (input.trim().length < 2) return []
  const country = countryCodes[0] || undefined
  const { data } = await apiClient.get<CachedPlaceRow[]>('/places/search', {
    params: { q: input.trim(), country },
    signal,
  })
  const rows = Array.isArray(data) ? data : []
  return rows.map((row) => {
    const address = row.address?.trim() || ''
    const description = address && address !== row.name ? `${row.name}, ${address}` : row.name
    return {
      place_id: row.google_place_id || `cached:${row.id}`,
      cached_place_id: row.id,
      description,
      name: row.name,
      address: address || row.name,
      latitude: row.latitude,
      longitude: row.longitude,
      structured_formatting: {
        main_text: row.name,
        ...(address && address !== row.name ? { secondary_text: address } : {}),
      },
    }
  })
}

/** Resolve selection — prefer coords already returned from search. */
export async function fetchPlaceDetails(options: {
  placeId: string
  cachedPlaceId?: number
  latitude?: number
  longitude?: number
  name?: string
  address?: string
  signal?: AbortSignal
}): Promise<PlaceDetails> {
  const { cachedPlaceId, latitude, longitude, name, address, placeId, signal } = options
  if (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    (name || address)
  ) {
    return {
      name: name || address || 'Selected place',
      address: address || name || 'Selected place',
      latitude,
      longitude,
      cached_place_id: cachedPlaceId,
    }
  }
  const id =
    cachedPlaceId ||
    (placeId.startsWith('cached:') ? Number(placeId.slice('cached:'.length)) : 0)
  if (!id) {
    throw new Error('Place details unavailable')
  }
  const { data } = await apiClient.get<CachedPlaceRow>(`/places/${id}`, { signal })
  return {
    name: data.name,
    address: data.address?.trim() || data.name,
    latitude: data.latitude,
    longitude: data.longitude,
    cached_place_id: data.id,
  }
}
