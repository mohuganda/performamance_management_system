package services

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type IhrisSyncService struct{}

func NewIhrisSyncService() *IhrisSyncService {
	return &IhrisSyncService{}
}

type SyncResult struct {
	FacilitiesUpserted  int `json:"facilities_upserted"`
	DepartmentsUpserted int `json:"departments_upserted"`
	JobsUpserted        int `json:"jobs_upserted"`
	StaffUpserted       int `json:"staff_upserted"`
	ContractsCreated    int `json:"contracts_created"`
	ContractsEnded      int `json:"contracts_ended"`
}

func (s *IhrisSyncService) SyncFromDemoTable() (SyncResult, error) {
	var rows []models.IhrisData
	if err := facades.Orm().Query().Get(&rows); err != nil {
		return SyncResult{}, fmt.Errorf("read ihrisdata: %w", err)
	}

	result := SyncResult{}
	for _, row := range rows {
		facilityID, err := s.upsertFacility(row)
		if err != nil {
			return result, err
		}
		result.FacilitiesUpserted++

		deptID, err := s.upsertDepartment(row, facilityID)
		if err != nil {
			return result, err
		}
		if deptID > 0 {
			result.DepartmentsUpserted++
		}

		jobID, err := s.upsertJob(row)
		if err != nil {
			return result, err
		}
		if jobID > 0 {
			result.JobsUpserted++
		}

		staffID, err := s.upsertStaff(row)
		if err != nil {
			return result, err
		}
		result.StaffUpserted++

		created, ended, err := s.syncContract(staffID, facilityID, jobID, deptID, row)
		if err != nil {
			return result, err
		}
		if created {
			result.ContractsCreated++
		}
		if ended {
			result.ContractsEnded++
		}
	}

	cacheKey := "pms:ihris:last_sync"
	_ = facades.Cache().Put(cacheKey, time.Now().Format(time.RFC3339), 24*time.Hour)
	NewStaffCacheService().Invalidate()
	_, _ = NewGeographyService().BackfillFacilityDistrictLinks()
	_, _ = BackfillDepartmentFacilityLinks()

	return result, nil
}

// SyncStaffByIhrisPID upserts staff, org units, and an active contract from a single ihrisdata row.
func (s *IhrisSyncService) SyncStaffByIhrisPID(ihrisPID string) (uint, error) {
	ihrisPID = strings.TrimSpace(ihrisPID)
	if ihrisPID == "" {
		return 0, fmt.Errorf("ihris pid is required")
	}

	var row models.IhrisData
	if err := facades.Orm().Query().Where("ihris_pid", ihrisPID).First(&row); err != nil || row.IhrisPID == "" {
		return 0, fmt.Errorf("ihrisdata row not found for pid %s", ihrisPID)
	}

	facilityID, err := s.upsertFacility(row)
	if err != nil {
		return 0, err
	}
	deptID, err := s.upsertDepartment(row, facilityID)
	if err != nil {
		return 0, err
	}
	jobID, err := s.upsertJob(row)
	if err != nil {
		return 0, err
	}
	staffID, err := s.upsertStaff(row)
	if err != nil {
		return 0, err
	}
	if _, _, err = s.syncContract(staffID, facilityID, jobID, deptID, row); err != nil {
		return 0, err
	}

	NewStaffCacheService().Invalidate()
	return staffID, nil
}

func (s *IhrisSyncService) upsertFacility(row models.IhrisData) (uint, error) {
	extID := deref(row.FacilityID)
	if extID == "" {
		extID = fmt.Sprintf("unknown-%d", row.ID)
	}

	var facility models.Facility
	err := facades.Orm().Query().Where("ihris_facility_id", extID).First(&facility)
	name := deref(row.Facility)
	if name == "" {
		name = "Unknown Facility"
	}

	geo := NewGeographyService().EnrichFacility(row)

	nfrid := row.DhisFacilityID
	districtID := row.DistrictID
	districtName := row.District
	if geo.DistrictID != nil {
		districtID = geo.DistrictID
	}
	if geo.DistrictName != nil {
		districtName = geo.DistrictName
	}

	payload := models.Facility{
		IhrisFacilityID:     extID,
		Nfrid:               nfrid,
		DhisFacilityID:      row.DhisFacilityID,
		Name:                name,
		FacilityTypeID:      row.FacilityTypeID,
		DistrictID:          districtID,
		DistrictName:        districtName,
		DistrictRefID:       geo.DistrictRefID,
		RegionID:            geo.RegionID,
		RegionCode:          geo.RegionCode,
		Latitude:            geo.Latitude,
		Longitude:           geo.Longitude,
		InstitutionTypeID:   row.InstitutionTypeID,
		InstitutionTypeName: strPtr(row.InstitutionTypeName),
		IsActive:            true,
	}

	if err != nil {
		if createErr := facades.Orm().Query().Create(&payload); createErr != nil {
			return 0, createErr
		}
		return payload.ID, nil
	}

	payload.ID = facility.ID
	if updateErr := facades.Orm().Query().Save(&payload); updateErr != nil {
		return 0, updateErr
	}

	return facility.ID, nil
}

