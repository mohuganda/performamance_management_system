package services

import (
	"fmt"
	"strings"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type LeaveAdminService struct {
	leave  *LeaveService
	config *LeaveConfigService
}

func NewLeaveAdminService() *LeaveAdminService {
	return &LeaveAdminService{
		leave:  NewLeaveService(),
		config: NewLeaveConfigService(),
	}
}

type StaffLeaveSummaryRow struct {
	StaffID         uint              `json:"staff_id"`
	StaffName       string            `json:"staff_name"`
	Email           string            `json:"email"`
	DepartmentName  string            `json:"department_name"`
	FacilityName    string            `json:"facility_name"`
	JobTitle        string            `json:"job_title"`
	SalaryGrade     string            `json:"salary_grade,omitempty"`
	CalendarYear    int               `json:"calendar_year"`
	AnnualEntitled  int               `json:"annual_entitled"`
	AnnualUsed      int               `json:"annual_used"`
	AnnualCarried   int               `json:"annual_carried"`
	AnnualRemaining int               `json:"annual_remaining"`
	Balances        []LeaveBalanceRow `json:"balances"`
}

type LeaveRequestAdminRow struct {
	ID             uint   `json:"id"`
	StaffID        uint   `json:"staff_id"`
	StaffName      string `json:"staff_name"`
	DepartmentName string `json:"department_name"`
	FacilityName   string `json:"facility_name"`
	LeaveTypeID    uint   `json:"leave_type_id"`
	LeaveTypeName  string `json:"leave_type_name"`
	LeaveTypeCode  string `json:"leave_type_code"`
	StartDate      string `json:"start_date"`
	EndDate        string `json:"end_date"`
	DaysRequested  int    `json:"days_requested"`
	Status         string `json:"status"`
	ApprovalStage  string `json:"approval_stage"`
	SubmittedAt    string `json:"submitted_at,omitempty"`
	AwaitingHr     bool   `json:"awaiting_hr"`
	Reason         string `json:"reason,omitempty"`
}

type LeaveStatementSummary struct {
	TotalEntitled      int `json:"total_entitled"`
	TotalUsed          int `json:"total_used"`
	TotalCarried       int `json:"total_carried"`
	TotalRemaining     int `json:"total_remaining"`
	PendingRequests    int `json:"pending_requests"`
	ApprovedAwaitingHr int `json:"approved_awaiting_hr"`
}

type LeaveStatement struct {
	StaffID        uint                   `json:"staff_id"`
	StaffName      string                 `json:"staff_name"`
	Email          string                 `json:"email"`
	DepartmentName string                 `json:"department_name"`
	FacilityName   string                 `json:"facility_name"`
	JobTitle       string                 `json:"job_title"`
	SalaryGrade    string                 `json:"salary_grade,omitempty"`
	Year           int                    `json:"year"`
	Summary        LeaveStatementSummary  `json:"summary"`
	Balances       []LeaveBalanceRow      `json:"balances"`
	Requests       []LeaveRequestAdminRow `json:"requests"`
}

type StaffLeaveListFilter struct {
	Search       string
	DepartmentID uint
	Year         int
	Page         int
	PerPage      int
}

type LeaveRequestListFilter struct {
	Search       string
	Status       string
	AwaitingHr   string
	LeaveTypeID  uint
	DepartmentID uint
	Page         int
	PerPage      int
}

func (s *LeaveAdminService) annualLeaveTypeID() (uint, error) {
	var annual models.LeaveType
	if err := facades.Orm().Query().Where("code", "annual").First(&annual); err != nil || annual.ID == 0 {
		return 0, fmt.Errorf("annual leave type not configured")
	}
	return annual.ID, nil
}

func (s *LeaveAdminService) staffContext(staffID uint) (models.Staff, models.StaffContract, string, string, string) {
	var staff models.Staff
	_ = facades.Orm().Query().Where("id", staffID).First(&staff)

	var contract models.StaffContract
	_ = facades.Orm().Query().
		Where("staff_id", staffID).
		Where("contract_status", "active").
		First(&contract)

	jobTitle := ""
	facilityName := ""
	departmentName := ""
	if contract.ID > 0 {
		var job models.JobTitle
		_ = facades.Orm().Query().Where("id", contract.JobID).First(&job)
		jobTitle = job.JobTitle
		var facility models.Facility
		_ = facades.Orm().Query().Where("id", contract.FacilityID).First(&facility)
		facilityName = facility.Name
		if contract.DepartmentID != nil {
			var dept models.Department
			_ = facades.Orm().Query().Where("id", *contract.DepartmentID).First(&dept)
			departmentName = dept.Name
		}
	}
	return staff, contract, jobTitle, facilityName, departmentName
}

func (s *LeaveAdminService) ListStaffBalances(filter StaffLeaveListFilter) (PaginatedResult[StaffLeaveSummaryRow], error) {
	year := filter.Year
	if year == 0 {
		year = time.Now().Year()
	}
	page, perPage := ResolvePage(filter.Page, filter.PerPage)

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
		return PaginatedResult[StaffLeaveSummaryRow]{}, err
	}

	annualID, _ := s.annualLeaveTypeID()
	all := make([]StaffLeaveSummaryRow, 0, len(staffRows))
	for _, st := range staffRows {
		_, contract, jobTitle, facilityName, departmentName := s.staffContext(st.ID)
		balances, _ := s.leave.BalanceRows(st.ID, year)

		row := StaffLeaveSummaryRow{
			StaffID:        st.ID,
			StaffName:      staffDisplayName(st),
			Email:          deref(st.Email),
			DepartmentName: departmentName,
			FacilityName:   facilityName,
			JobTitle:       jobTitle,
			CalendarYear:   year,
			Balances:       balances,
		}
		if contract.SalaryGrade != nil {
			row.SalaryGrade = *contract.SalaryGrade
		}
		for _, bal := range balances {
			if bal.LeaveTypeID == annualID {
				row.AnnualEntitled = bal.EntitledDays
				row.AnnualUsed = bal.UsedDays
				row.AnnualCarried = bal.CarriedOverDays
				row.AnnualRemaining = bal.RemainingDays
				break
			}
		}
		all = append(all, row)
	}

	return PaginateSlice(all, page, perPage), nil
}

