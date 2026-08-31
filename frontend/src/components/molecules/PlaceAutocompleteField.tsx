import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Loader2, MapPin, Navigation, X } from 'lucide-react'
import { useGoogleMapsApi } from '@/hooks/useGoogleMapsApi'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import {
  fetchPlaceDetails,
  fetchPlacePredictions,
  type PlacePrediction,
} from '@/api/services/places'
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
  const searchAbortRef = useRef<AbortController | null>(null)

  const { ready, error, apiKey, countryCodes } = useGoogleMapsApi()
  const debouncedQuery = useDebouncedValue(value.trim(), 280)

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const countryLabel =
    countryCodes.length === 1
      ? countryCodes[0].toUpperCase()
      : countryCodes.map((c) => c.toUpperCase()).join(', ')

  const fetchPredictions = useCallback(
    async (query: string) => {
      searchAbortRef.current?.abort()
      if (!ready || !apiKey) {
        setLoading(false)
        return
      }
      if (query.length < 2) {
        setPredictions([])
        setFetchError(null)
        setLoading(false)
        return
      }

      const controller = new AbortController()
      searchAbortRef.current = controller
      setLoading(true)
      setFetchError(null)

      try {
        const results = await fetchPlacePredictions({
          apiKey,
          input: query,
          countryCodes,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        setPredictions(results)
        setActiveIndex(-1)
        if (!results.length) {
          setFetchError('No places found. Try a different search.')
        }
      } catch (err) {
        if (controller.signal.aborted) return
        setPredictions([])
        setFetchError(err instanceof Error ? err.message : 'Could not load suggestions.')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    },
    [ready, apiKey, countryCodes],
  )

  useEffect(() => {
    if (!open) return
    void fetchPredictions(debouncedQuery)
    return () => {
      searchAbortRef.current?.abort()
    }
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

  const resolvePlace = async (prediction: PlacePrediction) => {
    if (!apiKey || resolving) return
    setResolving(true)
    setFetchError(null)
    try {
      const place = await fetchPlaceDetails({ apiKey, placeId: prediction.place_id })
      const name =
        place.name ||
        prediction.structured_formatting?.main_text?.trim() ||
        prediction.description
      onChange(name)
      onPlaceSelect({
        name,
        address: place.address || prediction.description,
        latitude: place.latitude,
        longitude: place.longitude,
      })
      setOpen(false)
      setPredictions([])
      setActiveIndex(-1)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Could not resolve that place.')
      setOpen(true)
    } finally {
      setResolving(false)
    }
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
      if (pick) void resolvePlace(pick)
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showDropdown = open && (loading || resolving || predictions.length > 0 || Boolean(fetchError))

  return (
    <div ref={containerRef} className={cn('relative', open && 'z-[80]', className)}>
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
        {loading || resolving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ui-muted" /> : null}
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
          className="absolute left-0 right-0 z-[90] mt-2 max-h-80 w-full overflow-auto rounded-lg border border-ui-border bg-white py-1 shadow-lg"
        >
          {(loading || resolving) && predictions.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ui-muted">
              {resolving ? 'Loading place details…' : 'Searching places…'}
            </li>
          ) : null}

          {!loading && !resolving && fetchError ? (
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
                  disabled={resolving}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition',
                    activeIndex === index ? 'bg-moh-green/8' : 'hover:bg-ui-subtle/80',
                    resolving && 'opacity-60',
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => void resolvePlace(prediction)}
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