func (s *IhrisSyncService) upsertDepartment(row models.IhrisData, facilityID uint) (uint, error) {
	extID := deref(row.DepartmentID)
	name := deref(row.Department)
	if extID == "" || name == "" {
		return 0, nil
	}

	var dept models.Department
	err := facades.Orm().Query().Where("external_system_id", extID).First(&dept)
	var facID *uint
	if facilityID > 0 {
		facID = &facilityID
	}
	payload := models.Department{
		ExternalSystemID: extID,
		Name:             name,
		FacilityID:       facID,
	}
	if err != nil {
		if createErr := facades.Orm().Query().Create(&payload); createErr != nil {
			return 0, createErr
		}
		return payload.ID, nil
	}

	payload.ID = dept.ID
	if updateErr := facades.Orm().Query().Save(&payload); updateErr != nil {
		return 0, updateErr
	}

	return dept.ID, nil
}

// BackfillDepartmentFacilityLinks sets departments.facility_id from staff contracts and iHRIS rows.
func BackfillDepartmentFacilityLinks() (int, error) {
	updated := 0

	type contractLink struct {
		DepartmentID uint
		FacilityID   uint
	}
	var links []contractLink
	if err := facades.Orm().Query().Table("staff_contracts").
		Select("department_id, facility_id").
		Where("department_id IS NOT NULL AND facility_id > 0").
		Group("department_id, facility_id").
		Get(&links); err != nil {
		return 0, err
	}
	for _, link := range links {
		if link.DepartmentID == 0 || link.FacilityID == 0 {
			continue
		}
		res, err := facades.Orm().Query().Model(&models.Department{}).
			Where("id", link.DepartmentID).
			Where("facility_id IS NULL OR facility_id = 0 OR facility_id <> ?", link.FacilityID).
			Update("facility_id", link.FacilityID)
		if err != nil {
			return updated, err
		}
		updated += int(res.RowsAffected)
	}

	if !facades.Schema().HasTable("ihrisdata") {
		return updated, nil
	}

	var ihrisRows []models.IhrisData
	if err := facades.Orm().Query().
		Where("department_id IS NOT NULL AND department_id <> ''").
		Where("facility_id IS NOT NULL AND facility_id <> ''").
		Get(&ihrisRows); err != nil {
		return updated, err
	}

	for _, row := range ihrisRows {
		extDept := strings.TrimSpace(deref(row.DepartmentID))
		extFac := strings.TrimSpace(deref(row.FacilityID))
		if extDept == "" || extFac == "" {
			continue
		}
		var facility models.Facility
		if err := facades.Orm().Query().Where("ihris_facility_id", extFac).First(&facility); err != nil || facility.ID == 0 {
			continue
		}
		res, err := facades.Orm().Query().Model(&models.Department{}).
			Where("external_system_id", extDept).
			Where("facility_id IS NULL OR facility_id = 0 OR facility_id <> ?", facility.ID).
			Update("facility_id", facility.ID)
		if err != nil {
			return updated, err
		}
		updated += int(res.RowsAffected)
	}

	return updated, nil
}

func (s *IhrisSyncService) upsertJob(row models.IhrisData) (uint, error) {
	extID := deref(row.JobID)
	title := deref(row.Job)
	if extID == "" || title == "" {
		return 0, nil
	}

	var job models.JobTitle
	err := facades.Orm().Query().Where("external_job_id", extID).First(&job)
	payload := models.JobTitle{ExternalJobID: extID, JobTitle: title}
	if err != nil {
		if createErr := facades.Orm().Query().Create(&payload); createErr != nil {
			return 0, createErr
		}
		return payload.ID, nil
	}

	payload.ID = job.ID
	if updateErr := facades.Orm().Query().Save(&payload); updateErr != nil {
		return 0, updateErr
	}

	return job.ID, nil
}

