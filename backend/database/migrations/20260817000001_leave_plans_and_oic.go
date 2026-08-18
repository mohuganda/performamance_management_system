package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260817000001LeavePlansAndOic struct{}

func (r *M20260817000001LeavePlansAndOic) Signature() string {
	return "20260817000001_leave_plans_and_oic"
}

func (r *M20260817000001LeavePlansAndOic) Up() error {
	if !facades.Schema().HasTable("leave_plans") {
		if err := facades.Schema().Create("leave_plans", func(table schema.Blueprint) {
			table.ID()
			table.UnsignedBigInteger("staff_id")
			table.Integer("calendar_year")
			table.Date("start_date")
			table.Date("end_date")
			table.Integer("days_planned")
			table.Text("notes").Nullable()
			table.Timestamps()
			table.Index("staff_id", "calendar_year")
			table.Index("start_date")
		}); err != nil {
			return err
		}
	}
	if facades.Schema().HasTable("leave_requests") && !facades.Schema().HasColumn("leave_requests", "oic_staff_id") {
		if err := facades.Schema().Table("leave_requests", func(table schema.Blueprint) {
			table.UnsignedBigInteger("oic_staff_id").Nullable()
			table.Index("oic_staff_id")
		}); err != nil {
			return err
		}
	}
	return nil
}

func (r *M20260817000001LeavePlansAndOic) Down() error {
	if facades.Schema().HasTable("leave_requests") && facades.Schema().HasColumn("leave_requests", "oic_staff_id") {
		_ = facades.Schema().Table("leave_requests", func(table schema.Blueprint) {
			table.DropColumn("oic_staff_id")
		})
	}
	if facades.Schema().HasTable("leave_plans") {
		return facades.Schema().DropIfExists("leave_plans")
	}
	return nil
}
