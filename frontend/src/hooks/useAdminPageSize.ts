import { useQuery } from '@tanstack/react-query'
import { adminSettingsService } from '@/api/services/admin'

const DEFAULT_PAGE_SIZE = 20

export function useAdminPageSize(): number {
  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings', 'page-size'],
    queryFn: () => adminSettingsService.get(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const size = settingsQuery.data?.ui?.admin_page_size
  if (typeof size === 'number' && size > 0) {
    return size
  }
  return DEFAULT_PAGE_SIZE
}
