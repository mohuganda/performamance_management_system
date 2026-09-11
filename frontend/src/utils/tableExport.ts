import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export type TableExportColumn = {
  label: string
  value: string
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'export'
}

function stamp() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

export function exportTableExcel(options: {
  title: string
  headers: string[]
  rows: string[][]
  filename?: string
}) {
  const sheetRows = [
    [options.title],
    [`Exported ${new Date().toLocaleString()}`],
    [],
    ['#', ...options.headers],
    ...options.rows.map((row, index) => [String(index + 1), ...row]),
  ]
  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows)
  worksheet['!cols'] = [{ wch: 6 }, ...options.headers.map((header) => ({ wch: Math.max(12, header.length + 2) }))]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Requests')
  XLSX.writeFile(workbook, `${options.filename ?? slugify(options.title)}-${stamp()}.xlsx`)
}

export async function exportTablePdf(options: {
  title: string
  headers: string[]
  rows: string[][]
  filename?: string
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFontSize(14)
  doc.setTextColor(26, 107, 61)
  doc.text(options.title, 40, 36)
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(`Exported ${new Date().toLocaleString()} · ${options.rows.length} row(s)`, 40, 52)

  autoTable(doc, {
    startY: 64,
    head: [['#', ...options.headers]],
    body: options.rows.map((row, index) => [String(index + 1), ...row]),
    styles: {
      fontSize: 8,
      cellPadding: 4,
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fillColor: [26, 107, 61],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 245],
    },
    margin: { left: 40, right: 40 },
  })

  doc.save(`${options.filename ?? slugify(options.title)}-${stamp()}.pdf`)
}
