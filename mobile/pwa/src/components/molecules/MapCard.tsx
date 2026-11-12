import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleMap, Marker, Circle, useJsApiLoader } from '@react-google-maps/api';
import { Navigation, RefreshCw, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { config } from '../../config';
import { useThemeStore } from '../../stores/themeStore';
import {
  GOOGLE_MAPS_SCRIPT_ID,
  getMapOptions,
  getUserPinIcon,
  getDestinationPinIcon,
} from '../../utils/googleMaps';

interface MapCardProps {
  coords: { latitude: number; longitude: number; accuracy?: number } | null;
  targetCoords?: { latitude: number; longitude: number; name?: string } | null;
  geofenceRadius?: number;
  isLocating: boolean;
  geoError: string | null;
  onRefreshGps?: () => void;
  heightClass?: string;
}

const DEFAULT_COORDS = { latitude: 0.3476, longitude: 32.5825 }; // Kampala

export const MapCard: React.FC<MapCardProps> = ({
  coords,
  targetCoords,
  geofenceRadius,
  isLocating,
  geoError,
  onRefreshGps,
  heightClass = 'h-48',
}) => {
  const { t } = useTranslation();
  const { isDark } = useThemeStore();
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: config.googleMapsApiKey,
  });

  const centerCoords = coords || targetCoords || DEFAULT_COORDS;

  const mapCenter = useMemo(
    () => ({
      lat: centerCoords.latitude,
      lng: centerCoords.longitude,
    }),
    [centerCoords.latitude, centerCoords.longitude]
  );

  const mapOptions = useMemo(() => getMapOptions(isDark), [isDark]);

  const userIcon = useMemo(() => (isLoaded ? getUserPinIcon() : undefined), [isLoaded]);
  const destinationIcon = useMemo(
    () => (isLoaded ? getDestinationPinIcon() : undefined),
    [isLoaded]
  );

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  // Smoothly pan to new coordinates when user moves or target changes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.panTo({
        lat: centerCoords.latitude,
        lng: centerCoords.longitude,
      });
    }
  }, [centerCoords.latitude, centerCoords.longitude]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden mb-4">
      {/* Map Header */}
      <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Navigation
            size={14}
            className={coords ? 'text-green-600' : 'text-zinc-400 animate-pulse'}
          />
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {coords
              ? t('attendance_gps_locked', 'GPS Signal Acquired')
              : t('attendance_gps_searching', 'Searching GPS Signal...')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {coords?.accuracy && (
            <span className="text-[11px] text-zinc-500 font-mono">
              ±{Math.round(coords.accuracy)}m
            </span>
          )}
          {onRefreshGps && (
            <button
              onClick={onRefreshGps}
              disabled={isLocating}
              className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              title="Refresh GPS"
            >
              <RefreshCw size={13} className={isLocating ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Map Body */}
      <div className={`${heightClass} w-full relative z-0`}>
        {!config.googleMapsApiKey ? (
          <div className="h-full w-full flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 text-xs p-4 text-center">
            <AlertTriangle size={24} className="text-amber-500 mb-2" />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {t('maps_missing_key')}
            </span>
          </div>
        ) : loadError ? (
          <div className="h-full w-full flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 text-xs p-4 text-center">
            <AlertTriangle size={24} className="text-red-500 mb-2" />
            <span className="font-medium text-red-600 dark:text-red-400">
              {t('maps_load_error')}
            </span>
          </div>
        ) : !isLoaded ? (
          <div className="h-full w-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-800/40 text-zinc-400 text-xs gap-2">
            <RefreshCw size={20} className="animate-spin text-primary" />
            <span>{t('maps_loading')}</span>
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={mapCenter}
            zoom={16}
            options={mapOptions}
            onLoad={onLoad}
            onUnmount={onUnmount}
          >
            {/* User Location Marker & Accuracy Circle */}
            {coords && (
              <>
                <Marker
                  position={{ lat: coords.latitude, lng: coords.longitude }}
                  icon={userIcon}
                />
                <Circle
                  center={{ lat: coords.latitude, lng: coords.longitude }}
                  radius={coords.accuracy || 15}
                  options={{
                    fillColor: '#3B82F6',
                    fillOpacity: 0.15,
                    strokeColor: '#3B82F6',
                    strokeWeight: 1.5,
                  }}
                />
              </>
            )}

            {/* Target / Destination Marker & Geofence Perimeter */}
            {targetCoords && (
              <>
                <Marker
                  position={{ lat: targetCoords.latitude, lng: targetCoords.longitude }}
                  icon={destinationIcon}
                />
                {geofenceRadius && (
                  <Circle
                    center={{ lat: targetCoords.latitude, lng: targetCoords.longitude }}
                    radius={geofenceRadius}
                    options={{
                      fillColor: '#22C55E',
                      fillOpacity: 0.15,
                      strokeColor: '#15803D',
                      strokeWeight: 2,
                    }}
                  />
                )}
              </>
            )}
          </GoogleMap>
        )}

        {/* Loading Overlay */}
        {isLocating && (
          <div className="absolute inset-0 bg-black/40 z-10 flex flex-col items-center justify-center text-white text-xs font-semibold backdrop-blur-[1px]">
            <RefreshCw size={22} className="animate-spin mb-2" />
            <span>Acquiring High-Accuracy GPS...</span>
          </div>
        )}

        {/* Error Overlay */}
        {geoError && (
          <div className="absolute inset-0 bg-black/75 z-10 flex flex-col items-center justify-center p-4 text-center">
            <p className="text-red-400 text-xs font-semibold leading-relaxed mb-3">
              {geoError}
            </p>
            {onRefreshGps && (
              <button
                onClick={onRefreshGps}
                className="px-3 py-1.5 bg-red-600/30 border border-red-500 text-white font-bold text-xs"
              >
                Retry GPS Acquisition
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
