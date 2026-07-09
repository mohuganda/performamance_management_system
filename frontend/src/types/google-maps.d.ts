export {}

type LatLng = { lat: () => number; lng: () => number }

type PlaceGeometry = {
  location?: LatLng
}

type PlaceResult = {
  name?: string
  formatted_address?: string
  geometry?: PlaceGeometry
}

type StructuredFormatting = {
  main_text: string
  secondary_text?: string
}

type PlacePrediction = {
  place_id: string
  description: string
  structured_formatting?: StructuredFormatting
}

type AutocompleteRequest = {
  input: string
  componentRestrictions?: { country: string | string[] }
  types?: string[]
}

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          PlacesServiceStatus: {
            OK: string
          }
          AutocompleteService: new () => {
            getPlacePredictions: (
              request: AutocompleteRequest,
              callback: (predictions: PlacePrediction[] | null, status: string) => void,
            ) => void
          }
          PlacesService: new (element: HTMLElement) => {
            getDetails: (
              request: { placeId: string; fields: string[] },
              callback: (place: PlaceResult | null, status: string) => void,
            ) => void
          }
        }
      }
    }
  }
}

export type { PlacePrediction, PlaceResult }
