package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260709000001DynamicLeaveConfig struct{}

func (r *M20260709000001DynamicLeaveConfig) Signature() string {
	return "20260709000001_dynamic_leave_config"
}

func (r *M20260709000001DynamicLeaveConfig) Up() error {
	if err := r.alterLeaveTypes(); err != nil {
		return err
	}
	if err := r.createLeaveApprovalStages(); err != nil {
		return err
	}
	return nil
}

func (r *M20260709000001DynamicLeaveConfig) alterLeaveTypes() error {
	if !facades.Schema().HasTable("leave_types") {
		return nil
	}

	return facades.Schema().Table("leave_types", func(table schema.Blueprint) {
		if !facades.Schema().HasColumn("leave_types", "description") {
			table.Text("description").Nullable()
		}
		if !facades.Schema().HasColumn("leave_types", "is_active") {
			table.Boolean("is_active").Default(true)
		}
		if !facades.Schema().HasColumn("leave_types", "advance_notice_days") {
			table.Integer("advance_notice_days").Nullable()
		}
		if !facades.Schema().HasColumn("leave_types", "medical_report_after_days") {
			table.Integer("medical_report_after_days").Nullable()
		}
		if !facades.Schema().HasColumn("leave_types", "max_days_per_request") {
			table.Integer("max_days_per_request").Nullable()
		}
		if !facades.Schema().HasColumn("leave_types", "sort_order") {
			table.Integer("sort_order").Default(0)
		}
		if !facades.Schema().HasColumn("leave_types", "eligibility_notes") {
			table.Text("eligibility_notes").Nullable()
		}
	})
}

func (r *M20260709000001DynamicLeaveConfig) createLeaveApprovalStages() error {
	if facades.Schema().HasTable("leave_approval_stages") {
		return nil
	}

	return facades.Schema().Create("leave_approval_stages", func(table schema.Blueprint) {
		table.ID()
		table.String("code")
		table.String("name")
		table.UnsignedTinyInteger("sequence")
		table.String("approver_role")
		table.Text("description").Nullable()
		table.Boolean("is_active").Default(true)
		table.TimestampsTz()
		table.Unique("code")
	})
}

func (r *M20260709000001DynamicLeaveConfig) Down() error {
	if err := facades.Schema().DropIfExists("leave_approval_stages"); err != nil {
		return err
	}
	return nil
}
