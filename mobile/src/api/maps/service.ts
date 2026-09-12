import axios from 'axios';
import Config from 'react-native-config';
import apiClient from '../client';
import { PlacesDbService } from '../../db/services/PlacesDbService';
import {
  GooglePlacePrediction,
  GooglePlaceDetails,
  GoogleGeocodingResult,
  BackendPlace,
} from './types';

const API_KEY = Config.GOOGLE_MAPS_API_KEY;

// ─── Geocoding API (used for reverse geocoding coordinates) ───────────────────
const GEOCODING_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';

function mapBackendPlaceToPrediction(place: BackendPlace): GooglePlacePrediction {
  const secondaryText = place.address && place.address !== place.name ? place.address : '';
  return {
    place_id: place.google_place_id || String(place.id),
    description: place.address || place.name,
    name: place.name,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    structured_formatting: {
      main_text: place.name,
      secondary_text: secondaryText,
    },
  };
}

export const mapsService = {
  /**
   * Search places using backend GET /places/search?q=<query>
   * Checks WatermelonDB local cache first for exact normalized search text.
   * If cached, returns local results immediately without calling upstream API.
   */
  async getPlacePredictions(query: string): Promise<GooglePlacePrediction[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const normalized = trimmed.toLowerCase();

    // 1. Check local WatermelonDB cache for exact normalized match
    try {
      const cached = await PlacesDbService.getCachedPlaces(normalized);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        return cached.map(mapBackendPlaceToPrediction);
      }
    } catch (cacheErr) {
      console.warn('[mapsService] Error checking local cache:', cacheErr);
    }

    // 2. Fetch from backend API
    try {
      const response = await apiClient.get<BackendPlace[]>('/places/search', {
        params: { q: trimmed },
      });

      const places = response.data ?? [];

      // 3. Save to WatermelonDB cache for offline access
      if (places.length > 0) {
        PlacesDbService.cachePlaces(normalized, places).catch((err) => {
          console.warn('[mapsService] Error saving to local cache:', err);
        });
      }

      return places.map(mapBackendPlaceToPrediction);
    } catch (error) {
      console.error('[mapsService] getPlacePredictions error:', error);
      return [];
    }
  },

  /**
   * Legacy place details resolver (for backward compatibility if needed)
   */
  async getPlaceDetails(placeId: string): Promise<GooglePlaceDetails | null> {
    if (!placeId) return null;
    return null;
  },

  /**
   * Reverse geocoding using the Google Geocoding API
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
