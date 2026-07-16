import { useState, useEffect, useCallback } from 'react';
import mapsService from '../../api/maps/service';
import { GooglePlacePrediction, GooglePlaceDetails } from '../../api/maps/types';

export interface PlaceSelectedResult {
  name: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
}

interface UsePlacesSearchOptions {
  /** Called when a place prediction is selected and details resolved */
  onPlaceSelected?: (result: PlaceSelectedResult) => void;
  /** Called when reverse geocoding resolves a coordinate to an address */
  onReverseGeocoded?: (result: { name: string; formatted_address: string }) => void;
}

export function usePlacesSearch(options: UsePlacesSearchOptions = {}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<GooglePlacePrediction[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Debounced autocomplete predictions fetch (300ms)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setPredictions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      const list = await mapsService.getPlacePredictions(searchQuery);
      setPredictions(list);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  /** Select a prediction, resolve place details, and notify parent */
  const selectPrediction = useCallback(async (prediction: GooglePlacePrediction): Promise<PlaceSelectedResult | null> => {
    setIsGeocoding(true);
    setPredictions([]);
    try {
      const details = await mapsService.getPlaceDetails(prediction.place_id);
      if (details) {
        const result: PlaceSelectedResult = {
          name: details.name,
          formatted_address: details.formatted_address,
          latitude: details.latitude,
          longitude: details.longitude,
        };
        setSearchQuery(details.name);
        options.onPlaceSelected?.(result);
        return result;
      }
      return null;
    } catch (err) {
      console.error('[usePlacesSearch] selectPrediction error:', err);
      return null;
    } finally {
      setIsGeocoding(false);
    }
  }, [options]);

  /** Reverse geocode coordinates to address and notify parent */
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsGeocoding(true);
    try {
      const res = await mapsService.reverseGeocode(lat, lng);
      if (res) {
        setSearchQuery(res.name);
        options.onReverseGeocoded?.(res);
        return res;
      }
      return null;
    } catch (err) {
      console.error('[usePlacesSearch] reverseGeocode error:', err);
      return null;
    } finally {
      setIsGeocoding(false);
    }
  }, [options]);

  /** Reset all search state */
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setPredictions([]);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    predictions,
    isGeocoding,
    selectPrediction,
    reverseGeocode,
    clearSearch,
  };
}
