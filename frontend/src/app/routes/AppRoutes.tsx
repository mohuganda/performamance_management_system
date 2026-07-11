import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/stores/appStore'
import { redirectToLogin } from '@/utils/authRedirect'
import { getTokenExpiryMs } from '@/utils/jwt'
import { AppLayout } from '@/components/templates/AppLayout'
import { Card } from '@/components/atoms/Card'
import { DashboardPageSkeleton } from '@/components/molecules/PageSkeletons'
import { DashboardErrorBoundary } from '@/components/organisms/DashboardErrorBoundary'
import { HealthWorkerDashboard } from '@/modules/dashboard/HealthWorkerDashboard'
import { SupervisorDashboard } from '@/modules/dashboard/SupervisorDashboard'
import { DepartmentHeadDashboard } from '@/modules/dashboard/DepartmentHeadDashboard'
import { HRManagerDashboard } from '@/modules/dashboard/HRManagerDashboard'
import { LoginPage } from '@/modules/auth/LoginPage'
import { LeavePage } from '@/modules/leave/LeavePage'
import { OutOfStationPage } from '@/modules/out-of-station/OutOfStationPage'
import { AttendancePage } from '@/modules/attendance/AttendancePage'
import { PerformancePage } from '@/modules/performance/PerformancePage'
import { PerformanceReportsPage } from '@/modules/performance/PerformanceReportsPage'
import { ProfilePage } from '@/modules/profile/ProfilePage'
import { NotificationsPage } from '@/modules/notifications/NotificationsPage'
import { SettingsPage } from '@/modules/settings/SettingsPage'
import { LeaveAdminPage } from '@/modules/admin/LeaveAdminPage'
import { StaffManagementPage } from '@/modules/admin/StaffManagementPage'
import { RbacAdminPage } from '@/modules/admin/RbacAdminPage'
import { KpiAdminPage } from '@/modules/admin/KpiAdminPage'
import { SystemConfigPage } from '@/modules/admin/SystemConfigPage'

function DashboardRouter() {
  const { hasPermission } = useAuthStore()

  const canView = hasPermission([
    'dashboard.staff',
    'dashboard.supervisor',
    'dashboard.department_head',
    'dashboard.hr',
    'dashboard.director',
    'dashboard.executive',
  ])

  if (!canView) {
    return (
      <Card className="m-4 md:m-6">
        <p className="font-semibold text-ui-text">Dashboard unavailable</p>
        <p className="mt-2 text-sm text-ui-muted">
          Your account does not have a dashboard permission assigned. Contact your administrator.
        </p>
      </Card>
    )
  }

  if (hasPermission(['dashboard.hr', 'dashboard.director', 'dashboard.executive'])) {
    return (
      <DashboardErrorBoundary label="HR dashboard">
        <HRManagerDashboard />
      </DashboardErrorBoundary>
    )
  }
  if (hasPermission('dashboard.department_head')) {
    return (
      <DashboardErrorBoundary label="Department dashboard">
        <DepartmentHeadDashboard />
      </DashboardErrorBoundary>
    )
  }
  if (hasPermission('dashboard.supervisor')) {
    return (
      <DashboardErrorBoundary label="Supervisor dashboard">
        <SupervisorDashboard />
      </DashboardErrorBoundary>
    )
  }
  return (
    <DashboardErrorBoundary label="Staff dashboard">
      <HealthWorkerDashboard />
    </DashboardErrorBoundary>
  )
}

function RequirePermission({
  permission,
  children,
}: {
  permission?: string | string[]
  children: React.ReactNode
}) {
  const { hasPermission } = useAuthStore()
  if (!permission) return <>{children}</>
  if (!hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function AuthenticatedApp() {
  const { refreshProfile } = useAuthStore()

  useEffect(() => {
    refreshProfile().catch(() => {
      // keep cached session if profile refresh fails
    })
  }, [refreshProfile])

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardRouter />} />
        <Route path="performance" element={<PerformancePage />} />
        <Route path="performance/reports" element={<PerformanceReportsPage />} />
        <Route
          path="leave"
          element={
            <RequirePermission permission="leave.requests.view">
              <LeavePage />
            </RequirePermission>
          }
        />
        <Route
          path="out-of-station"
          element={
            <RequirePermission permission="oos.requests.view">
              <OutOfStationPage />
            </RequirePermission>
          }
        />
        <Route
          path="attendance"
          element={
            <RequirePermission permission={['attendance.view', 'attendance.clock']}>
              <AttendancePage />
            </RequirePermission>
          }
        />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="admin/leave"
          element={
            <RequirePermission permission={['leave.config.manage', 'leave.workflow.manage']}>
              <LeaveAdminPage />
            </RequirePermission>
          }
        />
        <Route
          path="admin/staff"
          element={
            <RequirePermission permission="auth.users.manage">
              <StaffManagementPage />
            </RequirePermission>
          }
        />
        <Route
          path="admin/supervision"
          element={<Navigate to="/admin/staff" replace />}
        />
        <Route
          path="admin/system"
          element={
            <RequirePermission
              permission={[
                'settings.manage',
                'settings.data_sources.manage',
              ]}
            >
              <SystemConfigPage />
            </RequirePermission>
          }
        />
        <Route
          path="admin/kpi"
          element={
            <RequirePermission
              permission={[
                'kpi.catalog.view',
                'kpi.catalog.manage',
                'kpi.assignments.view',
                'kpi.assignments.manage',
              ]}
            >
              <KpiAdminPage />
            </RequirePermission>
          }
        />
        <Route
          path="admin/rbac"
          element={
            <RequirePermission permission="auth.roles.manage">
              <RbacAdminPage />
            </RequirePermission>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

export function AppRoutes() {
  const { isAuthenticated, token, authReady, hydrateToken, clearSession } = useAuthStore()

  useEffect(() => {
    hydrateToken()
  }, [hydrateToken])

  useEffect(() => {
    if (!authReady || !token) return
    const expiresAt = getTokenExpiryMs(token)
    if (expiresAt != null && expiresAt <= Date.now()) {
      clearSession()
      redirectToLogin()
    }
  }, [authReady, token, clearSession])

  if (!authReady) {
    return (
      <div className="min-h-screen bg-moh-background">
        <DashboardPageSkeleton />
      </div>
    )
  }

  const signedIn = isAuthenticated && Boolean(token)

  return (
    <Routes>
      <Route
        path="/login"
        element={signedIn ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/*"
        element={signedIn ? <AuthenticatedApp /> : <Navigate to="/login" replace />}
      />
    </Routes>
  )
}
