package controllers

// Supplemental OpenAPI documentation for routes not yet annotated on handlers.
// Regenerate: cd backend && swag init --parseDependency --parseInternal

// swaggerHealth godoc
// @Summary      API health check
// @Description  Returns service status. No authentication required.
// @Tags         system
// @Produce      json
// @Success      200 {object} map[string]any
// @Router       /api/v1/health [get]
func swaggerHealth() {}

// swaggerPublicConfig godoc
// @Summary      Public client configuration
// @Description  Branding and client-safe settings for the web app.
// @Tags         system
// @Produce      json
// @Success      200 {object} map[string]any
// @Router       /api/v1/config [get]
func swaggerPublicConfig() {}

// swaggerApprovalsInbox godoc
// @Summary      Unified approvals inbox
// @Description  Pending leave, out-of-station, PPA, and appraisal items for the signed-in approver. Requires a linked staff record.
// @Tags         approvals
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any "items, stats (counts and average approval time)"
// @Failure      403 {object} map[string]any "User not linked to staff"
// @Router       /api/v1/mobile/approvals/inbox [get]
func swaggerApprovalsInbox() {}

// swaggerDashboardHealthWorker godoc
// @Summary      Staff dashboard
// @Tags         dashboard
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/dashboard/health-worker [get]
func swaggerDashboardHealthWorker() {}

// swaggerDashboardSupervisor godoc
// @Summary      Supervisor dashboard
// @Tags         dashboard
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/dashboard/supervisor [get]
func swaggerDashboardSupervisor() {}

// swaggerDashboardDepartmentHead godoc
// @Summary      Department head dashboard
// @Tags         dashboard
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/dashboard/department-head [get]
func swaggerDashboardDepartmentHead() {}

// swaggerDashboardHR godoc
// @Summary      HR / director / executive dashboard
// @Tags         dashboard
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/dashboard/hr-manager [get]
func swaggerDashboardHR() {}

// swaggerIhrisSync godoc
// @Summary      Trigger iHRIS staff sync
// @Tags         integrations
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body body object false "Optional batch options (run_id, start_page, pages_per_batch)"
// @Success      200 {object} map[string]any
// @Router       /api/v1/ihris/sync [post]
func swaggerIhrisSync() {}

// swaggerIhrisSyncStatus godoc
// @Summary      iHRIS sync run status
// @Tags         integrations
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/ihris/sync/status [get]
func swaggerIhrisSyncStatus() {}

// swaggerAnalyticsStatus godoc
// @Summary      Analytics (Doris) connection status
// @Tags         integrations
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/analytics/status [get]
func swaggerAnalyticsStatus() {}

// swaggerAnalyticsSync godoc
// @Summary      Sync analytics warehouse
// @Tags         integrations
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/analytics/doris/sync [post]
func swaggerAnalyticsSync() {}

// swaggerHrmAttendSync godoc
// @Summary      Sync HRM attendance feed
// @Tags         integrations
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/hrm-attend/sync [post]
func swaggerHrmAttendSync() {}

// swaggerAdminSettingsShow godoc
// @Summary      Get system settings
// @Tags         admin-settings
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/settings [get]
func swaggerAdminSettingsShow() {}

// swaggerAdminSettingsUpdate godoc
// @Summary      Update system settings group
// @Tags         admin-settings
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body body object true "group + payload"
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/settings [put]
func swaggerAdminSettingsUpdate() {}

// swaggerAdminNotificationsReminders godoc
// @Summary      Send configured notification reminders
// @Tags         admin-settings
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/notifications/send-reminders [post]
func swaggerAdminNotificationsReminders() {}

// swaggerLeaveAdminOverview godoc
// @Summary      Leave admin overview metrics
// @Tags         admin-leave
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/leave/overview [get]
func swaggerLeaveAdminOverview() {}

// swaggerLeaveAdminBalances godoc
// @Summary      List staff leave balances
// @Tags         admin-leave
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/leave/balances [get]
func swaggerLeaveAdminBalances() {}

