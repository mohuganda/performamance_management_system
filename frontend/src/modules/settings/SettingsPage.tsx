import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  Database,
  DatabaseBackup,
  Layers,
  Mail,
  SlidersHorizontal,
  Stamp,
  Target,
} from 'lucide-react'
import {
  Button,
  Card,
  Input,
  Switch,
  Typography,
} from '@material-tailwind/react'
import { Select, Option } from '@/components/molecules/MtSelect'
import { Link } from 'react-router-dom'
import { adminSettingsService, analyticsAdminService, hrmAttendAdminService, ihrisAdminService, performanceAdminService } from '@/api/services/admin'
import { kpiAdminService } from '@/api/services/kpiAdmin'
import { PageHeader } from '@/components/organisms/PageHeader'
import { QueryState } from '@/components/organisms/QueryState'
import { SettingsTabNav } from '@/components/molecules/SettingsTabNav'
import { ThemeAppearancePicker } from '@/components/molecules/ThemeAppearancePicker'
import { NavPalettePicker } from '@/components/molecules/NavPalettePicker'
import {
  canAccessSettingsTab,
  canManagePreferencesAdmin,
  hasAnyAdminSettingsPermission,
} from '@/constants/settingsPermissions'
import { useAuthStore } from '@/stores/appStore'
import {
  applyOrgUiChrome,
  DEFAULT_CUSTOM_NAV,
  NAV_PRESET_OPTIONS,
  orgUiChromeFromAdminSettings,
  orgUiChromeToPayload,
  type NavPresetId,
  type OrgUiChrome,
} from '@/stores/uiPreferencesStore'
import { mt } from '@/utils/mt'
import { notifyApiError, toast } from '@/features/toast'
import { cn } from '@/utils/cn'
import { ListsAdminPanel } from '@/modules/settings/ListsAdminPanel'
import { BackupsAdminPanel } from '@/modules/settings/BackupsAdminPanel'
import { DEFAULT_LETTERHEAD, type LetterheadSettings } from '@/api/services/documents'

/** Wrapper so Material Tailwind outlined labels don't collide with neighbours. */
function Field({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('min-w-0 pt-1', className)}>{children}</div>
}

function SettingsSection({
  title,
  description,
  children,
  accent = 'green',
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  accent?: 'green' | 'blue'
  className?: string
}) {
  return (
    <Card
      {...mt}
      className={cn(
        'rounded-sm border p-6 shadow-sm',
        accent === 'blue' ? 'border-blue-200/70' : 'border-moh-green/15',
        className,
      )}
    >
      <Typography
        {...mt}
        className={cn(
          'text-sm font-bold uppercase tracking-wide',
          accent === 'blue' ? 'text-blue-900' : 'text-moh-green',
        )}
      >
        {title}
      </Typography>
      {description ? <p className="mt-2 text-sm leading-relaxed text-gray-600">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </Card>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  highlight,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-sm border px-4 py-3',
        highlight
          ? 'border-uganda-yellow/50 bg-uganda-yellow/10'
          : 'border-gray-100 bg-gray-50/80',
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-ui-text">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-gray-500">{hint}</p> : null}
      </div>
      <Switch {...mt} checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  )
}

function isLocalhostHrmUrl(value: string): boolean {
  const raw = value.trim()
  if (!raw) return true
  try {
    const host = new URL(raw.includes('://') ? raw : `http://${raw}`).hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host.startsWith('127.')
  } catch {
    return true
  }
}

