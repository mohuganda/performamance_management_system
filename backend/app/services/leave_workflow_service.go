package services

import (
	"fmt"
	"strings"

	"goravel/app/facades"
	"goravel/app/models"
)

type LeaveWorkflowService struct{}

func NewLeaveWorkflowService() *LeaveWorkflowService {
	return &LeaveWorkflowService{}
}

type StaffPlacement struct {
	StaffID       uint
	FacilityID    uint
	FacilityName  string
	DistrictRefID *uint
	RegionID      *uint
	DepartmentID  *uint
	JobID         uint
	JobTitle      string
}

func (s *LeaveWorkflowService) ProfileForLeaveType(leaveType models.LeaveType) string {
	code := strings.TrimSpace(leaveType.WorkflowProfileCode)
	if code == "" {
		return "default"
	}
	return code
}

func (s *LeaveWorkflowService) ListProfiles() ([]models.LeaveWorkflowProfile, error) {
	var rows []models.LeaveWorkflowProfile
	err := facades.Orm().Query().Order("is_default desc, name asc").Get(&rows)
	return rows, err
}

func (s *LeaveWorkflowService) StagesForProfile(profileCode string) ([]models.LeaveApprovalStage, error) {
	code := strings.TrimSpace(profileCode)
	if code == "" {
		code = "default"
	}
	var rows []models.LeaveApprovalStage
	err := facades.Orm().Query().
		Where("workflow_profile_code", code).
		Where("is_active", true).
		Order("sequence asc").
		Get(&rows)
	return rows, err
}

func (s *LeaveWorkflowService) LoadStaffPlacement(staffID uint) (StaffPlacement, error) {
	var contract models.StaffContract
	if err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("contract_status", "active").
		First(&contract); err != nil || contract.ID == 0 {
		return StaffPlacement{}, fmt.Errorf("active contract not found for staff %d", staffID)
	}

	placement := StaffPlacement{
		StaffID:      staffID,
		FacilityID:   contract.FacilityID,
		DepartmentID: contract.DepartmentID,
		JobID:        contract.JobID,
	}
	if contract.DepartmentID != nil {
		placement.DepartmentID = contract.DepartmentID
	}

	var facility models.Facility
	if err := facades.Orm().Query().Where("id", contract.FacilityID).First(&facility); err == nil && facility.ID > 0 {
		placement.FacilityName = facility.Name
		placement.DistrictRefID = facility.DistrictRefID
		placement.RegionID = facility.RegionID
	}

	var job models.JobTitle
	if err := facades.Orm().Query().Where("id", contract.JobID).First(&job); err == nil && job.ID > 0 {
		placement.JobTitle = job.JobTitle
	}

	return placement, nil
}

func (s *LeaveWorkflowService) BuildApprovalPlan(staffID uint, leaveType models.LeaveType) ([]models.LeaveApproval, string, error) {
	profile := s.ProfileForLeaveType(leaveType)
	stages, err := s.StagesForProfile(profile)
	if err != nil {
		return nil, "", err
	}
	if len(stages) == 0 {
		return s.legacySupervisorPlan(staffID)
	}

	placement, err := s.LoadStaffPlacement(staffID)
	if err != nil {
		return nil, "", err
	}

	approvals := make([]models.LeaveApproval, 0)
	seq := uint8(1)
	initialStage := "supervisor"
	hrStageCode := "hr"

	for _, stage := range stages {
		if stage.StageType == "employee" {
			if initialStage == "supervisor" {
				initialStage = stage.Code
			}
			continue
		}
		if stage.StageType == "hr_finalize" {
			hrStageCode = stage.Code
			continue
		}

		resolved, resolveErr := s.resolveStageApprovers(staffID, placement, stage)
		if resolveErr != nil {
			if stage.IsRequired && !stage.SkipIfUnresolved {
				return nil, "", resolveErr
			}
			continue
		}
		if len(resolved) == 0 {
			if stage.IsRequired && !stage.SkipIfUnresolved {
				return nil, "", fmt.Errorf("no approver resolved for stage %q (%s)", stage.Name, stage.Code)
			}
			continue
		}

		for _, approverID := range resolved {
			if approverID == staffID {
				continue
			}
			code := stage.Code
			stageType := stage.StageType
			stageName := stage.Name
			approvals = append(approvals, models.LeaveApproval{
				SupervisorStaffID: approverID,
				Sequence:          seq,
				Status:            "pending",
				StageCode:         &code,
				StageType:         &stageType,
				StageName:         &stageName,
			})
			seq++
		}
	}

	if len(approvals) == 0 {
		return s.legacySupervisorPlan(staffID)
	}

	return approvals, hrStageCode, nil
}

