import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useUiPreferencesStore } from '@/stores/uiPreferencesStore'
import type { SearchableSelectOption } from './SearchableSelect'

type SearchableMultiSelectProps = {
  label: string
  values: string[]
  options: SearchableSelectOption[]
  onChange: (values: string[]) => void
  placeholder?: string
  emptyLabel?: string
  disabled?: boolean
  className?: string
}

export function SearchableMultiSelect({
  label,
  values,
  options,
  onChange,
  placeholder = 'Search…',
  emptyLabel,
  disabled = false,
  className,
}: SearchableMultiSelectProps) {
  const floatingLabels = useUiPreferencesStore((s) => s.floatingLabels)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedOptions = useMemo(
    () => options.filter((option) => values.includes(option.value)),
    [options, values],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((option) => {
      const haystack = `${option.label} ${option.description ?? ''}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [options, query])

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

  const toggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value))
      return
    }
    onChange([...values, value])
  }

  const remove = (value: string) => {
    onChange(values.filter((item) => item !== value))
  }

  const openField = () => {
    if (disabled) return
    setOpen(true)
    setQuery('')
  }

  const dropdown = open ? (
    <div
      className="absolute z-50 mt-1 max-h-96 w-full overflow-auto rounded-md border border-ui-border bg-ui-surface p-1 shadow-lg"
      role="listbox"
      aria-multiselectable
    >
      {filtered.length === 0 ? (
        <p className="px-3 py-3 text-sm text-ui-muted">No matches for “{query.trim()}”.</p>
      ) : (
        filtered.map((option) => {
          const isActive = values.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={isActive}
              className={cn(
                'flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm leading-tight text-ui-text transition-all hover:bg-ui-subtle',
                isActive && 'bg-ui-subtle font-medium',
              )}
              onClick={() => toggle(option.value)}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-normal leading-tight text-ui-text">{option.label}</span>
                {option.description ? (
                  <span className="mt-0.5 block text-xs text-ui-muted">{option.description}</span>
                ) : null}
              </span>
              {isActive ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
            </button>
          )
        })
      )}
    </div>
  ) : null

  const controlInner = (
    <>
      {open ? (
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-sm text-ui-text outline-none placeholder:text-ui-muted"
        />
      ) : (
        <div className="flex min-h-6 flex-wrap items-center gap-1.5">
          {selectedOptions.length === 0 ? (
            <span className="text-ui-muted">{emptyLabel ?? 'Select…'}</span>
          ) : (
            selectedOptions.map((option) => (
              <span
                key={option.value}
                className="inline-flex max-w-full items-center gap-1 rounded bg-moh-green/10 px-2 py-0.5 text-xs text-moh-green"
              >
                <span className="truncate">{option.label}</span>
                <button
                  type="button"
                  className="rounded hover:bg-moh-green/15"
                  aria-label={`Remove ${option.label}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(option.value)
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          )}
        </div>
      )}
      <button
        type="button"
        disabled={disabled}
        className="absolute top-1/2 right-2 grid h-5 w-5 -translate-y-1/2 place-items-center text-ui-muted"
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
    </>
  )

  if (!floatingLabels) {
    return (
      <div ref={rootRef} className={cn('relative min-w-0 w-full', className)}>
        <label className="mb-1.5 block text-sm font-semibold text-ui-text">{label}</label>
        <div
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            'relative flex min-h-[42px] items-center rounded-md border bg-ui-surface px-3 py-2 pr-10 shadow-sm transition',
            open
              ? 'border-[var(--oa-field-border-focus)] ring-[3px] ring-[var(--oa-field-ring-focus)]'
              : 'border-ui-border',
            disabled && 'cursor-not-allowed opacity-50',
            !open && 'cursor-pointer',
          )}
          onClick={() => !open && openField()}
        >
          {controlInner}
        </div>
        {dropdown}
      </div>
    )
  }

  return (
    <div ref={rootRef} className={cn('oa-float-field relative min-w-[200px] w-full', className)}>
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'oa-float-control relative !pr-10',
          disabled && 'cursor-not-allowed opacity-50',
          !open && 'cursor-pointer',
          selectedOptions.length === 0 && !open && 'is-placeholder',
        )}
        onClick={() => !open && openField()}
      >
        {controlInner}
      </div>
      <label className="oa-float-label">{label}</label>
      {dropdown}
    </div>
  )
}
