import { getApiErrorMessage } from '@/api/client'
import { toast } from './api'

type MutationToastOptions = {
  successTitle?: string
  successMessage?: string
  errorTitle?: string
  errorFallback?: string
}

/** Reusable React Query mutation handlers for consistent toast feedback. */
export function mutationToasts(options: MutationToastOptions = {}) {
  return {
    onSuccess: () => {
      toast.success(
        options.successMessage ?? 'Changes saved successfully.',
        options.successTitle ?? 'Success',
      )
    },
    onError: (error: unknown) => {
      toast.error(
        getApiErrorMessage(error, options.errorFallback ?? 'Request failed'),
        options.errorTitle ?? 'Error',
      )
    },
  }
}
