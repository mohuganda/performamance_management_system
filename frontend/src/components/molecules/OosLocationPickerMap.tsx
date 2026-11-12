import { useEffect, useRef, useState, useCallback } from 'react'
import { Info, Loader2, Navigation } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useGoogleMapsApi } from '@/hooks/useGoogleMapsApi'
import { useGoogleMapsScript } from '@/hooks/useGoogleMapsScript'
import { cn } from '@/utils/cn'

interface Coords {
  latitude: number
  longitude: number
}

interface OosLocationPickerMapProps {
  coords: Coords | null
  onLocationChange: (newCoords: Coords, resolvedAddress?: string) => void
  className?: string
  error?: string
}

export function OosLocationPickerMap({
  coords,
  onLocationChange,
  className,
  error,
}: OosLocationPickerMapProps) {
  const { t } = useTranslation()
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const circleRef = useRef<any>(null)
  const [isLocating, setIsLocating] = useState(false)

  const { apiKey, ready: keyReady } = useGoogleMapsApi()
  const { ready: scriptReady } = useGoogleMapsScript(keyReady ? apiKey : '')

  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      if (!window.google?.maps?.Geocoder) {
        onLocationChange({ latitude: lat, longitude: lng })
        return
      }
      const geocoder = new window.google.maps.Geocoder()
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          onLocationChange(
            { latitude: lat, longitude: lng },
            results[0].formatted_address,
          )
        } else {
          onLocationChange({ latitude: lat, longitude: lng })
        }
      })
    },
    [onLocationChange],
  )

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }
        setIsLocating(false)
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter({
            lat: newCoords.latitude,
            lng: newCoords.longitude,
          })
          mapInstanceRef.current.setZoom(16)
        }
        reverseGeocode(newCoords.latitude, newCoords.longitude)
      },
      (err) => {
        console.warn('Geolocation error:', err)
        setIsLocating(false)
        alert('Unable to retrieve current coordinates. Please select manually on the map.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    )
  }

  // Initialize or update Map
  useEffect(() => {
    if (!scriptReady || !mapContainerRef.current || !coords || !window.google?.maps) return

    const maps = window.google.maps
    const pos = { lat: coords.latitude, lng: coords.longitude }

    if (!mapInstanceRef.current) {
      const map = new maps.Map(mapContainerRef.current, {
        center: pos,
        zoom: 16,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })
      mapInstanceRef.current = map

      const marker = new maps.Marker({
        position: pos,
        map,
        draggable: true,
        title: 'Selected Destination',
      })
      markerRef.current = marker

      const circle = new maps.Circle({
        map,
        center: pos,
        radius: 500,
        fillColor: 'rgba(21, 128, 61, 0.15)',
        strokeColor: '#15803D',
        strokeWeight: 1.5,
      })
      circleRef.current = circle

      marker.addListener('dragend', () => {
        const p = marker.getPosition()
        if (p) {
          const lat = p.lat()
          const lng = p.lng()
          circle.setCenter({ lat, lng })
          reverseGeocode(lat, lng)
        }
      })

      map.addListener('click', (e: any) => {
        if (e.latLng) {
          const lat = e.latLng.lat()
          const lng = e.latLng.lng()
          marker.setPosition({ lat, lng })
          circle.setCenter({ lat, lng })
          reverseGeocode(lat, lng)
        }
      })
    } else {
      mapInstanceRef.current.setCenter(pos)
      if (markerRef.current) {
        markerRef.current.setPosition(pos)
      }
      if (circleRef.current) {
        circleRef.current.setCenter(pos)
      }
    }
  }, [scriptReady, coords, reverseGeocode])

  if (!coords) return null

  return (
    <div className={cn('mb-6', className)}>
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-semibold text-ui-text">
          Fine-tune Location on Map
        </label>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="flex items-center gap-1.5 bg-ui-surface hover:bg-ui-subtle px-3 py-1.5 border border-ui-border text-xs font-bold text-ui-text cursor-pointer disabled:opacity-50 transition-colors"
        >
          {isLocating ? (
            <Loader2 size={12} className="animate-spin text-ui-muted" />
          ) : (
            <Navigation size={12} className="text-ui-text" />
          )}
          <span>{t('oos_btn_current_location', 'Use Current Location')}</span>
        </button>
      </div>

      <div className="h-56 w-full border border-ui-border relative overflow-hidden bg-ui-subtle">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {error ? (
        <p className="text-xs text-red-500 font-medium mt-1">{error}</p>
      ) : null}

      {/* Helper Card matching Mobile */}
      <div className="p-3.5 border border-blue-500/20 bg-blue-500/5 mt-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
            Adjust Location
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-ui-muted">
          Drag the <span className="font-semibold text-ui-text">red pin</span> or tap on the map to fine-tune your destination. The <span className="font-semibold text-ui-text">green circle</span> shows the 500m attendance verification zone.
        </p>
      </div>

      {/* Fixed Radius Callout Banner matching Mobile */}
      <div className="p-4 border border-ui-border flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900/50 mt-4">
        <Info size={16} className="text-ui-muted shrink-0" />
        <p className="text-xs text-ui-muted flex-1 leading-relaxed">
          Verification Radius is fixed to <span className="font-bold text-ui-text">500 meters</span>. You must check in within 500m of this location to verify attendance.
        </p>
      </div>
    </div>
  )
}
