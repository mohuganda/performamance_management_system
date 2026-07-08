package services

import (
	"encoding/json"
	"fmt"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type LeaveConfigService struct{}

func NewLeaveConfigService() *LeaveConfigService {
	return &LeaveConfigService{}
}

type LeavePolicySettings struct {
	AdvanceNoticeDays    int               `json:"advance_notice_days"`
	WorkHours            map[string]string `json:"work_hours"`
	CarryOverDeadline    string            `json:"carry_over_deadline"`
	ClockWindowMorning   string            `json:"clock_window_morning"`
	AllowCarryOver       bool              `json:"allow_carry_over"`
	VestingMonth         int               `json:"vesting_month"`
	VestingDay           int               `json:"vesting_day"`
}

func (s *LeaveConfigService) defaultSettings() LeavePolicySettings {
	return LeavePolicySettings{
		AdvanceNoticeDays:  14,
		WorkHours:          map[string]string{"morning": "08:00-12:45", "afternoon": "14:00-17:00"},
		CarryOverDeadline:  "12-15",
		ClockWindowMorning: "08:00-08:30",
		AllowCarryOver:     true,
		VestingMonth:       1,
		VestingDay:         1,
	}
}

func (s *LeaveConfigService) LoadSettings() (LeavePolicySettings, error) {
	settings := s.defaultSettings()
	var configs []models.SystemConfig
	if err := facades.Orm().Query().Where("group_name", "leave").Get(&configs); err != nil {
		return settings, err
	}
	for _, cfg := range configs {
		switch cfg.Key {
		case "advance_notice_days":
			var v int
			if json.Unmarshal([]byte(cfg.Value), &v) == nil {
				settings.AdvanceNoticeDays = v
			}
		case "work_hours":
			var v map[string]string
			if json.Unmarshal([]byte(cfg.Value), &v) == nil {
				settings.WorkHours = v
			}
		case "carry_over_deadline":
			settings.CarryOverDeadline = trimJSONString(cfg.Value)
		case "clock_window_morning":
			settings.ClockWindowMorning = trimJSONString(cfg.Value)
		case "allow_carry_over":
			var v bool
			if json.Unmarshal([]byte(cfg.Value), &v) == nil {
				settings.AllowCarryOver = v
			}
		case "vesting_month":
			var v int
			if json.Unmarshal([]byte(cfg.Value), &v) == nil {
				settings.VestingMonth = v
			}
		case "vesting_day":
			var v int
			if json.Unmarshal([]byte(cfg.Value), &v) == nil {
				settings.VestingDay = v
			}
		}
	}
	return settings, nil
}

func trimJSONString(raw string) string {
	var v string
	if json.Unmarshal([]byte(raw), &v) == nil {
		return v
	}
	return raw
}

func (s *LeaveConfigService) SaveSetting(key string, value any, description string, isPublic bool) error {
	payload, err := json.Marshal(value)
	if err != nil {
		return err
	}

	var existing models.SystemConfig
	err = facades.Orm().Query().Where("key", key).First(&existing)
	if err != nil {
		cfg := models.SystemConfig{
			Key:       key,
			Value:     string(payload),
			GroupName: "leave",
			IsPublic:  isPublic,
		}
		if description != "" {
			cfg.Description = &description
		}
		return facades.Orm().Query().Create(&cfg)
	}

	existing.Value = string(payload)
	existing.GroupName = "leave"
	existing.IsPublic = isPublic
	if description != "" {
		existing.Description = &description
	}
	return facades.Orm().Query().Save(&existing)
}

func (s *LeaveConfigService) PublicLeaveConfig() (map[string]any, error) {
	settings, err := s.LoadSettings()
	if err != nil {
		return nil, err
	}

	types, err := s.ListActiveTypes()
	if err != nil {
		return nil, err
	}

	stages, err := s.ListActiveApprovalStages()
	if err != nil {
		return nil, err
	}

	entitlements, err := s.ListEntitlements()
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"settings":     settings,
		"types":        types,
		"stages":       stages,
		"entitlements": entitlements,
		"profiles":     s.listWorkflowProfiles(),
	}, nil
}

func (s *LeaveConfigService) listWorkflowProfiles() []models.LeaveWorkflowProfile {
	rows, _ := NewLeaveWorkflowService().ListProfiles()
	if rows == nil {
		return []models.LeaveWorkflowProfile{}
	}
	return rows
}

