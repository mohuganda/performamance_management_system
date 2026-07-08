import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/utils/cn'

export type SearchableSelectOption = {
  value: string
  label: string
  description?: string
}

type SearchableSelectProps = {
  label: string
  value: string
  options: SearchableSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  emptyLabel?: string
  disabled?: boolean
  className?: string
  allowClear?: boolean
}

type FieldState = 'close' | 'open' | 'withValue'

export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Search…',
  emptyLabel,
  disabled = false,
  className,
  allowClear = true,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((option) => {
      const haystack = `${option.label} ${option.description ?? ''}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [options, query])

  const displayValue = selected?.label ?? (value ? '' : emptyLabel) ?? ''
  const fieldState: FieldState = open ? 'open' : displayValue ? 'withValue' : 'close'

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const choose = (next: string) => {
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  const openField = () => {
    if (disabled) return
    setOpen(true)
    setQuery('')
  }

  return (
    <div ref={rootRef} className={cn('relative min-w-[200px] w-full', className)}>
      <div
        className={cn(
          'relative h-10 w-full min-w-[200px]',
          disabled && 'opacity-50',
        )}
      >
        <div
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            'peer h-full w-full rounded-[7px] border border-blue-gray-200 bg-transparent px-3 py-2.5 font-sans text-sm font-normal text-blue-gray-700 outline outline-0 transition-all',
            open && 'border-2 border-gray-900 border-t-transparent',
            fieldState === 'withValue' && !open && 'border-t-transparent',
            disabled && 'cursor-not-allowed bg-blue-gray-50',
            !open && 'cursor-pointer',
          )}
          onClick={() => !open && openField()}
        >
          {open ? (
            <input
              ref={inputRef}
              type="text"
              disabled={disabled}
              value={query}
              placeholder={placeholder}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent pr-14 text-sm text-blue-gray-700 outline-none placeholder:text-blue-gray-400"
            />
          ) : (
            <span className="absolute top-2/4 left-3 block max-w-[calc(100%-3rem)] -translate-y-2/4 truncate pt-0.5 text-left">
              {displayValue}
            </span>
          )}

          <div className="absolute top-2/4 right-2 flex -translate-y-2/4 items-center gap-0.5">
            {allowClear && value && !open ? (
              <button
                type="button"
                disabled={disabled}
                className="rounded p-0.5 text-blue-gray-400 hover:bg-blue-gray-50 hover:text-blue-gray-700"
                aria-label="Clear selection"
                onClick={(e) => {
                  e.stopPropagation()
                  choose('')
                }}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              disabled={disabled}
              className="grid h-5 w-5 place-items-center text-blue-gray-400"
              aria-label={open ? 'Close options' : 'Open options'}
              onClick={(e) => {
                e.stopPropagation()
                if (disabled) return
                if (open) {
                  setOpen(false)
                  setQuery('')
                } else {
                  openField()
                }
              }}
            >
              <ChevronDown className={cn('h-5 w-5 transition', open && 'rotate-180')} />
            </button>
          </div>
        </div>

        <label
          className={cn(
            'pointer-events-none absolute left-0 flex h-full w-full select-none font-normal text-blue-gray-400 transition-all',
            fieldState === 'close'
              ? 'text-sm leading-[3.75] peer-disabled:text-blue-gray-400 before:border-t-transparent after:border-t-transparent'
              : 'text-[11px] leading-tight before:border-t-2 after:border-t-2',
            fieldState === 'withValue' &&
              'text-[11px] leading-tight before:border-t after:border-t',
            '-top-1.5 before:mr-1 before:block before:h-1.5 before:w-2.5 before:rounded-tl-md before:border-l before:border-blue-gray-200 before:transition-all after:ml-1 after:block after:h-1.5 after:flex-grow after:rounded-tr-md after:border-r after:border-blue-gray-200 after:transition-all',
            open && 'text-[11px] leading-tight text-gray-900 before:border-l-2 before:border-blue-gray-200 after:border-r-2 after:border-blue-gray-200',
            fieldState === 'withValue' && !open && 'text-[11px] text-blue-gray-400',
          )}
        >
          {label}
        </label>
      </div>

      {open ? (
        <div
          className="absolute z-50 mt-1 max-h-96 w-full overflow-auto rounded-md border border-blue-gray-50 bg-white p-1 shadow-lg shadow-blue-gray-500/10"
          role="listbox"
        >
          {emptyLabel ? (
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={cn(
                'flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm leading-tight transition-all hover:bg-blue-gray-50 hover:bg-opacity-80 hover:text-blue-gray-900',
                !value && 'bg-blue-gray-50 bg-opacity-80 text-blue-gray-900',
              )}
              onClick={() => choose('')}
            >
              <span className="flex-1 text-blue-gray-500">{emptyLabel}</span>
              {!value ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
            </button>
          ) : null}

          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-blue-gray-500">No matches for “{query.trim()}”.</p>
          ) : (
            filtered.map((option) => {
              const isActive = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm leading-tight transition-all hover:bg-blue-gray-50 hover:bg-opacity-80 hover:text-blue-gray-900',
                    isActive && 'bg-blue-gray-50 bg-opacity-80 text-blue-gray-900',
                  )}
                  onClick={() => choose(option.value)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-normal leading-tight text-blue-gray-700">{option.label}</span>
                    {option.description ? (
                      <span className="mt-0.5 block text-xs text-blue-gray-500">{option.description}</span>
                    ) : null}
                  </span>
                  {isActive ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                </button>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
