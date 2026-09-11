import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Chip, Input, Typography } from '@material-tailwind/react'
import { DatabaseBackup, HardDrive, RefreshCw, ShieldAlert } from 'lucide-react'
import { backupsAdminService, type BackupFileInfo } from '@/api/services/backupsAdmin'
import { QueryState } from '@/components/organisms/QueryState'
import { mt } from '@/utils/mt'
import { notifyApiError, toast } from '@/features/toast'

function formatBytes(n: number) {
  if (!n || n < 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function BackupsAdminPanel() {
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState<BackupFileInfo | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<BackupFileInfo | null>(null)
  const [restoreTyped, setRestoreTyped] = useState('')

  const statusQuery = useQuery({
    queryKey: ['admin', 'backups', 'status'],
    queryFn: () => backupsAdminService.status(),
  })
  const listQuery = useQuery({
    queryKey: ['admin', 'backups', 'list'],
    queryFn: () => backupsAdminService.list(),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'backups'] })
  }

  const runMutation = useMutation({
    mutationFn: () => backupsAdminService.run(),
    onSuccess: (row) => {
      toast.success(`Backup created: ${row.filename}`)
      invalidate()
    },
    onError: (e) => notifyApiError(e, 'Backup failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (filename: string) => backupsAdminService.remove(filename),
    onSuccess: () => {
      toast.success('Backup deleted')
      setConfirmDelete(null)
      invalidate()
    },
    onError: (e) => notifyApiError(e, 'Could not delete backup'),
  })

  const testMutation = useMutation({
    mutationFn: (filename: string) => backupsAdminService.testRestore(filename),
    onSuccess: (row) => {
      toast.success(row.test_message || 'Test restore succeeded')
      invalidate()
    },
    onError: (e) => notifyApiError(e, 'Test restore failed'),
  })

  const restoreMutation = useMutation({
    mutationFn: (filename: string) => backupsAdminService.restoreProduction(filename),
    onSuccess: () => {
      toast.success('Production restore completed')
      setConfirmRestore(null)
      setRestoreTyped('')
      invalidate()
    },
    onError: (e) => notifyApiError(e, 'Production restore failed'),
  })

  const rows = listQuery.data ?? []
  const status = statusQuery.data
  const busy = useMemo(
    () =>
      runMutation.isPending ||
      deleteMutation.isPending ||
      testMutation.isPending ||
      restoreMutation.isPending,
    [
      runMutation.isPending,
      deleteMutation.isPending,
      testMutation.isPending,
      restoreMutation.isPending,
    ],
  )

  return (
    <div className="space-y-4">
      <Card {...mt} className="rounded-sm border border-moh-green/15 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Typography {...mt} variant="h6" className="flex items-center gap-2 text-ui-text">
              <DatabaseBackup className="h-5 w-5 text-moh-green" />
              Database backups
            </Typography>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Daily dumps of the <strong>primary</strong> database from env <code>DB_CONNECTION</code>{' '}
              only ({status?.primary_engine || '…'}). Files live outside the app tree. Restore always
              runs a throwaway test first; production restore requires typing RESTORE.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5" />
                {status?.directory || '…'}
              </span>
              {status?.last_run_at ? (
                <span>
                  Last run: {new Date(status.last_run_at).toLocaleString()} — {status.last_run_message}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              {...mt}
              size="sm"
              variant="outlined"
              className="rounded-sm normal-case"
              disabled={busy}
              onClick={() => invalidate()}
            >
              <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button
              {...mt}
              size="sm"
              className="rounded-sm bg-moh-green normal-case"
              loading={runMutation.isPending}
              disabled={busy}
              onClick={() => runMutation.mutate()}
            >
              Run backup now
            </Button>
          </div>
        </div>
      </Card>

      <QueryState
        isLoading={listQuery.isLoading || statusQuery.isLoading}
        isError={listQuery.isError || statusQuery.isError}
        error={listQuery.error || statusQuery.error}
        label="backups"
        variant="table"
        onRetry={() => invalidate()}
      >
        <div className="overflow-x-auto rounded-sm border border-gray-100 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Engine</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Test</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                    No backups yet. Run a backup or wait for the daily job.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const primary = status?.primary_engine === row.engine
                  return (
                    <tr key={row.filename} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-mono text-xs">{row.filename}</td>
                      <td className="px-3 py-2">{row.date}</td>
                      <td className="px-3 py-2">
                        <Chip
                          {...mt}
                          size="sm"
                          value={row.engine}
                          className={
                            primary ? 'bg-moh-green/10 text-moh-green' : 'bg-gray-100 text-gray-600'
                          }
                        />
                      </td>
                      <td className="px-3 py-2">{formatBytes(row.size_bytes)}</td>
                      <td className="px-3 py-2 text-xs">
                        {row.test_ok == null ? (
                          'Never'
                        ) : row.test_ok ? (
                          <span className="text-moh-green">Pass</span>
                        ) : (
                          <span className="text-red-600">Fail</span>
                        )}
                        {row.tested_at ? (
                          <div className="text-[11px] text-gray-500">
                            {new Date(row.tested_at).toLocaleString()}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Button
                            {...mt}
                            size="sm"
                            variant="text"
                            className="normal-case"
                            disabled={busy || !primary}
                            loading={testMutation.isPending}
                            onClick={() => testMutation.mutate(row.filename)}
                          >
                            Test
                          </Button>
                          <Button
                            {...mt}
                            size="sm"
                            variant="text"
                            className="normal-case text-amber-800"
                            disabled={busy || !row.can_restore}
                            onClick={() => {
                              setRestoreTyped('')
                              setConfirmRestore(row)
                            }}
                          >
                            Restore
                          </Button>
                          <Button
                            {...mt}
                            size="sm"
                            variant="text"
                            className="normal-case text-red-700"
                            disabled={busy}
                            onClick={() => setConfirmDelete(row)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </QueryState>

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card {...mt} className="w-full max-w-md rounded-sm p-5 shadow-lg">
            <Typography {...mt} variant="h6">
              Delete backup?
            </Typography>
            <p className="mt-2 text-sm text-gray-600">{confirmDelete.filename}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button {...mt} size="sm" variant="text" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button
                {...mt}
                size="sm"
                className="rounded-sm bg-red-700 normal-case"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDelete.filename)}
              >
                Delete
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {confirmRestore ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card {...mt} className="w-full max-w-lg rounded-sm p-5 shadow-lg">
            <Typography {...mt} variant="h6" className="flex items-center gap-2 text-amber-900">
              <ShieldAlert className="h-5 w-5" />
              Restore production database
            </Typography>
            <p className="mt-2 text-sm text-gray-700">
              This replaces the live <strong>{status?.primary_engine}</strong> database with{' '}
              <code className="text-xs">{confirmRestore.filename}</code>. Active users will be
              interrupted. A fresh pre-restore dump is attempted first.
            </p>
            <Input
              {...mt}
              className="mt-4"
              label='Type RESTORE to confirm'
              value={restoreTyped}
              onChange={(e) => setRestoreTyped(e.target.value)}
              crossOrigin=""
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                {...mt}
                size="sm"
                variant="text"
                onClick={() => {
                  setConfirmRestore(null)
                  setRestoreTyped('')
                }}
              >
                Cancel
              </Button>
              <Button
                {...mt}
                size="sm"
                className="rounded-sm bg-amber-800 normal-case"
                disabled={restoreTyped !== 'RESTORE'}
                loading={restoreMutation.isPending}
                onClick={() => restoreMutation.mutate(confirmRestore.filename)}
              >
                Restore production
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
