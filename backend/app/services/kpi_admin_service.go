package services

import (
	"fmt"
	"strconv"
	"strings"

	"goravel/app/facades"
	"goravel/app/models"
)

type KpiAdminService struct {
	cache *StaffCacheService
}

func NewKpiAdminService() *KpiAdminService {
	return &KpiAdminService{cache: NewStaffCacheService()}
}

type KpiListRow struct {
	ID                  uint    `json:"id"`
	KpiCode             string  `json:"kpi_code"`
	ShortName           string  `json:"short_name"`
	IndicatorStatement  string  `json:"indicator_statement"`
	Frequency           string  `json:"frequency"`
	ComputationCategory string  `json:"computation_category"`
	SubjectAreaID       *uint8  `json:"subject_area_id,omitempty"`
	SubjectAreaName     string  `json:"subject_area_name"`
	CategoryID          uint    `json:"category_id"`
	CategoryName        string  `json:"category_name"`
	CurrentTarget       *int    `json:"current_target,omitempty"`
	IsCumulative        bool    `json:"is_cumulative"`
	Status              bool    `json:"status"`
	AssignmentCount     int     `json:"assignment_count"`
}

type KpiInput struct {
	CategoryID          uint
	KpiCode             string
	ShortName           string
	IndicatorStatement  string
	Description         string
	Computation         string
	Numerator           string
	Denominator         string
	Frequency           string
	ComputationCategory string
	SubjectArea         *uint8
	CurrentTarget       *int
	IsCumulative        bool
	GaugeType           string
	Status              bool
}

type KpiAssignmentRow struct {
	ID               uint   `json:"id"`
	KpiID            uint   `json:"kpi_id"`
	KpiCode          string `json:"kpi_code"`
	KpiName          string `json:"kpi_name"`
	AssignableType   string `json:"assignable_type"`
	JobID            *uint  `json:"job_id,omitempty"`
	JobTitle         string `json:"job_title,omitempty"`
	DepartmentID     *uint  `json:"department_id,omitempty"`
	DepartmentName   string `json:"department_name,omitempty"`
	StaffID          *uint  `json:"staff_id,omitempty"`
	StaffName        string `json:"staff_name,omitempty"`
	IsActive         bool   `json:"is_active"`
}

type KpiAssignmentInput struct {
	KpiID          uint
	KpiIDs         []uint
	AssignableType string
	JobID          *uint
	DepartmentID   *uint
	StaffID        *uint
}

type KpiBulkAssignmentResult struct {
	Created     int      `json:"created"`
	Reactivated int      `json:"reactivated"`
	Failed      int      `json:"failed"`
	Errors      []string `json:"errors,omitempty"`
}

type SubjectAreaOption struct {
	ID    uint8  `json:"id"`
	Label string `json:"label"`
}

func (s *KpiAdminService) ListSubjectAreas() []SubjectAreaOption {
	out := make([]SubjectAreaOption, 0, len(SubjectAreaLabels))
	for id, label := range SubjectAreaLabels {
		out = append(out, SubjectAreaOption{ID: id, Label: label})
	}
	return out
}

func (s *KpiAdminService) ListCategories() ([]models.KpiCategory, error) {
	var rows []models.KpiCategory
	err := facades.Orm().Query().Order("category_name asc").Get(&rows)
	return rows, err
}

func (s *KpiAdminService) ListKpis(search string, subjectArea uint8, activeOnly bool, limit int) ([]KpiListRow, error) {
	result, err := s.ListKpisPaginated(search, subjectArea, 0, activeOnly, 1, limit)
	if err != nil {
		return nil, err
	}
	return result.Data, nil
}

