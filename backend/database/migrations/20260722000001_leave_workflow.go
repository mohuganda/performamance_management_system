package migrations

import (
	"strings"

	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
	"goravel/app/models"
)

type M20260722000001LeaveWorkflow struct{}

func (r *M20260722000001LeaveWorkflow) Signature() string {
	return "20260722000001_leave_workflow"
}

func (r *M20260722000001LeaveWorkflow) Up() error {
	if err := r.createWorkflowProfiles(); err != nil {
		return err
	}
	if err := r.alterLeaveApprovalStages(); err != nil {
		return err
	}
	if err := r.alterLeaveTypes(); err != nil {
		return err
	}
	if err := r.alterLeaveApprovals(); err != nil {
		return err
	}
	return r.seedDefaultWorkflows()
}

func (r *M20260722000001LeaveWorkflow) createWorkflowProfiles() error {
	if facades.Schema().HasTable("leave_workflow_profiles") {
		return nil
	}
	return facades.Schema().Create("leave_workflow_profiles", func(table schema.Blueprint) {
		table.ID()
		table.String("code")
		table.String("name")
		table.Text("description").Nullable()
		table.Boolean("is_default").Default(false)
		table.Boolean("is_active").Default(true)
		table.TimestampsTz()
		table.Unique("code")
	})
}

func (r *M20260722000001LeaveWorkflow) alterLeaveApprovalStages() error {
	if !facades.Schema().HasTable("leave_approval_stages") {
		return nil
	}
	err := facades.Schema().Table("leave_approval_stages", func(table schema.Blueprint) {
		if !facades.Schema().HasColumn("leave_approval_stages", "workflow_profile_code") {
			table.String("workflow_profile_code").Default("default")
		}
		if !facades.Schema().HasColumn("leave_approval_stages", "stage_type") {
			table.String("stage_type").Default("supervisor")
		}
		if !facades.Schema().HasColumn("leave_approval_stages", "scope") {
			table.String("scope").Default("none")
		}
		if !facades.Schema().HasColumn("leave_approval_stages", "job_title_id") {
			table.UnsignedBigInteger("job_title_id").Nullable()
		}
		if !facades.Schema().HasColumn("leave_approval_stages", "job_title_match") {
			table.String("job_title_match").Nullable()
		}
		if !facades.Schema().HasColumn("leave_approval_stages", "supervisor_sequence") {
			table.UnsignedTinyInteger("supervisor_sequence").Nullable()
		}
		if !facades.Schema().HasColumn("leave_approval_stages", "is_required") {
			table.Boolean("is_required").Default(true)
		}
		if !facades.Schema().HasColumn("leave_approval_stages", "skip_if_unresolved") {
			table.Boolean("skip_if_unresolved").Default(true)
		}
	})
	if err != nil {
		return err
	}
	return r.rebuildStageUniqueIndex()
}

func (r *M20260722000001LeaveWorkflow) rebuildStageUniqueIndex() error {
	if !facades.Schema().HasTable("leave_approval_stages") {
		return nil
	}
	// Allow the same stage code under different workflow profiles.
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
	_, _ = facades.Orm().Query().Model(&models.LeaveApprovalStage{}).
		Where("workflow_profile_code IS NULL OR workflow_profile_code = ''").
		Update("workflow_profile_code", "default")
	return nil
}

func (r *M20260722000001LeaveWorkflow) alterLeaveTypes() error {
	if !facades.Schema().HasTable("leave_types") {
		return nil
	}
	return facades.Schema().Table("leave_types", func(table schema.Blueprint) {
		if !facades.Schema().HasColumn("leave_types", "workflow_profile_code") {
			table.String("workflow_profile_code").Default("default")
		}
	})
}

func (r *M20260722000001LeaveWorkflow) alterLeaveApprovals() error {
	if !facades.Schema().HasTable("leave_approvals") {
		return nil
	}
	return facades.Schema().Table("leave_approvals", func(table schema.Blueprint) {
		if !facades.Schema().HasColumn("leave_approvals", "stage_code") {
			table.String("stage_code").Nullable()
		}
		if !facades.Schema().HasColumn("leave_approvals", "stage_type") {
			table.String("stage_type").Nullable()
		}
		if !facades.Schema().HasColumn("leave_approvals", "stage_name") {
			table.String("stage_name").Nullable()
		}
	})
}

func (r *M20260722000001LeaveWorkflow) Down() error {
	return nil
}

func (r *M20260722000001LeaveWorkflow) seedDefaultWorkflows() error {
	profiles := []models.LeaveWorkflowProfile{
		{
			Code:        "default",
			Name:        "Standard staff",
			Description: strPtr("Supervisor 1 → facility HR → HR records"),
			IsDefault:   true,
			IsActive:    true,
		},
		{
			Code:        "ministry_senior",
			Name:        "Ministry / director",
			Description: strPtr("Supervisor 1 → ministry HR → Permanent Secretary → HR records"),
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

func strPtr(v string) *string {
	return &v
}
