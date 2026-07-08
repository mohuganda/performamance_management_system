package services

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type SyncBatchOptions struct {
	PagesPerBatch int
	StartPage     int
	RunID         uint
}

type SyncBatchResult struct {
	RunID           uint       `json:"run_id"`
	Status          string     `json:"status"`
	CurrentPage     uint       `json:"current_page"`
	TotalPages      uint       `json:"total_pages"`
	TotalRecords    uint       `json:"total_records"`
	ProcessedRecords uint      `json:"processed_records"`
	ImportedRecords uint       `json:"imported_records"`
	SkippedRecords  uint       `json:"skipped_records"`
	FailedRecords   uint       `json:"failed_records"`
	HasMore         bool       `json:"has_more"`
	StartedAt       time.Time  `json:"started_at"`
	FinishedAt      *time.Time `json:"finished_at,omitempty"`
	SyncResult      SyncResult `json:"sync_result"`
}

func (s *IhrisSyncService) SyncStatus() (map[string]any, error) {
	var run models.IhrisSyncRun
	if err := facades.Orm().Query().Order("id desc").First(&run); err != nil || run.ID == 0 {
		settings := NewSettingsService()
		return map[string]any{
			"status":          "idle",
			"last_sync_at":    settings.GetString("ihris.last_sync_at", ""),
			"last_sync_status": settings.GetString("ihris.last_sync_status", ""),
		}, nil
	}

	totalPages := uint(0)
	if run.TotalPages != nil {
		totalPages = *run.TotalPages
	}
	hasMore := run.Status == "running" || (totalPages > 0 && run.CurrentPage < totalPages)

	return map[string]any{
		"run_id":            run.ID,
		"status":            run.Status,
		"current_page":      run.CurrentPage,
		"total_pages":       totalPages,
		"total_records":     run.TotalRecords,
		"processed_records": run.ProcessedRecords,
		"imported_records":  run.ImportedRecords,
		"skipped_records":   run.SkippedRecords,
		"failed_records":    run.FailedRecords,
		"last_error":        run.LastError,
		"started_at":        run.StartedAt,
		"finished_at":       run.FinishedAt,
		"has_more":          hasMore,
	}, nil
}

func (s *IhrisSyncService) SyncFromAPI(opts SyncBatchOptions) (SyncBatchResult, error) {
	settings := NewSettingsService()
	if settings.GetBool("ihris.use_demo_data", false) {
		result, err := s.SyncFromDemoTable()
		if err != nil {
			return SyncBatchResult{}, err
		}
		now := time.Now()
		_ = settings.Set("ihris.last_sync_at", "data_sources", now.Format(time.RFC3339), true)
		_ = settings.Set("ihris.last_sync_status", "data_sources", "completed_demo", true)
		return SyncBatchResult{
			Status:          "completed",
			ImportedRecords: uint(result.StaffUpserted),
			HasMore:         false,
			StartedAt:       now,
			FinishedAt:      &now,
			SyncResult:      result,
		}, nil
	}

	if opts.PagesPerBatch <= 0 {
		opts.PagesPerBatch = 3
	}

	client := NewIhrisAPIClient()
	apiURL := ihrisAPIURL()

	var run models.IhrisSyncRun
	if opts.RunID > 0 {
		if err := facades.Orm().Query().Where("id", opts.RunID).First(&run); err != nil || run.ID == 0 {
			return SyncBatchResult{}, fmt.Errorf("sync run not found")
		}
	} else {
		run = models.IhrisSyncRun{
			Status:    "running",
			StartedAt: time.Now(),
		}
		if opts.StartPage > 0 {
			run.CurrentPage = uint(opts.StartPage)
		} else {
			run.CurrentPage = 1
		}
		if err := facades.Orm().Query().Create(&run); err != nil {
			return SyncBatchResult{}, err
		}
	}

	page := int(run.CurrentPage)
	if page < 1 {
		page = 1
	}

	batchResult := SyncResult{}
	for i := 0; i < opts.PagesPerBatch; i++ {
		resp, err := client.FetchPage(apiURL, page)
		if err != nil {
			msg := err.Error()
			run.LastError = &msg
			run.Status = "failed"
			now := time.Now()
			run.FinishedAt = &now
			_ = facades.Orm().Query().Save(&run)
			return SyncBatchResult{}, err
		}

		if run.TotalPages == nil && resp.Pagination.TotalPages > 0 {
			tp := uint(resp.Pagination.TotalPages)
			tr := uint(resp.Pagination.TotalRecords)
			run.TotalPages = &tp
			run.TotalRecords = &tr
		}

		for _, rec := range resp.Data {
			run.ProcessedRecords++
			if !s.passesSyncFilters(rec, settings) {
				run.SkippedRecords++
				continue
			}
			if err := s.importAPIRecord(rec, &batchResult); err != nil {
				run.FailedRecords++
				continue
			}
			run.ImportedRecords++
		}

		if !resp.Pagination.HasNextPage || resp.Pagination.NextPage == nil {
			run.Status = "completed"
			now := time.Now()
			run.FinishedAt = &now
			_ = settings.Set("ihris.last_sync_at", "data_sources", now.Format(time.RFC3339), true)
			_ = settings.Set("ihris.last_sync_status", "data_sources", "completed", true)
			break
		}
		page = *resp.Pagination.NextPage
		run.CurrentPage = uint(page)
	}

	if run.Status == "running" {
		run.Status = "running"
	}

	summary, _ := json.Marshal(batchResult)
	summaryStr := string(summary)
	run.SummaryJSON = &summaryStr
	_ = facades.Orm().Query().Save(&run)

	if run.Status == "completed" || run.Status == "failed" {
		NewStaffCacheService().Invalidate()
	}

	totalPages := uint(0)
	if run.TotalPages != nil {
		totalPages = *run.TotalPages
	}

	return SyncBatchResult{
		RunID:            run.ID,
		Status:           run.Status,
		CurrentPage:      run.CurrentPage,
		TotalPages:       totalPages,
		TotalRecords:     derefUint(run.TotalRecords),
		ProcessedRecords: run.ProcessedRecords,
		ImportedRecords:  run.ImportedRecords,
		SkippedRecords:   run.SkippedRecords,
		FailedRecords:    run.FailedRecords,
		HasMore:          run.Status == "running",
		StartedAt:        run.StartedAt,
		FinishedAt:       run.FinishedAt,
		SyncResult:       batchResult,
	}, nil
}

