package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260718000001PerformanceAppraisal struct{}

func (r *M20260718000001PerformanceAppraisal) Signature() string {
	return "20260718000001_performance_appraisal"
}

func (r *M20260718000001PerformanceAppraisal) Up() error {
	if facades.Schema().HasTable("performance_reports") {
		if err := facades.Schema().Table("performance_reports", func(table schema.Blueprint) {
			if !facades.Schema().HasColumn("performance_reports", "pending_supervisor_sequence") {
				table.UnsignedTinyInteger("pending_supervisor_sequence").Default(0)
			}
		}); err != nil {
			return err
		}
	}

	if !facades.Schema().HasTable("performance_action_plans") {
		if err := facades.Schema().Create("performance_action_plans", func(table schema.Blueprint) {
			table.ID()
			table.UnsignedBigInteger("performance_report_id")
			table.Text("performance_gap")
			table.Text("agreed_action")
			table.String("time_frame")
			table.UnsignedSmallInteger("sort_order").Default(0)
			table.TimestampsTz()
		}); err != nil {
			return err
		}
	}

	if !facades.Schema().HasTable("performance_appraisal_comments") {
		if err := facades.Schema().Create("performance_appraisal_comments", func(table schema.Blueprint) {
			table.ID()
			table.UnsignedBigInteger("performance_report_id")
			table.String("comment_role")
			table.UnsignedTinyInteger("supervisor_sequence").Nullable()
			table.UnsignedBigInteger("author_staff_id")
			table.Text("comments")
			table.String("author_name").Nullable()
			table.String("job_title").Nullable()
			table.DateTimeTz("signed_at").Nullable()
			table.TimestampsTz()
		}); err != nil {
			return err
		}
	}

	if !facades.Schema().HasTable("performance_approval_trail") {
		return facades.Schema().Create("performance_approval_trail", func(table schema.Blueprint) {
			table.ID()
			table.UnsignedBigInteger("performance_report_id")
			table.String("action")
			table.UnsignedBigInteger("actor_staff_id")
			table.String("actor_name").Nullable()
			table.String("role").Nullable()
			table.Text("comments").Nullable()
			table.TimestampsTz()
		})
	}

	return nil
}

func (r *M20260718000001PerformanceAppraisal) Down() error {
	if facades.Schema().HasTable("performance_approval_trail") {
		if err := facades.Schema().DropIfExists("performance_approval_trail"); err != nil {
			return err
		}
	}
	if facades.Schema().HasTable("performance_appraisal_comments") {
		if err := facades.Schema().DropIfExists("performance_appraisal_comments"); err != nil {
			return err
		}
	}
	if facades.Schema().HasTable("performance_action_plans") {
		if err := facades.Schema().DropIfExists("performance_action_plans"); err != nil {
			return err
		}
	}
	if facades.Schema().HasTable("performance_reports") &&
		facades.Schema().HasColumn("performance_reports", "pending_supervisor_sequence") {
		return facades.Schema().Table("performance_reports", func(table schema.Blueprint) {
			table.DropColumn("pending_supervisor_sequence")
		})
	}
	return nil
}
