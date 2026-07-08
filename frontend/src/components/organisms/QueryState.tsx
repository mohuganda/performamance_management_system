import type { ReactNode } from 'react'
import { Button, Spinner, Typography } from '@material-tailwind/react'
import { mt } from '@/utils/mt'

interface QueryStateProps {
  isLoading: boolean
  isError: boolean
  error?: Error | null
  label: string
  onRetry?: () => void
  isPending?: boolean
  children: ReactNode
}

export function QueryState({
  isLoading,
  isError,
  error,
  label,
  onRetry,
  isPending = false,
  children,
}: QueryStateProps) {
  if (isLoading || isPending) {
    return (
      <div className="flex items-center gap-3 py-12">
        <Spinner {...mt} className="h-6 w-6 text-moh-green" />
        <Typography {...mt} className="text-sm text-gray-600">
          Loading {label}...
        </Typography>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-sm border border-moh-error/30 bg-white p-6">
        <Typography {...mt} className="font-semibold text-moh-error">
          Could not load {label}
        </Typography>
        <Typography {...mt} className="mt-2 text-sm text-gray-600">
          {error?.message ?? 'Please sign in again or check that the API is running on port 3030.'}
        </Typography>
        {onRetry ? (
          <Button {...mt} variant="outlined" size="sm" className="mt-4 rounded-sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    )
  }

  return <>{children}</>
}
