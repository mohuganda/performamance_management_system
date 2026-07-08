import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

export type SettingsTabItem = {
  id: string
  label: string
  icon: LucideIcon
}

type SettingsTabNavProps = {
  tabs: SettingsTabItem[]
  value: string
  onChange: (id: string) => void
  className?: string
}

export function SettingsTabNav({ tabs, value, onChange, className }: SettingsTabNavProps) {
  if (tabs.length === 0) return null

  return (
    <nav className={cn('mb-8', className)} aria-label="Settings sections">
      <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex min-w-full gap-1 rounded-lg border border-moh-green/15 bg-gradient-to-r from-white via-moh-background/30 to-white p-1.5 shadow-sm ring-1 ring-black/[0.02] md:min-w-0">
          {tabs.map((tab) => {
            const active = value === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200',
                  active
                    ? 'bg-moh-green text-white shadow-md shadow-moh-green/25'
                    : 'text-gray-600 hover:bg-moh-green/8 hover:text-moh-green',
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-moh-green/70')} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