func (s *KpiAdminService) ListKpisPaginated(
	search string,
	subjectArea uint8,
	categoryID uint,
	activeOnly bool,
	page, perPage int,
) (PaginatedResult[KpiListRow], error) {
	page, perPage = ResolvePage(page, perPage)
	query := facades.Orm().Query().Order("kpi_code asc")
	if activeOnly {
		query = query.Where("status", true)
	}
	if subjectArea > 0 {
		query = query.Where("subject_area", subjectArea)
	}
	if categoryID > 0 {
		query = query.Where("category_id", categoryID)
	}
	if search != "" {
		like := "%" + strings.TrimSpace(search) + "%"
		query = query.Where(
			"kpi_code LIKE ? OR indicator_statement LIKE ? OR short_name LIKE ?",
			like, like, like,
		)
	}

	var kpis []models.Kpi
	if err := query.Get(&kpis); err != nil {
		return PaginatedResult[KpiListRow]{}, err
	}
	total := len(kpis)
	start := OffsetFor(page, perPage)
	if start > total {
		start = total
	}
	end := start + perPage
	if end > total {
		end = total
	}
	pageKpis := kpis[start:end]

	categories := map[uint]string{}
	var cats []models.KpiCategory
	_ = facades.Orm().Query().Get(&cats)
	for _, c := range cats {
		categories[c.ID] = c.CategoryName
	}

	rows := make([]KpiListRow, 0, len(pageKpis))
	for _, kpi := range pageKpis {
		var assignments []models.KpiAssignment
		_ = facades.Orm().Query().Where("kpi_id", kpi.ID).Where("is_active", true).Get(&assignments)
		count := len(assignments)

		shortName := ""
		if kpi.ShortName != nil {
			shortName = *kpi.ShortName
		}
		rows = append(rows, KpiListRow{
			ID:                  kpi.ID,
			KpiCode:             kpi.KpiCode,
			ShortName:           shortName,
			IndicatorStatement:  kpi.IndicatorStatement,
			Frequency:           kpi.Frequency,
			ComputationCategory: kpi.ComputationCategory,
			SubjectAreaID:       kpi.SubjectArea,
			SubjectAreaName:     SubjectAreaNamePtr(kpi.SubjectArea),
			CategoryID:          kpi.CategoryID,
			CategoryName:        categories[kpi.CategoryID],
			CurrentTarget:       kpi.CurrentTarget,
			IsCumulative:        kpi.IsCumulative,
			Status:              kpi.Status,
			AssignmentCount:     count,
		})
	}
	return BuildPaginatedResult(rows, total, page, perPage), nil
}

func (s *KpiAdminService) GetKpi(id uint) (models.Kpi, error) {
	var kpi models.Kpi
	if err := facades.Orm().Query().Where("id", id).First(&kpi); err != nil || kpi.ID == 0 {
		return kpi, fmt.Errorf("kpi not found")
	}
	return kpi, nil
}

func (s *KpiAdminService) CreateKpi(input KpiInput) (models.Kpi, error) {
	if strings.TrimSpace(input.IndicatorStatement) == "" {
		return models.Kpi{}, fmt.Errorf("indicator statement is required")
	}
	if input.CategoryID == 0 {
		var cat models.KpiCategory
		_ = facades.Orm().Query().Order("id asc").First(&cat)
		input.CategoryID = cat.ID
	}
	if strings.TrimSpace(input.KpiCode) == "" {
		code, err := s.NextKpiCode(input.CategoryID)
		if err != nil {
			return models.Kpi{}, err
		}
		input.KpiCode = code
	}
	if input.Frequency == "" {
		input.Frequency = "Quarterly"
	}
	if input.ComputationCategory == "" {
		input.ComputationCategory = "Ratio"
	}
	if input.GaugeType == "" {
		input.GaugeType = "ascending_scale"
	}

	var existing models.Kpi
	if err := facades.Orm().Query().Where("kpi_code", input.KpiCode).First(&existing); err == nil && existing.ID > 0 {
		return models.Kpi{}, fmt.Errorf("kpi code already exists")
	}

	kpi := models.Kpi{
		CategoryID:          input.CategoryID,
		KpiCode:             strings.TrimSpace(input.KpiCode),
		ShortName:           strPtrIf(input.ShortName),
		IndicatorStatement:  strings.TrimSpace(input.IndicatorStatement),
		Description:         strPtrIf(input.Description),
		Computation:         strPtrIf(input.Computation),
		Numerator:           strPtrIf(input.Numerator),
		Denominator:         strPtrIf(input.Denominator),
		Frequency:           input.Frequency,
		ComputationCategory: input.ComputationCategory,
		SubjectArea:         input.SubjectArea,
		CurrentTarget:       input.CurrentTarget,
		IsCumulative:        input.IsCumulative,
		GaugeType:           input.GaugeType,
		Status:              input.Status,
	}
	if err := facades.Orm().Query().Create(&kpi); err != nil {
		return models.Kpi{}, err
	}
	return kpi, nil
}

