import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Button, Typography } from '@material-tailwind/react'
import { Printer, X } from 'lucide-react'
import { OfficialPrintShell } from '@/components/organisms/OfficialPrintShell'
import { documentsService, type DocumentType } from '@/api/services/documents'
import { performanceService } from '@/api/services/mobile'
import { useLetterhead } from '@/hooks/useLetterhead'
import { mt } from '@/utils/mt'
import { cn } from '@/utils/cn'
import type { AppraisalBundle } from '@/components/performance/PerformanceAppraisalSections'

export type PrintPeriodId = 'q1' | 'q2' | 'q3' | 'endterm'

export type PerformancePrintSections = {
  ppa: boolean
  q1: boolean
  q2: boolean
  q3: boolean
  endterm: boolean
  appraisal: boolean
}

export type PerformancePrintPreset = 'ppa' | 'current_period' | 'endterm_pack' | 'custom'

type PlanGroup = {
  subject_area_id?: number
  subject_area_name: string
  kpis: Array<{
    id: number
    code: string
    name: string
    in_current_ppa?: boolean
    weight_percentage?: number
    target_value?: number
    default_target?: number
  }>
}

type ReportGroup = {
  subject_area_name: string
  kpis: Array<{
    ppa_kpi_id: number
    code: string
    name: string
    weight_percentage?: number
    target_value?: number
    actual_value?: number
    narrative?: string
  }>
}

type Props = {
  open: boolean
  onClose: () => void
  preset?: PerformancePrintPreset
  currentPeriod?: PrintPeriodId | string
  financialYear?: string
  staffName: string
  ppaId: number
  ppaStatus: string
  ppaApproved: boolean
  planGroups: PlanGroup[]
  planWeights: Record<number, number | string>
  planTargets?: Record<number, number | string>
  currentReportGroups: ReportGroup[]
  currentReportId: number
  currentReportStatus: string
  appraisal?: AppraisalBundle | null
}

const PERIOD_LABELS: Record<PrintPeriodId, string> = {
  q1: 'Q1 report',
  q2: 'Q2 report',
  q3: 'Q3 report',
  endterm: 'End of year report',
}

const ALL_PERIODS: PrintPeriodId[] = ['q1', 'q2', 'q3', 'endterm']

function emptySections(): PerformancePrintSections {
  return { ppa: false, q1: false, q2: false, q3: false, endterm: false, appraisal: false }
}

function sectionsForPreset(
  preset: PerformancePrintPreset,
  currentPeriod?: string,
): PerformancePrintSections {
  const next = emptySections()
  if (preset === 'ppa') {
    next.ppa = true
    return next
  }
  if (preset === 'current_period') {
    const p = (currentPeriod || 'q1') as PrintPeriodId
    if (p === 'q1' || p === 'q2' || p === 'q3' || p === 'endterm') next[p] = true
    if (p === 'endterm') next.appraisal = true
    return next
  }
  if (preset === 'endterm_pack') {
    return { ppa: true, q1: true, q2: true, q3: true, endterm: true, appraisal: true }
  }
  return next
}

function asGroups<T>(raw: unknown): T[] {
  return Array.isArray(raw) ? (raw as T[]) : []
}

