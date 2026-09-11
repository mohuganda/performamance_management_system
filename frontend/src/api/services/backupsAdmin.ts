import apiClient from '../client'

export type BackupFileInfo = {
  filename: string
  engine: string
  date: string
  size_bytes: number
  tested_at?: string
  test_ok?: boolean | null
  test_message?: string
  can_restore: boolean
}

export type BackupStatus = {
  directory: string
  primary_engine: string
  docker_exec: boolean
  last_run_at?: string
  last_run_message?: string
}

export const backupsAdminService = {
  status: async (): Promise<BackupStatus> => {
    const { data } = await apiClient.get('/admin/backups/status')
    return data
  },
  list: async (): Promise<BackupFileInfo[]> => {
    const { data } = await apiClient.get('/admin/backups')
    return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
  },
  run: async (): Promise<BackupFileInfo> => {
    const { data } = await apiClient.post('/admin/backups/run')
    return data
  },
  remove: async (filename: string) => {
    const { data } = await apiClient.delete(`/admin/backups/${encodeURIComponent(filename)}`)
    return data
  },
  testRestore: async (filename: string): Promise<BackupFileInfo> => {
    const { data } = await apiClient.post(`/admin/backups/${encodeURIComponent(filename)}/test-restore`)
    return data
  },
  restoreProduction: async (filename: string) => {
    const { data } = await apiClient.post(`/admin/backups/${encodeURIComponent(filename)}/restore`, {
      confirm: 'RESTORE',
    })
    return data
  },
}
