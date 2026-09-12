import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@material-tailwind/react'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { OfficialPrintShell } from '@/components/organisms/OfficialPrintShell'
import {
  documentsService,
  type DocumentType,
} from '@/api/services/documents'
import { useLetterhead } from '@/hooks/useLetterhead'
import { mt } from '@/utils/mt'

type OfficialDocumentPrintButtonProps = {
  documentType: DocumentType
  refId: number
  documentTitle: string
  subtitle?: string
  referenceLine?: string
  enabled: boolean
  children: ReactNode
  className?: string
  buttonLabel?: string
}

/** Renders a Print control and a letterhead print sheet (visible on print only). */
export function OfficialDocumentPrintButton({
  documentType,
  refId,
  documentTitle,
  subtitle,
  referenceLine,
  enabled,
  children,
  className,
  buttonLabel = 'Print official copy',
}: OfficialDocumentPrintButtonProps) {
  const { letterhead } = useLetterhead()
  const [printing, setPrinting] = useState(false)

  const verifyQuery = useQuery({
    queryKey: ['document-verification', documentType, refId],
    queryFn: () => documentsService.ensureVerification(documentType, refId),
    enabled: enabled && refId > 0,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  useEffect(() => {
    if (!printing) return
    const timer = window.setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [printing, verifyQuery.dataUpdatedAt])

  if (!enabled || refId <= 0) return null

  const handlePrint = async () => {
    if (!verifyQuery.data) {
      await verifyQuery.refetch()
    }
    setPrinting(true)
  }

  return (
    <div className={className}>
      <Button
        {...mt}
        size="sm"
        variant="outlined"
        className="flex items-center gap-1.5 rounded-sm normal-case print:hidden"
        onClick={handlePrint}
        loading={printing || verifyQuery.isFetching}
      >
        <Printer className="h-4 w-4" />
        {buttonLabel}
      </Button>
      {verifyQuery.isError ? (
        <p className="mt-1 text-xs text-red-600 print:hidden">
          Could not prepare verification QR. Try again.
        </p>
      ) : null}

      <div className="official-print-host">
        <OfficialPrintShell
          letterhead={letterhead}
          documentTitle={documentTitle}
          subtitle={subtitle}
          referenceLine={referenceLine ?? verifyQuery.data?.period_label}
          qrCodeDataUrl={verifyQuery.data?.qr_code_data_url}
          verifyUrl={verifyQuery.data?.verify_url}
        >
          {children}
        </OfficialPrintShell>
      </div>
    </div>
  )
}
