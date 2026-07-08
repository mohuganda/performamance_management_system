import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Switch, Typography } from '@material-tailwind/react'
import { Database, Shield } from 'lucide-react'
import { adminSettingsService } from '@/api/services/admin'
import { PageHeader } from '@/components/organisms/PageHeader'
import { ProcessGuide } from '@/components/organisms/ProcessGuide'
import { QueryState } from '@/components/organisms/QueryState'
import { mt } from '@/utils/mt'

const STEPS = [
  {
    title: 'iHRIS overwrite policy',
    description:
      'By default, PMS protects HR-enriched fields from being replaced when iHRIS sync runs. Enable overwrite only when you want sync to refresh email, mobile, and department from iHRIS.',
    actor: 'System administrator',
  },
]

export function SystemConfigPage() {
  const queryClient = useQueryClient()
  const [overwriteEnabled, setOverwriteEnabled] = useState(false)

  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminSettingsService.get(),
  })

  useEffect(() => {
    if (!settingsQuery.data) return
    setOverwriteEnabled(settingsQuery.data.data_sources.ihris.overwrite_enabled ?? false)
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: () => {
      const ihris = settingsQuery.data?.data_sources.ihris
      return adminSettingsService.update('data_sources', {
        ihris: {
          api_url: ihris?.api_url ?? '',
          require_email: ihris?.require_email ?? true,
          require_mobile: ihris?.require_mobile ?? false,
          use_demo_data: ihris?.use_demo_data ?? false,
          overwrite_enabled: overwriteEnabled,
        },
        hrm_attend: settingsQuery.data?.data_sources.hrm_attend ?? {
          api_url: 'http://localhost/attend',
          enabled: true,
        },
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  })

  return (
    <div className="pb-8">
      <PageHeader
        title="System configuration"
        subtitle="Organisation-wide policies for data sync and integrations"
      />

      <ProcessGuide title="How system configuration works" steps={STEPS} />

      <QueryState
        isLoading={settingsQuery.isLoading}
        isError={settingsQuery.isError}
        error={settingsQuery.error}
        label="system settings"
        variant="form"
        onRetry={() => settingsQuery.refetch()}
      >
        <Card {...mt} className="max-w-2xl rounded-sm border border-moh-green/15 p-6">
          <div className="mb-4 flex items-center gap-2 text-moh-green">
            <Database className="h-5 w-5" />
            <Typography {...mt} className="text-sm font-bold uppercase tracking-wide">
              iHRIS field overwrite
            </Typography>
          </div>
          <Typography {...mt} className="mb-6 text-sm text-gray-600">
            Controls whether the next iHRIS sync may replace staff <strong>email</strong>,{' '}
            <strong>mobile</strong>, and <strong>department</strong> values in PMS. When disabled
            (recommended), HR edits in Staff Management are preserved. HR email and mobile overrides
            in staff profiles always take precedence.
          </Typography>

          <div className="flex items-center justify-between gap-4 rounded-sm border border-gray-100 bg-gray-50/80 px-4 py-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Allow iHRIS to overwrite staff fields</p>
              <p className="mt-1 text-xs text-gray-500">
                {overwriteEnabled
                  ? 'Sync will update protected fields from iHRIS when values differ.'
                  : 'Protected fields are not replaced by sync (default).'}
              </p>
            </div>
            <Switch
              {...mt}
              checked={overwriteEnabled}
              onChange={(e) => setOverwriteEnabled(e.target.checked)}
            />
          </div>

          <div className="mt-6 flex items-center gap-2 rounded-sm border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
            <Shield className="h-4 w-4 shrink-0" />
            Per-staff lock toggles were removed — use this global setting instead.
          </div>

          <Button
            {...mt}
            size="sm"
            className="mt-6 rounded-sm bg-moh-green"
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Save configuration
          </Button>
        </Card>
      </QueryState>
    </div>
  )
}