func (s *LeaveConfigService) ListActiveTypes() ([]models.LeaveType, error) {
	var rows []models.LeaveType
	err := facades.Orm().Query().
		Where("is_active", true).
		Order("sort_order asc, name asc").
		Get(&rows)
	return rows, err
}

func (s *LeaveConfigService) ListAllTypes() ([]models.LeaveType, error) {
	var rows []models.LeaveType
	err := facades.Orm().Query().Order("sort_order asc, name asc").Get(&rows)
	return rows, err
}

func (s *LeaveConfigService) GetTypeByID(id uint) (models.LeaveType, error) {
	var row models.LeaveType
	err := facades.Orm().Query().Where("id", id).First(&row)
	return row, err
}

func (s *LeaveConfigService) CreateType(input models.LeaveType) (models.LeaveType, error) {
	if err := facades.Orm().Query().Create(&input); err != nil {
		return models.LeaveType{}, err
	}
	return input, nil
}

func (s *LeaveConfigService) UpdateType(id uint, input models.LeaveType) (models.LeaveType, error) {
	existing, err := s.GetTypeByID(id)
	if err != nil {
		return models.LeaveType{}, fmt.Errorf("leave type not found")
	}
	existing.Name = input.Name
	existing.Code = input.Code
	existing.Description = input.Description
	existing.IsActive = input.IsActive
	existing.MaxDaysPerYear = input.MaxDaysPerYear
	existing.MaxDaysPerRequest = input.MaxDaysPerRequest
	existing.AdvanceNoticeDays = input.AdvanceNoticeDays
	existing.MedicalReportAfterDays = input.MedicalReportAfterDays
	existing.SortOrder = input.SortOrder
	existing.EligibilityNotes = input.EligibilityNotes
	existing.RequiresSupervisorApproval = input.RequiresSupervisorApproval
	existing.RequiresHrApproval = input.RequiresHrApproval
	existing.WorkflowProfileCode = input.WorkflowProfileCode
	if err := facades.Orm().Query().Save(&existing); err != nil {
		return models.LeaveType{}, err
	}
	return existing, nil
}

func (s *LeaveConfigService) DeactivateType(id uint) error {
	existing, err := s.GetTypeByID(id)
	if err != nil {
		return fmt.Errorf("leave type not found")
	}
	existing.IsActive = false
	return facades.Orm().Query().Save(&existing)
}

func (s *LeaveConfigService) ListEntitlements() ([]models.LeaveEntitlement, error) {
	var rows []models.LeaveEntitlement
	err := facades.Orm().Query().Order("salary_grade asc").Get(&rows)
	return rows, err
}

func (s *LeaveConfigService) CreateEntitlement(input models.LeaveEntitlement) (models.LeaveEntitlement, error) {
	if err := facades.Orm().Query().Create(&input); err != nil {
		return models.LeaveEntitlement{}, err
	}
	return input, nil
}

func (s *LeaveConfigService) UpdateEntitlement(id uint, input models.LeaveEntitlement) (models.LeaveEntitlement, error) {
	var existing models.LeaveEntitlement
	if err := facades.Orm().Query().Where("id", id).First(&existing); err != nil {
		return models.LeaveEntitlement{}, fmt.Errorf("entitlement not found")
	}
	existing.SalaryGrade = input.SalaryGrade
	existing.LeaveTypeID = input.LeaveTypeID
	existing.DaysPerYear = input.DaysPerYear
	existing.MedicalReportAfterDays = input.MedicalReportAfterDays
	existing.RequiresHrFinalization = input.RequiresHrFinalization
	if err := facades.Orm().Query().Save(&existing); err != nil {
		return models.LeaveEntitlement{}, err
	}
	return existing, nil
}

func (s *LeaveConfigService) DeleteEntitlement(id uint) error {
	_, err := facades.Orm().Query().Where("id", id).Delete(&models.LeaveEntitlement{})
	return err
}

func (s *LeaveConfigService) ListActiveApprovalStages() ([]models.LeaveApprovalStage, error) {
	var rows []models.LeaveApprovalStage
	err := facades.Orm().Query().
		Where("is_active", true).
		Order("sequence asc").
		Get(&rows)
	return rows, err
}

func (s *LeaveConfigService) ListAllApprovalStages() ([]models.LeaveApprovalStage, error) {
	var rows []models.LeaveApprovalStage
	err := facades.Orm().Query().Order("sequence asc").Get(&rows)
	return rows, err
}

