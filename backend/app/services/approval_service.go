package services

import (
	"fmt"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type ApprovalService struct{}

func NewApprovalService() *ApprovalService {
	return &ApprovalService{}
}

func (s *ApprovalService) LoadCurrentSupervisors(staffID uint) ([]models.StaffSupervisor, error) {
	var contract models.StaffContract
	err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("contract_status", "active").
		First(&contract)
	if err != nil {
		return nil, fmt.Errorf("active contract not found for staff %d", staffID)
	}

	var supervisors []models.StaffSupervisor
	if err := facades.Orm().Query().
		Where("staff_contract_id", contract.ID).
		Where("is_current", true).
		Order("approval_sequence asc").
		Get(&supervisors); err != nil {
		return nil, err
	}

	return supervisors, nil
}

func (s *ApprovalService) SeedLeaveApprovals(requestID uint, staffID uint, leaveType models.LeaveType) error {
	workflow := NewLeaveWorkflowService()
	plan, _, err := workflow.BuildApprovalPlan(staffID, leaveType)
	if err != nil {
		return err
	}

	for _, row := range plan {
		approval := row
		approval.LeaveRequestID = requestID
		if err := facades.Orm().Query().Create(&approval); err != nil {
			return err
		}
	}

	var request models.LeaveRequest
	if err := facades.Orm().Query().Where("id", requestID).First(&request); err == nil && request.ID > 0 {
		if len(plan) > 0 && plan[0].StageCode != nil {
			request.ApprovalStage = *plan[0].StageCode
		}
		_ = facades.Orm().Query().Save(&request)
	}

	return nil
}

func (s *ApprovalService) SeedOutOfStationApprovals(requestID uint, staffID uint) error {
	supervisors, err := s.LoadCurrentSupervisors(staffID)
	if err != nil {
		return err
	}
	if len(supervisors) == 0 {
		return fmt.Errorf("no supervisors configured for staff %d", staffID)
	}

	for _, sup := range supervisors {
		approval := models.OutOfStationApproval{
			OutOfStationRequestID: requestID,
			SupervisorStaffID:     sup.SupervisorStaffID,
			Sequence:              sup.ApprovalSequence,
			Status:                "pending",
		}
		if err := facades.Orm().Query().Create(&approval); err != nil {
			return err
		}
	}

	return nil
}

func (s *ApprovalService) ActOnLeaveApproval(approvalID uint, supervisorStaffID uint, approve bool, comments string) error {
	var approval models.LeaveApproval
	if err := facades.Orm().Query().Where("id", approvalID).First(&approval); err != nil {
		return fmt.Errorf("approval not found")
	}
	if approval.SupervisorStaffID != supervisorStaffID {
		return fmt.Errorf("not authorized to act on this approval")
	}
	if approval.Status != "pending" {
		return fmt.Errorf("approval already acted on")
	}

	var request models.LeaveRequest
	if err := facades.Orm().Query().Where("id", approval.LeaveRequestID).First(&request); err != nil {
		return err
	}
	if request.CurrentApprovalSequence != approval.Sequence {
		return fmt.Errorf("previous approvers must act first (sequence %d)", request.CurrentApprovalSequence)
	}

	now := time.Now()
	if approve {
		approval.Status = "approved"
	} else {
		approval.Status = "rejected"
	}
	approval.Comments = strPtrIf(comments)
	approval.ActedAt = &now
	if err := facades.Orm().Query().Save(&approval); err != nil {
		return err
	}

	if !approve {
		request.Status = "rejected"
		return facades.Orm().Query().Save(&request)
	}

	var pending int64
	pending, err := facades.Orm().Query().Model(&models.LeaveApproval{}).
		Where("leave_request_id", request.ID).
		Where("status", "pending").
		Count()
	if err != nil {
		return err
	}

	if pending == 0 {
		hrStage := s.hrFinalizeStageForRequest(request)
		request.Status = "approved"
		request.ApprovalStage = hrStage
		return facades.Orm().Query().Save(&request)
	}

	var next models.LeaveApproval
	_ = facades.Orm().Query().
		Where("leave_request_id", request.ID).
		Where("status", "pending").
		Order("sequence asc").
		First(&next)
	if next.StageCode != nil {
		request.ApprovalStage = *next.StageCode
	}
	request.CurrentApprovalSequence = next.Sequence
	request.Status = "pending"
	return facades.Orm().Query().Save(&request)
}

func (s *ApprovalService) hrFinalizeStageForRequest(request models.LeaveRequest) string {
	leaveType, err := NewLeaveConfigService().GetTypeByID(request.LeaveTypeID)
	if err != nil {
		return "hr"
	}
	stages, err := NewLeaveWorkflowService().StagesForProfile(NewLeaveWorkflowService().ProfileForLeaveType(leaveType))
	if err != nil {
		return "hr"
	}
	for _, stage := range stages {
		if stage.StageType == "hr_finalize" {
			return stage.Code
		}
	}
	return "hr"
}

func (s *ApprovalService) ActOnOutOfStationApproval(approvalID uint, supervisorStaffID uint, approve bool, comments string) error {
	var approval models.OutOfStationApproval
	if err := facades.Orm().Query().Where("id", approvalID).First(&approval); err != nil {
		return fmt.Errorf("approval not found")
	}
	if approval.SupervisorStaffID != supervisorStaffID {
		return fmt.Errorf("not authorized to act on this approval")
	}
	if approval.Status != "pending" {
		return fmt.Errorf("approval already acted on")
	}

	var request models.OutOfStationRequest
	if err := facades.Orm().Query().Where("id", approval.OutOfStationRequestID).First(&request); err != nil {
		return err
	}
	if request.CurrentApprovalSequence != approval.Sequence {
		return fmt.Errorf("previous approvers must act first (sequence %d)", request.CurrentApprovalSequence)
	}

	now := time.Now()
	if approve {
		approval.Status = "approved"
	} else {
		approval.Status = "rejected"
	}
	approval.Comments = strPtrIf(comments)
	approval.ActedAt = &now
	if err := facades.Orm().Query().Save(&approval); err != nil {
		return err
	}

	if !approve {
		request.Status = "rejected"
		return facades.Orm().Query().Save(&request)
	}

	pending, err := facades.Orm().Query().Model(&models.OutOfStationApproval{}).
		Where("out_of_station_request_id", request.ID).
		Where("status", "pending").
		Count()
	if err != nil {
		return err
	}

	if pending == 0 {
		request.Status = "approved"
		return facades.Orm().Query().Save(&request)
	}

	request.CurrentApprovalSequence = approval.Sequence + 1
	request.Status = "pending"
	return facades.Orm().Query().Save(&request)
}

func strPtrIf(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}

type PendingLeaveApproval struct {
	ApprovalID    uint   `json:"approval_id"`
	RequestID     uint   `json:"request_id"`
	StaffName     string `json:"staff_name"`
	LeaveTypeName string `json:"leave_type_name"`
	StartDate     string `json:"start_date"`
	EndDate       string `json:"end_date"`
	DaysRequested int    `json:"days_requested"`
	Reason        string `json:"reason"`
	Status        string `json:"status"`
	StageName     string `json:"stage_name,omitempty"`
	StageCode     string `json:"stage_code,omitempty"`
}

type PendingOosApproval struct {
	ApprovalID   uint   `json:"approval_id"`
	RequestID    uint   `json:"request_id"`
	StaffName    string `json:"staff_name"`
	ReasonName   string `json:"reason_name"`
	StartDate    string `json:"start_date"`
	EndDate      string `json:"end_date"`
	Destination  string `json:"destination"`
	Status       string `json:"status"`
}

func (s *ApprovalService) ListPendingLeaveApprovals(supervisorStaffID uint) ([]PendingLeaveApproval, error) {
	var approvals []models.LeaveApproval
	if err := facades.Orm().Query().
		Where("supervisor_staff_id", supervisorStaffID).
		Where("status", "pending").
		Order("created_at asc").
		Get(&approvals); err != nil {
		return nil, err
	}

	result := make([]PendingLeaveApproval, 0)
	for _, approval := range approvals {
		var request models.LeaveRequest
		if err := facades.Orm().Query().Where("id", approval.LeaveRequestID).First(&request); err != nil || request.ID == 0 {
			continue
		}
		if request.Status != "pending" || request.CurrentApprovalSequence != approval.Sequence {
			continue
		}

		var staff models.Staff
		_ = facades.Orm().Query().Where("id", request.StaffID).First(&staff)

		leaveType, _ := NewLeaveConfigService().GetTypeByID(request.LeaveTypeID)
		reason := ""
		if request.Reason != nil {
			reason = *request.Reason
		}

		result = append(result, PendingLeaveApproval{
			ApprovalID:    approval.ID,
			RequestID:     request.ID,
			StaffName:     staffDisplayName(staff),
			LeaveTypeName: leaveType.Name,
			StartDate:     request.StartDate.Format("2006-01-02"),
			EndDate:       request.EndDate.Format("2006-01-02"),
			DaysRequested: request.DaysRequested,
			Reason:        reason,
			Status:        request.Status,
			StageName:     deref(approval.StageName),
			StageCode:     deref(approval.StageCode),
		})
	}

	return result, nil
}

func (s *ApprovalService) ListPendingOosApprovals(supervisorStaffID uint) ([]PendingOosApproval, error) {
	var approvals []models.OutOfStationApproval
	if err := facades.Orm().Query().
		Where("supervisor_staff_id", supervisorStaffID).
		Where("status", "pending").
		Order("created_at asc").
		Get(&approvals); err != nil {
		return nil, err
	}

	result := make([]PendingOosApproval, 0)
	for _, approval := range approvals {
		var request models.OutOfStationRequest
		if err := facades.Orm().Query().Where("id", approval.OutOfStationRequestID).First(&request); err != nil || request.ID == 0 {
			continue
		}
		if request.Status != "pending" || request.CurrentApprovalSequence != approval.Sequence {
			continue
		}

		var staff models.Staff
		_ = facades.Orm().Query().Where("id", request.StaffID).First(&staff)

		var reason models.OutOfStationReason
		_ = facades.Orm().Query().Where("id", request.ReasonID).First(&reason)

		dest := request.DestinationName
		if dest == "" && request.DestinationAddress != nil {
			dest = *request.DestinationAddress
		}

		result = append(result, PendingOosApproval{
			ApprovalID:  approval.ID,
			RequestID:   request.ID,
			StaffName:   staffDisplayName(staff),
			ReasonName:  reason.Reason,
			StartDate:   request.StartDate.Format("2006-01-02"),
			EndDate:     request.EndDate.Format("2006-01-02"),
			Destination: dest,
			Status:      request.Status,
		})
	}

	return result, nil
}
