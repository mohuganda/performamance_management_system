import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Input, Textarea, Typography } from '@material-tailwind/react'
import { CheckCircle2, Clock, MessageSquare, UserCheck } from 'lucide-react'
import { mt } from '@/utils/mt'
import { cn } from '@/utils/cn'

export type ActionPlanRow = {
  performance_gap: string
  agreed_action: string
  time_frame: string
}

export type AppraisalCommentRow = {
  comment_role: string
  supervisor_sequence?: number
  author_staff_id?: number
  author_name: string
  job_title: string
  comments: string
  signed_at?: string
  can_edit: boolean
}

export type SupervisorSlot = {
  sequence: number
  supervisor_staff_id: number
  supervisor_name: string
}

export type ApprovalTrailRow = {
  id: number
  action: string
  actor_name: string
  role: string
  comments: string
  occurred_at: string
}

export type AppraisalBundle = {
  report_id: number
  report_status: string
  pending_supervisor_sequence: number
  action_plans: ActionPlanRow[]
  comments: AppraisalCommentRow[]
  supervisors: SupervisorSlot[]
  approval_trail: ApprovalTrailRow[]
  can_edit_appraisee: boolean
  can_edit_action_plan: boolean
}

const ROLE_LABELS: Record<string, string> = {
  appraisee: 'Comments of the Appraisee (Staff)',
  appraiser: 'Comments of the Appraiser',
  countersigning: 'Comments of the Countersigning Officer / Supervisor of Appraiser',
  responsible_officer: 'Comments of the Responsible Officer',
}

