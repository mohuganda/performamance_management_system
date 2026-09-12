import { useState, useEffect, useCallback, useRef } from 'react';
import mapsService from '../../api/maps/service';
import { GooglePlacePrediction } from '../../api/maps/types';

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
  const skipNextSearchRef = useRef(false);

  // Debounced autocomplete predictions fetch (300ms)
  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      setPredictions([]);
      return;
    }

    if (!searchQuery.trim()) {
      setPredictions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      const list = await mapsService.getPlacePredictions(searchQuery);
      if (!skipNextSearchRef.current) {
        setPredictions(list);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  /** Custom query setter that allows normal keystrokes to search */
  const handleSetSearchQuery = useCallback((query: string) => {
    skipNextSearchRef.current = false;
    setSearchQuery(query);
  }, []);

  /** Select a prediction, resolve place details, dismiss dropdown, and notify parent */
  const selectPrediction = useCallback(async (prediction: GooglePlacePrediction): Promise<PlaceSelectedResult | null> => {
    skipNextSearchRef.current = true;
    setPredictions([]);

    // Direct resolution if coordinates are already present in prediction
    if (prediction.latitude !== undefined && prediction.longitude !== undefined) {
      const result: PlaceSelectedResult = {
        name: prediction.name || prediction.structured_formatting?.main_text || prediction.description,
        formatted_address: prediction.address || prediction.description,
        latitude: prediction.latitude,
        longitude: prediction.longitude,
      };
      setSearchQuery(result.name);
      options.onPlaceSelected?.(result);
      return result;
    }

    setIsGeocoding(true);
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
        skipNextSearchRef.current = true;
        setPredictions([]);
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
    skipNextSearchRef.current = true;
    setSearchQuery('');
    setPredictions([]);
  }, []);

  return {
    searchQuery,
    setSearchQuery: handleSetSearchQuery,
    predictions,
    isGeocoding,
    selectPrediction,
    reverseGeocode,
    clearSearch,
  };
}