func (s *LeaveAdminService) enrichRequest(req models.LeaveRequest) LeaveRequestAdminRow {
	staff, _, _, facilityName, departmentName := s.staffContext(req.StaffID)
	leaveType, _ := s.config.GetTypeByID(req.LeaveTypeID)

	row := LeaveRequestAdminRow{
		ID:             req.ID,
		StaffID:        req.StaffID,
		StaffName:      staffDisplayName(staff),
		DepartmentName: departmentName,
		FacilityName:   facilityName,
		LeaveTypeID:    req.LeaveTypeID,
		LeaveTypeName:  leaveType.Name,
		LeaveTypeCode:  leaveType.Code,
		StartDate:      req.StartDate.Format("2006-01-02"),
		EndDate:        req.EndDate.Format("2006-01-02"),
		DaysRequested:  req.DaysRequested,
		Status:         req.Status,
		ApprovalStage:  req.ApprovalStage,
		AwaitingHr:     req.Status == "approved" && req.ApprovalStage == "hr",
	}
	if req.SubmittedAt != nil {
		row.SubmittedAt = req.SubmittedAt.Format(time.RFC3339)
	}
	if req.Reason != nil {
		row.Reason = *req.Reason
	}
	return row
}

func (s *LeaveAdminService) ListRequests(filter LeaveRequestListFilter) (PaginatedResult[LeaveRequestAdminRow], error) {
	page, perPage := ResolvePage(filter.Page, filter.PerPage)

	query := facades.Orm().Query().Order("created_at desc")
	if filter.Status != "" {
		query = query.Where("status", filter.Status)
	}
	if filter.AwaitingHr == "true" {
		query = query.Where("status", "approved").Where("approval_stage", "hr")
	}
	if filter.LeaveTypeID > 0 {
		query = query.Where("leave_type_id", filter.LeaveTypeID)
	}
	if filter.DepartmentID > 0 {
		query = query.Where(
			"staff_id IN (SELECT staff_id FROM staff_contracts WHERE contract_status = ? AND department_id = ?)",
			"active", filter.DepartmentID,
		)
	}

	var requests []models.LeaveRequest
	if err := query.Get(&requests); err != nil {
		return PaginatedResult[LeaveRequestAdminRow]{}, err
	}

	rows := make([]LeaveRequestAdminRow, 0, len(requests))
	needle := strings.ToLower(strings.TrimSpace(filter.Search))
	for _, req := range requests {
		row := s.enrichRequest(req)
		if needle != "" {
			haystack := strings.ToLower(row.StaffName + " " + row.LeaveTypeName + " " + row.Status + " " + row.DepartmentName)
			if !strings.Contains(haystack, needle) {
				continue
			}
		}
		rows = append(rows, row)
	}

	return PaginateSlice(rows, page, perPage), nil
}

