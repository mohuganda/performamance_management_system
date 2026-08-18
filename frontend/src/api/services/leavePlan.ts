import apiClient from '../client'

export type LeavePlanRow = {
  id: number
  staff_id: number
  staff_name?: string
  calendar_year: number
  start_date: string
  end_date: string
  days_planned: number
  notes?: string
}

export type LeavePlanSaveResult = {
  plan: LeavePlanRow
  entitlement_warning: boolean
  warning_message?: string
}

export const leavePlanService = {
  listMine: async (year: number) => {
    const { data } = await apiClient.get<LeavePlanRow[]>('/mobile/leave-plans', { params: { year } })
    return data
  },
  listTeam: async (year: number) => {
    const { data } = await apiClient.get<LeavePlanRow[]>('/mobile/leave-plans/team', {
      params: { year },
    })
    return data
  },
  create: async (payload: {
    calendar_year: number
    start_date: string
    end_date: string
    notes?: string
  }) => {
    const { data } = await apiClient.post<LeavePlanSaveResult>('/mobile/leave-plans', payload)
    return data
  },
  update: async (
    id: number,
    payload: { calendar_year: number; start_date: string; end_date: string; notes?: string },
  ) => {
    const { data } = await apiClient.put<LeavePlanSaveResult>(`/mobile/leave-plans/${id}`, payload)
    return data
  },
  remove: async (id: number) => {
    const { data } = await apiClient.delete(`/mobile/leave-plans/${id}`)
    return data
  },
}
