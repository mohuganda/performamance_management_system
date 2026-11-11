import axios from 'axios';
import { config } from '../../config';
import apiClient from '../client';
import {
  GooglePlacePrediction,
  GooglePlaceDetails,
  GoogleGeocodingResult,
  BackendPlace,
} from './types';

const API_KEY = config.googleMapsApiKey;

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
  async getPlacePredictions(query: string): Promise<GooglePlacePrediction[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      const response = await apiClient.get<BackendPlace[]>('/places/search', {
        params: { q: trimmed },
      });

      const places = response.data ?? [];
      return places.map(mapBackendPlaceToPrediction);
    } catch (error) {
      console.error('[mapsService] getPlacePredictions error:', error);
      return [];
    }
  },

  async getPlaceDetails(_placeId: string): Promise<GooglePlaceDetails | null> {
    return null;
  },

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
