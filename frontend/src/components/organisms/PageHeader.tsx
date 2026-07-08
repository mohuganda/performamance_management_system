import { Typography } from '@material-tailwind/react'
import type { ReactNode } from 'react'
import { mt } from '@/utils/mt'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-ui-border pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        <Typography {...mt} className="text-xs font-semibold uppercase tracking-wide text-ui-muted">
          Ministry of Health Uganda
        </Typography>
        <Typography {...mt} variant="h4" className="font-semibold text-ui-text">
          {title}
        </Typography>
        {subtitle ? (
          <Typography {...mt} className="mt-1 text-sm text-ui-muted">
            {subtitle}
          </Typography>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
