package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260722000001LeaveWorkflow struct{}

func (r *M20260722000001LeaveWorkflow) Signature() string {
	return "20260722000001_leave_workflow"
}

func (r *M20260722000001LeaveWorkflow) Up() error {
	// Schema-only. Index rebuild + seed run in 20260722000002 so Postgres does not
	// deadlock (Schema().Table holds a TX that blocks later Orm().Exec DDL).
	if err := r.createWorkflowProfiles(); err != nil {
		return err
	}
	if err := r.alterLeaveApprovalStages(); err != nil {
		return err
	}
	if err := r.alterLeaveTypes(); err != nil {
		return err
	}
	return r.alterLeaveApprovals()
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
	return facades.Schema().Table("leave_approval_stages", func(table schema.Blueprint) {
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