// NextKpiCode returns the next available KPI code for a category (preview before create).
func (s *KpiAdminService) NextKpiCode(categoryID uint) (string, error) {
	if categoryID == 0 {
		return "", fmt.Errorf("category is required")
	}
	var cat models.KpiCategory
	if err := facades.Orm().Query().Where("id", categoryID).First(&cat); err != nil || cat.ID == 0 {
		return "", fmt.Errorf("category not found")
	}

	name := strings.ToLower(strings.TrimSpace(cat.CategoryName))
	switch name {
	case "score card":
		return s.nextPrefixedKpiCode("SC-", 3)
	case "ordinary", "normal":
		return s.nextPrefixedKpiCode("ORD-", 3)
	default:
		return s.nextPrefixedKpiCode("KPI-", 4)
	}
}

func (s *KpiAdminService) nextPrefixedKpiCode(prefix string, pad int) (string, error) {
	var kpis []models.Kpi
	if err := facades.Orm().Query().Where("kpi_code LIKE ?", prefix+"%").Get(&kpis); err != nil {
		return "", err
	}

	max := 0
	for _, kpi := range kpis {
		suffix := strings.TrimPrefix(kpi.KpiCode, prefix)
		n, err := strconv.Atoi(suffix)
		if err == nil && n > max {
			max = n
		}
	}

	return fmt.Sprintf("%s%0*d", prefix, pad, max+1), nil
}

func (s *KpiAdminService) UpdateKpi(id uint, input KpiInput) (models.Kpi, error) {
	kpi, err := s.GetKpi(id)
	if err != nil {
		return kpi, err
	}

	if input.KpiCode != "" && input.KpiCode != kpi.KpiCode {
		var dup models.Kpi
		if err := facades.Orm().Query().Where("kpi_code", input.KpiCode).Where("id != ?", id).First(&dup); err == nil && dup.ID > 0 {
			return kpi, fmt.Errorf("kpi code already in use")
		}
		kpi.KpiCode = strings.TrimSpace(input.KpiCode)
	}
	if input.CategoryID > 0 {
		kpi.CategoryID = input.CategoryID
	}
	if input.IndicatorStatement != "" {
		kpi.IndicatorStatement = strings.TrimSpace(input.IndicatorStatement)
	}
	if input.ShortName != "" {
		kpi.ShortName = strPtrIf(input.ShortName)
	}
	if input.Description != "" {
		kpi.Description = strPtrIf(input.Description)
	}
	if input.Computation != "" {
		kpi.Computation = strPtrIf(input.Computation)
	}
	if input.Numerator != "" {
		kpi.Numerator = strPtrIf(input.Numerator)
	}
	if input.Denominator != "" {
		kpi.Denominator = strPtrIf(input.Denominator)
	}
	if input.Frequency != "" {
		kpi.Frequency = input.Frequency
	}
	if input.ComputationCategory != "" {
		kpi.ComputationCategory = input.ComputationCategory
	}
	if input.SubjectArea != nil {
		kpi.SubjectArea = input.SubjectArea
	}
	if input.CurrentTarget != nil {
		kpi.CurrentTarget = input.CurrentTarget
	}
	if input.GaugeType != "" {
		kpi.GaugeType = input.GaugeType
	}
	kpi.IsCumulative = input.IsCumulative
	kpi.Status = input.Status

	if err := facades.Orm().Query().Save(&kpi); err != nil {
		return kpi, err
	}
	return kpi, nil
}

func (s *KpiAdminService) DeactivateKpi(id uint) error {
	kpi, err := s.GetKpi(id)
	if err != nil {
		return err
	}
	kpi.Status = false
	return facades.Orm().Query().Save(&kpi)
}

func (s *KpiAdminService) ListAssignments(assignableType string, kpiID uint) ([]KpiAssignmentRow, error) {
	result, err := s.ListAssignmentsPaginated(assignableType, kpiID, "", 1, 200)
	if err != nil {
		return nil, err
	}
	return result.Data, nil
}

