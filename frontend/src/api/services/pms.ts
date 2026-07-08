import apiClient from '../client'
import { unwrapApiData } from '@/utils/unwrapApi'

export interface AppConfig {
  name: string
  acronym: string
  organization: {
    name: string
    tagline: string
    co_branding: string[]
  }
  branding: Record<string, string | Record<string, string>>
  performance: Record<string, unknown>
  roles: string[]
}

export const configService = {
  getPublicConfig: async (): Promise<AppConfig> => {
    const { data } = await apiClient.get<AppConfig>('/config')
    return data
  },
}

export const dashboardService = {
  healthWorker: async (staffId = 1, quarter?: string) => {
    const { data } = await apiClient.get('/dashboard/health-worker', {
      params: { staff_id: staffId, quarter },
    })
    return unwrapApiData<Record<string, unknown>>(data)
  },
  supervisor: async (team = 'Ward A', quarter?: string) => {
    const { data } = await apiClient.get('/dashboard/supervisor', {
      params: { team, quarter },
    })
    return unwrapApiData<Record<string, unknown>>(data)
  },
  departmentHead: async (quarter?: string) => {
    const { data } = await apiClient.get('/dashboard/department-head', {
      params: { quarter },
    })
    return unwrapApiData<Record<string, unknown>>(data)
  },
  hrManager: async (quarter?: string) => {
    const { data } = await apiClient.get('/dashboard/hr-manager', {
      params: { quarter },
    })
    return unwrapApiData<Record<string, unknown>>(data)
  },
}

export const ihrisService = {
  sync: async () => {
    const { data } = await apiClient.post('/ihris/sync')
    return data
  },
}
