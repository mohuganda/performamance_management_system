import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export type SegmentedTabItem<T extends string> = {
  value: T
  label: string
  icon?: ReactNode
  count?: number
}

interface SegmentedTabsProps<T extends string> {
  tabs: SegmentedTabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: SegmentedTabsProps<T>) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-1 rounded-sm border border-moh-green/15 bg-white p-1 shadow-sm',
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = value === tab.value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-sm px-4 py-2.5 text-sm font-medium transition-all',
              active
                ? 'bg-moh-green text-white shadow-sm'
                : 'text-gray-600 hover:bg-moh-background hover:text-moh-green',
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined ? (
              <span
                className={cn(
                  'min-w-[1.25rem] rounded-full px-2 py-0.5 text-center text-[10px] font-bold leading-none',
                  active
                    ? 'bg-white text-moh-green shadow-sm'
                    : 'bg-moh-green text-white',
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
