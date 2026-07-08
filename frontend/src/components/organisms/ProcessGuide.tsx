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
}

export function ProcessGuide({ title, steps }: ProcessGuideProps) {
  return (
    <Card {...mt} className="mb-6 rounded-sm border border-ui-border bg-ui-subtle/50 p-4">
      <Typography {...mt} className="mb-3 text-sm font-bold uppercase text-ui-text">
        {title}
      </Typography>
      <ol className="space-y-3">
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
    </Card>
  )
}