func (s *IhrisSyncService) upsertStaff(row models.IhrisData) (uint, error) {
	var staff models.Staff
	err := facades.Orm().Query().Where("ihris_pid", row.IhrisPID).First(&staff)
	payload := models.Staff{
		IhrisPID:  row.IhrisPID,
		Nin:       row.Nin,
		Surname:   derefDefault(row.Surname, "Unknown"),
		Firstname: derefDefault(row.Firstname, "Staff"),
		Othername: row.Othername,
		Gender:    row.Gender,
		Mobile:    row.Mobile,
		Telephone: row.Telephone,
	}

	if err != nil {
		if createErr := facades.Orm().Query().Create(&payload); createErr != nil {
			return 0, createErr
		}
		return payload.ID, nil
	}

	payload.ID = staff.ID
	if updateErr := facades.Orm().Query().Save(&payload); updateErr != nil {
		return 0, updateErr
	}

	return staff.ID, nil
}

func (s *IhrisSyncService) syncContract(staffID, facilityID, jobID, deptID uint, row models.IhrisData) (created bool, ended bool, err error) {
	var active models.StaffContract
	findErr := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("contract_status", "active").
		First(&active)

	now := time.Now()
	var deptPtr *uint
	if deptID > 0 {
		deptPtr = &deptID
	}

	if findErr != nil {
		contract := models.StaffContract{
			StaffID:         staffID,
			FacilityID:      facilityID,
			JobID:           jobID,
			DepartmentID:    deptPtr,
			EmploymentTerms: row.EmploymentTerms,
			SalaryGrade:     row.SalaryGrade,
			Division:        row.Division,
			Section:         row.Section,
			Unit:            row.Unit,
			DistrictID:      row.DistrictID,
			DistrictName:    row.District,
			ContractStatus:  "active",
			StartedAt:       &now,
		}
		if createErr := facades.Orm().Query().Create(&contract); createErr != nil {
			return false, false, createErr
		}
		return true, false, nil
	}

	changed := active.FacilityID != facilityID || active.JobID != jobID ||
		(active.DepartmentID == nil && deptPtr != nil) ||
		(active.DepartmentID != nil && deptPtr != nil && *active.DepartmentID != *deptPtr)

	if !changed {
		return false, false, nil
	}

	active.ContractStatus = "ended"
	active.EndedAt = &now
	if saveErr := facades.Orm().Query().Save(&active); saveErr != nil {
		return false, false, saveErr
	}

	contract := models.StaffContract{
		StaffID:         staffID,
		FacilityID:      facilityID,
		JobID:           jobID,
		DepartmentID:    deptPtr,
		EmploymentTerms: row.EmploymentTerms,
		SalaryGrade:     row.SalaryGrade,
		Division:        row.Division,
		Section:         row.Section,
		Unit:            row.Unit,
		DistrictID:      row.DistrictID,
		DistrictName:    row.District,
		ContractStatus:  "active",
		StartedAt:       &now,
	}
	if createErr := facades.Orm().Query().Create(&contract); createErr != nil {
		return false, true, createErr
	}

	return true, true, nil
}

func deref(v *string) string {
	if v == nil {
		return ""
	}
	return strings.TrimSpace(*v)
}

func derefDefault(v *string, fallback string) string {
	if val := deref(v); val != "" {
		return val
	}
	return fallback
}

func strPtr(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}

type ConfigService struct{}

func NewConfigService() *ConfigService {
	return &ConfigService{}
}

func (s *ConfigService) PublicConfig() map[string]any {
	base := facades.Config().Get("pms")
	public := map[string]any{}

	if m, ok := base.(map[string]any); ok {
		for k, v := range m {
			if k == "ihris" {
				if ihris, ok := v.(map[string]any); ok {
					public[k] = map[string]any{
						"sync_enabled":  ihris["sync_enabled"],
						"use_demo_data": ihris["use_demo_data"],
					}
				}
				continue
			}
			public[k] = v
		}
	}

	leaveConfig := NewLeaveConfigService()
	if leave, err := leaveConfig.PublicLeaveConfig(); err == nil {
		public["leave"] = leave
	}

	settings := NewSettingsService()
	public["settings"] = settings.PublicSettings()

	var configs []models.SystemConfig
	_ = facades.Orm().Query().Where("is_public", true).Get(&configs)
	overrides := map[string]any{}
	for _, cfg := range configs {
		if cfg.GroupName == "leave" {
			continue
		}
		var parsed any
		if json.Unmarshal([]byte(cfg.Value), &parsed) == nil {
			overrides[cfg.Key] = parsed
		} else {
			overrides[cfg.Key] = cfg.Value
		}
	}
	public["overrides"] = overrides

	return public
}

