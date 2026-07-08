package services

import (
	"fmt"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type LeaveService struct {
	approval *ApprovalService
	config   *LeaveConfigService
}

func NewLeaveService() *LeaveService {
	return &LeaveService{
		approval: NewApprovalService(),
		config:   NewLeaveConfigService(),
	}
}

type CreateLeaveInput struct {
	StaffID          uint
	LeaveTypeID      uint
	StartDate        time.Time
	EndDate          time.Time
	Reason           string
	MedicalReportURL string
}

func (s *LeaveService) CreateDraft(input CreateLeaveInput) (models.LeaveRequest, error) {
	if input.EndDate.Before(input.StartDate) {
		return models.LeaveRequest{}, fmt.Errorf("end date must be on or after start date")
	}

	leaveType, err := s.config.GetTypeByID(input.LeaveTypeID)
	if err != nil {
		return models.LeaveRequest{}, fmt.Errorf("leave type not found")
	}

	if err := s.config.ValidateRequest(leaveType, input.StaffID, input.StartDate, input.EndDate, input.MedicalReportURL); err != nil {
		return models.LeaveRequest{}, err
	}

	days := int(input.EndDate.Sub(input.StartDate).Hours()/24) + 1
	advanceDays, _ := s.config.AdvanceNoticeDaysForType(leaveType)
	advanceNotice := input.StartDate.Sub(time.Now()) >= time.Duration(advanceDays)*24*time.Hour

	firstStage := "supervisor"
	stages, _ := s.config.ListActiveApprovalStages()
	if len(stages) > 0 {
		firstStage = stages[0].Code
	}

	req := models.LeaveRequest{
		StaffID:          input.StaffID,
		LeaveTypeID:      input.LeaveTypeID,
		StartDate:        input.StartDate,
		EndDate:          input.EndDate,
		DaysRequested:    days,
		Reason:           strPtrIf(input.Reason),
		Status:           "draft",
		AdvanceNoticeMet: advanceNotice,
		ApprovalStage:    firstStage,
	}
	if input.MedicalReportURL != "" {
		req.MedicalReportURL = &input.MedicalReportURL
	}

	if err := facades.Orm().Query().Create(&req); err != nil {
		return models.LeaveRequest{}, err
	}

	return req, nil
}

func (s *LeaveService) Submit(requestID uint, staffID uint) error {
	var req models.LeaveRequest
	if err := facades.Orm().Query().Where("id", requestID).Where("staff_id", staffID).First(&req); err != nil {
		return fmt.Errorf("leave request not found")
	}
	if req.Status != "draft" {
		return fmt.Errorf("only draft requests can be submitted")
	}

	leaveType, err := s.config.GetTypeByID(req.LeaveTypeID)
	if err != nil {
		return fmt.Errorf("leave type not found")
	}

	medicalURL := ""
	if req.MedicalReportURL != nil {
		medicalURL = *req.MedicalReportURL
	}
	if err := s.config.ValidateRequest(leaveType, staffID, req.StartDate, req.EndDate, medicalURL); err != nil {
		return err
	}

	now := time.Now()
	req.Status = "pending"
	req.SubmittedAt = &now
	req.CurrentApprovalSequence = 1
	if err := facades.Orm().Query().Save(&req); err != nil {
		return err
	}

	return s.approval.SeedLeaveApprovals(req.ID, staffID, leaveType)
}

func (s *LeaveService) ListForStaff(staffID uint) ([]models.LeaveRequest, error) {
	var rows []models.LeaveRequest
	err := facades.Orm().Query().Where("staff_id", staffID).Order("created_at desc").Get(&rows)
	return rows, err
}

func (s *LeaveService) Balances(staffID uint, year int) ([]models.LeaveBalance, error) {
	var rows []models.LeaveBalance
	err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("calendar_year", year).
		Get(&rows)
	return rows, err
}

type LeaveBalanceRow struct {
	LeaveTypeID     uint   `json:"leave_type_id"`
	LeaveTypeName   string `json:"leave_type_name"`
	LeaveTypeCode   string `json:"leave_type_code"`
	CalendarYear    int    `json:"calendar_year"`
	EntitledDays    int    `json:"entitled_days"`
	UsedDays        int    `json:"used_days"`
	CarriedOverDays int    `json:"carried_over_days"`
	RemainingDays   int    `json:"remaining_days"`
}

func (s *LeaveService) BalanceRows(staffID uint, year int) ([]LeaveBalanceRow, error) {
	rows, err := s.Balances(staffID, year)
	if err != nil {
		return nil, err
	}

	types, _ := s.config.ListActiveTypes()
	typeMap := map[uint]models.LeaveType{}
	for _, lt := range types {
		typeMap[lt.ID] = lt
	}

	out := make([]LeaveBalanceRow, 0, len(rows))
	for _, row := range rows {
		lt := typeMap[row.LeaveTypeID]
		out = append(out, LeaveBalanceRow{
			LeaveTypeID:     row.LeaveTypeID,
			LeaveTypeName:   lt.Name,
			LeaveTypeCode:   lt.Code,
			CalendarYear:    row.CalendarYear,
			EntitledDays:    row.EntitledDays,
			UsedDays:        row.UsedDays,
			CarriedOverDays: row.CarriedOverDays,
			RemainingDays:   row.EntitledDays + row.CarriedOverDays - row.UsedDays,
		})
	}
	return out, nil
}

func (s *LeaveService) ListLeaveTypes() ([]models.LeaveType, error) {
	return s.config.ListActiveTypes()
}

func (s *LeaveService) PublicConfig() (map[string]any, error) {
	return s.config.PublicLeaveConfig()
}
