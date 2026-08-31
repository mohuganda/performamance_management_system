export type PlacePrediction = {
  place_id: string
  description: string
  structured_formatting?: {
    main_text: string
    secondary_text?: string
  }
}

export type PlaceDetails = {
  name: string
  address: string
  latitude: number
  longitude: number
}

type AutocompleteSuggestion = {
  placePrediction?: {
    placeId?: string
    place?: string
    text?: { text?: string }
    structuredFormat?: {
      mainText?: { text?: string }
      secondaryText?: { text?: string }
    }
  }
}

type PlaceDetailsResponse = {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
}

function placesErrorMessage(status: number, body: string): string {
  if (status === 403 || status === 401) {
    return 'Maps API key was rejected. Enable Places API (New) for this key in Google Cloud.'
  }
  if (status === 429) {
    return 'Place search rate limit reached. Wait a moment and try again.'
  }
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } }
    if (parsed.error?.message) return parsed.error.message
  } catch {
    /* ignore */
  }
  return 'Could not load place suggestions.'
}

/** Places API (New) autocomplete — legacy AutocompleteService is disabled on many projects. */
export async function fetchPlacePredictions(options: {
  apiKey: string
  input: string
  countryCodes?: string[]
  signal?: AbortSignal
}): Promise<PlacePrediction[]> {
  const { apiKey, input, countryCodes = [], signal } = options
  const body: Record<string, unknown> = {
    input,
    languageCode: 'en',
  }
  if (countryCodes.length > 0) {
    body.includedRegionCodes = countryCodes.map((c) => c.toUpperCase())
  }

  const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(placesErrorMessage(response.status, text))
  }

  const data = JSON.parse(text || '{}') as { suggestions?: AutocompleteSuggestion[] }
  const suggestions = data.suggestions ?? []
  const predictions: PlacePrediction[] = []

  for (const item of suggestions) {
    const prediction = item.placePrediction
    if (!prediction) continue
    const placeId =
      prediction.placeId ||
      (prediction.place?.startsWith('places/') ? prediction.place.slice('places/'.length) : prediction.place)
    if (!placeId) continue
    const main = prediction.structuredFormat?.mainText?.text?.trim()
    const secondary = prediction.structuredFormat?.secondaryText?.text?.trim()
    const description = prediction.text?.text?.trim() || [main, secondary].filter(Boolean).join(', ')
    if (!description) continue
    predictions.push({
      place_id: placeId,
      description,
      structured_formatting: {
        main_text: main || description.split(',')[0] || description,
        ...(secondary ? { secondary_text: secondary } : {}),
      },
    })
  }

  return predictions
}

export async function fetchPlaceDetails(options: {
  apiKey: string
  placeId: string
  signal?: AbortSignal
}): Promise<PlaceDetails> {
  const { apiKey, placeId, signal } = options
  const id = placeId.startsWith('places/') ? placeId.slice('places/'.length) : placeId
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`,
    {
      method: 'GET',
      signal,
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
      },
    },
  )

  const text = await response.text()
  if (!response.ok) {
    throw new Error(placesErrorMessage(response.status, text))
  }

  const data = JSON.parse(text || '{}') as PlaceDetailsResponse
  const latitude = data.location?.latitude
  const longitude = data.location?.longitude
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Selected place is missing map coordinates.')
  }

  const name = data.displayName?.text?.trim() || data.formattedAddress?.trim() || 'Selected place'
  const address = data.formattedAddress?.trim() || name

  return { name, address, latitude, longitude }
}