type DashboardService struct {
	analytics *DashboardAnalyticsService
	org       *DashboardOrgService
}

func NewDashboardService() *DashboardService {
	return &DashboardService{
		analytics: NewDashboardAnalyticsService(),
		org:       NewDashboardOrgService(),
	}
}

func (s *DashboardService) HealthWorkerDashboard(staffID uint, quarter string) map[string]any {
	cacheKey := fmt.Sprintf("pms:dashboard:health_worker:%d:%s", staffID, quarter)
	if raw := facades.Cache().Get(cacheKey, ""); raw != nil {
		if cached, ok := raw.(string); ok && cached != "" {
			var payload map[string]any
			if json.Unmarshal([]byte(cached), &payload) == nil {
				return payload
			}
		}
	}

	perf := NewPerformanceService()
	overall, _ := perf.OverallRatingForStaff(staffID)

	payload := map[string]any{
		"role":    "health_worker",
		"quarter": quarter,
		"overall_performance": map[string]any{
			"normalized_score": overall.OverallNormalized,
			"raw_score":        overall.OverallRawScore,
			"latest_score":     overall.LatestNormalized,
			"ppa_status":       overall.PpaStatus,
			"periods":          overall.Periods,
			"financial_year":   overall.FinancialYear,
		},
		"task_completion": map[string]any{
			"percent":   55,
			"completed": 8,
			"total":     14,
		},
		"immediate_focus": map[string]any{
			"tasks_due_this_week": []map[string]any{
				{"task": "Clock in/out (today)", "status": "pending"},
				{"task": "Clock in/out (yesterday)", "status": "missed", "action": "explain"},
			},
			"upcoming_deadlines": []map[string]any{
				{"task": "Acknowledge performance plan", "days_remaining": 3, "severity": "warning"},
				{"task": "Submit Q1 leave requests", "days_remaining": 5, "severity": "warning"},
			},
		},
		"quarterly_tasks": []map[string]any{
			{"id": "HW-01", "description": "Review annual performance plan", "due_date": "2026-07-15", "status": "pending", "action": "Review"},
			{"id": "HW-02", "description": "Complete self-appraisal", "due_date": "2026-09-30", "status": "in_progress", "action": "Start"},
			{"id": "HW-03", "description": "Submit Q1 leave requests", "due_date": "2026-08-01", "status": "pending", "action": "Apply"},
		},
		"attendance_summary": s.analytics.StaffAttendanceSummary(staffID),
		"notifications": []map[string]any{
			{"type": "error", "message": "MISSED: You did not clock in on 15 July 2026. Please provide reason."},
			{"type": "warning", "message": "UPCOMING: Performance plan acknowledgment due in 3 days."},
			{"type": "success", "message": "COMPLETED: Your Q1 leave request for 5 days was approved."},
		},
	}

	for k, v := range s.analytics.AnalyticsBundle("staff", staffID) {
		payload[k] = v
	}

	if encoded, err := json.Marshal(payload); err == nil {
		ttl := time.Duration(facades.Config().GetInt("pms.dashboard.cache_ttl_seconds", 300)) * time.Second
		_ = facades.Cache().Put(cacheKey, string(encoded), ttl)
	}

	return payload
}

func (s *DashboardService) SupervisorDashboard(team string, quarter string) map[string]any {
	return map[string]any{
		"role":    "supervisor",
		"team":    team,
		"quarter": quarter,
		"team_task_completion": map[string]any{
			"percent":  75,
			"on_track": 6,
			"total":    8,
		},
		"summary_cards": map[string]any{
			"total_staff": 8,
			"on_track":    6,
			"at_risk":     1,
			"off_track":   1,
		},
		"pending_approvals": []map[string]any{
			{"type": "Leave", "staff_name": "J. Nakato", "details": "Annual leave - 5 days", "date": "2026-07-10", "action": "Approve/Reject"},
			{"type": "Appr", "staff_name": "P. Okello", "details": "Q1 self-appraisal", "date": "2026-07-12", "action": "Review"},
		},
		"team_members": []map[string]any{
			{"staff_name": "Dr. Ismail Wadembere", "tasks_due": 14, "completed": 12, "percent": 86, "status": "on_track"},
			{"staff_name": "J. Nakato", "tasks_due": 14, "completed": 10, "percent": 71, "status": "at_risk"},
			{"staff_name": "P. Okello", "tasks_due": 14, "completed": 8, "percent": 57, "status": "off_track"},
		},
		"pip_candidates": []map[string]any{
			{"staff_name": "P. Okello", "reason": "Missed 3 tasks in Q1, Attendance <80%", "action": "Initiate PIP"},
		},
	}
}

