import axios from 'axios';
import Config from 'react-native-config';
import {
  GooglePlacePrediction,
  GooglePlaceDetails,
  GoogleGeocodingResult,
  PlacesNewSuggestion,
  PlacesNewDetail,
} from './types';

const API_KEY = Config.GOOGLE_MAPS_API_KEY;

// ─── Places API (New) base URL ────────────────────────────────────────────────
const PLACES_NEW_BASE = 'https://places.googleapis.com/v1/places';

// ─── Geocoding API (separate from Places, still current) ─────────────────────
const GEOCODING_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';

export const mapsService = {
  /**
   * Autocomplete predictions using the Places API (New)
   * POST /v1/places:autocomplete
   * Restricted to Uganda (includedRegionCodes: ["ug"])
   */
  async getPlacePredictions(query: string): Promise<GooglePlacePrediction[]> {
    if (!API_KEY || !query.trim()) return [];

    try {
      const response = await axios.post<{ suggestions?: PlacesNewSuggestion[] }>(
        `${PLACES_NEW_BASE}:autocomplete`,
        {
          input: query,
          includedRegionCodes: ['ug'],
        },
        {
          headers: {
            'X-Goog-Api-Key': API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      const suggestions = response.data?.suggestions ?? [];

      // Map new API shape → stable GooglePlacePrediction interface
      return suggestions.map((s) => ({
        place_id: s.placePrediction.placeId,
        description: s.placePrediction.text.text,
        structured_formatting: s.placePrediction.structuredFormat
          ? {
              main_text: s.placePrediction.structuredFormat.mainText.text,
              secondary_text: s.placePrediction.structuredFormat.secondaryText.text,
            }
          : undefined,
      }));
    } catch (error) {
      console.error('[mapsService] getPlacePredictions error:', error);
      return [];
    }
  },

  /**
   * Place details using the Places API (New)
   * GET /v1/places/{placeId}
   */
  async getPlaceDetails(placeId: string): Promise<GooglePlaceDetails | null> {
    if (!API_KEY || !placeId) return null;

    try {
      const response = await axios.get<PlacesNewDetail>(
        `${PLACES_NEW_BASE}/${placeId}`,
        {
          headers: {
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'displayName,formattedAddress,location',
          },
        }
      );

      const result = response.data;
      if (result?.location) {
        return {
          name: result.displayName?.text ?? '',
          formatted_address: result.formattedAddress ?? '',
          latitude: result.location.latitude,
          longitude: result.location.longitude,
        };
      }
      return null;
    } catch (error) {
      console.error('[mapsService] getPlaceDetails error:', error);
      return null;
    }
  },

  /**
   * Reverse geocoding using the Geocoding API
   * (Not part of the Places API — this is a separate product and is current)
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<GoogleGeocodingResult | null> {
    if (!API_KEY) return null;

    try {
      const response = await axios.get<{ status: string; results: { formatted_address: string }[] }>(
        GEOCODING_BASE,
        {
          params: {
            latlng: `${latitude},${longitude}`,
            key: API_KEY,
          },
        }
      );

      if (response.data?.status === 'OK' && response.data.results.length > 0) {
        const formattedAddress = response.data.results[0].formatted_address;
        const firstComma = formattedAddress.indexOf(',');
        const name = firstComma !== -1
          ? formattedAddress.substring(0, firstComma)
          : formattedAddress;

        return { formatted_address: formattedAddress, name };
      }
      return null;
    } catch (error) {
      console.error('[mapsService] reverseGeocode error:', error);
      return null;
    }
  },
};

export default mapsService;
