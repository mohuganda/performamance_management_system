package routes

import (
	"github.com/goravel/framework/contracts/route"

	"goravel/app/facades"
	"goravel/app/http/controllers"
	"goravel/app/middleware"
)

func Api() {
	health := controllers.NewHealthController()
	configController := controllers.NewConfigController()
	ihrisController := controllers.NewIhrisController()
	settingsAdminController := controllers.NewSettingsAdminController()
	notificationsAdminController := controllers.NewNotificationsAdminController()
	dashboardController := controllers.NewDashboardController()
	mobileController := controllers.NewMobileController()
	leaveAdminController := controllers.NewLeaveAdminController()
	performanceAdminController := controllers.NewPerformanceAdminController()
	authController := controllers.NewAuthController()
	rbacAdminController := controllers.NewRbacAdminController()
	notificationController := controllers.NewNotificationController()
	kpiAdminController := controllers.NewKpiAdminController()

	authenticate := &middleware.Authenticate{}

	facades.Route().Prefix("api/v1").Group(func(router route.Router) {
		router.Get("/health", health.Check)
		router.Get("/config", configController.Show)
		router.Post("/auth/login", authController.Login)

		router.Middleware(authenticate).Group(func(auth route.Router) {
			auth.Post("/auth/logout", authController.Logout)
			auth.Get("/auth/me", authController.Me)
			auth.Put("/auth/profile", authController.UpdateProfile)
			auth.Post("/auth/refresh", authController.Refresh)
			auth.Post("/auth/change-password", authController.ChangePassword)

			auth.Get("/notifications", notificationController.List)
			auth.Get("/notifications/unread-count", notificationController.UnreadCount)
			auth.Post("/notifications/read-all", notificationController.MarkAllRead)
			auth.Post("/notifications/{id}/read", notificationController.MarkRead)

			auth.Middleware(middleware.Permission("ihris.sync")).Post("/ihris/sync", ihrisController.Sync)
			auth.Middleware(middleware.Permission("ihris.sync")).Get("/ihris/sync/status", ihrisController.Status)

			auth.Middleware(middleware.Permission("settings.manage")).Get("admin/settings", settingsAdminController.Show)
			auth.Prefix("admin/settings").Middleware(middleware.Permission("settings.manage")).Group(func(settings route.Router) {
				settings.Put("/", settingsAdminController.Update)
			})

			auth.Prefix("admin/notifications").Middleware(middleware.Permission("settings.manage")).Group(func(notifications route.Router) {
				notifications.Post("/send-reminders", notificationsAdminController.SendReminders)
			})

			auth.Prefix("dashboard").Group(func(dashboard route.Router) {
				dashboard.Middleware(middleware.Permission("dashboard.staff")).Get("/health-worker", dashboardController.HealthWorker)
				dashboard.Middleware(middleware.Permission("dashboard.supervisor")).Get("/supervisor", dashboardController.Supervisor)
				dashboard.Middleware(middleware.Permission("dashboard.department_head")).Get("/department-head", dashboardController.DepartmentHead)
				dashboard.Middleware(middleware.Permission("dashboard.hr", "dashboard.director", "dashboard.executive")).Get("/hr-manager", dashboardController.HRManager)
			})

			auth.Prefix("admin/leave").Middleware(middleware.Permission("leave.config.manage")).Group(func(admin route.Router) {
				admin.Get("/overview", leaveAdminController.Overview)
				admin.Get("/balances", leaveAdminController.ListBalances)
				admin.Post("/balances/initialize-year", leaveAdminController.InitializeYearBalances)
				admin.Patch("/staff/{staffId}/balances", leaveAdminController.AdjustBalance)
				admin.Get("/requests", leaveAdminController.ListRequests)
				admin.Post("/requests/{id}/finalize", leaveAdminController.FinalizeRequest)
				admin.Get("/staff/{staffId}/statement", leaveAdminController.StaffStatement)
				admin.Get("/departments", leaveAdminController.ListDepartments)
				admin.Get("/settings", leaveAdminController.ShowSettings)
				admin.Put("/settings", leaveAdminController.UpdateSettings)
				admin.Get("/types", leaveAdminController.ListTypes)
				admin.Post("/types", leaveAdminController.CreateType)
				admin.Put("/types/{id}", leaveAdminController.UpdateType)
				admin.Delete("/types/{id}", leaveAdminController.DeactivateType)
				admin.Get("/entitlements", leaveAdminController.ListEntitlements)
				admin.Post("/entitlements", leaveAdminController.CreateEntitlement)
				admin.Put("/entitlements/{id}", leaveAdminController.UpdateEntitlement)
				admin.Delete("/entitlements/{id}", leaveAdminController.DeleteEntitlement)
				admin.Get("/approval-stages", leaveAdminController.ListApprovalStages)
				admin.Post("/approval-stages", leaveAdminController.CreateApprovalStage)
				admin.Put("/approval-stages/{id}", leaveAdminController.UpdateApprovalStage)
			})

			auth.Prefix("admin/performance").Middleware(middleware.Permission("settings.manage")).Group(func(admin route.Router) {
				admin.Get("/settings", performanceAdminController.ShowSettings)
				admin.Put("/settings", performanceAdminController.UpdateSettings)
			})

			auth.Prefix("admin/rbac").Middleware(middleware.Permission("auth.roles.manage")).Group(func(rbac route.Router) {
				rbac.Get("/scope-options", rbacAdminController.ListScopeOptions)
				rbac.Get("/roles", rbacAdminController.ListRoles)
				rbac.Get("/permissions", rbacAdminController.ListPermissions)
				rbac.Get("/users", rbacAdminController.ListUsers)
				rbac.Post("/users", rbacAdminController.CreateUser)
				rbac.Patch("/users/{id}", rbacAdminController.UpdateUser)
				rbac.Post("/users/{id}/roles", rbacAdminController.AssignUserRole)
				rbac.Delete("/users/{id}/roles", rbacAdminController.RevokeUserRole)
				rbac.Get("/audit-logs", rbacAdminController.ListAuditLogs)
				rbac.Post("/audit-logs/{id}/recover", rbacAdminController.RecoverAuditLog)
				rbac.Post("/roles/{id}/scopes", rbacAdminController.SetRoleScope)
				rbac.Post("/grant-permission", rbacAdminController.GrantRolePermission)
			})

			auth.Prefix("admin/kpi").Group(func(kpi route.Router) {
				kpi.Middleware(middleware.Permission("kpi.catalog.view", "kpi.assignments.view")).Get("/permissions", kpiAdminController.PermissionCatalog)
				kpi.Middleware(middleware.Permission("kpi.catalog.view", "kpi.assignments.view")).Get("/subject-areas", kpiAdminController.ListSubjectAreas)
				kpi.Middleware(middleware.Permission("kpi.catalog.view")).Get("/categories", kpiAdminController.ListCategories)
				kpi.Middleware(middleware.Permission("kpi.catalog.view")).Get("/kpis", kpiAdminController.ListKpis)
				kpi.Middleware(middleware.Permission("kpi.catalog.view")).Get("/kpis/{id}", kpiAdminController.ShowKpi)
				kpi.Middleware(middleware.Permission("kpi.catalog.manage")).Post("/kpis", kpiAdminController.CreateKpi)
				kpi.Middleware(middleware.Permission("kpi.catalog.manage")).Put("/kpis/{id}", kpiAdminController.UpdateKpi)
				kpi.Middleware(middleware.Permission("kpi.catalog.manage")).Delete("/kpis/{id}", kpiAdminController.DeactivateKpi)
				kpi.Middleware(middleware.Permission("kpi.assignments.view")).Get("/assignments", kpiAdminController.ListAssignments)
				kpi.Middleware(middleware.Permission("kpi.assignments.manage")).Post("/assignments", kpiAdminController.CreateAssignment)
				kpi.Middleware(middleware.Permission("kpi.assignments.manage")).Delete("/assignments/{id}", kpiAdminController.DeactivateAssignment)
				kpi.Middleware(middleware.Permission("kpi.assignments.view", "kpi.assignments.manage")).Get("/jobs", kpiAdminController.ListJobs)
				kpi.Middleware(middleware.Permission("kpi.assignments.view", "kpi.assignments.manage")).Get("/departments", kpiAdminController.ListDepartments)
				kpi.Middleware(middleware.Permission("kpi.assignments.manage")).Get("/staff-search", kpiAdminController.SearchStaff)
			})

			auth.Prefix("mobile").Group(func(mobile route.Router) {
				mobile.Middleware(middleware.Permission("leave.requests.view")).Get("/leave/config", mobileController.LeaveConfig)
				mobile.Middleware(middleware.Permission("leave.requests.view")).Get("/leave/types", mobileController.ListLeaveTypes)
				mobile.Middleware(middleware.Permission("leave.requests.view")).Get("/leave/balances", mobileController.ListLeaveBalances)
				mobile.Middleware(middleware.Permission("leave.requests.view")).Get("/leave/requests", mobileController.ListLeaveRequests)
				mobile.Middleware(middleware.Permission("leave.requests.create")).Post("/leave/requests", mobileController.CreateLeaveRequest)
				mobile.Middleware(middleware.Permission("leave.requests.approve")).Post("/leave/approvals/{id}", mobileController.ApproveLeave)
				mobile.Middleware(middleware.Permission("leave.requests.approve")).Get("/leave/pending-approvals", mobileController.ListPendingLeaveApprovals)

				mobile.Middleware(middleware.Permission("oos.requests.view")).Get("/out-of-station/reasons", mobileController.ListOosReasons)
				mobile.Middleware(middleware.Permission("oos.requests.view")).Get("/out-of-station/requests", mobileController.ListOosRequests)
				mobile.Middleware(middleware.Permission("oos.requests.create")).Post("/out-of-station/requests", mobileController.CreateOosRequest)
				mobile.Middleware(middleware.Permission("oos.requests.approve")).Post("/out-of-station/approvals/{id}", mobileController.ApproveOos)
				mobile.Middleware(middleware.Permission("oos.requests.approve")).Get("/out-of-station/pending-approvals", mobileController.ListPendingOosApprovals)

				mobile.Middleware(middleware.Permission("attendance.clock")).Post("/attendance/clock", mobileController.Clock)
				mobile.Middleware(middleware.Permission("attendance.view")).Get("/attendance/clocks", mobileController.ListAttendance)

				mobile.Middleware(middleware.Permission("performance.view")).Get("/performance/summary", mobileController.PerformanceSummary)
				mobile.Middleware(middleware.Permission("performance.view")).Get("/performance/windows", mobileController.PerformanceWindows)
				mobile.Middleware(middleware.Permission("performance.view")).Get("/performance/kpis", mobileController.ListPerformanceKpis)
				mobile.Middleware(middleware.Permission("performance.view")).Get("/performance/kpis/grouped", mobileController.ListPerformanceKpisGrouped)
				mobile.Middleware(middleware.Permission("performance.view")).Get("/performance/report-form", mobileController.PerformanceReportForm)
				mobile.Middleware(middleware.Permission("performance.view")).Post("/performance/ppa", mobileController.SavePerformancePlan)
				mobile.Middleware(middleware.Permission("performance.view")).Post("/performance/ppa/submit", mobileController.SubmitPerformancePlan)
				mobile.Middleware(middleware.Permission("performance.view")).Post("/performance/reports", mobileController.SubmitPerformanceReport)
			})

			staffAdminController := controllers.NewStaffAdminController()
			staffPerm := middleware.Permission("auth.users.manage")
			auth.Middleware(staffPerm).Get("admin/staff", staffAdminController.ListStaff)
			auth.Prefix("admin/staff").Middleware(staffPerm).Group(func(staff route.Router) {
				staff.Get("/departments", staffAdminController.ListDepartments)
				staff.Patch("/{id}/hr-profile", staffAdminController.UpdateHrProfile)
				staff.Get("/{id}/supervisors", staffAdminController.GetStaffSupervisors)
				staff.Put("/{id}/supervisors", staffAdminController.SetStaffSupervisors)
				staff.Get("/supervision", staffAdminController.ListSupervision)
				staff.Get("/supervisor-candidates", staffAdminController.ListSupervisorCandidates)
				staff.Post("/supervision", staffAdminController.AssignSupervisor)
				staff.Delete("/supervision/{staffId}", staffAdminController.RemoveSupervisor)
			})
		})
	})
}