func (s *IhrisSyncService) passesSyncFilters(rec IhrisAPIRecord, settings *SettingsService) bool {
	if settings.GetBool("ihris.require_email", true) && !hasValidEmail(rec) {
		return false
	}
	if settings.GetBool("ihris.require_mobile", false) && !hasValidMobile(rec) {
		return false
	}
	if strings.TrimSpace(rec.IhrisPID) == "" {
		return false
	}
	return true
}

func (s *IhrisSyncService) importAPIRecord(rec IhrisAPIRecord, result *SyncResult) error {
	row := rec.ToIhrisData()

	facilityID, err := s.upsertFacility(row)
	if err != nil {
		return err
	}
	result.FacilitiesUpserted++

	deptID, err := s.upsertDepartment(row)
	if err != nil {
		return err
	}
	if deptID > 0 {
		result.DepartmentsUpserted++
	}

	jobID, err := s.upsertJob(row)
	if err != nil {
		return err
	}
	if jobID > 0 {
		result.JobsUpserted++
	}

	staffID, err := s.upsertStaffFromAPI(rec)
	if err != nil {
		return err
	}
	result.StaffUpserted++

	contractDeptID := deptID
	if hrDept := s.effectiveHRDepartmentID(staffID); hrDept > 0 {
		contractDeptID = hrDept
	}

	created, ended, err := s.syncContract(staffID, facilityID, jobID, contractDeptID, row)
	if err != nil {
		return err
	}
	if created {
		result.ContractsCreated++
	}
	if ended {
		result.ContractsEnded++
	}
	return nil
}

func (s *IhrisSyncService) effectiveHRDepartmentID(staffID uint) uint {
	var profile models.StaffHrProfile
	if err := facades.Orm().Query().Where("staff_id", staffID).First(&profile); err != nil || profile.ID == 0 {
		return 0
	}
	if profile.HrDepartmentID != nil {
		return *profile.HrDepartmentID
	}
	return 0
}

