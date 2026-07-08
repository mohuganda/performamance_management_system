import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import coatOfArms from '@/assets/uganda-coat-of-arms.svg'

export type PeriodScore = {
  report_type: string
  label: string
  submission_status: string
  approval_status: string
  raw_weighted_score: number
  normalized_score: number
  has_entries?: boolean
}

export type PerformanceStatusRow = {
  staff_id: number
  staff_name: string
  facility_name?: string
  department_name?: string
  job_title?: string
  ppa_status: string
  ppa_submitted: boolean
  ppa_approved: boolean
  ppa_total_weight: number
  periods: PeriodScore[]
  overall_raw_score: number
  overall_normalized_score: number
  latest_period_normalized_score: number
}

export type PerformanceStatusReport = {
  financial_year: string
  scope_note: string
  rows: PerformanceStatusRow[]
  totals: Record<string, number>
}

const PERIODS = ['q1', 'midterm', 'q3', 'endterm'] as const

function periodFor(row: PerformanceStatusRow, type: string) {
  return row.periods?.find((p) => p.report_type === type)
}

function statusLabel(submission?: string, approval?: string) {
  if (!submission || submission === 'not_submitted') return 'Not submitted'
  if (approval === 'approved') return 'Approved'
  if (approval === 'rejected') return 'Rejected'
  if (submission === 'submitted' || approval === 'pending_approval') return 'Submitted'
  return submission.replace(/_/g, ' ')
}

function scoreCell(p?: PeriodScore) {
  if (!p?.has_entries && !(p && p.normalized_score > 0)) return '—'
  return `${p.normalized_score}% (${p.raw_weighted_score} raw)`
}

async function svgToPngDataUrl(svgUrl: string, size = 96): Promise<string | null> {
  try {
    const res = await fetch(svgUrl)
    const svgText = await res.text()
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.src = url
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('logo load failed'))
    })
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, size, size)
    URL.revokeObjectURL(url)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

export function exportPerformanceReportExcel(report: PerformanceStatusReport, rows = report.rows) {
  const header = [
    'Staff name',
    'Facility',
    'Department',
    'Job title',
    'PPA status',
    'PPA weight %',
    ...PERIODS.flatMap((p) => {
      const label = p === 'midterm' ? 'Midterm' : p === 'endterm' ? 'Endterm' : p.toUpperCase()
      return [`${label} status`, `${label} score (normalized)`, `${label} score (raw)`]
    }),
    'Overall normalized %',
    'Overall raw (avg)',
  ]

  const data = rows.map((row) => {
    const cells: (string | number)[] = [
      row.staff_name,
      row.facility_name || '—',
      row.department_name || '—',
      row.job_title || '—',
      row.ppa_status.replace(/_/g, ' '),
      row.ppa_total_weight || 0,
    ]
    for (const rt of PERIODS) {
      const p = periodFor(row, rt)
      cells.push(statusLabel(p?.submission_status, p?.approval_status))
      cells.push(p?.has_entries || (p && p.normalized_score > 0) ? p!.normalized_score : '')
      cells.push(p?.has_entries || (p && p.raw_weighted_score > 0) ? p!.raw_weighted_score : '')
    }
    cells.push(row.overall_normalized_score || '')
    cells.push(row.overall_raw_score || '')
    return cells
  })

  const sheet = XLSX.utils.aoa_to_sheet([
    ['Ministry of Health Uganda — Performance Status Report'],
    [`Financial year: ${report.financial_year}`],
    [`Scope: ${report.scope_note}`],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    header,
    ...data,
  ])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Performance status')
  XLSX.writeFile(book, `MoH_PMS_performance_status_${report.financial_year.replace(/\s+/g, '_')}.xlsx`)
}

export async function exportPerformanceReportPdf(report: PerformanceStatusReport, rows = report.rows) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const logo = await svgToPngDataUrl(coatOfArms, 128)

  if (logo) {
    doc.addImage(logo, 'PNG', 14, 8, 16, 16)
  }

  doc.setFontSize(14)
  doc.setTextColor(30, 70, 32)
  doc.text('Ministry of Health Uganda', logo ? 34 : 14, 14)
  doc.setFontSize(11)
  doc.setTextColor(40, 40, 40)
  doc.text('Performance Management System — Status Report', logo ? 34 : 14, 20)
  doc.setFontSize(9)
  doc.setTextColor(90, 90, 90)
  doc.text(
    `${report.financial_year} · ${report.scope_note} · Generated ${new Date().toLocaleString()}`,
    14,
    28,
  )

  const head = [
    [
      'Staff',
      'PPA',
      'Q1',
      'Midterm',
      'Q3',
      'Endterm',
      'Overall (norm)',
      'Overall (raw)',
    ],
  ]

  const body = rows.map((row) => [
    `${row.staff_name}\n${row.facility_name || ''}`,
    row.ppa_status.replace(/_/g, ' '),
    ...PERIODS.map((rt) => {
      const p = periodFor(row, rt)
      return `${statusLabel(p?.submission_status, p?.approval_status)}\n${scoreCell(p)}`
    }),
    row.overall_normalized_score ? `${row.overall_normalized_score}%` : '—',
    row.overall_raw_score ? `${row.overall_raw_score}` : '—',
  ])

  autoTable(doc, {
    startY: 32,
    head,
    body,
    styles: { fontSize: 7, cellPadding: 1.5, valign: 'top' },
    headStyles: { fillColor: [46, 125, 50], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 248, 245] },
    margin: { left: 10, right: 10 },
  })

  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.text(
      'Scores: raw = Σ((actual÷target)×weight). Normalized = raw × (100 ÷ total weight). Overall = average of periods with entries.',
      10,
      doc.internal.pageSize.getHeight() - 8,
    )
  }

  doc.save(`MoH_PMS_performance_status_${report.financial_year.replace(/\s+/g, '_')}.pdf`)
}