func (s *LeaveWorkflowService) legacySupervisorPlan(staffID uint) ([]models.LeaveApproval, string, error) {
	supervisors, err := NewApprovalService().LoadCurrentSupervisors(staffID)
	if err != nil {
		return nil, "", err
	}
	if len(supervisors) == 0 {
		return nil, "", fmt.Errorf("no supervisors configured for staff %d", staffID)
	}
	approvals := make([]models.LeaveApproval, 0, len(supervisors))
	for _, sup := range supervisors {
		code := "supervisor"
		stageType := "supervisor"
		name := "Supervisor"
		approvals = append(approvals, models.LeaveApproval{
			SupervisorStaffID: sup.SupervisorStaffID,
			Sequence:          sup.ApprovalSequence,
			Status:            "pending",
			StageCode:         &code,
			StageType:         &stageType,
			StageName:         &name,
		})
	}
	return approvals, "hr", nil
}

func (s *LeaveWorkflowService) resolveStageApprovers(staffID uint, placement StaffPlacement, stage models.LeaveApprovalStage) ([]uint, error) {
	switch stage.StageType {
	case "supervisor":
		return s.resolveSupervisorApprovers(staffID, stage)
	case "job_holder":
		id, err := s.resolveJobHolderApprover(placement, stage)
		if err != nil {
			return nil, err
		}
		if id == 0 {
			return nil, nil
		}
		return []uint{id}, nil
	default:
		return nil, nil
	}
}

func (s *LeaveWorkflowService) resolveSupervisorApprovers(staffID uint, stage models.LeaveApprovalStage) ([]uint, error) {
	supervisors, err := NewApprovalService().LoadCurrentSupervisors(staffID)
	if err != nil {
		return nil, err
	}
	if len(supervisors) == 0 {
		return nil, fmt.Errorf("no supervisors configured for staff %d", staffID)
	}
	if stage.SupervisorSequence != nil && *stage.SupervisorSequence > 0 {
		for _, sup := range supervisors {
			if sup.ApprovalSequence == *stage.SupervisorSequence {
				return []uint{sup.SupervisorStaffID}, nil
			}
		}
		return nil, fmt.Errorf("supervisor %d not configured", *stage.SupervisorSequence)
	}
	ids := make([]uint, 0, len(supervisors))
	for _, sup := range supervisors {
		ids = append(ids, sup.SupervisorStaffID)
	}
	return ids, nil
}

