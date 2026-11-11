// Public-facing prediction type used by PlacesSearchInput molecule and usePlacesSearch hook.
// Kept backwards-compatible while carrying pre-resolved coordinates from the backend.
export interface GooglePlacePrediction {
  place_id: string;
  description: string;
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
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

// ─── Backend Places Search API response shape ─────────────────────────────────

export interface BackendPlace {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  country_code: string;
  google_place_id?: string;
  normalized_name?: string;
  source?: string;
  hit_count?: number;
  created_at?: string;
  updated_at?: string;
}
