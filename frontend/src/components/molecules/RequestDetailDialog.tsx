import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@material-tailwind/react'
import { useQuery } from '@tanstack/react-query'
import { Eye, Printer, RotateCcw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/atoms/Badge'
import { OfficialPrintShell } from '@/components/organisms/OfficialPrintShell'
import {
  documentsService,
  type DocumentType,
} from '@/api/services/documents'
import { useLetterhead } from '@/hooks/useLetterhead'
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
  /** Official MoH print when approved. */
  canPrint?: boolean
  documentType?: DocumentType
  documentRefId?: number
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
  return status.trim().toLowerCase() !== ''
}

export function canOfficialPrintRequest(status: string): boolean {
  return status.trim().toLowerCase() === 'approved'
}

export function RequestDetailDialog({
  open,
  title,
  status,
  fields,
  onClose,
  canPrint = true,
  documentType,
  documentRefId,
  canRecall = false,
  canDelete = false,
  recalling = false,
  deleting = false,
  onRecall,
  onDelete,
}: RequestDetailDialogProps) {
  const { letterhead } = useLetterhead()
  const official = canOfficialPrintRequest(status) && canPrint
  const [printing, setPrinting] = useState(false)

  const verifyQuery = useQuery({
    queryKey: ['document-verification', documentType, documentRefId],
    queryFn: () => documentsService.ensureVerification(documentType!, documentRefId!),
    enabled: open && official && Boolean(documentType) && Boolean(documentRefId),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  useEffect(() => {
    if (!printing) return
    const timer = window.setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 150)
    return () => window.clearTimeout(timer)
  }, [printing, verifyQuery.dataUpdatedAt])

  if (!open) return null

  const handlePrint = async () => {
    if (official && documentType && documentRefId && !verifyQuery.data) {
      await verifyQuery.refetch()
    }
    setPrinting(true)
  }

  const body = (
    <dl className="grid gap-3 sm:grid-cols-2 print:gap-2">
      {fields.map((field) => (
        <div
          key={field.label}
          className="rounded-sm border border-ui-border/70 bg-ui-subtle/40 px-3 py-2 print:border-black/20 print:bg-transparent"
        >
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-ui-muted print:text-black/60">
            {field.label}
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-ui-text print:text-black">
            {field.value || '—'}
          </dd>
        </div>
      ))}
    </dl>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:static print:bg-transparent print:p-0"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-sm border border-ui-border bg-ui-surface p-5 shadow-lg print:max-h-none print:max-w-none print:border-0 print:p-0 print:shadow-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 print:hidden">
          <div>
            <h2 className="text-lg font-semibold text-ui-text">{title}</h2>
            <div className="mt-2">
              <Badge label={status.replace(/_/g, ' ')} tone={statusTone(status)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {official ? (
              <Button
                {...mt}
                size="sm"
                variant="outlined"
                className="flex items-center gap-1.5 rounded-sm normal-case"
                onClick={handlePrint}
                loading={printing || verifyQuery.isFetching}
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

        {official ? (
          <OfficialPrintShell
            letterhead={letterhead}
            documentTitle={title}
            subtitle={verifyQuery.data?.staff_name}
            referenceLine={verifyQuery.data?.period_label}
            qrCodeDataUrl={verifyQuery.data?.qr_code_data_url}
            verifyUrl={verifyQuery.data?.verify_url}
          >
            {body}
          </OfficialPrintShell>
        ) : (
          body
        )}
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
