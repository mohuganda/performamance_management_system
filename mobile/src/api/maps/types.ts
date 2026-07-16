// Public-facing prediction type used by PlacesSearchInput molecule and usePlacesSearch hook.
// Kept stable so consumers don't change when the underlying API version changes.
export interface GooglePlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

export interface GooglePlaceDetails {
  name: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
}

export interface GoogleGeocodingResult {
  formatted_address: string;
  name: string;
}

// ─── Internal: New Places API (v1) raw response shapes ───────────────────────

/** Raw suggestion returned by POST /v1/places:autocomplete (New) */
export interface PlacesNewSuggestion {
  placePrediction: {
    place: string;       // "places/<placeId>"
    placeId: string;
    text: { text: string };
    structuredFormat?: {
      mainText: { text: string };
      secondaryText: { text: string };
    };
  };
}

/** Raw place returned by GET /v1/places/{placeId} (New) */
export interface PlacesNewDetail {
  name: string;             // "places/<placeId>"
  displayName: { text: string; languageCode: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
}
