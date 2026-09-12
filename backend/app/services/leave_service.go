package services

import (
	"fmt"
	"strings"
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
	OicStaffID       uint
	Clarification    string
}

func leaveEditableStatus(status string) bool {
	switch status {
	case "draft", "rejected":
		return true
	default:
		return false
	}
}

func (s *LeaveService) CreateDraft(input CreateLeaveInput) (models.LeaveRequest, error) {
	if input.EndDate.Before(input.StartDate) {
		return models.LeaveRequest{}, fmt.Errorf("end date must be on or after start date")
	}
	if input.OicStaffID == 0 {
		return models.LeaveRequest{}, fmt.Errorf("officer in charge (OIC) is required")
	}
	if input.OicStaffID == input.StaffID {
		return models.LeaveRequest{}, fmt.Errorf("OIC cannot be the same as the leave applicant")
	}
	var oic models.Staff
	if err := facades.Orm().Query().Where("id", input.OicStaffID).First(&oic); err != nil || oic.ID == 0 {
		return models.LeaveRequest{}, fmt.Errorf("OIC staff record not found")
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

	oicID := input.OicStaffID
	req := models.LeaveRequest{
		StaffID:          input.StaffID,
		LeaveTypeID:      input.LeaveTypeID,
		StartDate:        input.StartDate,
		EndDate:          input.EndDate,
		DaysRequested:    days,
		Reason:           strPtrIf(input.Reason),
		Clarification:    strPtrIf(input.Clarification),
		Status:           "draft",
		AdvanceNoticeMet: advanceNotice,
		ApprovalStage:    firstStage,
		OicStaffID:       &oicID,
	}
	if input.MedicalReportURL != "" {
		req.MedicalReportURL = &input.MedicalReportURL
	}

	if err := facades.Orm().Query().Create(&req); err != nil {
		return models.LeaveRequest{}, err
	}

	return req, nil
}

func (s *LeaveService) UpdateDraft(staffID, id uint, input CreateLeaveInput) (models.LeaveRequest, error) {
	req, err := s.GetOwned(staffID, id)
	if err != nil {
		return models.LeaveRequest{}, err
	}
	if !leaveEditableStatus(req.Status) {
		return models.LeaveRequest{}, fmt.Errorf("only draft or rejected requests can be updated")
	}
	if input.EndDate.Before(input.StartDate) {
		return models.LeaveRequest{}, fmt.Errorf("end date must be on or after start date")
	}
	if input.OicStaffID == 0 {
		return models.LeaveRequest{}, fmt.Errorf("officer in charge (OIC) is required")
	}
	if input.OicStaffID == staffID {
		return models.LeaveRequest{}, fmt.Errorf("OIC cannot be the same as the leave applicant")
	}
	var oic models.Staff
	if err := facades.Orm().Query().Where("id", input.OicStaffID).First(&oic); err != nil || oic.ID == 0 {
		return models.LeaveRequest{}, fmt.Errorf("OIC staff record not found")
	}

	leaveType, err := s.config.GetTypeByID(input.LeaveTypeID)
	if err != nil {
		return models.LeaveRequest{}, fmt.Errorf("leave type not found")
	}
	if err := s.config.ValidateRequest(leaveType, staffID, input.StartDate, input.EndDate, input.MedicalReportURL); err != nil {
		return models.LeaveRequest{}, err
	}

	wasRejected := req.Status == "rejected"

	days := int(input.EndDate.Sub(input.StartDate).Hours()/24) + 1
	advanceDays, _ := s.config.AdvanceNoticeDaysForType(leaveType)
	advanceNotice := input.StartDate.Sub(time.Now()) >= time.Duration(advanceDays)*24*time.Hour
	oicID := input.OicStaffID

	req.LeaveTypeID = input.LeaveTypeID
	req.StartDate = input.StartDate
	req.EndDate = input.EndDate
	req.DaysRequested = days
	req.Reason = strPtrIf(input.Reason)
	req.Clarification = strPtrIf(input.Clarification)
	req.AdvanceNoticeMet = advanceNotice
	req.OicStaffID = &oicID
	if input.MedicalReportURL != "" {
		req.MedicalReportURL = &input.MedicalReportURL
	} else {
		req.MedicalReportURL = nil
	}
	// Keep rejected until Submit so drafts of a revision stay revisable with the rejection note visible.
	if wasRejected {
		req.SubmittedAt = nil
	}

	if err := facades.Orm().Query().Save(req); err != nil {
		return models.LeaveRequest{}, err
	}
	return *req, nil
}

func (s *LeaveService) Submit(requestID uint, staffID uint) error {
	var req models.LeaveRequest
	if err := facades.Orm().Query().Where("id", requestID).Where("staff_id", staffID).First(&req); err != nil {
		return fmt.Errorf("leave request not found")
	}
	if !leaveEditableStatus(req.Status) {
		return fmt.Errorf("only draft or rejected requests can be submitted")
	}
	if req.Status == "rejected" && (req.Clarification == nil || strings.TrimSpace(*req.Clarification) == "") {
		return fmt.Errorf("add a clarification explaining the revision before resubmitting")
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

	if req.Status == "rejected" {
		_, _ = facades.Orm().Query().Model(&models.LeaveApproval{}).
			Where("leave_request_id", requestID).
			Delete()
	}

	now := time.Now()
	req.Status = "pending"
	req.SubmittedAt = &now
	req.CurrentApprovalSequence = 1
	firstStage := "supervisor"
	stages, _ := s.config.ListActiveApprovalStages()
	if len(stages) > 0 {
		firstStage = stages[0].Code
	}
	req.ApprovalStage = firstStage
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

func (s *LeaveService) GetOwned(staffID, id uint) (*models.LeaveRequest, error) {
	var req models.LeaveRequest
	if err := facades.Orm().Query().Where("id", id).Where("staff_id", staffID).First(&req); err != nil || req.ID == 0 {
		return nil, fmt.Errorf("leave request not found")
	}
	return &req, nil
}

// Recall withdraws a pending leave request back to draft. Approved requests cannot be recalled.
func (s *LeaveService) Recall(staffID, id uint) error {
	req, err := s.GetOwned(staffID, id)
	if err != nil {
		return err
	}
	if req.Status != "pending" {
		return fmt.Errorf("only pending requests under approval can be recalled")
	}
	firstStage := "supervisor"
	stages, _ := s.config.ListActiveApprovalStages()
	if len(stages) > 0 {
		firstStage = stages[0].Code
	}
	req.Status = "draft"
	req.SubmittedAt = nil
	req.CurrentApprovalSequence = 1
	req.ApprovalStage = firstStage
	if err := facades.Orm().Query().Save(req); err != nil {
		return err
	}
	_, _ = facades.Orm().Query().Model(&models.LeaveApproval{}).
		Where("leave_request_id", id).
		Delete()
	return nil
}

// Delete removes draft leave requests, or cancels then removes pending ones.
func (s *LeaveService) Delete(staffID, id uint) error {
	req, err := s.GetOwned(staffID, id)
	if err != nil {
		return err
	}
	switch req.Status {
	case "draft", "pending", "rejected":
		_, _ = facades.Orm().Query().Model(&models.LeaveApproval{}).
			Where("leave_request_id", id).
			Delete()
		_, err = facades.Orm().Query().Delete(req)
		return err
	default:
		return fmt.Errorf("approved or closed requests cannot be deleted")
	}
}

// Cancel marks draft/pending leave as cancelled without deleting the row.
func (s *LeaveService) Cancel(staffID, id uint) error {
	req, err := s.GetOwned(staffID, id)
	if err != nil {
		return err
	}
	switch req.Status {
	case "draft", "pending":
		// ok
	default:
		return fmt.Errorf("only draft or pending requests can be cancelled")
	}
	prev := req.Status
	req.Status = "cancelled"
	if err := facades.Orm().Query().Save(req); err != nil {
		return err
	}
	if prev == "pending" {
		_, _ = facades.Orm().Query().Model(&models.LeaveApproval{}).
			Where("leave_request_id", id).
			Where("status", "pending").
			Update("status", "cancelled")
	}
	return nil
}

type LeaveRequestRow struct {
	models.LeaveRequest
	OicName               string `json:"oic_name,omitempty"`
	RejectionComment      string `json:"rejection_comment,omitempty"`
}

func (s *LeaveService) ListRowsForStaff(staffID uint) ([]LeaveRequestRow, error) {
	rows, err := s.ListForStaff(staffID)
	if err != nil {
		return nil, err
	}
	return enrichLeaveRequestRows(rows), nil
}

func enrichLeaveRequestRows(rows []models.LeaveRequest) []LeaveRequestRow {
	oicIDs := make([]uint, 0)
	seen := map[uint]bool{}
	for _, row := range rows {
		if row.OicStaffID != nil && *row.OicStaffID > 0 && !seen[*row.OicStaffID] {
			seen[*row.OicStaffID] = true
			oicIDs = append(oicIDs, *row.OicStaffID)
		}
	}
	staffMap := loadStaffByIDs(oicIDs)
	rejectionMap := latestLeaveRejectionComments(rows)
	out := make([]LeaveRequestRow, 0, len(rows))
	for _, row := range rows {
		item := LeaveRequestRow{LeaveRequest: row, RejectionComment: rejectionMap[row.ID]}
		if row.OicStaffID != nil {
			if st, ok := staffMap[*row.OicStaffID]; ok {
				item.OicName = staffDisplayName(st)
			}
		}
		out = append(out, item)
	}
	return out
}

func latestLeaveRejectionComments(rows []models.LeaveRequest) map[uint]string {
	out := map[uint]string{}
	ids := make([]uint, 0)
	for _, row := range rows {
		if row.Status == "rejected" {
			ids = append(ids, row.ID)
		}
	}
	if len(ids) == 0 {
		return out
	}
	var approvals []models.LeaveApproval
	_ = facades.Orm().Query().Where("leave_request_id in ?", ids).Where("status", "rejected").Order("id desc").Get(&approvals)
	for _, a := range approvals {
		if _, exists := out[a.LeaveRequestID]; exists {
			continue
		}
		if a.Comments != nil && strings.TrimSpace(*a.Comments) != "" {
			out[a.LeaveRequestID] = strings.TrimSpace(*a.Comments)
		}
	}
	return out
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
