import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Input,
  Option,
  Select,
  Switch,
  Tab,
  Tabs,
  TabsHeader,
  Typography,
} from '@material-tailwind/react'
import { Link } from 'react-router-dom'
import { adminSettingsService, ihrisAdminService, performanceAdminService } from '@/api/services/admin'
import { kpiAdminService } from '@/api/services/kpiAdmin'
import { PageHeader } from '@/components/organisms/PageHeader'
import { QueryState } from '@/components/organisms/QueryState'
import { useAuthStore } from '@/stores/appStore'
import { mt } from '@/utils/mt'

export function SettingsPage() {
  const { quarter, setQuarter } = useAuthStore()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthStore()
  const canManageSettings = hasPermission('settings.manage')
  const canSyncIhris = hasPermission('ihris.sync')
  const canAccessKpi = hasPermission([
    'kpi.catalog.view',
    'kpi.catalog.manage',
    'kpi.assignments.view',
    'kpi.assignments.manage',
  ])

  const [activeTab, setActiveTab] = useState('preferences')
  const [pageSizeSetting, setPageSizeSetting] = useState('20')
  const [ihrisForm, setIhrisForm] = useState({
    api_url: '',
    require_email: true,
    require_mobile: false,
    use_demo_data: false,
  })
  const [hrmAttendForm, setHrmAttendForm] = useState({
    api_url: 'http://localhost/attend',
    enabled: true,
  })
  const [emailForm, setEmailForm] = useState({
    driver: 'smtp',
    smtp: { host: '', port: '587', username: '', password: '', encryption: 'tls', from_address: '', from_name: '' },
    exchange: { host: '', username: '', password: '', from_address: '', from_name: '' },
  })
  const [performanceForm, setPerformanceForm] = useState({
    enforce_windows: true,
    test_override: true,
    window_weeks: 3,
    window_shift_days: 0,
  })

  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminSettingsService.get(),
    enabled: canManageSettings,
  })

  const syncStatusQuery = useQuery({
    queryKey: ['ihris', 'sync', 'status'],
    queryFn: () => ihrisAdminService.status(),
    enabled: canSyncIhris,
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 3000 : false),
  })

  useEffect(() => {
    if (!settingsQuery.data) return
    const ihris = settingsQuery.data.data_sources.ihris
    setIhrisForm({
      api_url: ihris.api_url ?? '',
      require_email: ihris.require_email ?? true,
      require_mobile: ihris.require_mobile ?? false,
      use_demo_data: ihris.use_demo_data ?? false,
    })
    const hrm = settingsQuery.data.data_sources.hrm_attend
    setHrmAttendForm({
      api_url: hrm?.api_url ?? 'http://localhost/attend',
      enabled: hrm?.enabled ?? true,
    })
    setEmailForm({
      driver: settingsQuery.data.email.driver ?? 'smtp',
      smtp: { ...emailForm.smtp, ...settingsQuery.data.email.smtp },
      exchange: { ...emailForm.exchange, ...settingsQuery.data.email.exchange },
    })
    setPageSizeSetting(String(settingsQuery.data.ui?.admin_page_size ?? 20))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsQuery.data])

  const saveDataSources = useMutation({
    mutationFn: () =>
      adminSettingsService.update('data_sources', { ihris: ihrisForm, hrm_attend: hrmAttendForm }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  })

  const saveEmail = useMutation({
    mutationFn: () => adminSettingsService.update('email', emailForm),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  })

  const saveUi = useMutation({
    mutationFn: () =>
      adminSettingsService.update('ui', { admin_page_size: Number(pageSizeSetting) || 20 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'page-size'] })
    },
  })

  const syncMutation = useMutation({
    mutationFn: async () => {
      let runId = syncStatusQuery.data?.run_id
      let hasMore = true
      while (hasMore) {
        const result = await ihrisAdminService.syncBatch({
          run_id: runId,
          pages_per_batch: 3,
        })
        runId = result.run_id
        hasMore = result.has_more ?? false
        await queryClient.setQueryData(['ihris', 'sync', 'status'], result)
        if (!hasMore) break
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ihris', 'sync', 'status'] })
    },
  })

  const sendReminders = useMutation({
    mutationFn: () => adminSettingsService.sendReminders(),
  })

  const savePerformanceSettings = useMutation({
    mutationFn: () => performanceAdminService.updateSettings(performanceForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'performance', 'settings'] })
      queryClient.invalidateQueries({ queryKey: ['performance'] })
    },
  })

  const kpiPermissionsQuery = useQuery({
    queryKey: ['admin', 'kpi', 'permissions'],
    queryFn: () => kpiAdminService.permissions(),
    enabled: canAccessKpi,
  })

  const performanceSettingsQuery = useQuery({
    queryKey: ['admin', 'performance', 'settings'],
    queryFn: () => performanceAdminService.getSettings(),
    enabled: canManageSettings,
  })

  useEffect(() => {
    if (!performanceSettingsQuery.data?.settings) return
    setPerformanceForm(performanceSettingsQuery.data.settings)
  }, [performanceSettingsQuery.data])

  const quarters = [
    'Q1 (July - September 2026)',
    'Midterm (October - December 2026)',
    'Q3 (January - March 2027)',
    'Endterm (April - June 2027)',
  ]

  const sync = syncStatusQuery.data
  const progress =
    sync?.total_pages && sync.total_pages > 0
      ? Math.round(((sync.current_page ?? 0) / sync.total_pages) * 100)
      : 0

  return (
    <div>
      <PageHeader title="Settings" subtitle="Preferences, data sources, email, and notifications" />

      <Tabs value={activeTab} className="mb-6">
        <TabsHeader {...mt} className="rounded-sm bg-moh-background">
          <Tab {...mt} value="preferences" onClick={() => setActiveTab('preferences')}>
            Preferences
          </Tab>
          {canAccessKpi ? (
            <Tab {...mt} value="kpi" onClick={() => setActiveTab('kpi')}>
              KPI Management
            </Tab>
          ) : null}
          {canManageSettings ? (
            <>
              <Tab {...mt} value="data-sources" onClick={() => setActiveTab('data-sources')}>
                Data Sources
              </Tab>
              <Tab {...mt} value="email" onClick={() => setActiveTab('email')}>
                Email
              </Tab>
              <Tab {...mt} value="notifications" onClick={() => setActiveTab('notifications')}>
                Notifications
              </Tab>
              <Tab {...mt} value="performance" onClick={() => setActiveTab('performance')}>
                Performance reporting
              </Tab>
            </>
          ) : null}
        </TabsHeader>
      </Tabs>

      {activeTab === 'preferences' ? (
        <div className="grid max-w-xl gap-4">
          <Card {...mt} className="rounded-sm border border-moh-green/15 p-4">
            <Typography {...mt} className="mb-4 text-sm font-bold uppercase text-moh-green">
              User Preferences
            </Typography>
            <Select
              {...mt}
              label="Active reporting quarter"
              value={quarter}
              onChange={(v) => v && setQuarter(v)}
            >
              {quarters.map((q) => (
                <Option key={q} value={q}>
                  {q}
                </Option>
              ))}
            </Select>
          </Card>
          {canManageSettings ? (
            <Card {...mt} className="rounded-sm border border-moh-green/15 p-4">
              <Typography {...mt} className="mb-4 text-sm font-bold uppercase text-moh-green">
                Admin table pagination
              </Typography>
              <p className="mb-3 text-sm text-gray-600">
                Default rows per page for Staff Management, KPI catalog, and supervision tables.
              </p>
              <Select
                {...mt}
                label="Records per page"
                value={pageSizeSetting}
                onChange={(v) => v && setPageSizeSetting(v)}
              >
                {['10', '20', '50', '100'].map((n) => (
                  <Option key={n} value={n}>
                    {n} records
                  </Option>
                ))}
              </Select>
              <Button
                {...mt}
                size="sm"
                className="mt-4 rounded-sm bg-moh-green"
                onClick={() => saveUi.mutate()}
                loading={saveUi.isPending}
              >
                Save pagination setting
              </Button>
            </Card>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'data-sources' && canManageSettings ? (
        <QueryState
          isLoading={settingsQuery.isLoading}
          isError={settingsQuery.isError}
          error={settingsQuery.error}
          label="data source settings"
          onRetry={() => settingsQuery.refetch()}
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Card {...mt} className="rounded-sm border border-moh-green/15 p-4">
              <Typography {...mt} className="mb-4 text-sm font-bold uppercase text-moh-green">
                iHRIS API
              </Typography>
              <div className="space-y-4">
                <Input
                  {...mt}
                  label="API URL (token is the last path segment)"
                  value={ihrisForm.api_url}
                  onChange={(e) => setIhrisForm((f) => ({ ...f, api_url: e.target.value }))}
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm">Require email to import staff</span>
                  <Switch
                    {...mt}
                    checked={ihrisForm.require_email}
                    onChange={(e) => setIhrisForm((f) => ({ ...f, require_email: e.target.checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Require mobile number</span>
                  <Switch
                    {...mt}
                    checked={ihrisForm.require_mobile}
                    onChange={(e) => setIhrisForm((f) => ({ ...f, require_mobile: e.target.checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Use local demo table instead of live API</span>
                  <Switch
                    {...mt}
                    checked={ihrisForm.use_demo_data}
                    onChange={(e) => setIhrisForm((f) => ({ ...f, use_demo_data: e.target.checked }))}
                  />
                </div>
                <Button
                  {...mt}
                  size="sm"
                  className="rounded-sm bg-moh-green"
                  onClick={() => saveDataSources.mutate()}
                  loading={saveDataSources.isPending}
                >
                  Save data source settings
                </Button>
              </div>
            </Card>

            <Card {...mt} className="rounded-sm border border-blue-200/60 p-4">
              <Typography {...mt} className="mb-4 text-sm font-bold uppercase text-blue-900">
                HRM Attend integration
              </Typography>
              <p className="mb-4 text-xs text-gray-600">
                PMS exports out-of-station clock logs and approved leave to HRM Attend. Daily duty-station
                attendance summaries are pulled from HRM Attend for unified dashboard reporting.
              </p>
              <div className="space-y-4">
                <Input
                  {...mt}
                  label="HRM Attend base URL"
                  value={hrmAttendForm.api_url}
                  onChange={(e) => setHrmAttendForm((f) => ({ ...f, api_url: e.target.value }))}
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm">Enable HRM Attend data exchange</span>
                  <Switch
                    {...mt}
                    checked={hrmAttendForm.enabled}
                    onChange={(e) => setHrmAttendForm((f) => ({ ...f, enabled: e.target.checked }))}
                  />
                </div>
                {settingsQuery.data?.data_sources.hrm_attend?.last_sync_at ? (
                  <p className="text-xs text-gray-500">
                    Last summary sync: {settingsQuery.data.data_sources.hrm_attend.last_sync_at}
                  </p>
                ) : null}
              </div>
            </Card>

            {canSyncIhris ? (
              <Card {...mt} className="rounded-sm border border-moh-green/15 p-4">
                <Typography {...mt} className="mb-4 text-sm font-bold uppercase text-moh-green">
                  Sync Status
                </Typography>
                <dl className="mb-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Status</dt>
                    <dd className="font-medium capitalize">{sync?.status ?? 'idle'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Progress</dt>
                    <dd>
                      Page {sync?.current_page ?? 0} / {sync?.total_pages ?? '—'} ({progress}%)
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Imported</dt>
                    <dd>{sync?.imported_records ?? 0}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Skipped (no email / filters)</dt>
                    <dd>{sync?.skipped_records ?? 0}</dd>
                  </div>
                  {sync?.last_error ? (
                    <div className="rounded-sm bg-red-50 p-2 text-xs text-red-700">{sync.last_error}</div>
                  ) : null}
                </dl>
                <div className="mb-4 h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-moh-green transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <Button
                  {...mt}
                  size="sm"
                  className="rounded-sm bg-uganda-black"
                  onClick={() => syncMutation.mutate()}
                  loading={syncMutation.isPending || sync?.status === 'running'}
                  disabled={sync?.status === 'running'}
                >
                  {sync?.status === 'running' ? 'Sync in progress…' : 'Start iHRIS sync'}
                </Button>
                <p className="mt-2 text-xs text-gray-500">
                  Staff without email are skipped. HR-enriched fields are not overwritten by empty iHRIS values.
                </p>
              </Card>
            ) : null}
          </div>
        </QueryState>
      ) : null}

      {activeTab === 'email' && canManageSettings ? (
        <Card {...mt} className="max-w-2xl rounded-sm border border-moh-green/15 p-4">
          <Typography {...mt} className="mb-4 text-sm font-bold uppercase text-moh-green">
            Email Configuration
          </Typography>
          <Select
            {...mt}
            label="Mail driver"
            value={emailForm.driver}
            onChange={(v) => v && setEmailForm((f) => ({ ...f, driver: v }))}
            className="mb-4"
          >
            <Option value="smtp">SMTP (default)</Option>
            <Option value="exchange">Microsoft Exchange</Option>
          </Select>

          {emailForm.driver === 'smtp' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Input {...mt} label="SMTP host" value={emailForm.smtp.host} onChange={(e) => setEmailForm((f) => ({ ...f, smtp: { ...f.smtp, host: e.target.value } }))} />
              <Input {...mt} label="Port" value={emailForm.smtp.port} onChange={(e) => setEmailForm((f) => ({ ...f, smtp: { ...f.smtp, port: e.target.value } }))} />
              <Input {...mt} label="Username" value={emailForm.smtp.username} onChange={(e) => setEmailForm((f) => ({ ...f, smtp: { ...f.smtp, username: e.target.value } }))} />
              <Input {...mt} label="Password" type="password" value={emailForm.smtp.password} onChange={(e) => setEmailForm((f) => ({ ...f, smtp: { ...f.smtp, password: e.target.value } }))} />
              <Input {...mt} label="From address" value={emailForm.smtp.from_address} onChange={(e) => setEmailForm((f) => ({ ...f, smtp: { ...f.smtp, from_address: e.target.value } }))} />
              <Input {...mt} label="From name" value={emailForm.smtp.from_name} onChange={(e) => setEmailForm((f) => ({ ...f, smtp: { ...f.smtp, from_name: e.target.value } }))} />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <Input {...mt} label="Exchange host" value={emailForm.exchange.host} onChange={(e) => setEmailForm((f) => ({ ...f, exchange: { ...f.exchange, host: e.target.value } }))} />
              <Input {...mt} label="Username" value={emailForm.exchange.username} onChange={(e) => setEmailForm((f) => ({ ...f, exchange: { ...f.exchange, username: e.target.value } }))} />
              <Input {...mt} label="Password" type="password" value={emailForm.exchange.password} onChange={(e) => setEmailForm((f) => ({ ...f, exchange: { ...f.exchange, password: e.target.value } }))} />
              <Input {...mt} label="From address" value={emailForm.exchange.from_address} onChange={(e) => setEmailForm((f) => ({ ...f, exchange: { ...f.exchange, from_address: e.target.value } }))} />
              <Input {...mt} label="From name" value={emailForm.exchange.from_name} onChange={(e) => setEmailForm((f) => ({ ...f, exchange: { ...f.exchange, from_name: e.target.value } }))} />
            </div>
          )}

          <Button
            {...mt}
            size="sm"
            className="mt-4 rounded-sm bg-moh-green"
            onClick={() => saveEmail.mutate()}
            loading={saveEmail.isPending}
          >
            Save email settings
          </Button>
        </Card>
      ) : null}

      {activeTab === 'notifications' && canManageSettings ? (
        <QueryState
          isLoading={settingsQuery.isLoading}
          isError={settingsQuery.isError}
          error={settingsQuery.error}
          label="notification settings"
          onRetry={() => settingsQuery.refetch()}
        >
          <div className="space-y-4">
            {settingsQuery.data?.notifications
              ? Object.entries(settingsQuery.data.notifications).map(([key, cfg]) => (
                  <Card key={key} {...mt} className="rounded-sm border border-moh-green/15 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <Typography {...mt} className="text-sm font-bold capitalize text-moh-green">
                          {key.replace(/_/g, ' ')}
                        </Typography>
                        <p className="mt-1 text-sm text-gray-600">{cfg.description}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Remind {cfg.days_before} day(s) before deadline ·{' '}
                          {cfg.enabled ? 'Enabled' : 'Disabled'}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))
              : null}
            <Button
              {...mt}
              size="sm"
              variant="outlined"
              className="rounded-sm border-moh-green text-moh-green"
              onClick={() => sendReminders.mutate()}
              loading={sendReminders.isPending}
            >
              Send reminders now (test)
            </Button>
            {sendReminders.data ? (
              <pre className="rounded-sm bg-moh-background p-3 text-xs">
                {JSON.stringify(sendReminders.data, null, 2)}
              </pre>
            ) : null}
          </div>
        </QueryState>
      ) : null}

      {activeTab === 'performance' && canManageSettings ? (
        <QueryState
          isLoading={performanceSettingsQuery.isLoading}
          isError={performanceSettingsQuery.isError}
          error={performanceSettingsQuery.error}
          label="performance reporting settings"
          onRetry={() => performanceSettingsQuery.refetch()}
        >
          <div className="grid max-w-3xl gap-4">
            <Card {...mt} className="rounded-sm border border-moh-green/15 p-4">
              <Typography {...mt} className="mb-2 text-sm font-bold uppercase text-moh-green">
                Reporting windows
              </Typography>
              <p className="mb-4 text-sm text-gray-600">
                MoH practice: each quarterly report opens in the first weeks of the following quarter
                (e.g. Q1 report in Q2). Use test override to open all periods while testing.
              </p>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Enforce submission windows</p>
                    <p className="text-xs text-gray-500">When off, staff can report any time</p>
                  </div>
                  <Switch
                    {...mt}
                    checked={performanceForm.enforce_windows}
                    onChange={(e) =>
                      setPerformanceForm((f) => ({ ...f, enforce_windows: e.target.checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-sm border border-uganda-yellow/40 bg-uganda-yellow/10 p-3">
                  <div>
                    <p className="text-sm font-medium">Test override (open all periods)</p>
                    <p className="text-xs text-gray-600">Recommended on while testing the system</p>
                  </div>
                  <Switch
                    {...mt}
                    checked={performanceForm.test_override}
                    onChange={(e) =>
                      setPerformanceForm((f) => ({ ...f, test_override: e.target.checked }))
                    }
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    {...mt}
                    type="number"
                    label="Window length (weeks)"
                    value={String(performanceForm.window_weeks)}
                    onChange={(e) =>
                      setPerformanceForm((f) => ({
                        ...f,
                        window_weeks: Math.max(1, Number(e.target.value) || 3),
                      }))
                    }
                  />
                  <Input
                    {...mt}
                    type="number"
                    label="Shift all windows (days)"
                    value={String(performanceForm.window_shift_days)}
                    onChange={(e) =>
                      setPerformanceForm((f) => ({
                        ...f,
                        window_shift_days: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
              <Button
                {...mt}
                size="sm"
                className="mt-4 rounded-sm bg-moh-green"
                onClick={() => savePerformanceSettings.mutate()}
                loading={savePerformanceSettings.isPending}
              >
                Save reporting configuration
              </Button>
            </Card>

            <Card {...mt} className="rounded-sm border border-moh-green/15 p-4">
              <Typography {...mt} className="mb-3 text-sm font-bold uppercase text-moh-green">
                Computed windows · {performanceSettingsQuery.data?.financial_year ?? 'current FY'}
              </Typography>
              <div className="space-y-3">
                {(performanceSettingsQuery.data?.windows ?? []).map((w) => (
                  <div
                    key={w.phase}
                    className="rounded-sm border border-gray-100 bg-moh-background/50 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{w.label}</span>
                      <span
                        className={
                          w.is_open
                            ? 'text-moh-green'
                            : w.status === 'upcoming'
                              ? 'text-moh-warning'
                              : 'text-gray-500'
                        }
                      >
                        {w.is_open ? 'Open' : w.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-600">Coverage: {w.coverage_period}</p>
                    <p className="mt-1 text-xs text-gray-500">{w.reporting_window}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </QueryState>
      ) : null}

      {activeTab === 'kpi' && canAccessKpi ? (
        <QueryState
          isLoading={kpiPermissionsQuery.isLoading}
          isError={kpiPermissionsQuery.isError}
          error={kpiPermissionsQuery.error}
          label="KPI permissions"
          onRetry={() => kpiPermissionsQuery.refetch()}
        >
          <Card {...mt} className="rounded-sm border border-moh-green/15 p-4">
            <Typography {...mt} className="mb-2 text-sm font-bold uppercase text-moh-green">
              KPI Management
            </Typography>
            <p className="mb-4 text-sm text-gray-600">
              Configure the national KPI catalog and assign indicators to jobs, departments, and
              individual staff. Administrators have full access; HR officers receive these
              permissions by default and can be adjusted in Access Control.
            </p>
            <div className="mb-4 space-y-2">
              {(kpiPermissionsQuery.data?.permissions ?? []).map((p) => (
                <div
                  key={p.code}
                  className="flex items-center justify-between border-b border-gray-100 py-2 text-sm"
                >
                  <span>{p.name}</span>
                  <span className={hasPermission(p.code) ? 'text-moh-green' : 'text-gray-400'}>
                    {hasPermission(p.code) ? 'Granted' : '—'}
                  </span>
                </div>
              ))}
            </div>
            <Link to="/admin/kpi">
              <Button {...mt} size="sm" className="rounded-sm bg-moh-green">
                Open KPI Management
              </Button>
            </Link>
          </Card>
        </QueryState>
      ) : null}
    </div>
  )
}