function num(v: unknown, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function documentTitleFor(sections: PerformancePrintSections) {
  const selected = Object.entries(sections).filter(([, on]) => on).map(([k]) => k)
  if (selected.length === 1 && selected[0] === 'ppa') return 'Performance plan (PPA)'
  if (selected.length === 1 && selected[0] in PERIOD_LABELS) {
    return `Performance report — ${String(selected[0]).toUpperCase()}`
  }
  if (sections.ppa && sections.q1 && sections.q2 && sections.q3 && sections.endterm) {
    return 'Annual performance pack (PPA & reports)'
  }
  return 'Customised performance report'
}

function verificationFor(sections: PerformancePrintSections, ppaId: number, reportIds: Partial<Record<PrintPeriodId, number>>) {
  if (sections.endterm && reportIds.endterm) {
    return { type: 'appraisal' as DocumentType, refId: reportIds.endterm }
  }
  for (const p of ALL_PERIODS) {
    if (sections[p] && reportIds[p]) {
      return { type: 'quarterly_report' as DocumentType, refId: reportIds[p]! }
    }
  }
  if (sections.ppa && ppaId > 0) {
    return { type: 'ppa' as DocumentType, refId: ppaId }
  }
  return null
}

export function PerformancePrintDialog({
  open,
  onClose,
  preset = 'custom',
  currentPeriod = 'q1',
  financialYear,
  staffName,
  ppaId,
  ppaStatus,
  ppaApproved,
  planGroups,
  planWeights,
  planTargets = {},
  currentReportGroups,
  currentReportId,
  currentReportStatus,
  appraisal,
}: Props) {
  const { letterhead } = useLetterhead()
  const [activePreset, setActivePreset] = useState<PerformancePrintPreset>(preset)
  const [sections, setSections] = useState<PerformancePrintSections>(() =>
    sectionsForPreset(preset, currentPeriod),
  )
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (!open) return
    setActivePreset(preset)
    setSections(sectionsForPreset(preset, currentPeriod))
  }, [open, preset, currentPeriod])

  const periodsToFetch = useMemo(
    () =>
      ALL_PERIODS.filter((p) => {
        if (!sections[p]) return false
        // Current period already loaded on the page
        if (p === currentPeriod) return false
        return true
      }),
    [sections, currentPeriod],
  )

  const periodQueries = useQueries({
    queries: periodsToFetch.map((period) => ({
      queryKey: ['performance', 'report-form', 'print', period],
      queryFn: () => performanceService.reportForm(period),
      enabled: open && sections[period],
      staleTime: 60_000,
    })),
  })

  const fetchedByPeriod = useMemo(() => {
    const map: Partial<Record<PrintPeriodId, { groups: ReportGroup[]; reportId: number; status: string }>> =
      {}
    periodsToFetch.forEach((period, idx) => {
      const data = periodQueries[idx]?.data as
        | { subject_groups?: ReportGroup[]; report_id?: number; report_status?: string; status?: string }
        | undefined
      if (!data) return
      map[period] = {
        groups: asGroups<ReportGroup>(data.subject_groups),
        reportId: Number(data.report_id ?? 0),
        status: String(data.report_status ?? data.status ?? ''),
      }
    })
    return map
  }, [periodsToFetch, periodQueries])

  const periodData = useMemo(() => {
    const map: Partial<Record<PrintPeriodId, { groups: ReportGroup[]; reportId: number; status: string }>> =
      { ...fetchedByPeriod }
    if (currentPeriod === 'q1' || currentPeriod === 'q2' || currentPeriod === 'q3' || currentPeriod === 'endterm') {
      map[currentPeriod] = {
        groups: currentReportGroups,
        reportId: currentReportId,
        status: currentReportStatus,
      }
    }
    return map
  }, [fetchedByPeriod, currentPeriod, currentReportGroups, currentReportId, currentReportStatus])

  const reportIds = useMemo(() => {
    const ids: Partial<Record<PrintPeriodId, number>> = {}
    for (const p of ALL_PERIODS) {
      const id = periodData[p]?.reportId ?? 0
      if (id > 0) ids[p] = id
    }
    return ids
  }, [periodData])

  const verifyTarget = verificationFor(sections, ppaId, reportIds)
  const primaryPeriodStatus = (() => {
    if (sections.endterm) return String(periodData.endterm?.status ?? '').toLowerCase()
    for (const p of ALL_PERIODS) {
      if (sections[p]) return String(periodData[p]?.status ?? '').toLowerCase()
    }
    return ''
  })()
  const canOfficialVerify = Boolean(
    verifyTarget?.refId &&
      ((verifyTarget.type === 'ppa' && ppaApproved) ||
        (verifyTarget.type !== 'ppa' && primaryPeriodStatus === 'approved')),
  )

  const verifyQuery = useQuery({
    queryKey: ['document-verification', 'print-dialog', verifyTarget?.type, verifyTarget?.refId],
    queryFn: () => documentsService.ensureVerification(verifyTarget!.type, verifyTarget!.refId),
    enabled: open && canOfficialVerify && Boolean(verifyTarget?.refId),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  const anySelected = Object.values(sections).some(Boolean)
  const loadingExtra = periodQueries.some((q) => q.isFetching)

  useEffect(() => {
    if (!printing) return
    const timer = window.setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [printing, verifyQuery.dataUpdatedAt])

  const applyPreset = (next: PerformancePrintPreset) => {
    setActivePreset(next)
    if (next !== 'custom') setSections(sectionsForPreset(next, currentPeriod))
  }

  const toggleSection = (key: keyof PerformancePrintSections) => {
    setActivePreset('custom')
    setSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handlePrint = async () => {
    if (!anySelected) return
    if (canOfficialVerify && verifyTarget && !verifyQuery.data) {
      await verifyQuery.refetch()
    }
    setPrinting(true)
  }

  if (!open) return null

  const title = documentTitleFor(sections)

  return (
    <>
      <div
        className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center print:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Print performance documents"
      >
        <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-sm border border-ui-border bg-ui-surface shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-ui-border px-4 py-3">
            <div>
              <Typography {...mt} className="text-sm font-bold uppercase text-ui-text">
                Print / Save PDF
              </Typography>
              <Typography {...mt} className="mt-1 text-sm text-ui-muted">
                MoH letterhead · choose a preset or customise sections
              </Typography>
            </div>
            <button
              type="button"
              className="rounded-sm border border-ui-border p-2 text-ui-muted hover:bg-ui-subtle"
              aria-label="Close"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-ui-muted">Presets</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(
                  [
                    ['ppa', 'PPA only'],
                    ['current_period', `This period (${String(currentPeriod).toUpperCase()})`],
                    ['endterm_pack', 'Full pack (PPA + Q1–Q3 + endterm)'],
                    ['custom', 'Custom sections'],
                  ] as Array<[PerformancePrintPreset, string]>
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => applyPreset(id)}
                    className={cn(
                      'rounded-sm border px-3 py-2.5 text-left text-sm',
                      activePreset === id
                        ? 'border-moh-green bg-moh-green/10 font-semibold text-ui-text'
                        : 'border-ui-border hover:border-moh-green/40',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-ui-muted">Sections</p>
              <div className="space-y-2">
                {(
                  [
                    ['ppa', 'Performance plan (PPA)', ppaId > 0],
                    ['q1', 'Q1 report', true],
                    ['q2', 'Q2 report', true],
                    ['q3', 'Q3 report', true],
                    ['endterm', 'End of year KPI report', true],
                    ['appraisal', 'Endterm appraisal (Sections D & E)', true],
                  ] as Array<[keyof PerformancePrintSections, string, boolean]>
                ).map(([key, label, available]) => (
                  <label
                    key={key}
                    className={cn(
                      'flex items-center gap-3 rounded-sm border px-3 py-2.5 text-sm',
                      available ? 'border-ui-border' : 'border-ui-border/50 opacity-50',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[color:var(--color-moh-green,#18181b)]"
                      checked={sections[key]}
                      disabled={!available}
                      onChange={() => toggleSection(key)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <p className="text-xs text-ui-muted">
              Use your browser print dialog and choose <strong>Save as PDF</strong> for a PDF copy.
              Approved documents include a verification QR when available.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ui-border px-4 py-3">
            <Button {...mt} variant="text" className="rounded-sm normal-case" onClick={onClose}>
              Cancel
            </Button>
            <Button
              {...mt}
              className="flex items-center gap-1.5 rounded-sm bg-moh-green normal-case"
              disabled={!anySelected || loadingExtra || printing}
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" />
              {loadingExtra ? 'Loading…' : printing ? 'Preparing…' : 'Print / Save PDF'}
            </Button>
          </div>
        </div>
      </div>

      <div className="official-print-host" aria-hidden={!printing}>
        <OfficialPrintShell
          letterhead={letterhead}
          documentTitle={title}
          subtitle={financialYear}
          referenceLine={[
            staffName ? `Officer: ${staffName}` : null,
            ppaStatus ? `PPA status: ${ppaStatus.replace(/_/g, ' ')}` : null,
            canOfficialVerify ? 'Official verified copy' : 'Working copy',
          ]
            .filter(Boolean)
            .join(' · ')}
          qrCodeDataUrl={canOfficialVerify ? verifyQuery.data?.qr_code_data_url : undefined}
          verifyUrl={canOfficialVerify ? verifyQuery.data?.verify_url : undefined}
        >
          <div className="space-y-8">
            <PrintCoverBlock
              staffName={staffName}
              financialYear={financialYear}
              sections={sections}
            />

            {sections.ppa ? (
              <PrintSection title="Section — Performance plan (PPA)">
                <PrintKpiPlanTable
                  groups={planGroups}
                  planWeights={planWeights}
                  planTargets={planTargets}
                />
              </PrintSection>
            ) : null}

            {ALL_PERIODS.map((period) =>
              sections[period] ? (
                <PrintSection key={period} title={`Section — ${PERIOD_LABELS[period]}`}>
                  <PrintReportTable
                    groups={periodData[period]?.groups ?? []}
                    emptyLabel={
                      periodData[period]
                        ? 'No KPI rows for this period yet.'
                        : 'Report data not available yet.'
                    }
                  />
                </PrintSection>
              ) : null,
            )}

            {sections.appraisal ? (
              <PrintSection title="Section — Appraisal (D & E)">
                <PrintAppraisalBlock appraisal={appraisal} />
              </PrintSection>
            ) : null}
          </div>
        </OfficialPrintShell>
      </div>
    </>
  )
}

function PrintCoverBlock({
  staffName,
  financialYear,
  sections,
}: {
  staffName: string
  financialYear?: string
  sections: PerformancePrintSections
}) {
  const included = [
    sections.ppa ? 'PPA' : null,
    sections.q1 ? 'Q1' : null,
    sections.q2 ? 'Q2' : null,
    sections.q3 ? 'Q3' : null,
    sections.endterm ? 'End of year' : null,
    sections.appraisal ? 'Appraisal D & E' : null,
  ].filter(Boolean)

  return (
    <div className="rounded-sm border border-black/20 p-3 text-xs">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="font-semibold uppercase tracking-wide text-black/60">Officer</p>
          <p className="text-sm text-black">{staffName || '—'}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wide text-black/60">Financial year</p>
          <p className="text-sm text-black">{financialYear || '—'}</p>
        </div>
      </div>
      <p className="mt-3 text-black/70">
        Included sections: <span className="font-medium text-black">{included.join(', ') || '—'}</span>
      </p>
    </div>
  )
}

function PrintSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="official-print-section break-inside-avoid">
      <h3 className="mb-3 border-b border-black/30 pb-1 text-sm font-bold uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </section>
  )
}

export function PrintKpiPlanTable({
  groups,
  planWeights,
  planTargets = {},
}: {
  groups: PlanGroup[]
  planWeights: Record<number, number | string>
  planTargets?: Record<number, number | string>
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const kpis = (group.kpis ?? []).filter(
          (k) => k.in_current_ppa || num(planWeights[k.id]) > 0,
        )
        if (kpis.length === 0) return null
        return (
          <div key={group.subject_area_name}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide">{group.subject_area_name}</p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/30 text-left">
                  <th className="py-1 pr-2">Code</th>
                  <th className="py-1 pr-2">Indicator</th>
                  <th className="py-1 pr-2 text-right">Weight %</th>
                  <th className="py-1 text-right">Target</th>
                </tr>
              </thead>
              <tbody>
                {kpis.map((kpi) => (
                  <tr key={kpi.id} className="border-b border-black/10 align-top">
                    <td className="whitespace-nowrap py-1.5 pr-2">{kpi.code}</td>
                    <td className="py-1.5 pr-2">{kpi.name}</td>
                    <td className="py-1.5 pr-2 text-right">
                      {num(planWeights[kpi.id] ?? kpi.weight_percentage)}
                    </td>
                    <td className="py-1.5 text-right">
                      {planTargets[kpi.id] ?? kpi.target_value ?? kpi.default_target ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

export function PrintReportTable({
  groups,
  emptyLabel = 'No indicators.',
}: {
  groups: ReportGroup[]
  emptyLabel?: string
}) {
  const hasRows = groups.some((g) => (g.kpis ?? []).length > 0)
  if (!hasRows) {
    return <p className="text-xs italic text-black/60">{emptyLabel}</p>
  }
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const kpis = group.kpis ?? []
        if (kpis.length === 0) return null
        return (
          <div key={group.subject_area_name}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide">{group.subject_area_name}</p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/30 text-left">
                  <th className="py-1 pr-2">Code</th>
                  <th className="py-1 pr-2">Indicator</th>
                  <th className="py-1 pr-2 text-right">Weight %</th>
                  <th className="py-1 pr-2 text-right">Target</th>
                  <th className="py-1 text-right">Actual</th>
                </tr>
              </thead>
              <tbody>
                {kpis.map((kpi) => (
                  <tr key={kpi.ppa_kpi_id} className="border-b border-black/10 align-top">
                    <td className="whitespace-nowrap py-1.5 pr-2">{kpi.code}</td>
                    <td className="py-1.5 pr-2">
                      <div>{kpi.name}</div>
                      {kpi.narrative ? (
                        <p className="mt-1 text-[10px] text-black/60">{kpi.narrative}</p>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-2 text-right">{kpi.weight_percentage ?? '—'}</td>
                    <td className="py-1.5 pr-2 text-right">{kpi.target_value ?? '—'}</td>
                    <td className="py-1.5 text-right">{kpi.actual_value ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

function PrintAppraisalBlock({ appraisal }: { appraisal?: AppraisalBundle | null }) {
  if (!appraisal) {
    return (
      <p className="text-xs italic text-black/60">
        Appraisal sections are available on the End of year report once created.
      </p>
    )
  }
  const plans = appraisal.action_plans ?? []
  const comments = (appraisal.comments ?? []).filter((c) => c.comment_role !== 'responsible_officer')

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-bold uppercase">D — Action plan</p>
        {plans.length === 0 ? (
          <p className="text-xs italic text-black/60">No action plan rows.</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-black/30 text-left">
                <th className="py-1 pr-2">Performance gap</th>
                <th className="py-1 pr-2">Agreed action</th>
                <th className="py-1">Time frame</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((row, idx) => (
                <tr key={idx} className="border-b border-black/10 align-top">
                  <td className="py-1.5 pr-2 whitespace-pre-wrap">{row.performance_gap || '—'}</td>
                  <td className="py-1.5 pr-2 whitespace-pre-wrap">{row.agreed_action || '—'}</td>
                  <td className="py-1.5">{row.time_frame || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase">E — Comments & signatures</p>
        {comments.map((row) => (
          <div key={`${row.comment_role}-${row.supervisor_sequence ?? 0}`} className="border border-black/15 p-2">
            <p className="text-[11px] font-semibold uppercase text-black/70">
              {row.comment_role === 'appraisee'
                ? 'Appraisee (Staff)'
                : row.comment_role === 'countersigning'
                  ? 'Countersigning Officer / Supervisor of Appraiser'
                  : row.comment_role === 'appraiser'
                    ? `Appraiser ${row.supervisor_sequence ?? ''}`
                    : row.comment_role}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs">{row.comments || 'No comments yet.'}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              <p>
                <span className="font-semibold">Name:</span> {row.author_name || '—'}
              </p>
              <p>
                <span className="font-semibold">Job title:</span> {row.job_title || '—'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
