import autoTable from 'jspdf-autotable'
import type { LetterheadSettings } from '@/api/services/documents'
import type { AppraisalBundle } from '@/components/performance/PerformanceAppraisalSections'
import { createOfficialPdf, slugifyFilename } from '@/utils/officialPdf'

export type PdfPlanGroup = {
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

export type PdfReportGroup = {
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

export type PerformanceDocumentPdfInput = {
  documentTitle: string
  financialYear?: string
  staffName: string
  ppaStatus?: string
  copyKind?: 'official' | 'working'
  letterhead?: LetterheadSettings
  qrCodeDataUrl?: string | null
  sections: {
    ppa: boolean
    q1: boolean
    q2: boolean
    q3: boolean
    endterm: boolean
    appraisal: boolean
  }
  planGroups: PdfPlanGroup[]
  planWeights: Record<number, number | string>
  planTargets?: Record<number, number | string>
  periodReports: Partial<
    Record<'q1' | 'q2' | 'q3' | 'endterm', { groups: PdfReportGroup[]; status?: string }>
  >
  appraisal?: AppraisalBundle | null
}

function num(v: unknown, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function includedLabels(sections: PerformanceDocumentPdfInput['sections']) {
  return [
    sections.ppa ? 'PPA' : null,
    sections.q1 ? 'Q1' : null,
    sections.q2 ? 'Q2' : null,
    sections.q3 ? 'Q3' : null,
    sections.endterm ? 'End of year' : null,
    sections.appraisal ? 'Appraisal D & E' : null,
  ]
    .filter(Boolean)
    .join(', ')
}

export async function exportPerformanceDocumentPdf(input: PerformanceDocumentPdfInput) {
  const referenceLine = [
    input.staffName ? `Officer: ${input.staffName}` : null,
    input.ppaStatus ? `PPA status: ${input.ppaStatus.replace(/_/g, ' ')}` : null,
    input.copyKind === 'official' ? 'Official verified copy' : 'Working copy',
  ]
    .filter(Boolean)
    .join(' · ')

  const pdf = await createOfficialPdf({
    documentTitle: input.documentTitle,
    subtitle: input.financialYear,
    referenceLine,
    staffName: input.staffName,
    financialYear: input.financialYear,
    letterhead: input.letterhead,
    qrCodeDataUrl: input.qrCodeDataUrl,
    copyKind: input.copyKind,
  })

  const { doc, contentTop, contentBottomMargin, marginX } = pdf
  let cursorY = contentTop

  const ensureSpace = (neededMm: number) => {
    const limit = doc.internal.pageSize.getHeight() - contentBottomMargin
    if (cursorY + neededMm > limit) {
      doc.addPage()
      cursorY = contentTop
    }
  }

  const sectionHeading = (title: string) => {
    ensureSpace(12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    doc.text(title, marginX, cursorY)
    cursorY += 2
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.2)
    doc.line(marginX, cursorY, doc.internal.pageSize.getWidth() - marginX, cursorY)
    cursorY += 5
  }

  // Cover meta
  ensureSpace(22)
  doc.setDrawColor(200, 200, 200)
  doc.setFillColor(250, 250, 250)
  doc.roundedRect(marginX, cursorY, doc.internal.pageSize.getWidth() - marginX * 2, 18, 1, 1, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('OFFICER', marginX + 3, cursorY + 5)
  doc.text('FINANCIAL YEAR', marginX + 90, cursorY + 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text(input.staffName || '—', marginX + 3, cursorY + 10)
  doc.text(input.financialYear || '—', marginX + 90, cursorY + 10)
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  doc.text(`Included sections: ${includedLabels(input.sections) || '—'}`, marginX + 3, cursorY + 15)
  cursorY += 24

  if (input.sections.ppa) {
    sectionHeading('Section — Performance plan (PPA)')
    const body: string[][] = []
    for (const group of input.planGroups) {
      const kpis = (group.kpis ?? []).filter(
        (k) => k.in_current_ppa || num(input.planWeights[k.id]) > 0,
      )
      for (const kpi of kpis) {
        body.push([
          group.subject_area_name,
          kpi.code,
          kpi.name,
          String(num(input.planWeights[kpi.id] ?? kpi.weight_percentage)),
          String(
            input.planTargets?.[kpi.id] ?? kpi.target_value ?? kpi.default_target ?? '—',
          ),
        ])
      }
    }
    if (body.length === 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.text('No PPA indicators selected.', marginX, cursorY)
      cursorY += 8
    } else {
      autoTable(doc, {
        startY: cursorY,
        head: [['Function', 'Code', 'Indicator', 'Weight %', 'Target']],
        body,
        styles: { fontSize: 7.5, cellPadding: 1.6, valign: 'top', overflow: 'linebreak' },
        headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 22 },
          3: { cellWidth: 18, halign: 'right' },
          4: { cellWidth: 22,halign: 'right' },
        },
        margin: { left: marginX, right: marginX, top: contentTop, bottom: contentBottomMargin },
      })
      cursorY = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? cursorY) + 8
    }
  }

  const periods = [
    ['q1', 'Q1 report'],
    ['q2', 'Q2 report'],
    ['q3', 'Q3 report'],
    ['endterm', 'End of year report'],
  ] as const

  for (const [key, label] of periods) {
    if (!input.sections[key]) continue
    sectionHeading(`Section — ${label}`)
    const report = input.periodReports[key]
    const body: string[][] = []
    for (const group of report?.groups ?? []) {
      for (const kpi of group.kpis ?? []) {
        body.push([
          group.subject_area_name,
          kpi.code,
          kpi.narrative ? `${kpi.name}\n${kpi.narrative}` : kpi.name,
          kpi.weight_percentage != null ? String(kpi.weight_percentage) : '—',
          kpi.target_value != null ? String(kpi.target_value) : '—',
          kpi.actual_value != null ? String(kpi.actual_value) : '—',
        ])
      }
    }
    if (body.length === 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text(
        report ? 'No KPI rows for this period yet.' : 'Report data not available yet.',
        marginX,
        cursorY,
      )
      cursorY += 8
    } else {
      autoTable(doc, {
        startY: cursorY,
        head: [['Function', 'Code', 'Indicator', 'Weight %', 'Target', 'Actual']],
        body,
        styles: { fontSize: 7.5, cellPadding: 1.6, valign: 'top', overflow: 'linebreak' },
        headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 18 },
          3: { cellWidth: 16,halign: 'right' },
          4: { cellWidth: 18,halign: 'right' },
          5: { cellWidth: 18,halign: 'right' },
        },
        margin: { left: marginX, right: marginX, top: contentTop, bottom: contentBottomMargin },
      })
      cursorY = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? cursorY) + 8
    }
  }

  if (input.sections.appraisal) {
    sectionHeading('Section — Appraisal (D & E)')
    const appraisal = input.appraisal
    if (!appraisal) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text('Appraisal sections are not available yet.', marginX, cursorY)
      cursorY += 8
    } else {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)
      doc.text('D — Action plan', marginX, cursorY)
      cursorY += 4

      const plans = appraisal.action_plans ?? []
      if (plans.length === 0) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.text('No action plan rows.', marginX, cursorY)
        cursorY += 8
      } else {
        autoTable(doc, {
          startY: cursorY,
          head: [['Performance gap', 'Agreed action', 'Time frame']],
          body: plans.map((p) => [
            p.performance_gap || '—',
            p.agreed_action || '—',
            p.time_frame || '—',
          ]),
          styles: { fontSize: 7.5, cellPadding: 1.6, valign: 'top', overflow: 'linebreak' },
          headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
          margin: { left: marginX, right: marginX, top: contentTop, bottom: contentBottomMargin },
        })
        cursorY = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? cursorY) + 8
      }

      ensureSpace(10)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)
      doc.text('E — Comments & signatures', marginX, cursorY)
      cursorY += 5

      const comments = (appraisal.comments ?? []).filter(
        (c) => c.comment_role !== 'responsible_officer',
      )
      for (const row of comments) {
        ensureSpace(28)
        const roleLabel =
          row.comment_role === 'appraisee'
            ? 'Appraisee (Staff)'
            : row.comment_role === 'countersigning'
              ? 'Countersigning Officer / Supervisor of Appraiser'
              : row.comment_role === 'appraiser'
                ? `Appraiser ${row.supervisor_sequence ?? ''}`
                : row.comment_role

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(60, 60, 60)
        doc.text(roleLabel.toUpperCase(), marginX, cursorY)
        cursorY += 4
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(0, 0, 0)
        const commentLines = doc.splitTextToSize(
          row.comments || 'No comments yet.',
          doc.internal.pageSize.getWidth() - marginX * 2,
        )
        doc.text(commentLines, marginX, cursorY)
        cursorY += commentLines.length * 3.5 + 2
        doc.setFontSize(7.5)
        doc.setTextColor(50, 50, 50)
        doc.text(`Name: ${row.author_name || '—'}`, marginX, cursorY)
        doc.text(`Job title: ${row.job_title || '—'}`, marginX + 90, cursorY)
        cursorY += 7
      }
    }
  }

  pdf.applyChrome()

  const fy = (input.financialYear || 'fy').replace(/\s+/g, '_')
  doc.save(`MoH_PMS_${slugifyFilename(input.documentTitle)}_${fy}.pdf`)
}
