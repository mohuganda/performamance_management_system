import { useState } from 'react'
import { Card, Typography } from '@material-tailwind/react'
import { mt } from '@/utils/mt'

export interface ProcessStep {
  title: string
  description: string
  actor?: string
}

interface ProcessGuideProps {
  title: string
  steps: ProcessStep[]
  /** When true (default), steps start hidden until the user expands the guide. */
  defaultCollapsed?: boolean
}

export function ProcessGuide({ title, steps, defaultCollapsed = true }: ProcessGuideProps) {
  const [open, setOpen] = useState(!defaultCollapsed)

  return (
    <Card {...mt} className="mb-6 rounded-sm border border-ui-border bg-ui-subtle/50 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Typography {...mt} className="text-sm font-bold uppercase text-ui-text">
          {title}
        </Typography>
        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-ui-border bg-white text-ui-muted transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {open ? (
        <ol className="mt-3 space-y-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-uganda-yellow text-xs font-bold text-uganda-black">
                {index + 1}
              </span>
              <div>
                <p className="font-semibold text-ui-text">
                  {step.title}
                  {step.actor ? (
                    <span className="ml-2 font-normal text-ui-muted">({step.actor})</span>
                  ) : null}
                </p>
                <p className="text-ui-muted">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </Card>
  )
}