func (s *LeaveConfigService) CreateApprovalStage(input models.LeaveApprovalStage) (models.LeaveApprovalStage, error) {
	if err := facades.Orm().Query().Create(&input); err != nil {
		return models.LeaveApprovalStage{}, err
	}
	return input, nil
}

func (s *LeaveConfigService) UpdateApprovalStage(id uint, input models.LeaveApprovalStage) (models.LeaveApprovalStage, error) {
	var existing models.LeaveApprovalStage
	if err := facades.Orm().Query().Where("id", id).First(&existing); err != nil {
		return models.LeaveApprovalStage{}, fmt.Errorf("approval stage not found")
	}
	existing.Code = input.Code
	existing.Name = input.Name
	existing.Sequence = input.Sequence
	existing.ApproverRole = input.ApproverRole
	existing.Description = input.Description
	existing.IsActive = input.IsActive
	existing.WorkflowProfileCode = input.WorkflowProfileCode
	existing.StageType = input.StageType
	existing.Scope = input.Scope
	existing.JobTitleID = input.JobTitleID
	existing.JobTitleMatch = input.JobTitleMatch
	existing.SupervisorSequence = input.SupervisorSequence
	existing.IsRequired = input.IsRequired
	existing.SkipIfUnresolved = input.SkipIfUnresolved
	if err := facades.Orm().Query().Save(&existing); err != nil {
		return models.LeaveApprovalStage{}, err
	}
	return existing, nil
}

func (s *LeaveConfigService) EntitlementForStaff(staffID uint, leaveTypeID uint) (*models.LeaveEntitlement, error) {
	var contract models.StaffContract
	if err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("contract_status", "active").
		First(&contract); err != nil {
		return nil, nil
	}
	if contract.SalaryGrade == nil || *contract.SalaryGrade == "" {
		return nil, nil
	}

	var entitlement models.LeaveEntitlement
	err := facades.Orm().Query().
		Where("salary_grade", *contract.SalaryGrade).
		Where("leave_type_id", leaveTypeID).
		First(&entitlement)
	if err != nil {
		return nil, nil
	}
	return &entitlement, nil
}

func (s *LeaveConfigService) ValidateRequest(leaveType models.LeaveType, staffID uint, startDate, endDate time.Time, medicalReportURL string) error {
	if !leaveType.IsActive {
		return fmt.Errorf("leave type is not active")
	}

	settings, err := s.LoadSettings()
	if err != nil {
		return err
	}

	days := int(endDate.Sub(startDate).Hours()/24) + 1
	if days < 1 {
		return fmt.Errorf("invalid leave duration")
	}

	advanceDays := settings.AdvanceNoticeDays
	if leaveType.AdvanceNoticeDays != nil {
		advanceDays = *leaveType.AdvanceNoticeDays
	}
	if advanceDays > 0 {
		notice := startDate.Sub(time.Now())
		if notice < time.Duration(advanceDays)*24*time.Hour {
			return fmt.Errorf("leave must be requested at least %d days in advance", advanceDays)
		}
	}

	maxPerRequest := leaveType.MaxDaysPerRequest
	if maxPerRequest == nil {
		maxPerRequest = leaveType.MaxDaysPerYear
	}
	if maxPerRequest != nil && days > *maxPerRequest {
		return fmt.Errorf("maximum %d days allowed per request for this leave type", *maxPerRequest)
	}

	entitlement, _ := s.EntitlementForStaff(staffID, leaveType.ID)
	if entitlement != nil && days > entitlement.DaysPerYear {
		return fmt.Errorf("requested days exceed annual entitlement (%d days)", entitlement.DaysPerYear)
	}

	medicalAfter := leaveType.MedicalReportAfterDays
	if medicalAfter == nil && entitlement != nil {
		medicalAfter = entitlement.MedicalReportAfterDays
	}
	if medicalAfter != nil && days > *medicalAfter && medicalReportURL == "" {
		return fmt.Errorf("medical report required for absences longer than %d working days", *medicalAfter)
	}

	return nil
}

func (s *LeaveConfigService) AdvanceNoticeDaysForType(leaveType models.LeaveType) (int, error) {
	settings, err := s.LoadSettings()
	if err != nil {
		return 14, err
	}
	if leaveType.AdvanceNoticeDays != nil {
		return *leaveType.AdvanceNoticeDays, nil
	}
	return settings.AdvanceNoticeDays, nil
}