function formatTrailAction(action: string) {
  return action.replace(/_/g, ' ')
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function emptyActionPlan(): ActionPlanRow {
  return { performance_gap: '', agreed_action: '', time_frame: '' }
}

type Props = {
  appraisal: AppraisalBundle
  actionPlans: ActionPlanRow[]
  appraiseeComments: string
  onActionPlansChange: (rows: ActionPlanRow[]) => void
  onAppraiseeCommentsChange: (value: string) => void
  onSaveDraft?: () => void
  savingDraft?: boolean
  reviewMode?: boolean
  reviewDrafts?: Record<string, { comments: string; job_title: string }>
  onReviewDraftChange?: (key: string, patch: Partial<{ comments: string; job_title: string }>) => void
  onReviewSubmit?: (key: string, role: string, decision: 'approve' | 'return') => void
  reviewing?: boolean
}

function commentKey(row: AppraisalCommentRow) {
  if (row.comment_role === 'appraiser' && row.supervisor_sequence != null) {
    return `appraiser-${row.supervisor_sequence}`
  }
  return row.comment_role
}

export function PerformanceAppraisalSections({
  appraisal,
  actionPlans,
  appraiseeComments,
  onActionPlansChange,
  onAppraiseeCommentsChange,
  onSaveDraft,
  savingDraft,
  reviewMode,
  reviewDrafts,
  onReviewDraftChange,
  onReviewSubmit,
  reviewing,
}: Props) {
  const appraiserComments = useMemo(
    () => appraisal.comments.filter((c) => c.comment_role === 'appraiser'),
    [appraisal.comments],
  )
  const otherComments = useMemo(
    () => appraisal.comments.filter((c) => c.comment_role !== 'appraiser'),
    [appraisal.comments],
  )

  const statusLabel = appraisal.report_status.replace(/_/g, ' ')

  return (
    <div className="space-y-6">
      <Card {...mt} className="rounded-sm border border-ui-border bg-gradient-to-r from-moh-green/5 to-white p-5">
        <Typography {...mt} className="text-sm font-bold uppercase tracking-wide text-ui-text">
          Performance appraisal — Sections D &amp; E
        </Typography>
        <Typography {...mt} className="mt-1 text-sm text-ui-muted">
          End of year appraisal meeting record. Status:{' '}
          <span className="font-semibold capitalize text-ui-text">{statusLabel || 'draft'}</span>
          {appraisal.pending_supervisor_sequence > 0
            ? ` · awaiting appraiser ${appraisal.pending_supervisor_sequence}`
            : ''}
        </Typography>
      </Card>

      {/* Section D */}
      <section className="overflow-hidden rounded-sm border border-ui-border shadow-sm">
        <div className="border-b border-ui-border bg-ui-subtle/60 px-4 py-3 sm:px-5">
          <Typography {...mt} className="text-sm font-bold uppercase text-ui-text">
            Section D: Action plan to improve performance
          </Typography>
          <Typography {...mt} className="mt-2 text-sm text-ui-muted">
            The action plan shall be jointly agreed during the performance appraisal meeting, taking into
            consideration the appraisee&apos;s required job competences and the identified performance gaps.
            The plan may include training, coaching, mentoring, attachment, job rotation, counseling, or
            provision of other facilities and resources. Where formal training is involved, forward the
            record to the Training Committee.
          </Typography>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b bg-white text-xs uppercase text-ui-muted">
                <th className="px-4 py-3 font-semibold">Performance gap</th>
                <th className="px-4 py-3 font-semibold">Agreed action</th>
                <th className="w-36 px-4 py-3 font-semibold">Time frame</th>
                {appraisal.can_edit_action_plan ? (
                  <th className="w-20 px-4 py-3 font-semibold" />
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-ui-border">
              {(actionPlans.length > 0 ? actionPlans : [emptyActionPlan()]).map((row, idx) => (
                <tr key={idx} className="bg-white">
                  <td className="px-4 py-3 align-top">
                    {appraisal.can_edit_action_plan ? (
                      <Textarea
                        {...mt}
                        rows={3}
                        className="!min-h-[72px] rounded-sm border-ui-border text-sm"
                        value={row.performance_gap}
                        onChange={(e) => {
                          const next = [...actionPlans]
                          if (next.length === 0) next.push(emptyActionPlan())
                          next[idx] = { ...next[idx], performance_gap: e.target.value }
                          onActionPlansChange(next)
                        }}
                      />
                    ) : (
                      <span className="whitespace-pre-wrap">{row.performance_gap || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {appraisal.can_edit_action_plan ? (
                      <Textarea
                        {...mt}
                        rows={3}
                        className="!min-h-[72px] rounded-sm border-ui-border text-sm"
                        value={row.agreed_action}
                        onChange={(e) => {
                          const next = [...actionPlans]
                          if (next.length === 0) next.push(emptyActionPlan())
                          next[idx] = { ...next[idx], agreed_action: e.target.value }
                          onActionPlansChange(next)
                        }}
                      />
                    ) : (
                      <span className="whitespace-pre-wrap">{row.agreed_action || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {appraisal.can_edit_action_plan ? (
                      <Input
                        {...mt}
                        className="rounded-sm border-ui-border text-sm"
                        value={row.time_frame}
                        onChange={(e) => {
                          const next = [...actionPlans]
                          if (next.length === 0) next.push(emptyActionPlan())
                          next[idx] = { ...next[idx], time_frame: e.target.value }
                          onActionPlansChange(next)
                        }}
                      />
                    ) : (
                      <span>{row.time_frame || '—'}</span>
                    )}
                  </td>
                  {appraisal.can_edit_action_plan ? (
                    <td className="px-4 py-3 align-top">
                      {actionPlans.length > 1 ? (
                        <button
                          type="button"
                          className="text-xs text-moh-error underline"
                          onClick={() => onActionPlansChange(actionPlans.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {appraisal.can_edit_action_plan ? (
          <div className="border-t border-ui-border bg-ui-subtle/30 px-4 py-3">
            <Button
              {...mt}
              size="sm"
              variant="outlined"
              className="rounded-sm normal-case"
              onClick={() => onActionPlansChange([...actionPlans, emptyActionPlan()])}
            >
              Add action plan row
            </Button>
          </div>
        ) : null}

        {appraisal.approval_trail.length > 0 ? (
          <div className="border-t border-ui-border bg-blue-50/40 px-4 py-4 sm:px-5">
            <Typography {...mt} className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-blue-900">
              <Clock className="h-4 w-4" />
              Approval trail — Section D
            </Typography>
            <ol className="space-y-2">
              {appraisal.approval_trail.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-sm border border-blue-100 bg-white px-3 py-2 text-sm"
                >
                  <span className="font-semibold capitalize text-blue-900">
                    {formatTrailAction(entry.action)}
                  </span>
                  <span className="text-ui-muted">·</span>
                  <span>{entry.actor_name || '—'}</span>
                  <span className="text-ui-muted">·</span>
                  <span className="text-xs text-ui-muted">{formatDate(entry.occurred_at)}</span>
                  {entry.comments ? (
                    <p className="w-full text-sm text-ui-text">{entry.comments}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>

      {/* Section E */}
      <section className="space-y-4">
        <div className="rounded-sm border border-ui-border bg-ui-subtle/60 px-4 py-3 sm:px-5">
          <Typography {...mt} className="text-sm font-bold uppercase text-ui-text">
            Section E: Comments, recommendations (if any) and signatures
          </Typography>
          <Typography {...mt} className="mt-2 text-sm text-ui-muted">
            Confirmation that the appraisal meeting took place and that the action plan was discussed and
            agreed upon (or disagreement was resolved).
          </Typography>
        </div>

        {otherComments
          .filter((c) => c.comment_role === 'appraisee')
          .map((row) => (
            <CommentCard
              key="appraisee"
              row={row}
              title={ROLE_LABELS.appraisee}
              editable={appraisal.can_edit_appraisee && !reviewMode}
              comments={appraiseeComments}
              onCommentsChange={onAppraiseeCommentsChange}
            />
          ))}

        {appraiserComments.length > 0 ? (
          <div className="space-y-4">
            <Typography {...mt} className="text-xs font-bold uppercase text-ui-muted">
              Appraiser comments ({appraiserComments.length} supervisor
              {appraiserComments.length === 1 ? '' : 's'})
            </Typography>
            {appraiserComments.map((row) => {
              const key = commentKey(row)
              const sup = appraisal.supervisors.find((s) => s.sequence === row.supervisor_sequence)
              const title = `${ROLE_LABELS.appraiser} ${row.supervisor_sequence}${
                sup?.supervisor_name ? ` — ${sup.supervisor_name}` : ''
              }`
              return (
                <CommentCard
                  key={key}
                  row={row}
                  title={title}
                  editable={row.can_edit && reviewMode}
                  comments={reviewDrafts?.[key]?.comments ?? row.comments}
                  jobTitle={reviewDrafts?.[key]?.job_title ?? row.job_title}
                  onCommentsChange={(v) => onReviewDraftChange?.(key, { comments: v })}
                  onJobTitleChange={(v) => onReviewDraftChange?.(key, { job_title: v })}
                  onApprove={
                    row.can_edit && reviewMode
                      ? () => onReviewSubmit?.(key, 'appraiser', 'approve')
                      : undefined
                  }
                  onReturn={
                    row.can_edit && reviewMode
                      ? () => onReviewSubmit?.(key, 'appraiser', 'return')
                      : undefined
                  }
                  reviewing={reviewing}
                />
              )
            })}
          </div>
        ) : appraisal.supervisors.length > 0 ? (
          <div className="space-y-4">
            {appraisal.supervisors.map((sup) => (
              <Card
                key={sup.sequence}
                {...mt}
                className="rounded-sm border border-dashed border-ui-border bg-ui-subtle/20 p-4"
              >
                <Typography {...mt} className="text-sm font-semibold text-ui-text">
                  {ROLE_LABELS.appraiser} {sup.sequence} — {sup.supervisor_name}
                </Typography>
                <Typography {...mt} className="mt-1 text-sm text-ui-muted">
                  Awaiting submission and supervisor review.
                </Typography>
              </Card>
            ))}
          </div>
        ) : null}

        {otherComments
          .filter((c) => c.comment_role !== 'appraisee')
          .map((row) => {
            const key = commentKey(row)
            return (
              <CommentCard
                key={key}
                row={row}
                title={ROLE_LABELS[row.comment_role] ?? row.comment_role}
                editable={row.can_edit && reviewMode}
                comments={reviewDrafts?.[key]?.comments ?? row.comments}
                jobTitle={reviewDrafts?.[key]?.job_title ?? row.job_title}
                onCommentsChange={(v) => onReviewDraftChange?.(key, { comments: v })}
                onJobTitleChange={(v) => onReviewDraftChange?.(key, { job_title: v })}
                onApprove={
                  row.can_edit && reviewMode
                    ? () => onReviewSubmit?.(key, row.comment_role, 'approve')
                    : undefined
                }
                reviewing={reviewing}
              />
            )
          })}
      </section>

      {onSaveDraft && appraisal.can_edit_action_plan ? (
        <div className="flex flex-wrap gap-2">
          <Button
            {...mt}
            variant="outlined"
            className="rounded-sm normal-case"
            disabled={savingDraft}
            onClick={onSaveDraft}
          >
            Save appraisal sections
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function CommentCard({
  row,
  title,
  editable,
  comments,
  jobTitle,
  onCommentsChange,
  onJobTitleChange,
  onApprove,
  onReturn,
  reviewing,
}: {
  row: AppraisalCommentRow
  title: string
  editable?: boolean
  comments: string
  jobTitle?: string
  onCommentsChange?: (value: string) => void
  onJobTitleChange?: (value: string) => void
  onApprove?: () => void
  onReturn?: () => void
  reviewing?: boolean
}) {
  const signed = Boolean(row.signed_at)
  return (
    <Card
      {...mt}
      className={cn(
        'rounded-sm border p-4 sm:p-5',
        signed ? 'border-moh-green/30 bg-moh-green/5' : 'border-ui-border bg-white',
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Typography {...mt} className="flex items-center gap-2 text-sm font-semibold text-ui-text">
          {signed ? (
            <CheckCircle2 className="h-4 w-4 text-moh-green" />
          ) : (
            <MessageSquare className="h-4 w-4 text-ui-muted" />
          )}
          {title}
        </Typography>
        {signed ? (
          <span className="text-xs text-moh-green">Signed {formatDate(row.signed_at)}</span>
        ) : null}
      </div>

      {editable ? (
        <Textarea
          {...mt}
          rows={4}
          className="mb-4 rounded-sm border-ui-border text-sm"
          placeholder="Enter performance comments…"
          value={comments}
          onChange={(e) => onCommentsChange?.(e.target.value)}
        />
      ) : (
        <p className="mb-4 whitespace-pre-wrap text-sm text-ui-text">
          {comments || row.comments || (
            <span className="text-ui-muted italic">No comments yet.</span>
          )}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase text-ui-muted">Name</label>
          <p className="mt-1 text-sm">{row.author_name || '—'}</p>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-ui-muted">Job title</label>
          {editable && onJobTitleChange ? (
            <Input
              {...mt}
              className="mt-1 rounded-sm border-ui-border text-sm"
              value={jobTitle ?? ''}
              onChange={(e) => onJobTitleChange(e.target.value)}
            />
          ) : (
            <p className="mt-1 text-sm">{jobTitle || row.job_title || '—'}</p>
          )}
        </div>
      </div>

      {onApprove ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-ui-border pt-4">
          <Button
            {...mt}
            size="sm"
            className="rounded-sm bg-moh-green normal-case"
            disabled={reviewing || !comments.trim()}
            onClick={onApprove}
          >
            <UserCheck className="mr-1.5 inline h-4 w-4" />
            Approve
          </Button>
          {onReturn ? (
            <Button
              {...mt}
              size="sm"
              variant="outlined"
              color="red"
              className="rounded-sm normal-case"
              disabled={reviewing}
              onClick={onReturn}
            >
              Return to staff
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}

export function useAppraisalFormState(appraisal?: AppraisalBundle | null) {
  const [actionPlans, setActionPlans] = useState<ActionPlanRow[]>([emptyActionPlan()])
  const [appraiseeComments, setAppraiseeComments] = useState('')

  useEffect(() => {
    if (!appraisal) return
    if (appraisal.action_plans.length > 0) {
      setActionPlans(
        appraisal.action_plans.map((p) => ({
          performance_gap: p.performance_gap,
          agreed_action: p.agreed_action,
          time_frame: p.time_frame,
        })),
      )
    } else if (appraisal.can_edit_action_plan) {
      setActionPlans([emptyActionPlan()])
    }
    const appraisee = appraisal.comments.find((c) => c.comment_role === 'appraisee')
    setAppraiseeComments(appraisee?.comments ?? '')
  }, [appraisal])

  return { actionPlans, setActionPlans, appraiseeComments, setAppraiseeComments }
}
