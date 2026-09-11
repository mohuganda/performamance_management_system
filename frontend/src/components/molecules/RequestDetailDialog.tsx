import type { ReactNode } from 'react'
import { Button } from '@material-tailwind/react'
import { Eye, Printer, RotateCcw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/atoms/Badge'
import { mt } from '@/utils/mt'
import { statusTone } from '@/utils/requestRow'

export type RequestDetailField = {
  label: string
  value: ReactNode
}

type RequestDetailDialogProps = {
  open: boolean
  title: string
  status: string
  fields: RequestDetailField[]
  onClose: () => void
  /** When true, show Print (approved / closed records). */
  canPrint?: boolean
  canRecall?: boolean
  canDelete?: boolean
  recalling?: boolean
  deleting?: boolean
  onRecall?: () => void
  onDelete?: () => void
}

export function canMutateRequest(status: string): boolean {
  const s = status.trim().toLowerCase()
  return s === 'draft' || s === 'pending'
}

export function canRecallRequest(status: string): boolean {
  return status.trim().toLowerCase() === 'pending'
}

export function canDeleteRequest(status: string): boolean {
  return canMutateRequest(status)
}

export function canPreviewPrintRequest(status: string): boolean {
  // Preview always available; print especially for approved/closed.
  return status.trim().toLowerCase() !== ''
}

export function RequestDetailDialog({
  open,
  title,
  status,
  fields,
  onClose,
  canPrint = true,
  canRecall = false,
  canDelete = false,
  recalling = false,
  deleting = false,
  onRecall,
  onDelete,
}: RequestDetailDialogProps) {
  if (!open) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:static print:bg-transparent print:p-0"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-ui-border bg-ui-surface p-5 shadow-lg print:max-h-none print:max-w-none print:border-0 print:shadow-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 print:mb-6">
          <div>
            <h2 className="text-lg font-semibold text-ui-text">{title}</h2>
            <div className="mt-2">
              <Badge label={status.replace(/_/g, ' ')} tone={statusTone(status)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            {canPrint ? (
              <Button
                {...mt}
                size="sm"
                variant="outlined"
                className="flex items-center gap-1.5 rounded-sm normal-case"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
            ) : null}
            {canRecall && onRecall ? (
              <Button
                {...mt}
                size="sm"
                variant="outlined"
                className="flex items-center gap-1.5 rounded-sm normal-case"
                onClick={onRecall}
                loading={recalling}
                disabled={recalling || deleting}
              >
                <RotateCcw className="h-4 w-4" />
                Recall
              </Button>
            ) : null}
            {canDelete && onDelete ? (
              <Button
                {...mt}
                size="sm"
                variant="outlined"
                className="flex items-center gap-1.5 rounded-sm normal-case text-red-700 border-red-200"
                onClick={onDelete}
                loading={deleting}
                disabled={recalling || deleting}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : null}
            <Button {...mt} size="sm" className="rounded-sm bg-moh-green normal-case" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className="rounded-sm border border-ui-border/70 bg-ui-subtle/40 px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ui-muted">{field.label}</dt>
              <dd className="mt-1 text-sm text-ui-text whitespace-pre-wrap">{field.value || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

type RequestRowActionsProps = {
  status: string
  onPreview: () => void
  onRecall?: () => void
  onDelete?: () => void
  recalling?: boolean
  deleting?: boolean
}

export function RequestRowActions({
  status,
  onPreview,
  onRecall,
  onDelete,
  recalling,
  deleting,
}: RequestRowActionsProps) {
  const mutable = canMutateRequest(status)
  const recallable = canRecallRequest(status)

  return (
    <div className="flex flex-wrap gap-1.5">
      <Button
        {...mt}
        size="sm"
        variant="outlined"
        className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs normal-case"
        onClick={onPreview}
      >
        <Eye className="h-3.5 w-3.5" />
        {status.trim().toLowerCase() === 'approved' ? 'Preview' : 'View'}
      </Button>
      {recallable && onRecall ? (
        <Button
          {...mt}
          size="sm"
          variant="outlined"
          className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs normal-case"
          onClick={onRecall}
          loading={recalling}
          disabled={recalling || deleting}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Recall
        </Button>
      ) : null}
      {mutable && onDelete ? (
        <Button
          {...mt}
          size="sm"
          variant="outlined"
          className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs normal-case text-red-700 border-red-200"
          onClick={onDelete}
          loading={deleting}
          disabled={recalling || deleting}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      ) : null}
    </div>
  )
}
