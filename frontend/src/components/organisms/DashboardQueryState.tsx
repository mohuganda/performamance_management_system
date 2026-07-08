import type { ReactNode } from 'react'
import { Button } from '@/components/atoms/Button'

interface DashboardQueryStateProps {
  isLoading: boolean
  isError: boolean
  error?: Error | null
  label: string
  onRetry?: () => void
  children: ReactNode
}

export function DashboardQueryState({
  isLoading,
  isError,
  error,
  label,
  onRetry,
  children,
}: DashboardQueryStateProps) {
  if (isLoading) {
    return <p className="p-6 text-sm text-gray-600">Loading {label}...</p>
  }

  if (isError) {
    return (
      <div className="m-4 rounded-lg border border-moh-error/30 bg-white p-6">
        <p className="font-semibold text-moh-error">Could not load {label}</p>
        <p className="mt-2 text-sm text-gray-600">
          {error?.message ?? 'Please sign in again or check that the API is running on port 3030.'}
        </p>
        {onRetry ? (
          <Button className="mt-4" variant="ghost" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    )
  }

  return <>{children}</>
}
