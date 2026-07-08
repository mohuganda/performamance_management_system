import type { ReactNode } from 'react'
import { Button, Typography } from '@material-tailwind/react'
import {
  CardListSkeleton,
  DashboardPageSkeleton,
  FormPageSkeleton,
  InlineBlockSkeleton,
  MetricsPanelSkeleton,
  ProfilePageSkeleton,
  TablePageSkeleton,
} from '@/components/molecules/PageSkeletons'
import { mt } from '@/utils/mt'

export type QueryStateVariant =
  | 'inline'
  | 'dashboard'
  | 'table'
  | 'cards'
  | 'profile'
  | 'form'
  | 'metrics'

interface QueryStateProps {
  isLoading: boolean
  isError: boolean
  error?: Error | null
  label: string
  onRetry?: () => void
  isPending?: boolean
  variant?: QueryStateVariant
  skeleton?: ReactNode
  children: ReactNode
}

function renderSkeleton(variant: QueryStateVariant) {
  switch (variant) {
    case 'dashboard':
      return <DashboardPageSkeleton />
    case 'table':
      return <TablePageSkeleton />
    case 'cards':
      return <CardListSkeleton />
    case 'profile':
      return <ProfilePageSkeleton />
    case 'form':
      return <FormPageSkeleton />
    case 'metrics':
      return <MetricsPanelSkeleton />
    case 'inline':
    default:
      return <InlineBlockSkeleton />
  }
}

export function QueryState({
  isLoading,
  isError,
  error,
  label,
  onRetry,
  isPending = false,
  variant = 'inline',
  skeleton,
  children,
}: QueryStateProps) {
  if (isLoading || isPending) {
    return <>{skeleton ?? renderSkeleton(variant)}</>
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
