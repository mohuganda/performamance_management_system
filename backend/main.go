package main

import (
	_ "goravel/docs"

	"goravel/bootstrap"
)

// @title           MoH Uganda PMS API
// @version         1.0
// @description     Ministry of Health Uganda — Performance Management System (iHRIS-integrated).
//
// ## Overview
// REST API for staff self-service (leave, out-of-station, attendance, performance) and administration (HR, KPIs, RBAC, org catalog, workflows).
//
// ## Authentication
// Most endpoints require a JWT Bearer token obtained from `POST /api/v1/auth/login`. Use the **Authorize** button and enter: `Bearer {your_token}`.
//
// ## Conventions
// - Base path: `/api/v1`
// - JSON request/response bodies unless noted
// - Permission-gated admin routes return `403` when the user lacks the required RBAC permission
// - Staff-linked accounts are required for supervisor/approver actions (`staff_id` on the user record)
//
// ## Main areas
// | Tag | Purpose |
// |-----|---------|
// | auth | Login, activation, TOTP, profile |
// | mobile-leave / mobile-supervisor | Leave requests and approvals |
// | mobile-oos | Out-of-station requests and approvals |
// | mobile-attendance | GPS clock in/out |
// | mobile-performance | PPA, quarterly reports, appraisals |
// | approvals | Unified approvals inbox |
// | dashboard | Role-based dashboard payloads |
// | admin-leave | Leave policy, balances, workflow |
// | admin-kpi | KPI catalog and assignments |
// | admin-staff | Staff directory, HR profile, supervisors |
// | admin-lists | Org catalog (regions, facilities, departments) |
// | admin-rbac | Users, roles, permissions, audit |
// | admin-settings | System configuration |
//
// @host
// @BasePath        /
// @schemes         http https
//
// @tag.name auth
// @tag.description Authentication, session, profile, and two-factor (TOTP)
//
// @tag.name approvals
// @tag.description Unified inbox for pending leave, out-of-station, and performance approvals
//
// @tag.name mobile-leave
// @tag.description Staff leave balances, types, and request submission
//
// @tag.name mobile-supervisor
// @tag.description Supervisor leave and out-of-station approval actions
//
// @tag.name mobile-oos
// @tag.description Out-of-station travel requests
//
// @tag.name mobile-attendance
// @tag.description Attendance clock events with optional GPS coordinates
//
// @tag.name mobile-performance
// @tag.description Performance planning (PPA), quarterly reports, and appraisals
//
// @tag.name dashboard
// @tag.description Role-scoped dashboard metrics and drill-down data
//
// @tag.name admin-leave
// @tag.description Leave administration — balances, requests, workflow stages, HR finalize
//
// @tag.name admin-kpi
// @tag.description KPI catalog, assignments by facility type / facility / department / job / staff
//
// @tag.name admin-staff
// @tag.description Staff management — HR enrichment, supervisors, activation
//
// @tag.name admin-lists
// @tag.description Organisation reference lists and catalog maintenance
//
// @tag.name admin-rbac
// @tag.description Access control — users, roles, permissions, data scopes, audit log
//
// @tag.name admin-settings
// @tag.description System settings — integrations, email, notifications, performance windows
//
// @tag.name admin-performance
// @tag.description Performance reporting configuration
//
// @tag.name integrations
// @tag.description iHRIS sync, HRM attendance, analytics (Doris)
//
// @tag.name notifications
// @tag.description In-app notifications for the signed-in user
//
// @tag.name system
// @tag.description Health check and public configuration
//
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description JWT Bearer token. Format: Bearer {token}
func main() {
	app := bootstrap.Boot()

	app.Start()
}
