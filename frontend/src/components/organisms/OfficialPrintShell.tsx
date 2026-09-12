import type { ReactNode } from 'react'
import coatOfArms from '@/assets/uganda-coat-of-arms.svg'
import type { LetterheadSettings } from '@/api/services/documents'
import { DEFAULT_LETTERHEAD } from '@/api/services/documents'
import { cn } from '@/utils/cn'

type OfficialPrintShellProps = {
  letterhead?: LetterheadSettings
  documentTitle: string
  subtitle?: string
  referenceLine?: string
  qrCodeDataUrl?: string | null
  verifyUrl?: string | null
  children: ReactNode
  className?: string
}

export function OfficialPrintShell({
  letterhead = DEFAULT_LETTERHEAD,
  documentTitle,
  subtitle,
  referenceLine,
  qrCodeDataUrl,
  verifyUrl,
  children,
  className,
}: OfficialPrintShellProps) {
  const titleLine = letterhead.org_title_line || 'MINISTRY OF HEALTH'

  return (
    <div
      className={cn(
        'official-print-sheet mx-auto max-w-[210mm] bg-white text-black',
        className,
      )}
    >
      <header className="official-print-header border-b border-black/20 pb-4 text-center">
        <img
          src={coatOfArms}
          alt="Republic of Uganda coat of arms"
          className="mx-auto h-20 w-20 object-contain print:h-16 print:w-16"
        />
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-black/70">
          Republic of Uganda
        </p>
        <h1 className="mt-1 text-xl font-bold uppercase tracking-wide text-black sm:text-2xl">
          {titleLine}
        </h1>
        {letterhead.tagline ? (
          <p className="mt-1 text-xs text-black/70">{letterhead.tagline}</p>
        ) : null}
        <h2 className="mt-5 text-base font-semibold uppercase tracking-wide">{documentTitle}</h2>
        {subtitle ? <p className="mt-1 text-sm text-black/80">{subtitle}</p> : null}
        {referenceLine ? <p className="mt-1 text-xs text-black/60">{referenceLine}</p> : null}
      </header>

      <div className="official-print-body py-5 text-sm leading-relaxed">{children}</div>

      <footer className="official-print-footer mt-6 border-t border-black/20 pt-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 text-[11px] leading-snug text-black/80">
            <p className="font-semibold text-black">{letterhead.org_name}</p>
            <p>{letterhead.address_line}</p>
            <p>{letterhead.postal_address}</p>
            <p className="mt-1">
              Tel: {letterhead.phone}
              {letterhead.toll_free ? ` · Toll-free: ${letterhead.toll_free}` : ''}
            </p>
            <p>
              Email: {letterhead.email}
              {letterhead.website ? ` · ${letterhead.website}` : ''}
            </p>
            {letterhead.footer_note ? (
              <p className="mt-2 italic text-black/60">{letterhead.footer_note}</p>
            ) : null}
          </div>
          {qrCodeDataUrl ? (
            <div className="shrink-0 text-center">
              <img
                src={qrCodeDataUrl}
                alt="Document verification QR code"
                className="mx-auto h-24 w-24 border border-black/10 bg-white p-1"
              />
              <p className="mt-1 max-w-[7.5rem] text-[9px] leading-tight text-black/60">
                Scan to verify
              </p>
              {verifyUrl ? (
                <p className="mt-0.5 max-w-[7.5rem] break-all text-[8px] text-black/40 print:hidden">
                  {verifyUrl}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </footer>
    </div>
  )
}
