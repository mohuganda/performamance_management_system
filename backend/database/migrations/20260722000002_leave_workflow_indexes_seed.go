package migrations

import (
	"strings"

	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/support/dbdialect"
)

// M20260722000002LeaveWorkflowIndexesSeed runs after leave_workflow schema alters so
// raw DDL (drop code-unique / create composite unique) is not blocked by an open
// Schema transaction on another connection.
type M20260722000002LeaveWorkflowIndexesSeed struct{}

func (r *M20260722000002LeaveWorkflowIndexesSeed) Signature() string {
	return "20260722000002_leave_workflow_indexes_seed"
}

func (r *M20260722000002LeaveWorkflowIndexesSeed) Up() error {
	if err := r.rebuildStageUniqueIndex(); err != nil {
		return err
	}
	return r.seedDefaultWorkflows()
}

func (r *M20260722000002LeaveWorkflowIndexesSeed) Down() error {
	return nil
}

func (r *M20260722000002LeaveWorkflowIndexesSeed) rebuildStageUniqueIndex() error {
	if !facades.Schema().HasTable("leave_approval_stages") {
		return nil
	}
	// Allow the same stage code under different workflow profiles.
	if dbdialect.IsPostgres() {
		drops := []string{
			`ALTER TABLE leave_approval_stages DROP CONSTRAINT IF EXISTS leave_approval_stages_code_unique`,
			`DROP INDEX IF EXISTS leave_approval_stages_code_unique`,
			`DROP INDEX IF EXISTS idx_leave_stage_profile_code`,
		}
		for _, stmt := range drops {
			_, _ = facades.Orm().Query().Exec(stmt)
		}
		_, err := facades.Orm().Query().Exec(
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_stage_profile_code ON leave_approval_stages (workflow_profile_code, code)`,
		)
		if err != nil && !strings.Contains(strings.ToLower(err.Error()), "already exists") {
			return err
		}
	} else {
		drops := []string{
			"ALTER TABLE leave_approval_stages DROP INDEX leave_approval_stages_code_unique",
			"ALTER TABLE leave_approval_stages DROP INDEX code",
			"ALTER TABLE leave_approval_stages DROP INDEX idx_leave_stage_profile_code",
		}
		for _, stmt := range drops {
			_, _ = facades.Orm().Query().Exec(stmt)
		}
		_, err := facades.Orm().Query().Exec(
			"ALTER TABLE leave_approval_stages ADD UNIQUE INDEX idx_leave_stage_profile_code (workflow_profile_code, code)",
		)
		if err != nil && !strings.Contains(strings.ToLower(err.Error()), "duplicate key name") {
			return err
		}
	}
	_, _ = facades.Orm().Query().Model(&models.LeaveApprovalStage{}).
		Where("workflow_profile_code IS NULL OR workflow_profile_code = ''").
		Update("workflow_profile_code", "default")
	return nil
}

func (r *M20260722000002LeaveWorkflowIndexesSeed) seedDefaultWorkflows() error {
	profiles := []models.LeaveWorkflowProfile{
		{
			Code:        "default",
			Name:        "Standard staff",
			Description: leaveWorkflowStrPtr("Supervisor 1 → facility HR → HR records"),
			IsDefault:   true,
			IsActive:    true,
		},
		{
			Code:        "ministry_senior",
			Name:        "Ministry / director",
			Description: leaveWorkflowStrPtr("Supervisor 1 → ministry HR → Permanent Secretary → HR records"),
			IsActive:    true,
		},
	}
	for _, profile := range profiles {
		var existing models.LeaveWorkflowProfile
		if err := facades.Orm().Query().Where("code", profile.Code).FirstOr(&existing, func() error {
			return facades.Orm().Query().Create(&profile)
		}); err != nil {
			return err
		}
	}

	supervisorSeq := uint8(1)
	hrMatch := "Human Resource"
	psMatch := "Permanent Secretary"
	stages := []models.LeaveApprovalStage{
		{WorkflowProfileCode: "default", Code: "employee", Name: "Employee submission", Sequence: 1, ApproverRole: "health_worker", StageType: "employee", Scope: "none", IsActive: true, IsRequired: false},
		{WorkflowProfileCode: "default", Code: "supervisor_1", Name: "First supervisor", Sequence: 2, ApproverRole: "supervisor", StageType: "supervisor", Scope: "none", SupervisorSequence: &supervisorSeq, IsActive: true, IsRequired: true, SkipIfUnresolved: false},
		{WorkflowProfileCode: "default", Code: "facility_hr", Name: "Facility HR Manager", Sequence: 3, ApproverRole: "hr_manager", StageType: "job_holder", Scope: "facility", JobTitleMatch: &hrMatch, IsActive: true, IsRequired: false, SkipIfUnresolved: true},
		{WorkflowProfileCode: "default", Code: "hr", Name: "HR records", Sequence: 4, ApproverRole: "hr_manager", StageType: "hr_finalize", Scope: "none", IsActive: true, IsRequired: true},

		{WorkflowProfileCode: "ministry_senior", Code: "employee", Name: "Employee submission", Sequence: 1, ApproverRole: "health_worker", StageType: "employee", Scope: "none", IsActive: true},
		{WorkflowProfileCode: "ministry_senior", Code: "supervisor_1", Name: "First supervisor", Sequence: 2, ApproverRole: "supervisor", StageType: "supervisor", Scope: "none", SupervisorSequence: &supervisorSeq, IsActive: true, IsRequired: true},
		{WorkflowProfileCode: "ministry_senior", Code: "ministry_hr", Name: "Ministry HR", Sequence: 3, ApproverRole: "hr_manager", StageType: "job_holder", Scope: "ministry", JobTitleMatch: &hrMatch, IsActive: true, SkipIfUnresolved: true},
		{WorkflowProfileCode: "ministry_senior", Code: "permanent_secretary", Name: "Permanent Secretary", Sequence: 4, ApproverRole: "executive", StageType: "job_holder", Scope: "ministry", JobTitleMatch: &psMatch, IsActive: true, SkipIfUnresolved: true},
		{WorkflowProfileCode: "ministry_senior", Code: "hr", Name: "HR records", Sequence: 5, ApproverRole: "hr_manager", StageType: "hr_finalize", Scope: "none", IsActive: true},
	}

	for _, stage := range stages {
		var existing models.LeaveApprovalStage
		err := facades.Orm().Query().
			Where("workflow_profile_code", stage.WorkflowProfileCode).
			Where("code", stage.Code).
			First(&existing)
		if err != nil || existing.ID == 0 {
			if err := facades.Orm().Query().Create(&stage); err != nil {
				return err
			}
			continue
		}
		existing.Name = stage.Name
		existing.Sequence = stage.Sequence
		existing.ApproverRole = stage.ApproverRole
		existing.StageType = stage.StageType
		existing.Scope = stage.Scope
		existing.JobTitleMatch = stage.JobTitleMatch
		existing.SupervisorSequence = stage.SupervisorSequence
		existing.IsActive = stage.IsActive
		existing.IsRequired = stage.IsRequired
		existing.SkipIfUnresolved = stage.SkipIfUnresolved
		if err := facades.Orm().Query().Save(&existing); err != nil {
			return err
		}
	}

	_, _ = facades.Orm().Query().Model(&models.LeaveType{}).
		Where("workflow_profile_code IS NULL OR workflow_profile_code = ''").
		Update("workflow_profile_code", "default")
	_, _ = facades.Orm().Query().Model(&models.LeaveType{}).
		Where("code IN ?", []string{"study"}).
		Update("workflow_profile_code", "ministry_senior")

	return nil
}

func leaveWorkflowStrPtr(v string) *string {
	return &v
}
