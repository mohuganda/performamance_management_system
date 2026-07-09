import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Loader2, MapPin, Navigation, X } from 'lucide-react'
import { useGoogleMapsApi } from '@/hooks/useGoogleMapsApi'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { PlacePrediction } from '@/types/google-maps.d'
import { cn } from '@/utils/cn'

export type PlaceSelection = {
  name: string
  address: string
  latitude: number
  longitude: number
}

type PlaceAutocompleteFieldProps = {
  label?: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
  onPlaceSelect: (place: PlaceSelection) => void
  className?: string
}

export function PlaceAutocompleteField({
  label = 'Where are you going?',
  value,
  placeholder = 'Search for a building, address, or landmark',
  onChange,
  onPlaceSelect,
  className,
}: PlaceAutocompleteFieldProps) {
  const listId = useId()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const placesHostRef = useRef<HTMLDivElement | null>(null)
  const sessionTokenRef = useRef<object | null>(null)

  const { ready, error, apiKey, countryCodes } = useGoogleMapsApi()
  const debouncedQuery = useDebouncedValue(value.trim(), 280)

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const countryLabel =
    countryCodes.length === 1
      ? countryCodes[0].toUpperCase()
      : countryCodes.map((c) => c.toUpperCase()).join(', ')

  const fetchPredictions = useCallback(
    (query: string) => {
      if (!ready || !window.google?.maps?.places) return
      if (query.length < 2) {
        setPredictions([])
        setFetchError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setFetchError(null)
      const service = new window.google.maps.places.AutocompleteService()
      const request: {
        input: string
        componentRestrictions?: { country: string | string[] }
        types?: string[]
      } = {
        input: query,
        types: ['geocode', 'establishment'],
      }
      if (countryCodes.length > 0) {
        request.componentRestrictions = {
          country: countryCodes.length === 1 ? countryCodes[0] : countryCodes,
        }
      }

      service.getPlacePredictions(request, (results, status) => {
        setLoading(false)
        const ok = window.google?.maps?.places?.PlacesServiceStatus?.OK ?? 'OK'
        if (status !== ok) {
          setPredictions([])
          setFetchError(
            status === 'ZERO_RESULTS'
              ? 'No places found. Try a different search.'
              : 'Could not load suggestions. Check your Maps API key and Places API access.',
          )
          return
        }
        setPredictions(results ?? [])
        setActiveIndex(-1)
        if (!results?.length) {
          setFetchError('No places found in the selected country. Try another search.')
        }
      })
    },
    [ready, countryCodes],
  )

  useEffect(() => {
    if (!open) return
    fetchPredictions(debouncedQuery)
  }, [debouncedQuery, fetchPredictions, open])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const resolvePlace = (prediction: PlacePrediction) => {
    if (!window.google?.maps?.places) return
    if (!placesHostRef.current) return

    const placesService = new window.google.maps.places.PlacesService(placesHostRef.current)
    placesService.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['name', 'formatted_address', 'geometry'],
      },
      (place, status) => {
        const ok = window.google?.maps?.places?.PlacesServiceStatus?.OK ?? 'OK'
        if (status !== ok || !place?.geometry?.location) return

        const lat = place.geometry.location.lat()
        const lng = place.geometry.location.lng()
        const name =
          place.name?.trim() ||
          prediction.structured_formatting?.main_text?.trim() ||
          prediction.description
        const address = place.formatted_address?.trim() || prediction.description

        onChange(name)
        onPlaceSelect({ name, address, latitude: lat, longitude: lng })
        setOpen(false)
        setPredictions([])
        setActiveIndex(-1)
        sessionTokenRef.current = null
      },
    )
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || predictions.length === 0) {
      if (event.key === 'ArrowDown' && predictions.length > 0) {
        setOpen(true)
        setActiveIndex(0)
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % predictions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index <= 0 ? predictions.length - 1 : index - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const pick = predictions[activeIndex] ?? predictions[0]
      if (pick) resolvePlace(pick)
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showDropdown = open && (loading || predictions.length > 0 || Boolean(fetchError))

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div ref={placesHostRef} className="hidden" aria-hidden />

      <label htmlFor={listId} className="mb-1.5 block text-sm font-semibold text-ui-text">
        {label}
      </label>

      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5 shadow-sm transition',
          open ? 'border-moh-green ring-2 ring-moh-green/15' : 'border-ui-border',
        )}
      >
        <MapPin className="h-5 w-5 shrink-0 text-moh-green" aria-hidden />
        <input
          ref={inputRef}
          id={listId}
          type="text"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={`${listId}-listbox`}
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-sm text-ui-text outline-none placeholder:text-ui-muted"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
            setFetchError(null)
          }}
          onKeyDown={handleKeyDown}
        />
        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ui-muted" /> : null}
        {value ? (
          <button
            type="button"
            className="rounded-sm p-1 text-ui-muted transition hover:bg-ui-subtle hover:text-ui-text"
            aria-label="Clear destination search"
            onClick={() => {
              onChange('')
              setPredictions([])
              setFetchError(null)
              setOpen(false)
              inputRef.current?.focus()
            }}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <p className="mt-1.5 text-xs text-ui-muted">
        {countryCodes.length > 0
          ? `Suggestions are limited to ${countryLabel}.`
          : 'Search powered by Google Maps.'}
      </p>

      {!apiKey ? (
        <p className="mt-1 text-xs text-amber-700">
          Add a Google Maps API key under Settings → Data sources to enable destination search.
        </p>
      ) : error ? (
        <p className="mt-1 text-xs text-moh-error">{error}</p>
      ) : !ready ? (
        <p className="mt-1 text-xs text-ui-muted">Loading location search…</p>
      ) : null}

      {showDropdown ? (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className="absolute z-50 mt-2 max-h-80 w-full overflow-auto rounded-lg border border-ui-border bg-white py-1 shadow-lg"
        >
          {loading && predictions.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ui-muted">Searching places…</li>
          ) : null}

          {!loading && fetchError ? (
            <li className="px-4 py-3 text-sm text-ui-muted">{fetchError}</li>
          ) : null}

          {predictions.map((prediction, index) => {
            const main =
              prediction.structured_formatting?.main_text ??
              prediction.description.split(',')[0] ??
              prediction.description
            const secondary =
              prediction.structured_formatting?.secondary_text ??
              prediction.description.split(',').slice(1).join(',').trim()

            return (
              <li key={prediction.place_id} role="option" aria-selected={activeIndex === index}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition',
                    activeIndex === index ? 'bg-moh-green/8' : 'hover:bg-ui-subtle/80',
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => resolvePlace(prediction)}
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ui-subtle text-moh-green">
                    <Navigation className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ui-text">{main}</span>
                    {secondary ? (
                      <span className="mt-0.5 block truncate text-xs text-ui-muted">{secondary}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