// swaggerLeaveAdminRequests godoc
// @Summary      List leave requests (admin)
// @Tags         admin-leave
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/leave/requests [get]
func swaggerLeaveAdminRequests() {}

// swaggerLeaveAdminFinalize godoc
// @Summary      HR finalize approved leave request
// @Description  Moves a fully approved request to finalized status. Requires leave.config.manage.
// @Tags         admin-leave
// @Produce      json
// @Security     BearerAuth
// @Param        id path int true "Leave request ID"
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/leave/requests/{id}/finalize [post]
func swaggerLeaveAdminFinalize() {}

// swaggerPerformanceAdminSettings godoc
// @Summary      Performance reporting settings
// @Tags         admin-performance
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/performance/settings [get]
func swaggerPerformanceAdminSettings() {}

// swaggerListsSummary godoc
// @Summary      Org catalog summary counts
// @Tags         admin-lists
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/lists/summary [get]
func swaggerListsSummary() {}

// swaggerListsRefreshCatalog godoc
// @Summary      Refresh facility/institution type catalog from facilities
// @Tags         admin-lists
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/lists/refresh-catalog [post]
func swaggerListsRefreshCatalog() {}

// swaggerListsFacilities godoc
// @Summary      List facilities (paginated)
// @Tags         admin-lists
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/lists/facilities [get]
func swaggerListsFacilities() {}

// swaggerListsDepartments godoc
// @Summary      List departments
// @Tags         admin-lists
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/lists/departments [get]
func swaggerListsDepartments() {}

// swaggerKpiList godoc
// @Summary      List KPI catalog
// @Tags         admin-kpi
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/kpi/kpis [get]
func swaggerKpiList() {}

// swaggerKpiAssignments godoc
// @Summary      List KPI assignments
// @Tags         admin-kpi
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/kpi/assignments [get]
func swaggerKpiAssignments() {}

// swaggerKpiAssignmentTargets godoc
// @Summary      Assignable targets for KPI mapping
// @Description  Facility types, facilities, departments (with facility type context), and job titles.
// @Tags         admin-kpi
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/kpi/assignment-targets [get]
func swaggerKpiAssignmentTargets() {}

// swaggerKpiCreateAssignment godoc
// @Summary      Create KPI assignment(s)
// @Description  Assign one or more KPIs to facility_type, facility, department, job, or staff.
// @Tags         admin-kpi
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body body object true "kpi_ids, assignable_type, target ids"
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/kpi/assignments [post]
func swaggerKpiCreateAssignment() {}

// swaggerStaffList godoc
// @Summary      Staff directory (paginated)
// @Tags         admin-staff
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/staff [get]
func swaggerStaffList() {}

// swaggerStaffHrProfile godoc
// @Summary      Update staff HR profile
// @Description  HR department override, contact fields, leave management flag (is_leave_manager).
// @Tags         admin-staff
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id path int true "Staff ID"
// @Param        body body object true "hr_department_id, hr_email, is_leave_manager, etc."
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/staff/{id}/hr-profile [patch]
func swaggerStaffHrProfile() {}

// swaggerStaffSupervisors godoc
// @Summary      Set supervisor chain (up to 3)
// @Tags         admin-staff
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id path int true "Staff ID"
// @Param        body body object true "supervisors: [{sequence, supervisor_staff_id}]"
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/staff/{id}/supervisors [put]
func swaggerStaffSupervisors() {}

// swaggerMobilePpaReview godoc
// @Summary      Review submitted PPA
// @Tags         mobile-performance
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body body object true "ppa_id, approve, comments"
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/performance/ppa/review [post]
func swaggerMobilePpaReview() {}

// swaggerMobilePerformanceWindows godoc
// @Summary      Current performance reporting windows
// @Tags         mobile-performance
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/performance/windows [get]
func swaggerMobilePerformanceWindows() {}

// swaggerMobilePerformanceKpisGrouped godoc
// @Summary      Assigned KPIs grouped by function
// @Tags         mobile-performance
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/performance/kpis/grouped [get]
func swaggerMobilePerformanceKpisGrouped() {}
