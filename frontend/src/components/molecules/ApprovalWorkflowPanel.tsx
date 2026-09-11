import { Chip, Typography } from '@material-tailwind/react'
import { CheckCircle2, Clock3, UserRound } from 'lucide-react'
import { mt } from '@/utils/mt'
import { cn } from '@/utils/cn'

export type ApprovalWorkflowStep = {
  sequence: number
  role_label: string
  approver_name: string
  status: string
  acted_at?: string
  comments?: string
  is_current?: boolean
}

export type ApprovalTrailEntry = {
  action: string
  actor_name: string
  role?: string
  comments?: string
  occurred_at?: string
}

function formatWhen(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusChipClass(status: string) {
  const s = status.toLowerCase()
  if (s === 'approved') return 'bg-moh-success/15 text-moh-success'
  if (s === 'rejected' || s === 'returned') return 'bg-red-100 text-red-800'
  if (s === 'pending') return 'bg-amber-100 text-amber-900'
  return 'bg-ui-subtle text-ui-muted'
}

export function ApprovalWorkflowPanel({
  approvers,
  trail,
}: {
  approvers: ApprovalWorkflowStep[]
  trail: ApprovalTrailEntry[]
}) {
  if (approvers.length === 0 && trail.length === 0) return null

  return (
    <div className="space-y-5">
      {approvers.length > 0 ? (
        <section>
          <Typography {...mt} className="mb-3 text-sm font-bold uppercase tracking-wide text-moh-green">
            Approvers
          </Typography>
          <ol className="space-y-3">
            {approvers.map((step) => (
              <li
                key={`${step.sequence}-${step.role_label}`}
                className={cn(
                  'rounded-sm border px-3 py-3',
                  step.is_current
                    ? 'border-moh-green/40 bg-moh-green/5'
                    : 'border-ui-border bg-white',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="mt-0.5 rounded-sm bg-ui-subtle p-1.5 text-ui-muted">
                      <UserRound className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ui-muted">
                        {step.role_label}
                        {step.is_current ? ' · your turn' : ''}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-ui-text">
                        {step.approver_name || '—'}
                      </p>
                      {step.comments ? (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ui-muted">
                          {step.comments}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right">
                    <Chip
                      {...mt}
                      size="sm"
                      value={step.status.replace(/_/g, ' ')}
                      className={cn('normal-case capitalize', statusChipClass(step.status))}
                    />
                    {formatWhen(step.acted_at) ? (
                      <p className="mt-1 text-xs text-ui-muted">{formatWhen(step.acted_at)}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {trail.length > 0 ? (
        <section className="rounded-sm border border-sky-100 bg-sky-50/50 px-4 py-4">
          <Typography
            {...mt}
            className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-900"
          >
            <Clock3 className="h-4 w-4" />
            Approval trail
          </Typography>
          <ol className="space-y-2">
            {trail.map((entry, idx) => (
              <li
                key={`${entry.action}-${entry.occurred_at}-${idx}`}
                className="rounded-sm border border-sky-100 bg-white px-3 py-2.5 text-sm"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1 font-semibold capitalize text-sky-950">
                    {entry.action === 'approved' || entry.action === 'submitted' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-moh-success" />
                    ) : null}
                    {entry.action.replace(/_/g, ' ')}
                  </span>
                  <span className="text-ui-muted">·</span>
                  <span>{entry.actor_name || '—'}</span>
                  {entry.role ? (
                    <>
                      <span className="text-ui-muted">·</span>
                      <span className="text-xs uppercase tracking-wide text-ui-muted">
                        {entry.role.replace(/_/g, ' ')}
                      </span>
                    </>
                  ) : null}
                  {formatWhen(entry.occurred_at) ? (
                    <>
                      <span className="text-ui-muted">·</span>
                      <span className="text-xs text-ui-muted">{formatWhen(entry.occurred_at)}</span>
                    </>
                  ) : null}
                </div>
                {entry.comments ? (
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-ui-text">{entry.comments}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  )
}
