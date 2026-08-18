package services

import (
	"fmt"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type LeavePlanService struct {
	leave *LeaveService
}

func NewLeavePlanService() *LeavePlanService {
	return &LeavePlanService{leave: NewLeaveService()}
}

type LeavePlanInput struct {
	CalendarYear int
	StartDate    time.Time
	EndDate      time.Time
	Notes        string
}

type LeavePlanRow struct {
	ID           uint   `json:"id"`
	StaffID      uint   `json:"staff_id"`
	StaffName    string `json:"staff_name,omitempty"`
	CalendarYear int    `json:"calendar_year"`
	StartDate    string `json:"start_date"`
	EndDate      string `json:"end_date"`
	DaysPlanned  int    `json:"days_planned"`
	Notes        string `json:"notes,omitempty"`
}

type LeavePlanSaveResult struct {
	Plan               LeavePlanRow `json:"plan"`
	EntitlementWarning bool         `json:"entitlement_warning"`
	WarningMessage     string       `json:"warning_message,omitempty"`
}

func (s *LeavePlanService) ListForStaff(staffID uint, year int) ([]LeavePlanRow, error) {
	if year <= 0 {
		year = time.Now().Year()
	}
	var rows []models.LeavePlan
	if err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("calendar_year", year).
		Order("start_date asc").
		Get(&rows); err != nil {
		return nil, err
	}
	out := make([]LeavePlanRow, 0, len(rows))
	for _, row := range rows {
		out = append(out, s.toRow(row, ""))
	}
	return out, nil
}

func (s *LeavePlanService) Create(staffID uint, in LeavePlanInput) (LeavePlanSaveResult, error) {
	if err := LeavePlanDatesInYear(in.StartDate, in.EndDate, in.CalendarYear); err != nil {
		return LeavePlanSaveResult{}, err
	}
	if err := s.assertNoOverlap(staffID, in.CalendarYear, in.StartDate, in.EndDate, 0); err != nil {
		return LeavePlanSaveResult{}, err
	}
	plan := models.LeavePlan{
		StaffID:      staffID,
		CalendarYear: in.CalendarYear,
		StartDate:    in.StartDate,
		EndDate:      in.EndDate,
		DaysPlanned:  LeavePlanDayCount(in.StartDate, in.EndDate),
		Notes:        strPtrIf(in.Notes),
	}
	if err := facades.Orm().Query().Create(&plan); err != nil {
		return LeavePlanSaveResult{}, err
	}
	return s.saveResult(staffID, plan), nil
}

func (s *LeavePlanService) Update(staffID, planID uint, in LeavePlanInput) (LeavePlanSaveResult, error) {
	var plan models.LeavePlan
	if err := facades.Orm().Query().Where("id", planID).Where("staff_id", staffID).First(&plan); err != nil || plan.ID == 0 {
		return LeavePlanSaveResult{}, fmt.Errorf("leave plan not found")
	}
	if err := LeavePlanDatesInYear(in.StartDate, in.EndDate, in.CalendarYear); err != nil {
		return LeavePlanSaveResult{}, err
	}
	if err := s.assertNoOverlap(staffID, in.CalendarYear, in.StartDate, in.EndDate, planID); err != nil {
		return LeavePlanSaveResult{}, err
	}
	plan.CalendarYear = in.CalendarYear
	plan.StartDate = in.StartDate
	plan.EndDate = in.EndDate
	plan.DaysPlanned = LeavePlanDayCount(in.StartDate, in.EndDate)
	plan.Notes = strPtrIf(in.Notes)
	if err := facades.Orm().Query().Save(&plan); err != nil {
		return LeavePlanSaveResult{}, err
	}
	return s.saveResult(staffID, plan), nil
}

func (s *LeavePlanService) Delete(staffID, planID uint) error {
	var plan models.LeavePlan
	if err := facades.Orm().Query().Where("id", planID).Where("staff_id", staffID).First(&plan); err != nil || plan.ID == 0 {
		return fmt.Errorf("leave plan not found")
	}
	_, err := facades.Orm().Query().Delete(&plan)
	return err
}

func (s *LeavePlanService) ListTeam(viewerStaffID uint, year int) ([]LeavePlanRow, error) {
	if year <= 0 {
		year = time.Now().Year()
	}
	var links []models.StaffSupervisor
	if err := facades.Orm().Query().
		Where("supervisor_staff_id", viewerStaffID).
		Where("approval_sequence", 1).
		Where("is_current", true).
		Get(&links); err != nil {
		return nil, err
	}
	if len(links) == 0 {
		return []LeavePlanRow{}, nil
	}
	contractIDs := make([]uint, 0, len(links))
	for _, l := range links {
		contractIDs = append(contractIDs, l.StaffContractID)
	}
	var contracts []models.StaffContract
	_ = facades.Orm().Query().WhereIn("id", toAnySlice(contractIDs)).Where("contract_status", "active").Get(&contracts)
	staffIDs := make([]uint, 0, len(contracts))
	for _, c := range contracts {
		staffIDs = append(staffIDs, c.StaffID)
	}
	if len(staffIDs) == 0 {
		return []LeavePlanRow{}, nil
	}
	var plans []models.LeavePlan
	if err := facades.Orm().Query().
		WhereIn("staff_id", toAnySlice(staffIDs)).
		Where("calendar_year", year).
		Order("start_date asc").
		Get(&plans); err != nil {
		return nil, err
	}
	staffMap := loadStaffByIDs(staffIDs)
	out := make([]LeavePlanRow, 0, len(plans))
	for _, p := range plans {
		name := ""
		if st, ok := staffMap[p.StaffID]; ok {
			name = staffDisplayName(st)
		}
		out = append(out, s.toRow(p, name))
	}
	return out, nil
}

func (s *LeavePlanService) assertNoOverlap(staffID uint, year int, start, end time.Time, excludeID uint) error {
	var existing []models.LeavePlan
	_ = facades.Orm().Query().Where("staff_id", staffID).Where("calendar_year", year).Get(&existing)
	for _, row := range existing {
		if excludeID > 0 && row.ID == excludeID {
			continue
		}
		if LeavePlansOverlap(start, end, row.StartDate, row.EndDate) {
			return fmt.Errorf("planned leave overlaps an existing block (%s to %s)",
				row.StartDate.Format("2006-01-02"), row.EndDate.Format("2006-01-02"))
		}
	}
	return nil
}

func (s *LeavePlanService) saveResult(staffID uint, plan models.LeavePlan) LeavePlanSaveResult {
	warning, msg := s.entitlementWarning(staffID, plan.CalendarYear)
	return LeavePlanSaveResult{
		Plan:               s.toRow(plan, ""),
		EntitlementWarning: warning,
		WarningMessage:     msg,
	}
}

func (s *LeavePlanService) entitlementWarning(staffID uint, year int) (bool, string) {
	var plans []models.LeavePlan
	_ = facades.Orm().Query().Where("staff_id", staffID).Where("calendar_year", year).Get(&plans)
	planned := 0
	for _, p := range plans {
		planned += p.DaysPlanned
	}
	rows, err := s.leave.BalanceRows(staffID, year)
	if err != nil {
		return false, ""
	}
	remaining := 0
	found := false
	for _, row := range rows {
		if row.LeaveTypeCode == "annual" {
			remaining = row.RemainingDays
			found = true
			break
		}
	}
	if !found {
		return false, ""
	}
	if planned > remaining {
		return true, fmt.Sprintf("Planned days (%d) exceed remaining annual entitlement (%d).", planned, remaining)
	}
	return false, ""
}

func (s *LeavePlanService) toRow(plan models.LeavePlan, staffName string) LeavePlanRow {
	notes := ""
	if plan.Notes != nil {
		notes = *plan.Notes
	}
	return LeavePlanRow{
		ID:           plan.ID,
		StaffID:      plan.StaffID,
		StaffName:    staffName,
		CalendarYear: plan.CalendarYear,
		StartDate:    plan.StartDate.Format("2006-01-02"),
		EndDate:      plan.EndDate.Format("2006-01-02"),
		DaysPlanned:  plan.DaysPlanned,
		Notes:        notes,
	}
}