func (s *LeaveAdminService) StaffStatement(staffID uint, year int) (LeaveStatement, error) {
	if year == 0 {
		year = time.Now().Year()
	}
	staff, contract, jobTitle, facilityName, departmentName := s.staffContext(staffID)
	if staff.ID == 0 {
		return LeaveStatement{}, fmt.Errorf("staff not found")
	}

	balances, err := s.leave.BalanceRows(staffID, year)
	if err != nil {
		return LeaveStatement{}, err
	}

	var requests []models.LeaveRequest
	if err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("start_date >= ? AND start_date < ?", time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC), time.Date(year+1, 1, 1, 0, 0, 0, 0, time.UTC)).
		Order("start_date desc").
		Get(&requests); err != nil {
		return LeaveStatement{}, err
	}

	reqRows := make([]LeaveRequestAdminRow, 0, len(requests))
	summary := LeaveStatementSummary{}
	for _, req := range requests {
		row := s.enrichRequest(req)
		reqRows = append(reqRows, row)
		if req.Status == "pending" {
			summary.PendingRequests++
		}
		if row.AwaitingHr {
			summary.ApprovedAwaitingHr++
		}
	}
	for _, bal := range balances {
		summary.TotalEntitled += bal.EntitledDays
		summary.TotalUsed += bal.UsedDays
		summary.TotalCarried += bal.CarriedOverDays
		summary.TotalRemaining += bal.RemainingDays
	}

	stmt := LeaveStatement{
		StaffID:        staffID,
		StaffName:      staffDisplayName(staff),
		Email:          deref(staff.Email),
		DepartmentName: departmentName,
		FacilityName:   facilityName,
		JobTitle:       jobTitle,
		Year:           year,
		Summary:        summary,
		Balances:       balances,
		Requests:       reqRows,
	}
	if contract.SalaryGrade != nil {
		stmt.SalaryGrade = *contract.SalaryGrade
	}
	return stmt, nil
}

func (s *LeaveAdminService) FinalizeRequest(requestID uint) error {
	var req models.LeaveRequest
	if err := facades.Orm().Query().Where("id", requestID).First(&req); err != nil || req.ID == 0 {
		return fmt.Errorf("leave request not found")
	}
	if req.Status != "approved" || req.ApprovalStage != "hr" {
		return fmt.Errorf("only supervisor-approved requests awaiting HR recording can be finalized")
	}

	year := req.StartDate.Year()
	var balance models.LeaveBalance
	err := facades.Orm().Query().
		Where("staff_id", req.StaffID).
		Where("leave_type_id", req.LeaveTypeID).
		Where("calendar_year", year).
		First(&balance)
	if err != nil || balance.ID == 0 {
		entitled := 0
		if ent, e := s.config.EntitlementForStaff(req.StaffID, req.LeaveTypeID); e == nil && ent != nil {
			entitled = ent.DaysPerYear
		}
		balance = models.LeaveBalance{
			StaffID:      req.StaffID,
			LeaveTypeID:  req.LeaveTypeID,
			CalendarYear: year,
			EntitledDays: entitled,
		}
		if createErr := facades.Orm().Query().Create(&balance); createErr != nil {
			return createErr
		}
	}

	remaining := balance.EntitledDays + balance.CarriedOverDays - balance.UsedDays
	if req.DaysRequested > remaining {
		return fmt.Errorf("insufficient leave balance (%d days remaining, %d requested)", remaining, req.DaysRequested)
	}

	balance.UsedDays += req.DaysRequested
	if err := facades.Orm().Query().Save(&balance); err != nil {
		return err
	}

	req.ApprovalStage = "completed"
	return facades.Orm().Query().Save(&req)
}

type BalanceAdjustInput struct {
	EntitledDays    *int
	UsedDays        *int
	CarriedOverDays *int
}

