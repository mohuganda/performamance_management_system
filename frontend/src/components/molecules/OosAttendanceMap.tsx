import { useEffect, useRef } from 'react'
import { Typography } from '@material-tailwind/react'
import { useGoogleMapsApi } from '@/hooks/useGoogleMapsApi'
import { useGoogleMapsScript } from '@/hooks/useGoogleMapsScript'
import { mt } from '@/utils/mt'

export type MapClockPoint = {
  lat: number
  lng: number
  clock_type?: string
  accuracy_percent?: number | null
  label?: string
}

type OosAttendanceMapProps = {
  destination: { lat: number; lng: number; name?: string }
  radiusMeters: number
  clocks?: MapClockPoint[]
  current?: { lat: number; lng: number } | null
  previewAccuracyPercent?: number | null
  className?: string
}

export function OosAttendanceMap({
  destination,
  radiusMeters,
  clocks = [],
  current = null,
  previewAccuracyPercent = null,
  className,
}: OosAttendanceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { apiKey, ready: keyReady, error: keyError } = useGoogleMapsApi()
  const { ready: scriptReady, error: scriptError } = useGoogleMapsScript(keyReady ? apiKey : '')

  useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.google?.maps) return

    const maps = window.google.maps
    const map = new maps.Map(containerRef.current, {
      center: { lat: destination.lat, lng: destination.lng },
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })

    const overlays: Array<{ setMap: (m: unknown) => void }> = []

    overlays.push(
      new maps.Marker({
        map,
        position: { lat: destination.lat, lng: destination.lng },
        title: destination.name || 'Destination',
        label: { text: 'D', color: '#fff', fontWeight: '700' },
      }),
    )

    overlays.push(
      new maps.Circle({
        map,
        center: { lat: destination.lat, lng: destination.lng },
        radius: Math.max(1, radiusMeters),
        strokeColor: '#0b4f4a',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: '#0b4f4a',
        fillOpacity: 0.12,
      }),
    )

    for (const clock of clocks) {
      if (!Number.isFinite(clock.lat) || !Number.isFinite(clock.lng)) continue
      const isIn = (clock.clock_type || '').toLowerCase() === 'in'
      overlays.push(
        new maps.Marker({
          map,
          position: { lat: clock.lat, lng: clock.lng },
          title:
            clock.label ||
            `${isIn ? 'Clock in' : 'Clock out'}${
              clock.accuracy_percent != null ? ` · ${Math.round(clock.accuracy_percent)}%` : ''
            }`,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: isIn ? '#1b7a4e' : '#c62828',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        }),
      )
    }

    if (current && Number.isFinite(current.lat) && Number.isFinite(current.lng)) {
      overlays.push(
        new maps.Marker({
          map,
          position: { lat: current.lat, lng: current.lng },
          title:
            previewAccuracyPercent != null
              ? `You · ${Math.round(previewAccuracyPercent)}%`
              : 'Your location',
          label: { text: 'You', color: '#0b4f4a', fontWeight: '700', fontSize: '11px' },
        }),
      )
    }

    const bounds = new maps.LatLngBounds()
    bounds.extend({ lat: destination.lat, lng: destination.lng })
    for (const clock of clocks) {
      if (Number.isFinite(clock.lat) && Number.isFinite(clock.lng)) {
        bounds.extend({ lat: clock.lat, lng: clock.lng })
      }
    }
    if (current) bounds.extend({ lat: current.lat, lng: current.lng })
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 48)
    }

    return () => {
      for (const overlay of overlays) overlay.setMap(null)
    }
  }, [
    scriptReady,
    destination.lat,
    destination.lng,
    destination.name,
    radiusMeters,
    clocks,
    current,
    previewAccuracyPercent,
  ])

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${destination.lat},${destination.lng}`

  if (keyError || !apiKey) {
    return (
      <div className={className}>
        <Typography {...mt} className="text-sm text-ui-muted">
          Map preview needs a Google Maps API key (Settings → Data sources).{' '}
          <a className="text-moh-green underline" href={mapsHref} target="_blank" rel="noreferrer">
            Open destination in Google Maps
          </a>
        </Typography>
      </div>
    )
  }

  if (scriptError) {
    return (
      <div className={className}>
        <Typography {...mt} className="text-sm text-moh-error">
          {scriptError}.{' '}
          <a className="underline" href={mapsHref} target="_blank" rel="noreferrer">
            Open destination in Google Maps
          </a>
        </Typography>
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="h-64 w-full overflow-hidden rounded-sm border border-moh-green/20 bg-ui-subtle"
        aria-label="Out-of-station attendance map"
      />
      {previewAccuracyPercent != null ? (
        <Typography {...mt} className="mt-2 text-xs text-ui-muted">
          Live accuracy preview: <span className="font-semibold text-ui-text">{Math.round(previewAccuracyPercent)}%</span>
        </Typography>
      ) : null}
    </div>
  )
}