func (s *KpiAdminService) ListAssignmentsPaginated(
	assignableType string,
	kpiID uint,
	search string,
	page, perPage int,
) (PaginatedResult[KpiAssignmentRow], error) {
	page, perPage = ResolvePage(page, perPage)
	query := facades.Orm().Query().Order("id desc")
	if assignableType != "" {
		query = query.Where("assignable_type", assignableType)
	}
	if kpiID > 0 {
		query = query.Where("kpi_id", kpiID)
	}

	var assignments []models.KpiAssignment
	if err := query.Get(&assignments); err != nil {
		return PaginatedResult[KpiAssignmentRow]{}, err
	}

	allRows := make([]KpiAssignmentRow, 0, len(assignments))
	for _, a := range assignments {
		row := KpiAssignmentRow{
			ID:             a.ID,
			KpiID:          a.KpiID,
			AssignableType: a.AssignableType,
			JobID:          a.JobID,
			DepartmentID:   a.DepartmentID,
			StaffID:        a.StaffID,
			IsActive:       a.IsActive,
		}

		var kpi models.Kpi
		if err := facades.Orm().Query().Where("id", a.KpiID).First(&kpi); err == nil && kpi.ID > 0 {
			row.KpiCode = kpi.KpiCode
			row.KpiName = kpi.IndicatorStatement
			if kpi.ShortName != nil && *kpi.ShortName != "" {
				row.KpiName = *kpi.ShortName
			}
		}
		if a.JobID != nil {
			var job models.JobTitle
			if err := facades.Orm().Query().Where("id", *a.JobID).First(&job); err == nil && job.ID > 0 {
				row.JobTitle = job.JobTitle
			}
		}
		if a.DepartmentID != nil {
			var dept models.Department
			if err := facades.Orm().Query().Where("id", *a.DepartmentID).First(&dept); err == nil && dept.ID > 0 {
				row.DepartmentName = dept.Name
			}
		}
		if a.StaffID != nil {
			var staff models.Staff
			if err := facades.Orm().Query().Where("id", *a.StaffID).First(&staff); err == nil && staff.ID > 0 {
				row.StaffName = staffDisplayName(staff)
			}
		}

		if search != "" {
			needle := strings.ToLower(strings.TrimSpace(search))
			haystack := strings.ToLower(row.KpiCode + " " + row.KpiName + " " + row.JobTitle + " " + row.DepartmentName + " " + row.StaffName)
			if !strings.Contains(haystack, needle) {
				continue
			}
		}
		allRows = append(allRows, row)
	}

	return PaginateSlice(allRows, page, perPage), nil
}

func (s *KpiAdminService) CreateAssignment(input KpiAssignmentInput) (models.KpiAssignment, error) {
	if input.KpiID == 0 {
		return models.KpiAssignment{}, fmt.Errorf("kpi_id is required")
	}
	switch input.AssignableType {
	case "job":
		if input.JobID == nil || *input.JobID == 0 {
			return models.KpiAssignment{}, fmt.Errorf("job_id is required for job assignments")
		}
	case "department":
		if input.DepartmentID == nil || *input.DepartmentID == 0 {
			return models.KpiAssignment{}, fmt.Errorf("department_id is required for department assignments")
		}
	case "staff":
		if input.StaffID == nil || *input.StaffID == 0 {
			return models.KpiAssignment{}, fmt.Errorf("staff_id is required for individual assignments")
		}
	default:
		return models.KpiAssignment{}, fmt.Errorf("assignable_type must be job, department, or staff")
	}

	query := facades.Orm().Query().
		Where("kpi_id", input.KpiID).
		Where("assignable_type", input.AssignableType)
	if input.JobID != nil {
		query = query.Where("job_id", *input.JobID)
	}
	if input.DepartmentID != nil {
		query = query.Where("department_id", *input.DepartmentID)
	}
	if input.StaffID != nil {
		query = query.Where("staff_id", *input.StaffID)
	}

	var existing models.KpiAssignment
	if err := query.First(&existing); err == nil && existing.ID > 0 {
		existing.IsActive = true
		if err := facades.Orm().Query().Save(&existing); err != nil {
			return existing, err
		}
		s.cache.Invalidate()
		return existing, nil
	}

	row := models.KpiAssignment{
		KpiID:          input.KpiID,
		AssignableType: input.AssignableType,
		JobID:          input.JobID,
		DepartmentID:   input.DepartmentID,
		StaffID:        input.StaffID,
		IsActive:       true,
	}
	if err := facades.Orm().Query().Create(&row); err != nil {
		return row, err
	}
	s.cache.Invalidate()
	return row, nil
}

