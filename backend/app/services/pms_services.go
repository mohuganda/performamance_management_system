package services

import (
	"encoding/json"
	"fmt"
	"math"
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
	catalog := NewOrgCatalogService()
	_, _, _ = catalog.BackfillCatalogFromFacilities()
	_, _ = catalog.BackfillDepartmentTypeLinks()

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

	catalog := NewOrgCatalogService()
	facilityTypeRefID, _ := catalog.UpsertFacilityType(
		ihrisRefExternalID(row.FacilityTypeID),
		resolveFacilityTypeName(row.FacilityTypeID),
	)
	institutionTypeRefID, _ := catalog.UpsertInstitutionType(
		resolveInstitutionTypeExternalID(row.InstitutionTypeID, row.InstitutionTypeName),
		strings.TrimSpace(row.InstitutionTypeName),
	)

	payload := models.Facility{
		IhrisFacilityID:      extID,
		Nfrid:                nfrid,
		DhisFacilityID:       row.DhisFacilityID,
		Name:                 name,
		FacilityTypeID:       row.FacilityTypeID,
		FacilityTypeRefID:    facilityTypeRefID,
		DistrictID:           districtID,
		DistrictName:         districtName,
		DistrictRefID:        geo.DistrictRefID,
		RegionID:             geo.RegionID,
		RegionCode:           geo.RegionCode,
		Latitude:             geo.Latitude,
		Longitude:            geo.Longitude,
		InstitutionTypeID:    row.InstitutionTypeID,
		InstitutionTypeName:  strPtr(row.InstitutionTypeName),
		InstitutionTypeRefID: institutionTypeRefID,
		IsActive:             true,
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

	var facility models.Facility
	if facilityID > 0 {
		_ = facades.Orm().Query().Where("id", facilityID).First(&facility)
	}

	instName := strings.TrimSpace(row.InstitutionTypeName)
	if instName == "" {
		instName = deref(facility.InstitutionTypeName)
	}
	scopedByFacility := InstitutionUsesFacilityScopedDepartments(instName)

	var dept models.Department
	query := facades.Orm().Query().Where("external_system_id", extID)
	if scopedByFacility && facilityID > 0 {
		query = query.Where("facility_id", facilityID)
	} else if facility.FacilityTypeRefID != nil {
		query = query.Where("facility_type_ref_id", *facility.FacilityTypeRefID)
	}
	err := query.First(&dept)

	payload := models.Department{
		ExternalSystemID: extID,
		Name:             name,
	}
	if scopedByFacility && facilityID > 0 {
		facID := facilityID
		payload.FacilityID = &facID
	} else if facility.FacilityTypeRefID != nil {
		payload.FacilityTypeRefID = facility.FacilityTypeRefID
	} else if facilityID > 0 {
		facID := facilityID
		payload.FacilityID = &facID
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

func (s *DashboardService) staffClockedOn(staffID uint, day time.Time) bool {
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.Local)
	end := start.Add(24 * time.Hour)
	var clocks []models.AttendanceClock
	_ = facades.Orm().Query().
		Where("staff_id", staffID).
		Where("clocked_at >= ?", start).
		Where("clocked_at < ?", end).
		Limit(1).
		Get(&clocks)
	return len(clocks) > 0
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
	now := time.Now()

	tasksDue := make([]map[string]any, 0, 4)
	if !s.staffClockedOn(staffID, now) {
		tasksDue = append(tasksDue, map[string]any{"task": "Clock in/out (today)", "status": "pending"})
	}
	yesterday := now.AddDate(0, 0, -1)
	if yesterday.Weekday() != time.Saturday && yesterday.Weekday() != time.Sunday && !s.staffClockedOn(staffID, yesterday) {
		tasksDue = append(tasksDue, map[string]any{
			"task":   fmt.Sprintf("Clock in/out (%s)", yesterday.Format("2 Jan 2006")),
			"status": "missed",
			"action": "explain",
		})
	}

	upcoming := make([]map[string]any, 0, 4)
	quarterlyTasks := make([]map[string]any, 0, 6)
	completedTasks := 0
	totalTasks := 0

	fy, fyErr := currentFinancialYear()
	ppaStatus := strings.TrimSpace(overall.PpaStatus)
	if fyErr == nil {
		duePPA := fy.StartDate.AddDate(0, 1, 0)
		daysPPA := int(duePPA.Sub(now).Hours() / 24)
		switch ppaStatus {
		case "", "draft", "returned":
			totalTasks++
			quarterlyTasks = append(quarterlyTasks, map[string]any{
				"id": "HW-PPA", "description": "Complete and submit annual performance plan",
				"due_date": duePPA.Format("2006-01-02"), "status": "pending", "action": "Review", "action_url": "/performance",
			})
			if daysPPA >= 0 && daysPPA <= 14 {
				upcoming = append(upcoming, map[string]any{
					"task": "Submit performance plan", "days_remaining": daysPPA, "severity": "warning",
				})
			}
		case "supervisor_review":
			totalTasks++
			quarterlyTasks = append(quarterlyTasks, map[string]any{
				"id": "HW-PPA", "description": "Performance plan awaiting supervisor approval",
				"due_date": duePPA.Format("2006-01-02"), "status": "in_progress", "action": "Review", "action_url": "/performance",
			})
		case "approved":
			totalTasks++
			completedTasks++
			quarterlyTasks = append(quarterlyTasks, map[string]any{
				"id": "HW-PPA", "description": "Annual performance plan approved",
				"due_date": duePPA.Format("2006-01-02"), "status": "completed", "action": "Review", "action_url": "/performance",
			})
		}
	}

	var reports []models.PerformanceReport
	if fyErr == nil {
		_ = facades.Orm().Query().
			Where("staff_id", staffID).
			Where("financial_year_id", fy.ID).
			Get(&reports)
	}
	reportByType := map[string]models.PerformanceReport{}
	for _, r := range reports {
		reportByType[r.ReportType] = r
	}
	for _, period := range []string{"q1", "midterm", "q3", "endterm"} {
		totalTasks++
		label := map[string]string{
			"q1": "Q1 progress report", "midterm": "Mid-term appraisal",
			"q3": "Q3 progress report", "endterm": "End-term appraisal",
		}[period]
		rep, ok := reportByType[period]
		status := "pending"
		action := "Start"
		if ok {
			switch rep.Status {
			case "approved":
				status = "completed"
				action = "Review"
				completedTasks++
			case "submitted", "supervisor_review", "under_review":
				status = "in_progress"
				action = "Review"
			case "returned":
				status = "pending"
				action = "Start"
			default:
				if rep.Status != "" {
					status = rep.Status
				}
			}
		}
		quarterlyTasks = append(quarterlyTasks, map[string]any{
			"id":          fmt.Sprintf("HW-%s", strings.ToUpper(period)),
			"description": label,
			"due_date":    "",
			"status":      status,
			"action":      action,
			"action_url":  "/performance",
		})
	}

	leavePending, _ := facades.Orm().Query().Model(&models.LeaveRequest{}).
		Where("staff_id", staffID).
		Where("status IN ?", []string{"submitted", "pending", "supervisor_review"}).
		Count()
	totalTasks++
	leaveStatus := "pending"
	leaveAction := "Apply"
	if leavePending > 0 {
		leaveStatus = "in_progress"
		leaveAction = "View"
	} else {
		approvedLeave, _ := facades.Orm().Query().Model(&models.LeaveRequest{}).
			Where("staff_id", staffID).
			Where("status", "approved").
			Count()
		if approvedLeave > 0 {
			leaveStatus = "completed"
			leaveAction = "View"
			completedTasks++
		}
	}
	quarterlyTasks = append(quarterlyTasks, map[string]any{
		"id": "HW-LEAVE", "description": "Submit leave requests for the quarter",
		"due_date": "", "status": leaveStatus, "action": leaveAction, "action_url": "/leave",
	})

	percent := 0
	if totalTasks > 0 {
		percent = int(math.Round(float64(completedTasks) / float64(totalTasks) * 100))
	}

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
			"percent":   percent,
			"completed": completedTasks,
			"total":     totalTasks,
		},
		"immediate_focus": map[string]any{
			"tasks_due_this_week": tasksDue,
			"upcoming_deadlines":  upcoming,
		},
		"quarterly_tasks":    quarterlyTasks,
		"attendance_summary": s.analytics.StaffAttendanceSummary(staffID),
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

func (s *DashboardService) SupervisorDashboard(staffID uint, team string, quarter string) map[string]any {
	pendingApprovals := make([]map[string]any, 0)
	if staffID > 0 {
		if inbox, err := NewApprovalsInboxService().Inbox(staffID); err == nil {
			for _, item := range inbox.Pending {
				if len(pendingApprovals) >= 20 {
					break
				}
				refID := item.ApprovalID
				switch item.Module {
				case "ppa":
					refID = item.PpaID
				case "performance":
					refID = item.ReportID
				}
				pendingApprovals = append(pendingApprovals, map[string]any{
					"type":       item.TypeLabel,
					"staff_name": item.StaffName,
					"details":    item.Title,
					"date":       item.SubmittedAt,
					"action":     "Review",
					"action_url": fmt.Sprintf("/approvals/%s/%d", item.Module, refID),
				})
			}
		}
	}

	teamMembers := make([]map[string]any, 0)
	onTrack, atRisk, offTrack := 0, 0, 0
	if staffID > 0 {
		var links []models.StaffSupervisor
		_ = facades.Orm().Query().
			Where("supervisor_staff_id", staffID).
			Where("is_current", true).
			Get(&links)
		perf := NewPerformanceService()
		seen := map[uint]bool{}
		for _, link := range links {
			var contract models.StaffContract
			if err := facades.Orm().Query().Where("id", link.StaffContractID).First(&contract); err != nil || contract.StaffID == 0 {
				continue
			}
			if seen[contract.StaffID] {
				continue
			}
			seen[contract.StaffID] = true
			var staff models.Staff
			_ = facades.Orm().Query().Where("id", contract.StaffID).First(&staff)
			name := staffDisplayName(staff)
			if name == "" {
				name = fmt.Sprintf("Staff #%d", contract.StaffID)
			}
			overall, _ := perf.OverallRatingForStaff(contract.StaffID)
			pct := int(math.Round(overall.OverallNormalized))
			status := "on_track"
			switch {
			case overall.OverallNormalized >= 80:
				onTrack++
			case overall.OverallNormalized >= 60:
				status = "at_risk"
				atRisk++
			case overall.OverallNormalized <= 0 && overall.PpaStatus != "approved":
				status = "at_risk"
				atRisk++
				pct = 0
			default:
				status = "off_track"
				offTrack++
			}
			teamMembers = append(teamMembers, map[string]any{
				"staff_name": name,
				"tasks_due":  4,
				"completed":  0,
				"percent":    pct,
				"status":     status,
			})
		}
	}

	total := len(teamMembers)
	teamPct := 0
	if total > 0 {
		teamPct = int(math.Round(float64(onTrack) / float64(total) * 100))
	}
	if team == "" {
		team = "My team"
	}

	pipCandidates := make([]map[string]any, 0)
	for _, m := range teamMembers {
		if m["status"] == "off_track" {
			pipCandidates = append(pipCandidates, map[string]any{
				"staff_name": m["staff_name"],
				"reason":     fmt.Sprintf("Performance at %v%% — below expected track", m["percent"]),
				"action":     "Review",
				"action_url": "/approvals",
			})
		}
	}

	return map[string]any{
		"role":    "supervisor",
		"team":    team,
		"quarter": quarter,
		"team_task_completion": map[string]any{
			"percent":  teamPct,
			"on_track": onTrack,
			"total":    total,
		},
		"summary_cards": map[string]any{
			"total_staff": total,
			"on_track":    onTrack,
			"at_risk":     atRisk,
			"off_track":   offTrack,
		},
		"pending_approvals": pendingApprovals,
		"team_members":      teamMembers,
		"pip_candidates":    pipCandidates,
	}
}

func (s *DashboardService) DepartmentHeadDashboard(staffID uint, quarter string) map[string]any {
	org := s.org.ResolveForStaff(staffID)
	facilities := s.org.ListFacilityPerformance(0)
	summary := s.org.SummarizeFacilities(facilities)

	onTrack := summary["on_track"]
	atRisk := summary["at_risk"]
	offTrack := summary["off_track"]
	teamRows := make([]map[string]any, 0, len(facilities))
	interventions := make([]map[string]any, 0)
	sumPct := 0
	for _, row := range facilities {
		sumPct += row.AvgTaskPercent
		teamRows = append(teamRows, map[string]any{
			"team":             row.Facility,
			"staff":            row.Staff,
			"avg_task_percent": row.AvgTaskPercent,
			"attendance":       row.Attendance,
			"status":           row.Status,
		})
		if row.Status == "off_track" {
			interventions = append(interventions, map[string]any{
				"team":    row.Facility,
				"reason":  fmt.Sprintf("Task completion %d%%, attendance %d%%", row.AvgTaskPercent, row.Attendance),
				"actions": []string{"Schedule Meeting", "Review team"},
			})
		}
	}
	avgPct := 0
	if len(facilities) > 0 {
		avgPct = int(math.Round(float64(sumPct) / float64(len(facilities))))
	}

	trendQuarters := []map[string]any{
		{"label": quarter, "value": avgPct},
	}

	payload := map[string]any{
		"role":                  "department_head",
		"org_context":           org,
		"quarter":               quarter,
		"task_completion_label": s.org.TaskCompletionLabel(org),
		"task_completion": map[string]any{
			"percent":  avgPct,
			"on_track": onTrack,
			"total":    len(facilities),
		},
		"summary_cards": map[string]any{
			"total_teams": len(facilities),
			"total_staff": summary["total_staff"],
			"on_track":    onTrack,
			"at_risk":     atRisk,
			"off_track":   offTrack,
		},
		"team_performance":      teamRows,
		"intervention_required": interventions,
		"trends": map[string]any{
			"target":   85,
			"actual":   avgPct,
			"quarters": trendQuarters,
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
