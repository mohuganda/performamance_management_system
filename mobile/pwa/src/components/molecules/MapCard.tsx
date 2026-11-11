import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

// Custom self-contained HTML marker for user position
const userPinIcon = L.divIcon({
  className: 'custom-user-pin',
  html: `
    <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
      <div style="width:24px; height:24px; border-radius:50%; background:#D90000; border:2px solid #FFFFFF; box-shadow:0 2px 4px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center;">
        <div style="width:8px; height:8px; border-radius:50%; background:#FFFFFF;"></div>
      </div>
      <div style="width:8px; height:8px; background:#D90000; transform:rotate(45deg); margin-top:-4px;"></div>
    </div>
  `,
  iconSize: [24, 28],
  iconAnchor: [12, 28],
});

// Custom destination marker
const destinationPinIcon = L.divIcon({
  className: 'custom-destination-pin',
  html: `
    <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
      <div style="width:28px; height:28px; border-radius:50%; background:#15803D; border:2px solid #FFFFFF; box-shadow:0 2px 4px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      </div>
      <div style="width:8px; height:8px; background:#15803D; transform:rotate(45deg); margin-top:-4px;"></div>
    </div>
  `,
  iconSize: [28, 32],
  iconAnchor: [14, 32],
});

function MapRecenter({ coords }: { coords: { latitude: number; longitude: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([coords.latitude, coords.longitude], map.getZoom());
  }, [coords, map]);
  return null;
}

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

  const centerCoords = coords || targetCoords || DEFAULT_COORDS;

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
            {coords ? t('attendance_gps_locked', 'GPS Signal Acquired') : t('attendance_gps_searching', 'Searching GPS Signal...')}
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
        <MapContainer
          center={[centerCoords.latitude, centerCoords.longitude]}
          zoom={16}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapRecenter coords={centerCoords} />

          {/* User Location Marker & Accuracy Circle */}
          {coords && (
            <>
              <Marker position={[coords.latitude, coords.longitude]} icon={userPinIcon} />
              <Circle
                center={[coords.latitude, coords.longitude]}
                radius={coords.accuracy || 15}
                pathOptions={{
                  fillColor: '#3B82F6',
                  fillOpacity: 0.15,
                  color: '#3B82F6',
                  weight: 1.5,
                }}
              />
            </>
          )}

          {/* Target / Destination Marker & Geofence Perimeter */}
          {targetCoords && (
            <>
              <Marker
                position={[targetCoords.latitude, targetCoords.longitude]}
                icon={destinationPinIcon}
              />
              {geofenceRadius && (
                <Circle
                  center={[targetCoords.latitude, targetCoords.longitude]}
                  radius={geofenceRadius}
                  pathOptions={{
                    fillColor: '#22C55E',
                    fillOpacity: 0.15,
                    color: '#15803D',
                    weight: 2,
                    dashArray: '4, 4',
                  }}
                />
              )}
            </>
          )}
        </MapContainer>

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

