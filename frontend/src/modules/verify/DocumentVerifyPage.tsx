import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { BrandLogo } from '@/components/atoms/BrandLogo'
import { documentsService } from '@/api/services/documents'
import { useLetterhead } from '@/hooks/useLetterhead'

export function DocumentVerifyPage() {
  const { token = '' } = useParams()
  const { letterhead } = useLetterhead()
  const query = useQuery({
    queryKey: ['verify-document', token],
    queryFn: () => documentsService.verifyPublic(token),
    enabled: Boolean(token),
  })

  const result = query.data

  return (
    <div className="min-h-screen bg-ui-bg px-4 py-10">
      <div className="mx-auto max-w-lg rounded-sm border border-ui-border bg-ui-surface p-6 shadow-sm">
        <div className="mb-6 flex justify-center">
          <BrandLogo size="md" />
        </div>
        <h1 className="text-center text-lg font-semibold text-ui-text">Document verification</h1>
        <p className="mt-1 text-center text-sm text-ui-muted">
          {letterhead.org_name} · Performance Management System
        </p>

        {query.isLoading ? (
          <p className="mt-8 text-center text-sm text-ui-muted">Checking document…</p>
        ) : query.isError ? (
          <p className="mt-8 text-center text-sm text-red-600">Could not reach the verification service.</p>
        ) : result ? (
          <div className="mt-8 space-y-3 text-sm">
            <p
              className={
                result.valid
                  ? 'rounded-sm bg-moh-success/15 px-3 py-2 font-medium text-moh-success'
                  : 'rounded-sm bg-red-50 px-3 py-2 font-medium text-red-700'
              }
            >
              {result.message}
            </p>
            {result.document_label ? (
              <Row label="Document" value={result.document_label} />
            ) : null}
            {result.title ? <Row label="Title" value={result.title} /> : null}
            {result.period_label ? <Row label="Period" value={result.period_label} /> : null}
            {result.staff_name ? <Row label="Staff" value={result.staff_name} /> : null}
            {result.status ? <Row label="Status" value={result.status} /> : null}
            {result.issued_at ? (
              <Row label="Issued" value={new Date(result.issued_at).toLocaleString()} />
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 text-center">
          <Link to="/login" className="text-sm font-medium text-moh-green underline">
            Sign in to MoH PMS
          </Link>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-ui-border/60 py-2">
      <dt className="w-24 shrink-0 text-ui-muted">{label}</dt>
      <dd className="font-medium text-ui-text">{value}</dd>
    </div>
  )
}