func (s *LeaveAdminService) AdjustBalance(staffID, leaveTypeID uint, year int, input BalanceAdjustInput) (LeaveBalanceRow, error) {
	if year == 0 {
		year = time.Now().Year()
	}

	var balance models.LeaveBalance
	err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("leave_type_id", leaveTypeID).
		Where("calendar_year", year).
		First(&balance)
	if err != nil || balance.ID == 0 {
		entitled := 0
		if input.EntitledDays != nil {
			entitled = *input.EntitledDays
		} else if ent, e := s.config.EntitlementForStaff(staffID, leaveTypeID); e == nil && ent != nil {
			entitled = ent.DaysPerYear
		}
		balance = models.LeaveBalance{
			StaffID:      staffID,
			LeaveTypeID:  leaveTypeID,
			CalendarYear: year,
			EntitledDays: entitled,
		}
		if createErr := facades.Orm().Query().Create(&balance); createErr != nil {
			return LeaveBalanceRow{}, createErr
		}
	}

	if input.EntitledDays != nil {
		balance.EntitledDays = *input.EntitledDays
	}
	if input.UsedDays != nil {
		balance.UsedDays = *input.UsedDays
	}
	if input.CarriedOverDays != nil {
		balance.CarriedOverDays = *input.CarriedOverDays
	}
	if err := facades.Orm().Query().Save(&balance); err != nil {
		return LeaveBalanceRow{}, err
	}

	rows, err := s.leave.BalanceRows(staffID, year)
	if err != nil {
		return LeaveBalanceRow{}, err
	}
	for _, row := range rows {
		if row.LeaveTypeID == leaveTypeID {
			return row, nil
		}
	}
	return LeaveBalanceRow{}, fmt.Errorf("balance not found after update")
}

type InitializeYearResult struct {
	Year      int `json:"year"`
	Created   int `json:"created"`
	Skipped   int `json:"skipped"`
	Processed int `json:"processed"`
}

func (s *LeaveAdminService) InitializeYearBalances(year int) (InitializeYearResult, error) {
	if year == 0 {
		year = time.Now().Year()
	}
	annualID, err := s.annualLeaveTypeID()
	if err != nil {
		return InitializeYearResult{}, err
	}

	var contracts []models.StaffContract
	if err := facades.Orm().Query().Where("contract_status", "active").Get(&contracts); err != nil {
		return InitializeYearResult{}, err
	}

	result := InitializeYearResult{Year: year, Processed: len(contracts)}
	for _, contract := range contracts {
		var existing models.LeaveBalance
		if err := facades.Orm().Query().
			Where("staff_id", contract.StaffID).
			Where("leave_type_id", annualID).
			Where("calendar_year", year).
			First(&existing); err == nil && existing.ID > 0 {
			result.Skipped++
			continue
		}

		entitled := 30
		if ent, e := s.config.EntitlementForStaff(contract.StaffID, annualID); e == nil && ent != nil {
			entitled = ent.DaysPerYear
		}

		if err := facades.Orm().Query().Create(&models.LeaveBalance{
			StaffID:      contract.StaffID,
			LeaveTypeID:  annualID,
			CalendarYear: year,
			EntitledDays: entitled,
		}); err != nil {
			return result, err
		}
		result.Created++
	}

	types, _ := s.config.ListActiveTypes()
	for _, contract := range contracts {
		for _, lt := range types {
			if lt.ID == annualID {
				continue
			}
			var existing models.LeaveBalance
			if err := facades.Orm().Query().
				Where("staff_id", contract.StaffID).
				Where("leave_type_id", lt.ID).
				Where("calendar_year", year).
				First(&existing); err == nil && existing.ID > 0 {
				continue
			}
			entitled := 0
			if lt.MaxDaysPerYear != nil {
				entitled = *lt.MaxDaysPerYear
			}
			if entitled == 0 {
				continue
			}
			_ = facades.Orm().Query().Create(&models.LeaveBalance{
				StaffID:      contract.StaffID,
				LeaveTypeID:  lt.ID,
				CalendarYear: year,
				EntitledDays: entitled,
			})
		}
	}

	return result, nil
}

func (s *LeaveAdminService) OverviewStats(year int) (map[string]any, error) {
	if year == 0 {
		year = time.Now().Year()
	}

	pendingHr, _ := facades.Orm().Query().Model(&models.LeaveRequest{}).
		Where("status", "approved").
		Where("approval_stage", "hr").
		Count()

	pendingSupervisor, _ := facades.Orm().Query().Model(&models.LeaveRequest{}).
		Where("status", "pending").
		Count()

	activeStaff, _ := facades.Orm().Query().Model(&models.StaffContract{}).
		Where("contract_status", "active").
		Count()

	withBalances, _ := facades.Orm().Query().Model(&models.LeaveBalance{}).
		Where("calendar_year", year).
		Count()

	settings, _ := s.config.LoadSettings()
	return map[string]any{
		"year":                      year,
		"active_staff":              activeStaff,
		"staff_with_balances":       withBalances,
		"pending_supervisor":        pendingSupervisor,
		"awaiting_hr_finalization":  pendingHr,
		"carry_over_deadline":       settings.CarryOverDeadline,
		"advance_notice_days":       settings.AdvanceNoticeDays,
		"allow_carry_over":          settings.AllowCarryOver,
	}, nil
}
