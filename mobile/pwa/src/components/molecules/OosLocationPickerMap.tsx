import React, { useMemo, useCallback } from 'react';
import { GoogleMap, Marker, Circle, useJsApiLoader } from '@react-google-maps/api';
import { Navigation, Info, AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { config } from '../../config';
import { useThemeStore } from '../../stores/themeStore';
import { GOOGLE_MAPS_SCRIPT_ID, getMapOptions, getDestinationPinIcon } from '../../utils/googleMaps';

interface OosLocationPickerMapProps {
  coords: { latitude: number; longitude: number } | null;
  onLocationChange: (coords: { latitude: number; longitude: number }) => void;
  onUseCurrentLocation: () => void;
  isLocating: boolean;
  error?: string;
}

export const OosLocationPickerMap: React.FC<OosLocationPickerMapProps> = ({
  coords,
  onLocationChange,
  onUseCurrentLocation,
  isLocating,
  error,
}) => {
  const { t } = useTranslation();
  const { isDark } = useThemeStore();

  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: config.googleMapsApiKey,
  });

  const mapOptions = useMemo(() => getMapOptions(isDark), [isDark]);
  const destinationIcon = useMemo(
    () => (isLoaded ? getDestinationPinIcon() : undefined),
    [isLoaded]
  );

  const center = useMemo(() => {
    if (coords) return { lat: coords.latitude, lng: coords.longitude };
    return { lat: 0.3476, lng: 32.5825 };
  }, [coords]);

  const handleMarkerDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        onLocationChange({
          latitude: e.latLng.lat(),
          longitude: e.latLng.lng(),
        });
      }
    },
    [onLocationChange]
  );

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        onLocationChange({
          latitude: e.latLng.lat(),
          longitude: e.latLng.lng(),
        });
      }
    },
    [onLocationChange]
  );

  if (!coords) return null;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Fine-tune Location on Map
        </label>
        <button
          type="button"
          onClick={onUseCurrentLocation}
          disabled={isLocating}
          className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer disabled:opacity-50 transition-colors"
        >
          {isLocating ? (
            <RefreshCw size={12} className="animate-spin text-zinc-500" />
          ) : (
            <Navigation size={12} className="text-zinc-700 dark:text-zinc-300" />
          )}
          <span>{t('oos_btn_current_location', 'Use Current Location')}</span>
        </button>
      </div>

      <div className="h-56 w-full border border-zinc-200 dark:border-zinc-800 relative overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {!config.googleMapsApiKey ? (
          <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center text-xs text-zinc-500">
            <AlertTriangle size={24} className="text-amber-500 mb-2" />
            <span>Google Maps API key not configured.</span>
          </div>
        ) : loadError ? (
          <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center text-xs text-zinc-500">
            <AlertTriangle size={24} className="text-red-500 mb-2" />
            <span className="text-red-600 dark:text-red-400">Failed to load Google Maps</span>
          </div>
        ) : !isLoaded ? (
          <div className="h-full w-full flex items-center justify-center text-xs text-zinc-400 gap-2">
            <RefreshCw size={18} className="animate-spin text-emerald-600" />
            <span>Loading Map...</span>
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={16}
            options={mapOptions}
            onClick={handleMapClick}
          >
            <Marker
              position={center}
              draggable={true}
              onDragEnd={handleMarkerDragEnd}
              icon={destinationIcon}
              title="Selected Destination"
            />
            <Circle
              center={center}
              radius={500}
              options={{
                fillColor: '#15803D',
                fillOpacity: 0.15,
                strokeColor: '#15803D',
                strokeWeight: 1.5,
              }}
            />
          </GoogleMap>
        )}
      </div>

      {error && <p className="text-xs text-red-500 font-medium mt-1">{error}</p>}

      {/* Helper Card matching Mobile */}
      <div className="p-3.5 border border-blue-500/20 bg-blue-500/5 mt-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-bold text-blue-700 dark:text-blue-400">Adjust Location</span>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Drag the <span className="font-semibold text-zinc-900 dark:text-zinc-100">red pin</span> or tap on the map to fine-tune your destination. The <span className="font-semibold text-zinc-900 dark:text-zinc-100">green circle</span> shows the 500m attendance verification zone.
        </p>
      </div>

      {/* Fixed Radius Callout Banner matching Mobile */}
      <div className="p-4 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900/50 mt-4">
        <Info size={16} className="text-zinc-400 shrink-0" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400 flex-1 leading-relaxed">
          Verification Radius is fixed to <span className="font-bold text-zinc-900 dark:text-zinc-100">500 meters</span>. You must check in within 500m of this location to verify attendance.
        </p>
      </div>
    </div>
  );
};
