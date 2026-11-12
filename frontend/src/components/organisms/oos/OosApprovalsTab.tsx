import { useState } from 'react'
import { Check, X, User, MapPin, Calendar, ClipboardList, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { oosService } from '@/api/services/mobile'
import { toast, notifyApiError } from '@/features/toast'

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateRange(start: string, end: string) {
  if (!start) return ''
  if (!end || start === end) return formatDate(start)
  return `${formatDate(start)} to ${formatDate(end)}`
}

export function OosApprovalsTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const pendingQuery = useQuery({
    queryKey: ['oos', 'pending-approvals'],
    queryFn: () => oosService.listPendingApprovals(),
  })

  const [comments, setComments] = useState<Record<number, string>>({})

  const approveMutation = useMutation({
    mutationFn: ({ id, approve, comments }: { id: number; approve: boolean; comments: string }) =>
      oosService.approve(id, { approve, comments }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['oos'] })
      toast.success(
        variables.approve ? 'Travel request approved.' : 'Travel request rejected.',
        'Success',
      )
      setComments((prev) => {
        const copy = { ...prev }
        delete copy[variables.id]
        return copy
      })
    },
    onError: (err: unknown) => {
      notifyApiError(err, 'Could not process travel approval')
    },
  })

  const handleAction = (approvalId: number, approve: boolean) => {
    const commentText = comments[approvalId]?.trim() || ''
    approveMutation.mutate({ id: approvalId, approve, comments: commentText })
  }

  if (pendingQuery.isLoading) {
    return (
      <div className="flex-1 justify-center items-center py-16 flex flex-col">
        <Loader2 size={24} className="animate-spin text-emerald-600" />
      </div>
    )
  }

  const list = Array.isArray(pendingQuery.data)
    ? pendingQuery.data
    : (pendingQuery.data as { data?: any[] })?.data || []

  if (list.length === 0) {
    return (
      <div className="flex-1 justify-center items-center py-16 px-6 flex flex-col text-center">
        <ClipboardList size={40} className="text-ui-muted opacity-50 mb-3" />
        <p className="text-sm font-semibold text-ui-muted">
          {t('oos_approvals_empty', 'No travel requests waiting for your approval.')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 px-4 py-3 max-w-3xl mx-auto w-full">
      <h2 className="text-xs font-bold uppercase tracking-wider mb-4 text-ui-muted">
        {t('oos_approvals_title', 'Pending Travel Approvals')}
      </h2>

      <div className="space-y-4 pb-12">
        {list.map((row: any) => {
          const approvalId = Number(row.approval_id ?? row.ApprovalID ?? row.id ?? row.ID)
          return (
            <div
              key={approvalId}
              className="p-4 border shadow-sm rounded-none bg-ui-surface border-ui-border"
            >
              {/* Applicant Name */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                  <User size={14} className="text-ui-text" />
                </div>
                <h3 className="text-base font-bold text-ui-text flex-1">
                  {row.staff_name || row.StaffName || 'Staff Member'}
                </h3>
              </div>

              {/* Travel Details */}
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-ui-muted shrink-0" />
                  <span className="text-xs font-medium text-ui-text">
                    {row.reason_name || row.ReasonName || 'Official Duty'} ·{' '}
                    {formatDateRange(row.start_date || row.StartDate, row.end_date || row.EndDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-ui-muted shrink-0" />
                  <span className="text-xs font-medium text-ui-text">
                    Destination: {row.destination || row.destination_name || row.DestinationName}
                  </span>
                </div>
              </div>

              {row.expected_deliverables && (
                <div className="mb-3 p-3 bg-zinc-50 dark:bg-zinc-900 border border-ui-border">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-ui-muted">
                    {t('oos_form_deliverables', 'Expected Deliverables')}
                  </p>
                  <p className="text-xs text-ui-text">
                    {row.expected_deliverables}
                  </p>
                </div>
              )}

              {row.remarks && (
                <p className="text-xs italic mb-4 text-ui-muted">
                  Remarks: "{row.remarks}"
                </p>
              )}

              {/* Supervisor Decision Comments */}
              <div className="mb-4">
                <input
                  type="text"
                  value={comments[approvalId] || ''}
                  onChange={(e) =>
                    setComments((prev) => ({ ...prev, [approvalId]: e.target.value }))
                  }
                  placeholder={t('oos_comment_placeholder', 'Enter decision comments...')}
                  className="w-full px-3 py-2 border border-ui-border bg-ui-subtle/50 text-sm text-ui-text rounded-none focus:outline-none focus:border-emerald-600 placeholder:text-ui-muted"
                />
              </div>

              {/* Approve / Reject Buttons matching Mobile */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleAction(approvalId, true)}
                  disabled={approveMutation.isPending}
                  className="flex-1 py-2.5 rounded-none flex justify-center items-center gap-1.5 bg-[#15803D] hover:bg-[#15803D]/90 text-white font-bold text-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Check size={14} className="text-white" />
                  <span>{t('oos_approve_action', 'Approve')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAction(approvalId, false)}
                  disabled={approveMutation.isPending}
                  className="flex-1 py-2.5 rounded-none flex justify-center items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  <X size={14} className="text-white" />
                  <span>{t('oos_reject_action', 'Reject')}</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