func (s *KpiAdminService) CreateAssignmentsBulk(input KpiAssignmentInput) (KpiBulkAssignmentResult, error) {
	result := KpiBulkAssignmentResult{}
	if len(input.KpiIDs) == 0 {
		return result, fmt.Errorf("at least one kpi_id is required")
	}

	for _, kpiID := range input.KpiIDs {
		if kpiID == 0 {
			result.Failed++
			result.Errors = append(result.Errors, "invalid kpi_id: 0")
			continue
		}

		var existing models.KpiAssignment
		query := facades.Orm().Query().
			Where("kpi_id", kpiID).
			Where("assignable_type", input.AssignableType)
		if input.JobID != nil {
			query = query.Where("job_id", *input.JobID)
		}
		if input.DepartmentID != nil {
			query = query.Where("department_id", *input.DepartmentID)
		}
		if input.StaffID != nil {
			query = query.Where("staff_id", *input.StaffID)
		}

		hadExisting := query.First(&existing) == nil && existing.ID > 0

		row, err := s.CreateAssignment(KpiAssignmentInput{
			KpiID:          kpiID,
			AssignableType: input.AssignableType,
			JobID:          input.JobID,
			DepartmentID:   input.DepartmentID,
			StaffID:        input.StaffID,
		})
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("KPI %d: %s", kpiID, err.Error()))
			continue
		}
		if hadExisting {
			result.Reactivated++
		} else if row.ID > 0 {
			result.Created++
		}
	}

	if result.Created == 0 && result.Reactivated == 0 && result.Failed > 0 {
		return result, fmt.Errorf("could not create any assignments")
	}
	return result, nil
}

func (s *KpiAdminService) DeactivateAssignment(id uint) error {
	var row models.KpiAssignment
	if err := facades.Orm().Query().Where("id", id).First(&row); err != nil || row.ID == 0 {
		return fmt.Errorf("assignment not found")
	}
	row.IsActive = false
	if err := facades.Orm().Query().Save(&row); err != nil {
		return err
	}
	s.cache.Invalidate()
	return nil
}

func (s *KpiAdminService) ListJobs() ([]models.JobTitle, error) {
	var rows []models.JobTitle
	err := facades.Orm().Query().Order("job_title asc").Limit(500).Get(&rows)
	return rows, err
}

func (s *KpiAdminService) ListDepartments() ([]models.Department, error) {
	var rows []models.Department
	err := facades.Orm().Query().Order("name asc").Get(&rows)
	return rows, err
}

func (s *KpiAdminService) SearchStaff(search string, limit int) ([]map[string]any, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	cacheKey := s.cache.key("search", normalizeStaffSearch(search), fmt.Sprintf("%d", limit))
	var cached []map[string]any
	if s.cache.Get(cacheKey, &cached) {
		return cached, nil
	}

	query := facades.Orm().Query().Order("firstname asc").Limit(limit)
	if search != "" {
		like := "%" + strings.TrimSpace(search) + "%"
		query = query.Where("surname LIKE ? OR firstname LIKE ? OR email LIKE ?", like, like, like)
	}
	var staffRows []models.Staff
	if err := query.Get(&staffRows); err != nil {
		return nil, err
	}
	out := make([]map[string]any, 0, len(staffRows))
	for _, st := range staffRows {
		out = append(out, map[string]any{
			"staff_id": st.ID,
			"name":     staffDisplayName(st),
			"email":    deref(st.Email),
		})
	}
	s.cache.Put(cacheKey, out)
	return out, nil
}

func (s *KpiAdminService) PermissionCatalog() map[string]any {
	return map[string]any{
		"permissions": []map[string]string{
			{"code": "kpi.catalog.view", "name": "View KPI catalog", "description": "Browse indicators, subject areas, and categories"},
			{"code": "kpi.catalog.manage", "name": "Manage KPI catalog", "description": "Create, edit, and deactivate KPI definitions"},
			{"code": "kpi.assignments.view", "name": "View KPI assignments", "description": "See job, department, and individual KPI mappings"},
			{"code": "kpi.assignments.manage", "name": "Manage KPI assignments", "description": "Assign KPIs to jobs, departments, or staff"},
		},
		"default_roles": map[string][]string{
			"admin":      {"kpi.catalog.view", "kpi.catalog.manage", "kpi.assignments.view", "kpi.assignments.manage"},
			"hr_officer": {"kpi.catalog.view", "kpi.catalog.manage", "kpi.assignments.view", "kpi.assignments.manage"},
		},
	}
}
