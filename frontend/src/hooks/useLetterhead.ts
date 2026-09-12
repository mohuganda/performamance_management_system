import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'
import { DEFAULT_LETTERHEAD, type LetterheadSettings } from '@/api/services/documents'

type PublicConfig = {
  settings?: {
    letterhead?: Partial<LetterheadSettings>
  }
}

export function parseLetterhead(raw?: Partial<LetterheadSettings> | null): LetterheadSettings {
  return {
    ...DEFAULT_LETTERHEAD,
    ...(raw ?? {}),
  }
}

export function useLetterhead() {
  const query = useQuery({
    queryKey: ['public-config', 'letterhead'],
    queryFn: async () => {
      const { data } = await apiClient.get<PublicConfig>('/config')
      return parseLetterhead(data.settings?.letterhead)
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    letterhead: query.data ?? DEFAULT_LETTERHEAD,
    isLoading: query.isLoading,
    query,
  }
}