func (s *DashboardService) DepartmentHeadDashboard(staffID uint, quarter string) map[string]any {
	org := s.org.ResolveForStaff(staffID)
	payload := map[string]any{
		"role":                  "department_head",
		"org_context":           org,
		"quarter":               quarter,
		"task_completion_label": s.org.TaskCompletionLabel(org),
		"task_completion": map[string]any{
			"percent":  68,
			"on_track": 4,
			"total":    6,
		},
		"summary_cards": map[string]any{
			"total_teams": 6,
			"total_staff": 45,
			"on_track":    4,
			"at_risk":     1,
			"off_track":   1,
		},
		"team_performance": []map[string]any{
			{"team": "Ward A – J. Mukasa", "staff": 8, "avg_task_percent": 86, "attendance": 94, "status": "on_track"},
			{"team": "Ward D – P. Wasswa", "staff": 7, "avg_task_percent": 57, "attendance": 82, "status": "off_track"},
		},
		"intervention_required": []map[string]any{
			{"team": "Ward D – P. Wasswa", "reason": "Task completion 57%, attendance below 85%", "actions": []string{"Schedule Meeting", "Initiate Team PIP"}},
		},
		"trends": map[string]any{
			"target": 85,
			"actual": 68,
			"quarters": []map[string]any{
				{"label": "Q4 2024", "value": 72},
				{"label": "Q1 2025", "value": 70},
				{"label": "Q2 2026", "value": 68},
			},
		},
	}
	for k, v := range s.analytics.AnalyticsBundle("national", 0) {
		payload[k] = v
	}
	return payload
}

func (s *DashboardService) HRManagerDashboard(staffID uint, quarter string) map[string]any {
	org := s.org.ResolveForStaff(staffID)
	if org.ScopeLevel != "national" && staffID > 0 {
		// HR at MoH HQ still sees national facility roll-up; others see their facility context in header.
	}
	facilities := s.org.ListFacilityPerformance(0)
	summary := s.org.SummarizeFacilities(facilities)

	facilityRows := make([]map[string]any, 0, len(facilities))
	for _, row := range facilities {
		facilityRows = append(facilityRows, map[string]any{
			"facility":          row.Facility,
			"institution_type":  row.InstitutionType,
			"district":          row.District,
			"region":            row.Region,
			"staff":             row.Staff,
			"departments":       row.Departments,
			"avg_task_percent":  row.AvgTaskPercent,
			"attendance":        row.Attendance,
			"active_pips":       row.ActivePips,
			"status":            row.Status,
		})
	}

	interventions := make([]map[string]any, 0)
	for _, row := range facilities {
		if row.Status == "off_track" {
			interventions = append(interventions, map[string]any{
				"facility": row.Facility,
				"institution_type": row.InstitutionType,
				"district": row.District,
				"reason":     fmt.Sprintf("Task completion %d%%, %d active PIPs", row.AvgTaskPercent, row.ActivePips),
				"action":     "Schedule audit, visit facility",
			})
		}
	}

	nationalOrg := s.org.NationalContext()
	payload := map[string]any{
		"role":                  "hr_manager",
		"org_context":           nationalOrg,
		"viewer_org_context":    org,
		"quarter":               quarter,
		"task_completion_label": s.org.TaskCompletionLabel(nationalOrg),
		"task_completion": map[string]any{
			"percent":  summary["percent"],
			"on_track": summary["on_track"],
			"total":    summary["total"],
		},
		"summary_cards": map[string]any{
			"total_facilities": summary["total_facilities"],
			"total_staff":      summary["total_staff"],
			"on_track":         summary["on_track"],
			"at_risk":          summary["at_risk"],
			"off_track":        summary["off_track"],
		},
		"facility_performance": facilityRows,
		"intervention_required": interventions,
		"pip_analytics": map[string]any{
			"by_level": []map[string]any{
				{"level": "Level 1 (Verbal)", "count": 45},
				{"level": "Level 2 (Written)", "count": 28},
				{"level": "Level 3 (Formal)", "count": 12},
			},
			"completion_rate": 67,
			"avg_resolution_days": 45,
		},
	}
	for k, v := range s.analytics.AnalyticsBundle("national", 0) {
		payload[k] = v
	}
	return payload
}
