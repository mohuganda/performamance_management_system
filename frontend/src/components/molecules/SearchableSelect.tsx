import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useUiPreferencesStore } from '@/stores/uiPreferencesStore'

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
  /** Defaults from Settings → floating labels preference */
  labelPosition?: 'floating' | 'top'
}

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
  labelPosition,
}: SearchableSelectProps) {
  const floatingLabelsPref = useUiPreferencesStore((s) => s.floatingLabels)
  const floatingLabels =
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('floating-labels')
      : floatingLabelsPref
  const resolvedLabelPosition = labelPosition ?? (floatingLabels ? 'floating' : 'top')
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

  const dropdown = open ? (
    <div
      className="absolute left-0 right-0 z-[90] mt-1 max-h-96 w-full overflow-auto rounded-md border border-ui-border bg-ui-surface p-1 shadow-lg"
      role="listbox"
    >
      {emptyLabel ? (
        <button
          type="button"
          role="option"
          aria-selected={!value}
          className={cn(
            'flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm leading-tight text-ui-text transition-all hover:bg-ui-subtle',
            !value && 'bg-ui-subtle font-medium',
          )}
          onClick={() => choose('')}
        >
          <span className="flex-1 text-ui-muted">{emptyLabel}</span>
          {!value ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
        </button>
      ) : null}

      {filtered.length === 0 ? (
        <p className="px-3 py-3 text-sm text-ui-muted">No matches for “{query.trim()}”.</p>
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
                'flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm leading-tight text-ui-text transition-all hover:bg-ui-subtle',
                isActive && 'bg-moh-green/10 font-medium',
              )}
              onClick={() => choose(option.value)}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-normal leading-tight text-ui-text">{option.label}</span>
                {option.description ? (
                  <span className="mt-0.5 block text-xs text-ui-muted">{option.description}</span>
                ) : null}
              </span>
              {isActive ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-moh-green" /> : null}
            </button>
          )
        })
      )}
    </div>
  ) : null

  if (resolvedLabelPosition === 'top') {
    return (
      <div ref={rootRef} className={cn('relative min-w-0 w-full', open && 'z-[80]', className)}>
        <label className="mb-1.5 block text-sm font-semibold text-ui-text">{label}</label>
        <div
          className={cn(
            'flex min-h-[42px] items-center gap-2 rounded-md border bg-ui-surface px-3 py-2 shadow-sm transition',
            open
              ? 'border-[var(--oa-field-border-focus)] ring-[3px] ring-[var(--oa-field-ring-focus)]'
              : 'border-ui-border',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          {open ? (
            <input
              ref={inputRef}
              type="text"
              disabled={disabled}
              value={query}
              placeholder={placeholder}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-ui-text outline-none placeholder:text-ui-muted"
            />
          ) : (
            <button
              type="button"
              disabled={disabled}
              className="min-w-0 flex-1 truncate text-left text-sm text-ui-text"
              onClick={openField}
            >
              {displayValue || <span className="text-ui-muted">{emptyLabel ?? placeholder}</span>}
            </button>
          )}
          <div className="flex shrink-0 items-center gap-0.5">
            {allowClear && value && !open ? (
              <button
                type="button"
                disabled={disabled}
                className="rounded-sm p-0.5 text-ui-muted hover:bg-ui-subtle hover:text-ui-text"
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
              className="grid h-5 w-5 place-items-center text-ui-muted"
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
        {dropdown}
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className={cn('oa-float-field relative min-w-[200px] w-full', open && 'is-open z-[80]', className)}
    >
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'oa-float-control relative flex items-center gap-2 !pr-10',
          disabled && 'cursor-not-allowed opacity-50',
          !open && 'cursor-pointer',
          !displayValue && !open && 'is-placeholder',
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
            className="min-w-0 flex-1 bg-transparent text-sm text-ui-text outline-none placeholder:text-[var(--oa-placeholder-color)]"
          />
        ) : (
          <span
            className={cn(
              'block min-w-0 flex-1 truncate text-left text-sm',
              displayValue ? 'text-ui-text' : 'text-[var(--oa-placeholder-color)]',
            )}
          >
            {displayValue || emptyLabel || placeholder}
          </span>
        )}

        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5">
          {allowClear && value && !open ? (
            <button
              type="button"
              disabled={disabled}
              className="rounded p-0.5 text-ui-muted hover:bg-ui-subtle hover:text-ui-text"
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
            className="grid h-5 w-5 place-items-center text-ui-muted"
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

      <label className="oa-float-label">{label}</label>
      {dropdown}
    </div>
  )
}