func (s *IhrisSyncService) upsertStaffFromAPI(rec IhrisAPIRecord) (uint, error) {
	var staff models.Staff
	_ = facades.Orm().Query().Where("ihris_pid", rec.IhrisPID).First(&staff)

	var profile models.StaffHrProfile
	_ = facades.Orm().Query().Where("staff_id", staff.ID).First(&profile)
	locked := lockedFieldsSet(&profile)

	now := time.Now()
	payload := models.Staff{
		IhrisPID:  rec.IhrisPID,
		Nin:       mergeStringPtr(staff.Nin, rec.Nin, locked["nin"]),
		Surname:   mergeString(staff.Surname, derefDefault(rec.Surname, "Unknown"), locked["surname"]),
		Firstname: mergeString(staff.Firstname, derefDefault(rec.Firstname, "Staff"), locked["firstname"]),
		Othername: mergeStringPtr(staff.Othername, rec.Othername, locked["othername"]),
		Gender:    mergeStringPtr(staff.Gender, rec.Gender, locked["gender"]),
		Mobile:    mergeStringPtr(staff.Mobile, rec.Mobile, locked["mobile"]),
		Telephone: mergeStringPtr(staff.Telephone, rec.Telephone, locked["telephone"]),
		Email:     mergeStringPtr(staff.Email, rec.Email, locked["email"]),
		Cadre:     mergeStringPtr(staff.Cadre, rec.Cadre, locked["cadre"]),
		Region:    mergeStringPtr(staff.Region, rec.Region, locked["region"]),
	}

	if profile.HrEmail != nil && strings.TrimSpace(*profile.HrEmail) != "" {
		payload.Email = profile.HrEmail
	}
	if profile.HrMobile != nil && strings.TrimSpace(*profile.HrMobile) != "" {
		payload.Mobile = profile.HrMobile
	}

	payload.IhrisLastSyncAt = &now

	if staff.ID == 0 {
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

func derefUint(v *uint) uint {
	if v == nil {
		return 0
	}
	return *v
}

type StaffAdminService struct {
	supervisors *SupervisorService
	cache       *StaffCacheService
}

func NewStaffAdminService() *StaffAdminService {
	return &StaffAdminService{
		supervisors: NewSupervisorService(),
		cache:       NewStaffCacheService(),
	}
}

type StaffListRow struct {
	StaffID         uint   `json:"staff_id"`
	IhrisPID        string `json:"ihris_pid"`
	Name            string `json:"name"`
	Email           string `json:"email"`
	Mobile          string `json:"mobile"`
	JobTitle        string `json:"job_title"`
	FacilityName    string `json:"facility_name"`
	DepartmentName  string `json:"department_name"`
	HrDepartmentID  *uint  `json:"hr_department_id,omitempty"`
	HrDepartment    string `json:"hr_department_name,omitempty"`
	HasSupervisor   bool                   `json:"has_supervisor"`
	SupervisorName  string                 `json:"supervisor_name,omitempty"`
	Supervisors     []SupervisorAssignment `json:"supervisors,omitempty"`
	Cadre           string `json:"cadre,omitempty"`
	Region          string `json:"region,omitempty"`
	IhrisLastSyncAt string `json:"ihris_last_sync_at,omitempty"`
}

func (s *StaffAdminService) ListStaff(search string, limit int) ([]StaffListRow, error) {
	result, err := s.ListStaffPaginated(StaffListFilter{
		Search:  search,
		Page:    1,
		PerPage: limit,
	})
	if err != nil {
		return nil, err
	}
	return result.Data, nil
}

type StaffListFilter struct {
	Search        string
	DepartmentID  uint
	HasSupervisor string
	Page          int
	PerPage       int
}

func (s *StaffAdminService) ListStaffPaginated(filter StaffListFilter) (PaginatedResult[StaffListRow], error) {
	page, perPage := ResolvePage(filter.Page, filter.PerPage)
	cacheKey := s.cache.key(
		"list-paged",
		normalizeStaffSearch(filter.Search),
		fmt.Sprintf("%d_%d_%d_%s", page, perPage, filter.DepartmentID, filter.HasSupervisor),
	)
	var cached PaginatedResult[StaffListRow]
	if s.cache.Get(cacheKey, &cached) {
		return cached, nil
	}

	query := facades.Orm().Query().Order("id desc")
	if filter.Search != "" {
		like := "%" + strings.TrimSpace(filter.Search) + "%"
		query = query.Where(
			"surname LIKE ? OR firstname LIKE ? OR email LIKE ? OR ihris_pid LIKE ?",
			like, like, like, like,
		)
	}
	if filter.DepartmentID > 0 {
		query = query.Where(
			"id IN (SELECT staff_id FROM staff_contracts WHERE contract_status = ? AND department_id = ?)",
			"active", filter.DepartmentID,
		)
	}

	var staffRows []models.Staff
	if err := query.Get(&staffRows); err != nil {
		return PaginatedResult[StaffListRow]{}, err
	}

	supervisionMap := map[uint]StaffSupervisionRow{}
	if supervision, err := s.supervisors.ListStaffSupervision(); err == nil {
		for _, sup := range supervision {
			supervisionMap[sup.StaffID] = sup
		}
	}

	allRows := make([]StaffListRow, 0, len(staffRows))
	for _, st := range staffRows {
		row := s.buildStaffListRow(st, supervisionMap)
		if filter.HasSupervisor == "true" && !row.HasSupervisor {
			continue
		}
		if filter.HasSupervisor == "false" && row.HasSupervisor {
			continue
		}
		allRows = append(allRows, row)
	}

	result := PaginateSlice(allRows, page, perPage)
	s.cache.Put(cacheKey, result)
	return result, nil
}

func (s *StaffAdminService) buildStaffListRow(st models.Staff, supervisionMap map[uint]StaffSupervisionRow) StaffListRow {
	row := StaffListRow{
		StaffID:  st.ID,
		IhrisPID: st.IhrisPID,
		Name:     staffDisplayName(st),
		Email:    deref(st.Email),
		Mobile:   deref(st.Mobile),
		Cadre:    deref(st.Cadre),
		Region:   deref(st.Region),
	}
	if st.IhrisLastSyncAt != nil {
		row.IhrisLastSyncAt = st.IhrisLastSyncAt.Format(time.RFC3339)
	}

	var contract models.StaffContract
	if err := facades.Orm().Query().Where("staff_id", st.ID).Where("contract_status", "active").First(&contract); err == nil && contract.ID > 0 {
		var job models.JobTitle
		_ = facades.Orm().Query().Where("id", contract.JobID).First(&job)
		row.JobTitle = job.JobTitle
		var facility models.Facility
		_ = facades.Orm().Query().Where("id", contract.FacilityID).First(&facility)
		row.FacilityName = facility.Name
		if contract.DepartmentID != nil {
			var dept models.Department
			_ = facades.Orm().Query().Where("id", *contract.DepartmentID).First(&dept)
			row.DepartmentName = dept.Name
		}
	}

	var profile models.StaffHrProfile
	if err := facades.Orm().Query().Where("staff_id", st.ID).First(&profile); err == nil && profile.ID > 0 {
		row.HrDepartmentID = profile.HrDepartmentID
		if profile.HrDepartmentID != nil {
			var dept models.Department
			if err := facades.Orm().Query().Where("id", *profile.HrDepartmentID).First(&dept); err == nil && dept.ID > 0 {
				row.HrDepartment = dept.Name
			}
		}
		if profile.HrEmail != nil {
			row.Email = *profile.HrEmail
		}
	}

	if sup, ok := supervisionMap[st.ID]; ok {
		row.HasSupervisor = sup.HasSupervisor
		row.SupervisorName = sup.SupervisorName
		row.Supervisors = sup.Supervisors
	}
	return row
}

type StaffProfileDetail struct {
	StaffID            uint   `json:"staff_id"`
	IhrisPID           string `json:"ihris_pid"`
	Name               string `json:"name"`
	Firstname          string `json:"firstname"`
	Surname            string `json:"surname"`
	Othername          string `json:"othername,omitempty"`
	Nin                string `json:"nin,omitempty"`
	Gender             string `json:"gender,omitempty"`
	Email              string `json:"email,omitempty"`
	Mobile             string `json:"mobile,omitempty"`
	Telephone          string `json:"telephone,omitempty"`
	Cadre              string `json:"cadre,omitempty"`
	Region             string `json:"region,omitempty"`
	JobTitle           string `json:"job_title,omitempty"`
	FacilityName       string `json:"facility_name,omitempty"`
	InstitutionType    string `json:"institution_type,omitempty"`
	DepartmentName     string `json:"department_name,omitempty"`
	HrDepartmentName   string `json:"hr_department_name,omitempty"`
	Division           string `json:"division,omitempty"`
	Section            string `json:"section,omitempty"`
	Unit               string `json:"unit,omitempty"`
	DistrictName       string `json:"district_name,omitempty"`
	EmploymentTerms    string `json:"employment_terms,omitempty"`
	SalaryGrade        string `json:"salary_grade,omitempty"`
	SupervisorName     string `json:"supervisor_name,omitempty"`
	IhrisLastSyncAt    string `json:"ihris_last_sync_at,omitempty"`
}

func (s *StaffAdminService) GetStaffProfile(staffID uint) (*StaffProfileDetail, error) {
	if staffID == 0 {
		return nil, nil
	}

	var st models.Staff
	if err := facades.Orm().Query().Where("id", staffID).First(&st); err != nil || st.ID == 0 {
		return nil, fmt.Errorf("staff not found")
	}

	supervisionMap := map[uint]StaffSupervisionRow{}
	if supervision, err := s.supervisors.ListStaffSupervision(); err == nil {
		for _, sup := range supervision {
			supervisionMap[sup.StaffID] = sup
		}
	}

	row := s.buildStaffListRow(st, supervisionMap)
	detail := &StaffProfileDetail{
		StaffID:          row.StaffID,
		IhrisPID:         row.IhrisPID,
		Name:             row.Name,
		Firstname:        strings.TrimSpace(st.Firstname),
		Surname:          strings.TrimSpace(st.Surname),
		Othername:        deref(st.Othername),
		Nin:              deref(st.Nin),
		Gender:           deref(st.Gender),
		Email:            row.Email,
		Mobile:           row.Mobile,
		Telephone:        deref(st.Telephone),
		Cadre:            row.Cadre,
		Region:           row.Region,
		JobTitle:         row.JobTitle,
		FacilityName:     row.FacilityName,
		DepartmentName:   row.DepartmentName,
		HrDepartmentName: row.HrDepartment,
		SupervisorName:   row.SupervisorName,
		IhrisLastSyncAt:  row.IhrisLastSyncAt,
	}

	var contract models.StaffContract
	if err := facades.Orm().Query().Where("staff_id", st.ID).Where("contract_status", "active").First(&contract); err == nil && contract.ID > 0 {
		detail.Division = deref(contract.Division)
		detail.Section = deref(contract.Section)
		detail.Unit = deref(contract.Unit)
		detail.DistrictName = deref(contract.DistrictName)
		detail.EmploymentTerms = deref(contract.EmploymentTerms)
		detail.SalaryGrade = deref(contract.SalaryGrade)

		var facility models.Facility
		if err := facades.Orm().Query().Where("id", contract.FacilityID).First(&facility); err == nil && facility.ID > 0 {
			detail.FacilityName = facility.Name
			detail.InstitutionType = deref(facility.InstitutionTypeName)
		}
	}

	return detail, nil
}

type StaffHrProfileInput struct {
	HrDepartmentID  *uint
	HrEmail         string
	HrMobile        string
	Notes           string
	LockEmail       bool
	LockDepartment  bool
	LockMobile      bool
}

func (s *StaffAdminService) UpdateHrProfile(staffID uint, userID uint, input StaffHrProfileInput) error {
	var profile models.StaffHrProfile
	if err := facades.Orm().Query().Where("staff_id", staffID).FirstOr(&profile, func() error {
		profile = models.StaffHrProfile{StaffID: staffID}
		return facades.Orm().Query().Create(&profile)
	}); err != nil {
		return err
	}

	locks := []string{}
	if input.LockEmail {
		locks = append(locks, "email")
	}
	if input.LockDepartment {
		locks = append(locks, "department_id")
	}
	if input.LockMobile {
		locks = append(locks, "mobile")
	}
	encoded, _ := json.Marshal(locks)

	profile.HrDepartmentID = input.HrDepartmentID
	if input.HrEmail != "" {
		profile.HrEmail = strPtr(input.HrEmail)
	}
	if input.HrMobile != "" {
		profile.HrMobile = strPtr(input.HrMobile)
	}
	if input.Notes != "" {
		profile.Notes = strPtr(input.Notes)
	}
	lockStr := string(encoded)
	profile.LockedFields = &lockStr
	profile.UpdatedByUserID = &userID

	if err := facades.Orm().Query().Save(&profile); err != nil {
		return err
	}

	if input.HrDepartmentID != nil {
		var contract models.StaffContract
		if err := facades.Orm().Query().Where("staff_id", staffID).Where("contract_status", "active").First(&contract); err == nil && contract.ID > 0 {
			contract.DepartmentID = input.HrDepartmentID
			_ = facades.Orm().Query().Save(&contract)
		}
	}

	s.cache.Invalidate()
	return nil
}

func (s *StaffAdminService) ListDepartments() ([]models.Department, error) {
	cacheKey := s.cache.key("departments")
	var cached []models.Department
	if s.cache.Get(cacheKey, &cached) {
		return cached, nil
	}
	var rows []models.Department
	err := facades.Orm().Query().Order("name asc").Get(&rows)
	if err != nil {
		return nil, err
	}
	s.cache.Put(cacheKey, rows)
	return rows, err
}
