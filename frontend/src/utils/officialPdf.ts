import { jsPDF } from 'jspdf'
import coatOfArms from '@/assets/uganda-coat-of-arms.svg'
import type { LetterheadSettings } from '@/api/services/documents'
import { DEFAULT_LETTERHEAD } from '@/api/services/documents'

/** Rasterise the coat-of-arms SVG for embedding in jsPDF. */
export async function svgToPngDataUrl(svgUrl: string, size = 512): Promise<string | null> {
  try {
    const res = await fetch(svgUrl)
    if (!res.ok) return null
    let svgText = await res.text()
    // Explicit pixel size helps the browser rasterise reliably for canvas → PNG.
    if (/<svg\b/i.test(svgText) && !/\swidth=/i.test(svgText)) {
      svgText = svgText.replace(/<svg\b/i, '<svg width="600" height="643"')
    }
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`
    const img = new Image()
    img.decoding = 'sync'
    img.src = dataUrl
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('coat of arms failed to load'))
    })
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.clearRect(0, 0, size, size)
    // Preserve aspect ratio inside the square canvas
    const aspect = (img.naturalWidth || 600) / (img.naturalHeight || 643)
    let dw = size
    let dh = size
    let dx = 0
    let dy = 0
    if (aspect > 1) {
      dh = size / aspect
      dy = (size - dh) / 2
    } else {
      dw = size * aspect
      dx = (size - dw) / 2
    }
    ctx.drawImage(img, dx, dy, dw, dh)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

export type OfficialPdfMeta = {
  documentTitle: string
  subtitle?: string
  referenceLine?: string
  staffName?: string
  financialYear?: string
  letterhead?: LetterheadSettings
  qrCodeDataUrl?: string | null
  copyKind?: 'official' | 'working'
}

const MARGIN_X = 14
const FOOTER_HEIGHT = 36

export async function createOfficialPdf(meta: OfficialPdfMeta) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const letterhead = meta.letterhead ?? DEFAULT_LETTERHEAD
  const logo = await svgToPngDataUrl(coatOfArms, 512)
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  /** Compute header band height so content never sits under the chrome. */
  const measureHeaderBottom = () => {
    let y = 8
    if (logo) y += 18 + 3 // emblem + gap
    y += 4 // REPUBLIC OF UGANDA
    y += 6 // MINISTRY OF HEALTH
    if (letterhead.tagline) y += 4
    y += 6 // document title
    if (meta.subtitle) y += 4.5
    if (meta.referenceLine) y += 4.5
    y += 4 // padding above rule
    return y
  }

  const headerBottom = measureHeaderBottom()
  const contentTop = headerBottom + 4

  const drawHeader = () => {
    const titleLine = letterhead.org_title_line || 'MINISTRY OF HEALTH'
    let y = 8

    if (logo) {
      const logoW = 16
      const logoH = 17
      doc.addImage(logo, 'PNG', (pageWidth - logoW) / 2, y, logoW, logoH)
      y += logoH + 3
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text('REPUBLIC OF UGANDA', pageWidth / 2, y, { align: 'center' })
    y += 5

    doc.setFontSize(13)
    doc.setTextColor(0, 0, 0)
    doc.text(titleLine, pageWidth / 2, y, { align: 'center' })
    y += 5

    if (letterhead.tagline) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(90, 90, 90)
      doc.text(letterhead.tagline, pageWidth / 2, y, { align: 'center' })
      y += 4
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(0, 0, 0)
    doc.text(meta.documentTitle, pageWidth / 2, y, { align: 'center' })
    y += 5

    if (meta.subtitle) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(50, 50, 50)
      doc.text(meta.subtitle, pageWidth / 2, y, { align: 'center' })
      y += 4
    }

    if (meta.referenceLine) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(100, 100, 100)
      const lines = doc.splitTextToSize(meta.referenceLine, pageWidth - MARGIN_X * 2)
      doc.text(lines, pageWidth / 2, y, { align: 'center' })
      y += lines.length * 3.5
    }

    // Rule always below the last header text
    const ruleY = Math.max(y + 2, headerBottom - 1)
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.4)
    doc.line(MARGIN_X, ruleY, pageWidth - MARGIN_X, ruleY)
  }

  const drawFooter = (pageNumber: number, pageCount: number) => {
    const footerTop = pageHeight - FOOTER_HEIGHT
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(MARGIN_X, footerTop, pageWidth - MARGIN_X, footerTop)

    // Contact block on the left; QR on the right (coat of arms is in the header)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(0, 0, 0)
    doc.text(letterhead.org_name || 'Ministry of Health', MARGIN_X, footerTop + 5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(60, 60, 60)
    let ty = footerTop + 9
    if (letterhead.address_line) {
      doc.text(letterhead.address_line, MARGIN_X, ty)
      ty += 3.1
    }
    if (letterhead.postal_address) {
      doc.text(letterhead.postal_address, MARGIN_X, ty)
      ty += 3.1
    }
    const phoneLine = [
      letterhead.phone ? `Tel: ${letterhead.phone}` : '',
      letterhead.toll_free ? `Toll-free: ${letterhead.toll_free}` : '',
    ]
      .filter(Boolean)
      .join(' · ')
    if (phoneLine) {
      doc.text(phoneLine, MARGIN_X, ty)
      ty += 3.1
    }
    const webLine = [letterhead.email ? `Email: ${letterhead.email}` : '', letterhead.website || '']
      .filter(Boolean)
      .join(' · ')
    if (webLine) {
      doc.text(webLine, MARGIN_X, ty)
      ty += 3.1
    }
    if (letterhead.footer_note) {
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(110, 110, 110)
      doc.text(letterhead.footer_note, MARGIN_X, ty, {
        maxWidth: pageWidth - MARGIN_X * 2 - (meta.qrCodeDataUrl ? 28 : 0),
      })
    }

    if (meta.qrCodeDataUrl) {
      const qrSize = 20
      const qrX = pageWidth - MARGIN_X - qrSize
      const qrY = footerTop + 3
      try {
        doc.addImage(meta.qrCodeDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(110, 110, 110)
        doc.text('Scan to verify', qrX + qrSize / 2, qrY + qrSize + 2.5, { align: 'center' })
      } catch {
        // ignore invalid QR payload
      }
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(140, 140, 140)
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth / 2, pageHeight - 3.5, {
      align: 'center',
    })
  }

  const applyChrome = () => {
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      drawHeader()
      drawFooter(i, pageCount)
    }
  }

  return {
    doc,
    logo,
    letterhead,
    marginX: MARGIN_X,
    contentTop,
    contentBottomMargin: FOOTER_HEIGHT + 6,
    pageWidth,
    pageHeight,
    applyChrome,
  }
}

export function slugifyFilename(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'document'
  )
}
