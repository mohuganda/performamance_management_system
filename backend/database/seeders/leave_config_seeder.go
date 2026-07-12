package seeders

import (
	"encoding/json"

	"goravel/app/facades"
	"goravel/app/models"
)

type LeaveConfigSeeder struct{}

func (s *LeaveConfigSeeder) Signature() string {
	return "LeaveConfigSeeder"
}

func (s *LeaveConfigSeeder) Run() error {
	if err := s.seedSettings(); err != nil {
		return err
	}
	if err := s.seedApprovalStages(); err != nil {
		return err
	}
	if err := s.seedLeaveTypes(); err != nil {
		return err
	}
	return s.seedEntitlements()
}

func (s *LeaveConfigSeeder) seedSettings() error {
	settings := []struct {
		key         string
		value       any
		description string
	}{
		{"advance_notice_days", 14, "Minimum days before leave start"},
		{"enforce_advance_notice", true, "Require advance notice before leave start"},
		{"block_past_dates", true, "Disallow leave applications for past dates"},
		{"exempt_sick_leave_advance_notice", true, "Exempt sick leave from advance notice policy"},
		{"work_hours", map[string]string{"morning": "08:00-12:45", "afternoon": "14:00-17:00"}, "Official work hours"},
		{"carry_over_deadline", "12-15", "Carry-over request deadline (MM-DD)"},
		{"clock_window_morning", "08:00-08:30", "Morning clock-in window"},
		{"allow_carry_over", true, "Whether carry-over is permitted"},
		{"vesting_month", 1, "Month annual leave vests (1-12)"},
		{"vesting_day", 1, "Day annual leave vests"},
	}

	for _, setting := range settings {
		var existing models.SystemConfig
		if err := facades.Orm().Query().Where("key", setting.key).FirstOr(&existing, func() error {
			payload, _ := json.Marshal(setting.value)
			desc := setting.description
			return facades.Orm().Query().Create(&models.SystemConfig{
				Key:         setting.key,
				Value:       string(payload),
				GroupName:   "leave",
				Description: &desc,
				IsPublic:    true,
			})
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *LeaveConfigSeeder) seedApprovalStages() error {
	stages := []models.LeaveApprovalStage{
		{Code: "employee", Name: "Employee Submission", Sequence: 1, ApproverRole: "health_worker", IsActive: true},
		{Code: "supervisor", Name: "Head of Unit / Supervisor", Sequence: 2, ApproverRole: "supervisor", IsActive: true},
		{Code: "responsible_officer", Name: "Responsible Officer", Sequence: 3, ApproverRole: "department_head", IsActive: true},
		{Code: "hr", Name: "HR / Records", Sequence: 4, ApproverRole: "hr_manager", IsActive: true},
	}
	for _, stage := range stages {
		var existing models.LeaveApprovalStage
		if err := facades.Orm().Query().Where("code", stage.Code).FirstOr(&existing, func() error {
			return facades.Orm().Query().Create(&stage)
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *LeaveConfigSeeder) seedLeaveTypes() error {
	medicalAfter := 2
	types := []models.LeaveType{
		{
			Name: "Annual Leave", Code: "annual", IsActive: true, SortOrder: 1,
			EligibilityNotes: strPtr("Full-time public officers; vests 1 January"),
			RequiresSupervisorApproval: true,
		},
		{
			Name: "Sick Leave", Code: "sick", IsActive: true, SortOrder: 2,
			MaxDaysPerYear: intPtr(90), MedicalReportAfterDays: &medicalAfter,
			EligibilityNotes: strPtr("Requires Government Medical Officer report after 2 working days"),
			RequiresSupervisorApproval: true,
		},
		{
			Name: "Maternity Leave", Code: "maternity", IsActive: true, SortOrder: 3,
			MaxDaysPerYear: intPtr(60), MaxDaysPerRequest: intPtr(60),
			RequiresSupervisorApproval: true, RequiresHrApproval: true,
		},
		{
			Name: "Paternity Leave", Code: "paternity", IsActive: true, SortOrder: 4,
			MaxDaysPerYear: intPtr(4), MaxDaysPerRequest: intPtr(4),
			RequiresSupervisorApproval: true,
		},
		{
			Name: "Study Leave", Code: "study", IsActive: true, SortOrder: 5,
			RequiresSupervisorApproval: true, RequiresHrApproval: true,
		},
		{
			Name: "Special Leave of Absence", Code: "special", IsActive: true, SortOrder: 6,
			MaxDaysPerYear: intPtr(10), MaxDaysPerRequest: intPtr(10),
			RequiresSupervisorApproval: true,
		},
	}
	for _, lt := range types {
		var existing models.LeaveType
		if err := facades.Orm().Query().Where("code", lt.Code).FirstOr(&existing, func() error {
			return facades.Orm().Query().Create(&lt)
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *LeaveConfigSeeder) seedEntitlements() error {
	var annual models.LeaveType
	if err := facades.Orm().Query().Where("code", "annual").First(&annual); err != nil || !modelFound(annual.ID) {
		return nil
	}

	entitlements := []struct {
		grade string
		days  int
	}{
		{"U2", 36}, {"U3", 30}, {"U4", 30}, {"U5", 30},
		{"U6", 30}, {"U7", 30}, {"U8", 24},
	}
	for _, e := range entitlements {
		var existing models.LeaveEntitlement
		if err := facades.Orm().Query().
			Where("salary_grade", e.grade).
			Where("leave_type_id", annual.ID).
			FirstOr(&existing, func() error {
				return facades.Orm().Query().Create(&models.LeaveEntitlement{
					SalaryGrade: e.grade, LeaveTypeID: annual.ID, DaysPerYear: e.days,
				})
			}); err != nil {
			return err
		}
	}
	return nil
}
