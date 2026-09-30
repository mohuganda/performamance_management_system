import { jsPDF } from 'jspdf'
import coatOfArms from '@/assets/uganda-coat-of-arms.svg'
import type { LetterheadSettings } from '@/api/services/documents'
import { DEFAULT_LETTERHEAD } from '@/api/services/documents'

export async function svgToPngDataUrl(svgUrl: string, size = 256): Promise<string | null> {
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
    if (!ctx) {
      URL.revokeObjectURL(url)
      return null
    }
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(img, 0, 0, size, size)
    URL.revokeObjectURL(url)
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
  /** Working copy vs official */
  copyKind?: 'official' | 'working'
}

const MARGIN_X = 14
const HEADER_BOTTOM = 42
const FOOTER_HEIGHT = 38

export async function createOfficialPdf(meta: OfficialPdfMeta) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const letterhead = meta.letterhead ?? DEFAULT_LETTERHEAD
  const logo = await svgToPngDataUrl(coatOfArms, 256)
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const drawHeader = () => {
    const titleLine = letterhead.org_title_line || 'MINISTRY OF HEALTH'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text('REPUBLIC OF UGANDA', pageWidth / 2, 14, { align: 'center' })

    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.text(titleLine, pageWidth / 2, 21, { align: 'center' })

    if (letterhead.tagline) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(90, 90, 90)
      doc.text(letterhead.tagline, pageWidth / 2, 26, { align: 'center' })
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(0, 0, 0)
    doc.text(meta.documentTitle, pageWidth / 2, 33, { align: 'center' })

    let y = 37
    if (meta.subtitle) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(50, 50, 50)
      doc.text(meta.subtitle, pageWidth / 2, y, { align: 'center' })
      y += 4
    }
    if (meta.referenceLine) {
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text(meta.referenceLine, pageWidth / 2, y, { align: 'center' })
    }

    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.4)
    doc.line(MARGIN_X, HEADER_BOTTOM - 2, pageWidth - MARGIN_X, HEADER_BOTTOM - 2)
  }

  const drawFooter = (pageNumber: number, pageCount: number) => {
    const footerTop = pageHeight - FOOTER_HEIGHT
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(MARGIN_X, footerTop, pageWidth - MARGIN_X, footerTop)

    const textLeft = MARGIN_X + (logo ? 18 : 0)
    if (logo) {
      // Coat of arms only — no flag colour bars
      doc.addImage(logo, 'PNG', MARGIN_X, footerTop + 4, 14, 15)
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(0, 0, 0)
    doc.text(letterhead.org_name || 'Ministry of Health', textLeft, footerTop + 7)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(60, 60, 60)
    let ty = footerTop + 11
    if (letterhead.address_line) {
      doc.text(letterhead.address_line, textLeft, ty)
      ty += 3.2
    }
    if (letterhead.postal_address) {
      doc.text(letterhead.postal_address, textLeft, ty)
      ty += 3.2
    }
    const phoneLine = [
      letterhead.phone ? `Tel: ${letterhead.phone}` : '',
      letterhead.toll_free ? `Toll-free: ${letterhead.toll_free}` : '',
    ]
      .filter(Boolean)
      .join(' · ')
    if (phoneLine) {
      doc.text(phoneLine, textLeft, ty)
      ty += 3.2
    }
    const webLine = [
      letterhead.email ? `Email: ${letterhead.email}` : '',
      letterhead.website || '',
    ]
      .filter(Boolean)
      .join(' · ')
    if (webLine) {
      doc.text(webLine, textLeft, ty)
      ty += 3.2
    }
    if (letterhead.footer_note) {
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(110, 110, 110)
      doc.text(letterhead.footer_note, textLeft, ty, {
        maxWidth: pageWidth - textLeft - (meta.qrCodeDataUrl ? 32 : MARGIN_X) - 4,
      })
    }

    if (meta.qrCodeDataUrl) {
      const qrSize = 22
      const qrX = pageWidth - MARGIN_X - qrSize
      const qrY = footerTop + 4
      try {
        doc.addImage(meta.qrCodeDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(110, 110, 110)
        doc.text('Scan to verify', qrX + qrSize / 2, qrY + qrSize + 3, { align: 'center' })
      } catch {
        // ignore invalid QR payload
      }
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(140, 140, 140)
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth / 2, pageHeight - 4, { align: 'center' })
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
    contentTop: HEADER_BOTTOM + 2,
    contentBottomMargin: FOOTER_HEIGHT + 4,
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