func (s *LeaveWorkflowService) resolveJobHolderApprover(placement StaffPlacement, stage models.LeaveApprovalStage) (uint, error) {
	scope := strings.ToLower(strings.TrimSpace(stage.Scope))
	if scope == "" {
		scope = "facility"
	}

	var contracts []models.StaffContract
	query := facades.Orm().Query().
		Where("contract_status", "active").
		Where("staff_id <> ?", placement.StaffID)

	switch scope {
	case "facility":
		query = query.Where("facility_id", placement.FacilityID)
	case "district":
		if placement.DistrictRefID == nil || *placement.DistrictRefID == 0 {
			return 0, nil
		}
		var facilityIDs []uint
		var facilities []models.Facility
		_ = facades.Orm().Query().Where("district_ref_id", *placement.DistrictRefID).Get(&facilities)
		for _, f := range facilities {
			facilityIDs = append(facilityIDs, f.ID)
		}
		if len(facilityIDs) == 0 {
			return 0, nil
		}
		query = query.Where("facility_id IN ?", facilityIDs)
	case "ministry":
		// Ministry-wide: search all active contracts in the organisation.
	default:
		query = query.Where("facility_id", placement.FacilityID)
	}

	if err := query.Get(&contracts); err != nil {
		return 0, err
	}
	if len(contracts) == 0 {
		return 0, nil
	}

	jobIDs := map[uint]struct{}{}
	if stage.JobTitleID != nil && *stage.JobTitleID > 0 {
		jobIDs[*stage.JobTitleID] = struct{}{}
	}

	matchNeedle := ""
	if stage.JobTitleMatch != nil {
		matchNeedle = strings.ToLower(strings.TrimSpace(*stage.JobTitleMatch))
	}

	for _, contract := range contracts {
		if stage.JobTitleID != nil && *stage.JobTitleID > 0 {
			if _, ok := jobIDs[contract.JobID]; ok {
				return contract.StaffID, nil
			}
		}
		if matchNeedle != "" {
			var job models.JobTitle
			if err := facades.Orm().Query().Where("id", contract.JobID).First(&job); err == nil && job.ID > 0 {
				if strings.Contains(strings.ToLower(job.JobTitle), matchNeedle) {
					return contract.StaffID, nil
				}
			}
		}
	}

	return 0, nil
}

func (s *LeaveWorkflowService) HrFinalizeStageCodes() []string {
	var stages []models.LeaveApprovalStage
	_ = facades.Orm().Query().
		Where("stage_type", "hr_finalize").
		Where("is_active", true).
		Get(&stages)
	codes := []string{"hr"}
	seen := map[string]struct{}{"hr": {}}
	for _, stage := range stages {
		if _, ok := seen[stage.Code]; ok {
			continue
		}
		seen[stage.Code] = struct{}{}
		codes = append(codes, stage.Code)
	}
	return codes
}

func (s *LeaveWorkflowService) IsHrFinalizeStage(stageCode string) bool {
	code := strings.TrimSpace(stageCode)
	if code == "" {
		return false
	}
	if code == "hr" {
		return true
	}
	var count int64
	n, err := facades.Orm().Query().Model(&models.LeaveApprovalStage{}).
		Where("code", code).
		Where("stage_type", "hr_finalize").
		Count()
	if err != nil {
		return false
	}
	count = n
	return count > 0
}

func (s *LeaveWorkflowService) CreateProfile(input models.LeaveWorkflowProfile) (models.LeaveWorkflowProfile, error) {
	if err := facades.Orm().Query().Create(&input); err != nil {
		return models.LeaveWorkflowProfile{}, err
	}
	return input, nil
}

func (s *LeaveWorkflowService) UpdateProfile(id uint, input models.LeaveWorkflowProfile) (models.LeaveWorkflowProfile, error) {
	var existing models.LeaveWorkflowProfile
	if err := facades.Orm().Query().Where("id", id).First(&existing); err != nil || existing.ID == 0 {
		return models.LeaveWorkflowProfile{}, fmt.Errorf("workflow profile not found")
	}
	existing.Name = input.Name
	existing.Description = input.Description
	existing.IsDefault = input.IsDefault
	existing.IsActive = input.IsActive
	if err := facades.Orm().Query().Save(&existing); err != nil {
		return models.LeaveWorkflowProfile{}, err
	}
	return existing, nil
}

func (s *LeaveWorkflowService) ListStagesByProfile(profileCode string) ([]models.LeaveApprovalStage, error) {
	code := strings.TrimSpace(profileCode)
	if code == "" {
		code = "default"
	}
	var rows []models.LeaveApprovalStage
	err := facades.Orm().Query().
		Where("workflow_profile_code", code).
		Order("sequence asc").
		Get(&rows)
	return rows, err
}

func (s *LeaveWorkflowService) DeleteStage(id uint) error {
	_, err := facades.Orm().Query().Where("id", id).Delete(&models.LeaveApprovalStage{})
	return err
}