export function SettingsPage() {
  const { quarter, setQuarter } = useAuthStore()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const canPrefsAdmin = canManagePreferencesAdmin(hasPermission)
  const canLetterhead = canAccessSettingsTab(hasPermission, 'letterhead')
  const canLists = canAccessSettingsTab(hasPermission, 'lists')
  const canDataSources = canAccessSettingsTab(hasPermission, 'data-sources')
  const canEmail = canAccessSettingsTab(hasPermission, 'email')
  const canNotifications = canAccessSettingsTab(hasPermission, 'notifications')
  const canPerformance = canAccessSettingsTab(hasPermission, 'performance')
  const canKpiSettings = canAccessSettingsTab(hasPermission, 'kpi')
  const canBackups = canAccessSettingsTab(hasPermission, 'backups')
  const canLoadSettings = hasAnyAdminSettingsPermission(hasPermission)
  const canSyncIhris = hasPermission('ihris.sync')

  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'preferences')
  const [pageSizeSetting, setPageSizeSetting] = useState('20')
  const [chromeForm, setChromeForm] = useState<OrgUiChrome>({
    navPresetId: 'teal',
    customNav: DEFAULT_CUSTOM_NAV,
    headerChrome: 'inherit',
    floatingLabels: true,
  })
  const [letterheadForm, setLetterheadForm] = useState<LetterheadSettings>({ ...DEFAULT_LETTERHEAD })
  const [ihrisForm, setIhrisForm] = useState({
    api_url: '',
    require_email: true,
    require_mobile: false,
    use_demo_data: false,
    overwrite_enabled: false,
  })
  const [hrmAttendForm, setHrmAttendForm] = useState({
    api_url: 'http://localhost/attend',
    summary_path: '/attendance/attendance_summary',
    enabled: true,
    export_push_enabled: false,
    export_push_path: '/api/outoftstation_clockin',
    basic_user: '',
    basic_password: '',
    jwt_token: '',
    export_pull_token: '',
  })
  const [googleMapsForm, setGoogleMapsForm] = useState({ api_key: '', country_code: 'ug' })
  const [oosAttendanceForm, setOosAttendanceForm] = useState({
    min_accuracy_percent: 70,
    default_geofence_radius_meters: 500,
  })
  const [dutyStationAttendanceForm, setDutyStationAttendanceForm] = useState({
    min_accuracy_percent: 90,
    default_geofence_radius_meters: 500,
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
    enabled: canLoadSettings,
  })

  const hrmNeedsProductionHost =
    settingsQuery.data?.data_sources.hrm_attend?.needs_host_configuration === true
  const hrmSyncBlocked =
    !hrmAttendForm.enabled || (hrmNeedsProductionHost && isLocalhostHrmUrl(hrmAttendForm.api_url))

  const syncStatusQuery = useQuery({
    queryKey: ['ihris', 'sync', 'status'],
    queryFn: () => ihrisAdminService.status(),
    enabled: canSyncIhris,
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 3000 : false),
  })

  const hrmSyncStatusQuery = useQuery({
    queryKey: ['hrm-attend', 'sync', 'status'],
    queryFn: () => hrmAttendAdminService.status(),
    enabled: canDataSources,
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 3000 : false),
  })

  const hrmExportStatusQuery = useQuery({
    queryKey: ['hrm-attend', 'export', 'status'],
    queryFn: () => hrmAttendAdminService.exportStatus(),
    enabled: canDataSources,
  })

  useEffect(() => {
    if (!settingsQuery.data) return
    const ihris = settingsQuery.data.data_sources.ihris
    setIhrisForm({
      api_url: ihris.api_url ?? '',
      require_email: ihris.require_email ?? true,
      require_mobile: ihris.require_mobile ?? false,
      use_demo_data: ihris.use_demo_data ?? false,
      overwrite_enabled: ihris.overwrite_enabled ?? false,
    })
    const hrm = settingsQuery.data.data_sources.hrm_attend
    setHrmAttendForm({
      api_url: hrm?.api_url ?? 'http://localhost/attend',
      summary_path: hrm?.summary_path ?? '/attendance/attendance_summary',
      enabled: hrm?.enabled ?? true,
      export_push_enabled: hrm?.export_push_enabled ?? false,
      export_push_path: hrm?.export_push_path ?? '/api/outoftstation_clockin',
      basic_user: hrm?.basic_user ?? '',
      basic_password: '',
      jwt_token: '',
      export_pull_token: '',
    })
    setGoogleMapsForm({
      api_key: settingsQuery.data.data_sources.google_maps?.api_key ?? '',
      country_code: settingsQuery.data.data_sources.google_maps?.country_code ?? 'ug',
    })
    setOosAttendanceForm({
      min_accuracy_percent:
        settingsQuery.data.data_sources.oos?.attendance?.min_accuracy_percent ?? 70,
      default_geofence_radius_meters:
        settingsQuery.data.data_sources.oos?.attendance?.default_geofence_radius_meters ?? 500,
    })
    setDutyStationAttendanceForm({
      min_accuracy_percent:
        settingsQuery.data.data_sources.attendance?.duty_station?.min_accuracy_percent ?? 90,
      default_geofence_radius_meters:
        settingsQuery.data.data_sources.attendance?.duty_station?.default_geofence_radius_meters ??
        500,
    })
    setEmailForm({
      driver: settingsQuery.data.email.driver ?? 'smtp',
      smtp: { ...emailForm.smtp, ...settingsQuery.data.email.smtp },
      exchange: { ...emailForm.exchange, ...settingsQuery.data.email.exchange },
    })
    setPageSizeSetting(String(settingsQuery.data.ui?.admin_page_size ?? 20))
    setChromeForm(orgUiChromeFromAdminSettings(settingsQuery.data.ui))
    if (settingsQuery.data.letterhead) {
      setLetterheadForm({ ...DEFAULT_LETTERHEAD, ...settingsQuery.data.letterhead })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsQuery.data])

  const updateChromeForm = (next: OrgUiChrome) => {
    setChromeForm(next)
    applyOrgUiChrome(next)
  }

  const setNavPresetId = (navPresetId: NavPresetId) => {
    let customNav = chromeForm.customNav
    if (navPresetId !== 'custom') {
      const preset = NAV_PRESET_OPTIONS.find((p) => p.id === navPresetId)
      if (preset) customNav = { ...preset.colors }
    }
    updateChromeForm({ ...chromeForm, navPresetId, customNav })
  }

  const setCustomNav = (partial: Partial<OrgUiChrome['customNav']>) => {
    updateChromeForm({
      ...chromeForm,
      navPresetId: 'custom',
      customNav: { ...chromeForm.customNav, ...partial },
    })
  }

  const saveDataSources = useMutation({
    mutationFn: () => {
      const hrmPayload: Record<string, unknown> = { ...hrmAttendForm }
      if (!hrmAttendForm.basic_password) delete hrmPayload.basic_password
      if (!hrmAttendForm.jwt_token) delete hrmPayload.jwt_token
      if (!hrmAttendForm.export_pull_token) delete hrmPayload.export_pull_token
      return adminSettingsService.update('data_sources', {
        ihris: ihrisForm,
        hrm_attend: hrmPayload,
        google_maps: googleMapsForm,
        oos: { attendance: oosAttendanceForm },
        attendance: { duty_station: dutyStationAttendanceForm },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      queryClient.invalidateQueries({ queryKey: ['public-config', 'maps'] })
      queryClient.invalidateQueries({ queryKey: ['public-config', 'oos-attendance'] })
      queryClient.invalidateQueries({ queryKey: ['public-config', 'duty-station-attendance'] })
      queryClient.invalidateQueries({ queryKey: ['hrm-attend', 'export', 'status'] })
      toast.success('Data source settings saved.')
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not save data sources'),
  })

  const saveEmail = useMutation({
    mutationFn: () => adminSettingsService.update('email', emailForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      toast.success('Email settings saved.')
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not save email settings'),
  })

  const saveUi = useMutation({
    mutationFn: () =>
      adminSettingsService.update('ui', {
        admin_page_size: Number(pageSizeSetting) || 20,
        ...orgUiChromeToPayload(chromeForm),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'page-size'] })
      queryClient.invalidateQueries({ queryKey: ['public-config', 'ui-chrome'] })
      toast.success('Organisation UI settings saved.')
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not save UI settings'),
  })

  const saveLetterhead = useMutation({
    mutationFn: () => adminSettingsService.update('letterhead', { ...letterheadForm }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      queryClient.invalidateQueries({ queryKey: ['public-config', 'letterhead'] })
      toast.success('Letterhead settings saved.')
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not save letterhead'),
  })

  const syncMutation = useMutation({
    mutationFn: async () => ihrisAdminService.start({ run_id: syncStatusQuery.data?.run_id }),
    onSuccess: (result) => {
      queryClient.setQueryData(['ihris', 'sync', 'status'], result)
      queryClient.invalidateQueries({ queryKey: ['ihris', 'sync', 'status'] })
      toast.success('iHRIS background sync started.')
    },
    onError: (error: unknown) => notifyApiError(error, 'iHRIS sync failed to start'),
  })

  const resumeIhrisMutation = useMutation({
    mutationFn: async () => ihrisAdminService.resume({ run_id: syncStatusQuery.data?.run_id }),
    onSuccess: (result) => {
      queryClient.setQueryData(['ihris', 'sync', 'status'], result)
      queryClient.invalidateQueries({ queryKey: ['ihris', 'sync', 'status'] })
      toast.success('iHRIS sync resumed.')
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not resume iHRIS sync'),
  })

  const cancelIhrisMutation = useMutation({
    mutationFn: async () => ihrisAdminService.cancel({ run_id: syncStatusQuery.data?.run_id }),
    onSuccess: (result) => {
      queryClient.setQueryData(['ihris', 'sync', 'status'], result)
      queryClient.invalidateQueries({ queryKey: ['ihris', 'sync', 'status'] })
      toast.success('iHRIS sync cancelled.')
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not cancel iHRIS sync'),
  })

  const hrmAttendSyncMutation = useMutation({
    mutationFn: () => hrmAttendAdminService.start(),
    onSuccess: (result) => {
      queryClient.setQueryData(['hrm-attend', 'sync', 'status'], result)
      queryClient.invalidateQueries({ queryKey: ['hrm-attend', 'sync', 'status'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      toast.success('HRM Attend background sync started.')
    },
    onError: (error: unknown) => notifyApiError(error, 'HRM Attend sync failed to start'),
  })

  const resumeHrmMutation = useMutation({
    mutationFn: () => hrmAttendAdminService.resume({ run_id: hrmSyncStatusQuery.data?.run_id }),
    onSuccess: (result) => {
      queryClient.setQueryData(['hrm-attend', 'sync', 'status'], result)
      toast.success('HRM Attend sync resumed.')
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not resume HRM sync'),
  })

  const cancelHrmMutation = useMutation({
    mutationFn: () => hrmAttendAdminService.cancel({ run_id: hrmSyncStatusQuery.data?.run_id }),
    onSuccess: (result) => {
      queryClient.setQueryData(['hrm-attend', 'sync', 'status'], result)
      toast.success('HRM Attend sync cancelled.')
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not cancel HRM sync'),
  })

  const hrmExportPushMutation = useMutation({
    mutationFn: () => hrmAttendAdminService.pushExport(100),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['hrm-attend', 'export', 'status'] })
      toast.success(`Export push: ${result.pushed} pushed, ${result.failed} failed.`)
    },
    onError: (error: unknown) => notifyApiError(error, 'Export push failed'),
  })

  const dorisSyncMutation = useMutation({
    mutationFn: () => analyticsAdminService.sync(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      const total = Object.values(result.tables ?? {}).reduce((sum, n) => sum + n, 0)
      toast.success(result.message ?? `Replicated ${total} rows to Doris.`)
    },
    onError: (error: unknown) => notifyApiError(error, 'Doris analytics sync failed'),
  })

  const analyticsStatus = settingsQuery.data?.data_sources.analytics

  const sendReminders = useMutation({
    mutationFn: () => adminSettingsService.sendReminders(),
    onSuccess: () => toast.success('Reminder notifications sent.'),
    onError: (error: unknown) => notifyApiError(error, 'Could not send reminders'),
  })

  const savePerformanceSettings = useMutation({
    mutationFn: () => performanceAdminService.updateSettings(performanceForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'performance', 'settings'] })
      queryClient.invalidateQueries({ queryKey: ['performance'] })
      toast.success('Performance settings saved.')
    },
    onError: (error: unknown) => notifyApiError(error, 'Could not save performance settings'),
  })

  const kpiPermissionsQuery = useQuery({
    queryKey: ['admin', 'kpi', 'permissions'],
    queryFn: () => kpiAdminService.permissions(),
    enabled: canKpiSettings,
  })

  const performanceSettingsQuery = useQuery({
    queryKey: ['admin', 'performance', 'settings'],
    queryFn: () => performanceAdminService.getSettings(),
    enabled: canPerformance,
  })

  useEffect(() => {
    if (!performanceSettingsQuery.data?.settings) return
    setPerformanceForm(performanceSettingsQuery.data.settings)
  }, [performanceSettingsQuery.data])

  const settingsTabs = useMemo(
    () =>
      [
        { id: 'preferences' as const, label: 'Preferences', icon: SlidersHorizontal, visible: true },
        { id: 'letterhead' as const, label: 'Letterhead', icon: Stamp, visible: canLetterhead },
        { id: 'lists' as const, label: 'Lists', icon: Layers, visible: canLists },
        { id: 'kpi' as const, label: 'KPI', icon: Target, visible: canKpiSettings },
        { id: 'data-sources' as const, label: 'Data sources', icon: Database, visible: canDataSources },
        { id: 'backups' as const, label: 'Backups', icon: DatabaseBackup, visible: canBackups },
        { id: 'email' as const, label: 'Email', icon: Mail, visible: canEmail },
        { id: 'notifications' as const, label: 'Notifications', icon: Bell, visible: canNotifications },
        { id: 'performance' as const, label: 'Performance', icon: BarChart3, visible: canPerformance },
      ].filter((tab) => tab.visible),
    [canLetterhead, canLists, canKpiSettings, canDataSources, canBackups, canEmail, canNotifications, canPerformance],
  )

  const selectTab = (tab: string) => {
    setActiveTab(tab)
    if (tab === 'preferences') {
      searchParams.delete('tab')
    } else {
      searchParams.set('tab', tab)
    }
    setSearchParams(searchParams, { replace: true })
  }

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && tab !== activeTab) {
      setActiveTab(tab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync URL → tab once on navigation
  }, [searchParams])

  useEffect(() => {
    if (settingsTabs.length === 0) return
    const allowed = settingsTabs.some((tab) => tab.id === activeTab)
    if (!allowed) {
      selectTab(settingsTabs[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redirect when permissions change
  }, [settingsTabs, activeTab])

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
    <div className="pb-10">
      <PageHeader
        title="Settings"
        subtitle="Preferences, reference lists, data sources, email, notifications, and system policies"
      />

      <SettingsTabNav tabs={settingsTabs} value={activeTab} onChange={selectTab} />

      {activeTab === 'preferences' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SettingsSection title="User preferences" description="Controls your active reporting period across dashboards and performance pages.">
            <Field>
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
            </Field>
          </SettingsSection>

          <SettingsSection
            title="Appearance"
            description="Choose light, dark, or match your device. Your choice is saved on this browser."
            className="lg:col-span-2"
          >
            <ThemeAppearancePicker />
            {canPrefsAdmin ? (
              <>
                <div className="mt-6">
                  <p className="mb-1 text-sm font-semibold text-ui-text">Top navigation colors</p>
                  <p className="mb-3 text-xs text-ui-muted">
                    Pick a preset or build a custom bar. Each option includes background, text, and
                    active accent colors. Saved for all users in the organisation.
                  </p>
                  <NavPalettePicker
                    navPresetId={chromeForm.navPresetId}
                    customNav={chromeForm.customNav}
                    onPresetChange={setNavPresetId}
                    onCustomNavChange={setCustomNav}
                  />
                </div>
                <div className="mt-6">
                  <p className="mb-1 text-sm font-semibold text-ui-text">Brand header</p>
                  <p className="mb-3 text-xs text-ui-muted">
                    The top row with logo and account menu. Defaults to matching the navigation colors.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        {
                          value: 'inherit' as const,
                          label: 'Inherit nav colors',
                          description: 'Same bar as navigation (default)',
                        },
                        {
                          value: 'light' as const,
                          label: 'Light',
                          description: 'White/light surface, independent of nav',
                        },
                      ] as const
                    ).map((option) => {
                      const selected = chromeForm.headerChrome === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            updateChromeForm({ ...chromeForm, headerChrome: option.value })
                          }
                          aria-pressed={selected}
                          className={cn(
                            'rounded-sm border px-3 py-2.5 text-left transition',
                            selected
                              ? 'border-uganda-yellow bg-uganda-yellow/15 text-ui-text ring-1 ring-uganda-yellow/40'
                              : 'border-ui-border bg-ui-surface text-ui-muted hover:border-ui-text/20 hover:bg-ui-subtle hover:text-ui-text',
                          )}
                        >
                          <span className="block text-sm font-semibold text-ui-text">{option.label}</span>
                          <span className="mt-0.5 block text-xs text-ui-muted">{option.description}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="mt-4">
                  <ToggleRow
                    label="Floating field labels"
                    hint="Sit labels on the input border (Material-style). On by default — turn off to place labels above fields."
                    checked={chromeForm.floatingLabels}
                    onChange={(floatingLabels) => updateChromeForm({ ...chromeForm, floatingLabels })}
                  />
                </div>
                <Button
                  {...mt}
                  size="sm"
                  className="mt-6 rounded-sm bg-moh-green normal-case"
                  onClick={() => saveUi.mutate()}
                  loading={saveUi.isPending}
                >
                  Save organisation appearance
                </Button>
              </>
            ) : null}
          </SettingsSection>

          {canPrefsAdmin ? (
            <SettingsSection
              title="Admin table pagination"
              description="Default rows per page for Staff Management, KPI catalog, and related admin tables."
            >
              <Field>
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
              </Field>
              <Button
                {...mt}
                size="sm"
                className="mt-6 rounded-sm bg-moh-green normal-case"
                onClick={() => saveUi.mutate()}
                loading={saveUi.isPending}
              >
                Save pagination setting
              </Button>
            </SettingsSection>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'letterhead' && canLetterhead ? (
        <SettingsSection
          title="Official letterhead"
          description="Address and contacts shown on approved performance, leave, and out-of-station printouts. The coat of arms and MINISTRY OF HEALTH title are fixed branding."
          className="max-w-3xl"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ['org_name', 'Organisation name'],
                ['org_title_line', 'Title under logo'],
                ['tagline', 'Tagline'],
                ['address_line', 'Physical address'],
                ['postal_address', 'Postal address'],
                ['phone', 'Phone'],
                ['toll_free', 'Toll-free'],
                ['email', 'Email'],
                ['website', 'Website'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} className={key === 'tagline' || key === 'address_line' ? 'sm:col-span-2' : ''}>
                <Input
                  {...mt}
                  label={label}
                  value={letterheadForm[key]}
                  onChange={(e) =>
                    setLetterheadForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                  crossOrigin={undefined}
                />
              </Field>
            ))}
            <Field className="sm:col-span-2">
              <Input
                {...mt}
                label="Footer note (under QR)"
                value={letterheadForm.footer_note}
                onChange={(e) =>
                  setLetterheadForm((f) => ({ ...f, footer_note: e.target.value }))
                }
                crossOrigin={undefined}
              />
            </Field>
          </div>
          <Button
            {...mt}
            size="sm"
            className="mt-6 rounded-sm bg-moh-green normal-case"
            onClick={() => saveLetterhead.mutate()}
            loading={saveLetterhead.isPending}
          >
            Save letterhead
          </Button>
        </SettingsSection>
      ) : null}

      {activeTab === 'lists' && canLists ? <ListsAdminPanel /> : null}

      {activeTab === 'backups' && canBackups ? <BackupsAdminPanel /> : null}

      {activeTab === 'data-sources' && canDataSources ? (
        <QueryState
          isLoading={settingsQuery.isLoading}
          isError={settingsQuery.isError}
          error={settingsQuery.error}
          label="data source settings"
          variant="form"
          onRetry={() => settingsQuery.refetch()}
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <SettingsSection
              title="iHRIS API"
              description="Connection and import rules for staff sync from iHRIS."
            >
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <Input
                      {...mt}
                      label="API URL (token is the last path segment)"
                      value={ihrisForm.api_url}
                      onChange={(e) => setIhrisForm((f) => ({ ...f, api_url: e.target.value }))}
                    />
                  </Field>
                  <Field>
                    <div className="rounded-sm border border-gray-100 bg-gray-50/80 p-3 text-xs text-gray-600">
                      <p className="font-semibold text-gray-800">Sync payload fields</p>
                      <p className="mt-1">
                        Each iHRIS row maps <code className="text-[11px]">district_id</code> → district
                        catalog, <code className="text-[11px]">facility_id</code> → facility, and{' '}
                        <code className="text-[11px]">region</code> → macro-region. Facilities store{' '}
                        <code className="text-[11px]">district_ref_id</code> linking to{' '}
                        <code className="text-[11px]">districts.id</code>.
                      </p>
                    </div>
                  </Field>
                </div>
                <div className="space-y-3">
                  <ToggleRow
                    label="Require email to import staff"
                    hint="Staff without email are skipped during sync"
                    checked={ihrisForm.require_email}
                    onChange={(checked) => setIhrisForm((f) => ({ ...f, require_email: checked }))}
                  />
                  <ToggleRow
                    label="Require mobile number"
                    checked={ihrisForm.require_mobile}
                    onChange={(checked) => setIhrisForm((f) => ({ ...f, require_mobile: checked }))}
                  />
                  <ToggleRow
                    label="Use local demo table instead of live API"
                    checked={ihrisForm.use_demo_data}
                    onChange={(checked) => setIhrisForm((f) => ({ ...f, use_demo_data: checked }))}
                  />
                  <ToggleRow
                    label="Allow iHRIS to overwrite staff fields"
                    hint={
                      ihrisForm.overwrite_enabled
                        ? 'Sync will update email, mobile, and department from iHRIS when values differ.'
                        : 'Protected fields are not replaced by sync (recommended default).'
                    }
                    checked={ihrisForm.overwrite_enabled}
                    onChange={(checked) => setIhrisForm((f) => ({ ...f, overwrite_enabled: checked }))}
                    highlight={!ihrisForm.overwrite_enabled}
                  />
                  <div className="rounded-sm border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                    When overwrite is disabled, HR edits in Staff Management are preserved. HR email
                    and mobile overrides in staff profiles always take precedence. Per-staff lock
                    toggles were removed — use this global setting instead.
                  </div>
                </div>
                <Button
                  {...mt}
                  size="sm"
                  className="rounded-sm bg-moh-green normal-case"
                  onClick={() => saveDataSources.mutate()}
                  loading={saveDataSources.isPending}
                >
                  Save data source settings
                </Button>
              </div>
            </SettingsSection>

            <SettingsSection
              title="HRM Attend integration"
              description="Pull monthly duty-station summaries and push OOS attendance clocks to HRM Attend. Sync runs on the server so leaving this page does not stop it."
              accent="blue"
            >
              <div className="space-y-6">
                <Field>
                  <Input
                    {...mt}
                    label="HRM Attend base URL"
                    value={hrmAttendForm.api_url}
                    onChange={(e) => setHrmAttendForm((f) => ({ ...f, api_url: e.target.value }))}
                  />
                </Field>
                <Field>
                  <Input
                    {...mt}
                    label="Attendance summary path"
                    value={hrmAttendForm.summary_path}
                    onChange={(e) => setHrmAttendForm((f) => ({ ...f, summary_path: e.target.value }))}
                  />
                </Field>
                <ToggleRow
                  label="Enable HRM Attend data exchange"
                  checked={hrmAttendForm.enabled}
                  onChange={(checked) => setHrmAttendForm((f) => ({ ...f, enabled: checked }))}
                />
                {settingsQuery.data?.data_sources.hrm_attend?.needs_host_configuration ? (
                  <div className="rounded-sm border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
                    Production deployment detected. Update the HRM Attend base URL below to your server host
                    (not <code className="text-xs">localhost</code>), save settings, then run sync.
                  </div>
                ) : null}
                {settingsQuery.data?.data_sources.hrm_attend?.last_sync_at ? (
                  <p className="text-xs text-gray-500">
                    Last summary sync: {settingsQuery.data.data_sources.hrm_attend.last_sync_at}
                    {settingsQuery.data.data_sources.hrm_attend.last_sync_status
                      ? ` (${settingsQuery.data.data_sources.hrm_attend.last_sync_status})`
                      : ''}
                  </p>
                ) : null}
                <p className="text-xs text-gray-500">
                  Status: <span className="font-semibold capitalize">{hrmSyncStatusQuery.data?.status ?? 'idle'}</span>
                  {hrmSyncStatusQuery.data?.year_month
                    ? ` · ${hrmSyncStatusQuery.data.year_month}`
                    : ''}
                  {typeof hrmSyncStatusQuery.data?.imported === 'number'
                    ? ` · imported ${hrmSyncStatusQuery.data.imported}`
                    : ''}
                </p>
                {hrmSyncStatusQuery.data?.last_error ? (
                  <div className="rounded-sm bg-red-50 p-3 text-xs text-red-700">
                    {hrmSyncStatusQuery.data.last_error}
                  </div>
                ) : null}
                <p className="text-xs text-gray-500">
                  Fetches monthly summaries from{' '}
                  <code className="text-[11px]">
                    {hrmAttendForm.api_url.replace(/\/$/, '')}
                    {hrmAttendForm.summary_path}
                  </code>{' '}
                  and imports only rows matching PMS staff (by iHRIS PID, card number, or NIN).
                </p>
                <div className="border-t border-gray-100 pt-4 space-y-4">
                  <p className="text-sm font-semibold text-ui-text">OOS clock export to HRM</p>
                  <ToggleRow
                    label="Enable push of OOS attendance clocks"
                    hint="Posts to /api/outoftstation_clockin with source=performance_system"
                    checked={hrmAttendForm.export_push_enabled}
                    onChange={(checked) =>
                      setHrmAttendForm((f) => ({ ...f, export_push_enabled: checked }))
                    }
                  />
                  <Field>
                    <Input
                      {...mt}
                      label="Export push path"
                      value={hrmAttendForm.export_push_path}
                      onChange={(e) =>
                        setHrmAttendForm((f) => ({ ...f, export_push_path: e.target.value }))
                      }
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <Input
                        {...mt}
                        label="Attend API username (JWT login)"
                        value={hrmAttendForm.basic_user}
                        onChange={(e) =>
                          setHrmAttendForm((f) => ({ ...f, basic_user: e.target.value }))
                        }
                      />
                    </Field>
                    <Field>
                      <Input
                        {...mt}
                        type="password"
                        label="Attend API password"
                        value={hrmAttendForm.basic_password}
                        onChange={(e) =>
                          setHrmAttendForm((f) => ({ ...f, basic_password: e.target.value }))
                        }
                        placeholder="Leave blank to keep existing"
                      />
                    </Field>
                  </div>
                  <Field>
                    <Input
                      {...mt}
                      type="password"
                      label="Optional JWT override"
                      value={hrmAttendForm.jwt_token}
                      onChange={(e) =>
                        setHrmAttendForm((f) => ({ ...f, jwt_token: e.target.value }))
                      }
                      placeholder={
                        settingsQuery.data?.data_sources.hrm_attend?.jwt_token_set
                          ? 'Token is set — leave blank to keep'
                          : 'Or paste a Bearer token (skips login)'
                      }
                    />
                  </Field>
                  <p className="text-xs text-gray-500">
                    Push uses <code className="text-[11px]">Authorization: Bearer</code> (Attend JWT).
                    Username/password call <code className="text-[11px]">/api/login</code> unless a JWT
                    override is stored.
                  </p>
                  <Field>
                    <Input
                      {...mt}
                      type="password"
                      label="Pull API token (for HRM → PMS)"
                      value={hrmAttendForm.export_pull_token}
                      onChange={(e) =>
                        setHrmAttendForm((f) => ({ ...f, export_pull_token: e.target.value }))
                      }
                      placeholder={
                        settingsQuery.data?.data_sources.hrm_attend?.export_pull_token_set
                          ? 'Token is set — leave blank to keep'
                          : 'Set a shared secret for pull'
                      }
                    />
                  </Field>
                  <p className="text-xs text-gray-500">
                    Pending clocks: {hrmExportStatusQuery.data?.pending ?? '—'}
                    {hrmExportStatusQuery.data?.last_push_at
                      ? ` · last push ${hrmExportStatusQuery.data.last_push_at} (${hrmExportStatusQuery.data.last_push_status ?? ''})`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    {...mt}
                    size="sm"
                    className="rounded-sm bg-moh-green normal-case"
                    onClick={() => saveDataSources.mutate()}
                    loading={saveDataSources.isPending}
                  >
                    Save HRM settings
                  </Button>
                  <Button
                    {...mt}
                    size="sm"
                    variant="outlined"
                    className="rounded-sm normal-case"
                    onClick={() => hrmAttendSyncMutation.mutate()}
                    loading={hrmAttendSyncMutation.isPending || hrmSyncStatusQuery.data?.status === 'running'}
                    disabled={hrmSyncBlocked || hrmSyncStatusQuery.data?.status === 'running'}
                  >
                    {hrmSyncStatusQuery.data?.status === 'running'
                      ? 'Sync in progress…'
                      : "Sync last month's summaries"}
                  </Button>
                  {(hrmSyncStatusQuery.data?.status === 'failed' ||
                    hrmSyncStatusQuery.data?.status === 'running') && (
                    <Button
                      {...mt}
                      size="sm"
                      variant="outlined"
                      className="rounded-sm normal-case"
                      onClick={() => resumeHrmMutation.mutate()}
                      loading={resumeHrmMutation.isPending}
                      disabled={hrmSyncBlocked}
                    >
                      Resume
                    </Button>
                  )}
                  {hrmSyncStatusQuery.data?.status === 'running' ? (
                    <Button
                      {...mt}
                      size="sm"
                      variant="outlined"
                      className="rounded-sm normal-case text-red-700"
                      onClick={() => cancelHrmMutation.mutate()}
                      loading={cancelHrmMutation.isPending}
                    >
                      Cancel
                    </Button>
                  ) : null}
                  <Button
                    {...mt}
                    size="sm"
                    variant="outlined"
                    className="rounded-sm normal-case"
                    onClick={() => hrmExportPushMutation.mutate()}
                    loading={hrmExportPushMutation.isPending}
                    disabled={hrmSyncBlocked || !hrmAttendForm.export_push_enabled}
                  >
                    Push OOS clocks now
                  </Button>
                </div>
                {hrmSyncBlocked && hrmAttendForm.enabled && hrmNeedsProductionHost ? (
                  <p className="text-xs text-orange-700">
                    Save a non-localhost HRM base URL before running sync on this server.
                  </p>
                ) : null}
              </div>
            </SettingsSection>

            <SettingsSection
              title="Apache Doris analytics"
              description="OLAP read store for faster attendance, leave, and dashboard reports. Enabled by default. MySQL remains the system of record for all writes."
              accent="blue"
            >
              <div className="space-y-4">
                <div className="rounded-sm border border-ui-border bg-ui-subtle/80 p-3 text-sm text-ui-text">
                  <p>
                    Status:{' '}
                    <span className="font-semibold">
                      {analyticsStatus?.enabled
                        ? analyticsStatus.connected
                          ? 'Connected'
                          : 'Enabled but unreachable'
                        : 'Disabled'}
                    </span>
                  </p>
                  {analyticsStatus?.message ? (
                    <p className="mt-1 text-xs text-ui-muted">{analyticsStatus.message}</p>
                  ) : null}
                  {analyticsStatus?.database ? (
                    <p className="mt-1 text-xs text-ui-muted">Database: {analyticsStatus.database}</p>
                  ) : null}
                  {analyticsStatus?.last_sync_at ? (
                    <p className="mt-1 text-xs text-ui-muted">Last OLTP sync: {analyticsStatus.last_sync_at}</p>
                  ) : null}
                </div>
                {!analyticsStatus?.enabled ? (
                  <p className="text-xs text-ui-muted">
                    Analytics is disabled. Set <code className="text-[11px]">ANALYTICS_DB_ENABLED=true</code> on
                    the API (default) and start Doris with{' '}
                    <code className="text-[11px]">docker compose -f docker-compose.analytics.yml up -d</code>.
                    Dashboards fall back to MySQL when Doris is off or unreachable.
                  </p>
                ) : !analyticsStatus?.connected ? (
                  <p className="text-xs text-ui-muted">
                    Doris is enabled but not reachable yet. Start it with{' '}
                    <code className="text-[11px]">docker compose -f docker-compose.analytics.yml up -d</code>, then
                    sync OLTP data here. Dashboards keep using MySQL until the connection succeeds.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    <Button
                      {...mt}
                      size="sm"
                      variant="outlined"
                      className="rounded-sm normal-case"
                      onClick={() => dorisSyncMutation.mutate()}
                      loading={dorisSyncMutation.isPending}
                    >
                      Sync OLTP data to Doris
                    </Button>
                  </div>
                )}
              </div>
            </SettingsSection>

            <SettingsSection
              title="Google Maps"
              description="Powers Uber-style destination search on out-of-station forms. Restrict the API key to your site domain in Google Cloud Console."
              accent="green"
            >
              <div className="space-y-4">
                <Field>
                  <Input
                    {...mt}
                    label="Google Maps API key"
                    value={googleMapsForm.api_key}
                    onChange={(e) => setGoogleMapsForm((f) => ({ ...f, api_key: e.target.value }))}
                    placeholder="AIza..."
                  />
                </Field>
                <Field>
                  <Input
                    {...mt}
                    label="Country restriction (ISO codes)"
                    value={googleMapsForm.country_code}
                    onChange={(e) =>
                      setGoogleMapsForm((f) => ({ ...f, country_code: e.target.value.toLowerCase() }))
                    }
                    placeholder="ug"
                  />
                </Field>
                <p className="text-xs text-gray-500">
                  Use a two-letter ISO country code (e.g. <code className="text-[11px]">ug</code> for Uganda).
                  For multiple countries, separate with commas (e.g.{' '}
                  <code className="text-[11px]">ug,ke,tz</code>). Leave blank to search globally.
                </p>
                <p className="text-xs text-gray-500">
                  Enable <strong>Places API (New)</strong> for this key (legacy Places Autocomplete is not used).
                  Restrict the key by HTTP referrer to your PMS site. The key is exposed to signed-in users for destination lookup.
                </p>
                <Button
                  {...mt}
                  size="sm"
                  className="rounded-sm bg-moh-green normal-case"
                  onClick={() => saveDataSources.mutate()}
                  loading={saveDataSources.isPending}
                >
                  Save Google Maps settings
                </Button>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Out-of-station attendance"
              description="Accuracy score for clocks linked to an approved trip. Percentage is the default score; radius is used for the map geofence and scoring."
              accent="green"
            >
              <div className="space-y-4">
                <Field>
                  <Input
                    {...mt}
                    type="number"
                    label="Minimum accuracy to pass (%)"
                    value={String(oosAttendanceForm.min_accuracy_percent)}
                    onChange={(e) =>
                      setOosAttendanceForm((f) => ({
                        ...f,
                        min_accuracy_percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-ui-muted">
                    Clocks below this percentage (default 70%) are flagged as outside the destination geofence.
                  </p>
                </Field>
                <Field>
                  <Input
                    {...mt}
                    type="number"
                    label="Default geofence radius (meters)"
                    value={String(oosAttendanceForm.default_geofence_radius_meters)}
                    onChange={(e) =>
                      setOosAttendanceForm((f) => ({
                        ...f,
                        default_geofence_radius_meters: Math.max(1, Number(e.target.value) || 500),
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-ui-muted">
                    ≈ {(oosAttendanceForm.default_geofence_radius_meters / 1609.34).toFixed(2)} miles. Used when a
                    request has no radius set.
                  </p>
                </Field>
                <Button
                  {...mt}
                  size="sm"
                  className="rounded-sm bg-moh-green normal-case"
                  onClick={() => saveDataSources.mutate()}
                  loading={saveDataSources.isPending}
                >
                  Save OOS attendance settings
                </Button>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Duty-station attendance"
              description="Accuracy score for clocks at the employee duty station (personal pin or facility). Default pass mark is 90%."
              accent="green"
            >
              <div className="space-y-4">
                <Field>
                  <Input
                    {...mt}
                    type="number"
                    label="Minimum accuracy to pass (%)"
                    value={String(dutyStationAttendanceForm.min_accuracy_percent)}
                    onChange={(e) =>
                      setDutyStationAttendanceForm((f) => ({
                        ...f,
                        min_accuracy_percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-ui-muted">
                    Clocks below this percentage (default 90%) are flagged as outside the duty-station geofence.
                  </p>
                </Field>
                <Field>
                  <Input
                    {...mt}
                    type="number"
                    label="Default geofence radius (meters)"
                    value={String(dutyStationAttendanceForm.default_geofence_radius_meters)}
                    onChange={(e) =>
                      setDutyStationAttendanceForm((f) => ({
                        ...f,
                        default_geofence_radius_meters: Math.max(1, Number(e.target.value) || 500),
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-ui-muted">
                    ≈ {(dutyStationAttendanceForm.default_geofence_radius_meters / 1609.34).toFixed(2)} miles.
                    Used when the personal pin has no radius set.
                  </p>
                </Field>
                <Button
                  {...mt}
                  size="sm"
                  className="rounded-sm bg-moh-green normal-case"
                  onClick={() => saveDataSources.mutate()}
                  loading={saveDataSources.isPending}
                >
                  Save duty-station attendance settings
                </Button>
              </div>
            </SettingsSection>

            {canSyncIhris ? (
              <SettingsSection
                title="Sync status"
                description="Run a batched iHRIS import. HR-enriched fields are not overwritten by empty iHRIS values."
                className="lg:col-span-2"
              >
                <dl className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-sm border border-gray-100 bg-gray-50/80 px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-gray-500">Status</dt>
                    <dd className="mt-1 font-semibold capitalize text-ui-text">{sync?.status ?? 'idle'}</dd>
                  </div>
                  <div className="rounded-sm border border-gray-100 bg-gray-50/80 px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-gray-500">Progress</dt>
                    <dd className="mt-1 font-semibold text-ui-text">
                      Page {sync?.current_page ?? 0} / {sync?.total_pages ?? '—'} ({progress}%)
                    </dd>
                  </div>
                  <div className="rounded-sm border border-gray-100 bg-gray-50/80 px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-gray-500">Imported</dt>
                    <dd className="mt-1 font-semibold text-ui-text">{sync?.imported_records ?? 0}</dd>
                  </div>
                  <div className="rounded-sm border border-gray-100 bg-gray-50/80 px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-gray-500">Skipped</dt>
                    <dd className="mt-1 font-semibold text-ui-text">{sync?.skipped_records ?? 0}</dd>
                  </div>
                </dl>
                {sync?.last_error ? (
                  <div className="mb-4 rounded-sm bg-red-50 p-3 text-xs text-red-700">{sync.last_error}</div>
                ) : null}
                <div className="mb-6 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-moh-green transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    {...mt}
                    size="sm"
                    className="rounded-sm bg-uganda-black normal-case"
                    onClick={() => syncMutation.mutate()}
                    loading={syncMutation.isPending || sync?.status === 'running'}
                    disabled={sync?.status === 'running'}
                  >
                    {sync?.status === 'running' ? 'Sync in progress…' : 'Start iHRIS sync'}
                  </Button>
                  {(sync?.status === 'failed' || sync?.status === 'running' || sync?.has_more) && (
                    <Button
                      {...mt}
                      size="sm"
                      variant="outlined"
                      className="rounded-sm normal-case"
                      onClick={() => resumeIhrisMutation.mutate()}
                      loading={resumeIhrisMutation.isPending}
                    >
                      Resume
                    </Button>
                  )}
                  {sync?.status === 'running' ? (
                    <Button
                      {...mt}
                      size="sm"
                      variant="outlined"
                      className="rounded-sm normal-case text-red-700"
                      onClick={() => cancelIhrisMutation.mutate()}
                      loading={cancelIhrisMutation.isPending}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  Sync runs on the server (also scheduled daily at 03:00). You can leave this page.
                </p>
              </SettingsSection>
            ) : null}
          </div>
        </QueryState>
      ) : null}

      {activeTab === 'email' && canEmail ? (
        <SettingsSection
          title="Email configuration"
          description="SMTP or Microsoft Exchange for system notifications and reminders."
          className="w-full"
        >
          <div className="space-y-6">
            <Field>
              <Select
                {...mt}
                label="Mail driver"
                value={emailForm.driver}
                onChange={(v) => v && setEmailForm((f) => ({ ...f, driver: v }))}
              >
                <Option value="smtp">SMTP (default)</Option>
                <Option value="exchange">Microsoft Exchange</Option>
              </Select>
            </Field>

            {emailForm.driver === 'smtp' ? (
              <div className="grid gap-x-6 gap-y-8 md:grid-cols-2">
                <Field>
                  <Input
                    {...mt}
                    label="SMTP host"
                    value={emailForm.smtp.host}
                    onChange={(e) =>
                      setEmailForm((f) => ({ ...f, smtp: { ...f.smtp, host: e.target.value } }))
                    }
                  />
                </Field>
                <Field>
                  <Input
                    {...mt}
                    label="Port"
                    value={emailForm.smtp.port}
                    onChange={(e) =>
                      setEmailForm((f) => ({ ...f, smtp: { ...f.smtp, port: e.target.value } }))
                    }
                  />
                </Field>
                <Field>
                  <Input
                    {...mt}
                    label="Username"
                    value={emailForm.smtp.username}
                    onChange={(e) =>
                      setEmailForm((f) => ({ ...f, smtp: { ...f.smtp, username: e.target.value } }))
                    }
                  />
                </Field>
                <Field>
                  <Input
                    {...mt}
                    label="Password"
                    type="password"
                    value={emailForm.smtp.password}
                    onChange={(e) =>
                      setEmailForm((f) => ({ ...f, smtp: { ...f.smtp, password: e.target.value } }))
                    }
                  />
                </Field>
                <Field>
                  <Input
                    {...mt}
                    label="From address"
                    value={emailForm.smtp.from_address}
                    onChange={(e) =>
                      setEmailForm((f) => ({
                        ...f,
                        smtp: { ...f.smtp, from_address: e.target.value },
                      }))
                    }
                  />
                </Field>
                <Field>
                  <Input
                    {...mt}
                    label="From name"
                    value={emailForm.smtp.from_name}
                    onChange={(e) =>
                      setEmailForm((f) => ({
                        ...f,
                        smtp: { ...f.smtp, from_name: e.target.value },
                      }))
                    }
                  />
                </Field>
                <Field>
                  <Select
                    {...mt}
                    label="Encryption"
                    value={emailForm.smtp.encryption || 'tls'}
                    onChange={(v) =>
                      v && setEmailForm((f) => ({ ...f, smtp: { ...f.smtp, encryption: v } }))
                    }
                  >
                    <Option value="tls">TLS</Option>
                    <Option value="ssl">SSL</Option>
                    <Option value="none">None</Option>
                  </Select>
                </Field>
              </div>
            ) : (
              <div className="grid gap-x-6 gap-y-8 md:grid-cols-2">
                <Field>
                  <Input
                    {...mt}
                    label="Exchange host"
                    value={emailForm.exchange.host}
                    onChange={(e) =>
                      setEmailForm((f) => ({
                        ...f,
                        exchange: { ...f.exchange, host: e.target.value },
                      }))
                    }
                  />
                </Field>
                <Field>
                  <Input
                    {...mt}
                    label="Username"
                    value={emailForm.exchange.username}
                    onChange={(e) =>
                      setEmailForm((f) => ({
                        ...f,
                        exchange: { ...f.exchange, username: e.target.value },
                      }))
                    }
                  />
                </Field>
                <Field>
                  <Input
                    {...mt}
                    label="Password"
                    type="password"
                    value={emailForm.exchange.password}
                    onChange={(e) =>
                      setEmailForm((f) => ({
                        ...f,
                        exchange: { ...f.exchange, password: e.target.value },
                      }))
                    }
                  />
                </Field>
                <Field>
                  <Input
                    {...mt}
                    label="From address"
                    value={emailForm.exchange.from_address}
                    onChange={(e) =>
                      setEmailForm((f) => ({
                        ...f,
                        exchange: { ...f.exchange, from_address: e.target.value },
                      }))
                    }
                  />
                </Field>
                <Field>
                  <Input
                    {...mt}
                    label="From name"
                    value={emailForm.exchange.from_name}
                    onChange={(e) =>
                      setEmailForm((f) => ({
                        ...f,
                        exchange: { ...f.exchange, from_name: e.target.value },
                      }))
                    }
                  />
                </Field>
              </div>
            )}

            <Button
              {...mt}
              size="sm"
              className="rounded-sm bg-moh-green normal-case"
              onClick={() => saveEmail.mutate()}
              loading={saveEmail.isPending}
            >
              Save email settings
            </Button>
          </div>
        </SettingsSection>
      ) : null}

      {activeTab === 'notifications' && canNotifications ? (
        <QueryState
          isLoading={settingsQuery.isLoading}
          isError={settingsQuery.isError}
          error={settingsQuery.error}
          label="notification settings"
          variant="form"
          onRetry={() => settingsQuery.refetch()}
        >
          <div className="w-full space-y-5">
            <p className="text-sm text-gray-600">
              Reminder types configured for leave, performance plans, and approvals. Use the test action
              below to trigger a send cycle without waiting for the scheduler.
            </p>
            {settingsQuery.data?.notifications
              ? Object.entries(settingsQuery.data.notifications).map(([key, cfg]) => (
                  <Card
                    key={key}
                    {...mt}
                    className="rounded-sm border border-moh-green/15 p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <Typography {...mt} className="text-sm font-bold capitalize text-moh-green">
                          {key.replace(/_/g, ' ')}
                        </Typography>
                        <p className="mt-2 text-sm leading-relaxed text-gray-600">{cfg.description}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                            Remind {cfg.days_before} day(s) before deadline
                          </span>
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-1 text-xs font-medium',
                              cfg.enabled
                                ? 'bg-moh-green/10 text-moh-green'
                                : 'bg-gray-100 text-gray-500',
                            )}
                          >
                            {cfg.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              : null}
            <div className="pt-2">
              <Button
                {...mt}
                size="sm"
                variant="outlined"
                className="rounded-sm border-moh-green normal-case text-moh-green"
                onClick={() => sendReminders.mutate()}
                loading={sendReminders.isPending}
              >
                Send reminders now (test)
              </Button>
            </div>
            {sendReminders.data ? (
              <pre className="overflow-x-auto rounded-sm border border-gray-200 bg-moh-background p-4 text-xs">
                {JSON.stringify(sendReminders.data, null, 2)}
              </pre>
            ) : null}
          </div>
        </QueryState>
      ) : null}

      {activeTab === 'performance' && canPerformance ? (
        <QueryState
          isLoading={performanceSettingsQuery.isLoading}
          isError={performanceSettingsQuery.isError}
          error={performanceSettingsQuery.error}
          label="performance reporting settings"
          variant="form"
          onRetry={() => performanceSettingsQuery.refetch()}
        >
          <div className="grid w-full gap-6 lg:grid-cols-2">
            <SettingsSection
              title="Reporting windows"
              description="MoH practice: each quarterly report opens in the first weeks of the following quarter (e.g. Q1 report in Q2). Use test override to open all periods while testing."
            >
              <div className="space-y-6">
                <ToggleRow
                  label="Enforce submission windows"
                  hint="When off, staff can report any time"
                  checked={performanceForm.enforce_windows}
                  onChange={(checked) =>
                    setPerformanceForm((f) => ({ ...f, enforce_windows: checked }))
                  }
                />
                <ToggleRow
                  label="Test override (open all periods)"
                  hint="Recommended on while testing the system"
                  checked={performanceForm.test_override}
                  onChange={(checked) =>
                    setPerformanceForm((f) => ({ ...f, test_override: checked }))
                  }
                  highlight
                />
                <div className="grid gap-x-6 gap-y-8 md:grid-cols-2">
                  <Field>
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
                  </Field>
                  <Field>
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
                  </Field>
                </div>
                <Button
                  {...mt}
                  size="sm"
                  className="rounded-sm bg-moh-green normal-case"
                  onClick={() => savePerformanceSettings.mutate()}
                  loading={savePerformanceSettings.isPending}
                >
                  Save reporting configuration
                </Button>
              </div>
            </SettingsSection>

            <SettingsSection
              title={`Computed windows · ${performanceSettingsQuery.data?.financial_year ?? 'current FY'}`}
            >
              <div className="space-y-3">
                {(performanceSettingsQuery.data?.windows ?? []).map((w) => (
                  <div
                    key={w.phase}
                    className="rounded-sm border border-gray-100 bg-moh-background/50 px-4 py-3.5 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-ui-text">{w.label}</span>
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
                    <p className="mt-1.5 text-xs text-gray-600">Coverage: {w.coverage_period}</p>
                    <p className="mt-1 text-xs text-gray-500">{w.reporting_window}</p>
                  </div>
                ))}
              </div>
            </SettingsSection>
          </div>
        </QueryState>
      ) : null}

      {activeTab === 'kpi' && canKpiSettings ? (
        <QueryState
          isLoading={kpiPermissionsQuery.isLoading}
          isError={kpiPermissionsQuery.isError}
          error={kpiPermissionsQuery.error}
          label="KPI permissions"
          variant="table"
          onRetry={() => kpiPermissionsQuery.refetch()}
        >
          <SettingsSection
            title="KPI Management"
            description="Configure the national KPI catalog and assign indicators to jobs, departments, and individual staff. Administrators have full access; HR officers receive these permissions by default and can be adjusted in Access Control."
            className="w-full"
          >
            <div className="mb-6 space-y-2">
              {(kpiPermissionsQuery.data?.permissions ?? []).map((p) => (
                <div
                  key={p.code}
                  className="flex items-center justify-between border-b border-gray-100 py-3 text-sm"
                >
                  <span>{p.name}</span>
                  <span className={hasPermission(p.code) ? 'text-moh-green' : 'text-gray-400'}>
                    {hasPermission(p.code) ? 'Granted' : '—'}
                  </span>
                </div>
              ))}
            </div>
            <Link to="/admin/kpi">
              <Button {...mt} size="sm" className="rounded-sm bg-moh-green normal-case">
                Open KPI Management
              </Button>
            </Link>
          </SettingsSection>
        </QueryState>
      ) : null}
    </div>
  )
}
