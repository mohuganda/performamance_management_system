package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260708000001AttendanceLeaveOosModule struct{}

func (r *M20260708000001AttendanceLeaveOosModule) Signature() string {
	return "20260708000001_attendance_leave_oos_module"
}

func (r *M20260708000001AttendanceLeaveOosModule) Up() error {
	tables := []func() error{
		r.createLeaveEntitlements,
		r.createLeaveBalances,
		r.alterLeaveRequests,
		r.createOutOfStationReasons,
		r.createOutOfStationRequests,
		r.createOutOfStationApprovals,
		r.createAttendanceClocks,
	}

	for _, create := range tables {
		if err := create(); err != nil {
			return err
		}
	}

	return nil
}

func (r *M20260708000001AttendanceLeaveOosModule) createLeaveEntitlements() error {
	if facades.Schema().HasTable("leave_entitlements") {
		return nil
	}

	return facades.Schema().Create("leave_entitlements", func(table schema.Blueprint) {
		table.ID()
		table.String("salary_grade")
		table.UnsignedBigInteger("leave_type_id")
		table.Integer("days_per_year")
		table.Integer("medical_report_after_days").Nullable()
		table.Boolean("requires_hr_finalization").Default(false)
		table.TimestampsTz()
		table.Unique("salary_grade", "leave_type_id")
	})
}

func (r *M20260708000001AttendanceLeaveOosModule) createLeaveBalances() error {
	if facades.Schema().HasTable("leave_balances") {
		return nil
	}

	return facades.Schema().Create("leave_balances", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("staff_id")
		table.UnsignedBigInteger("leave_type_id")
		table.Integer("calendar_year")
		table.Integer("entitled_days").Default(0)
		table.Integer("used_days").Default(0)
		table.Integer("carried_over_days").Default(0)
		table.TimestampsTz()
		table.Unique("staff_id", "leave_type_id", "calendar_year")
	})
}

func (r *M20260708000001AttendanceLeaveOosModule) alterLeaveRequests() error {
	if !facades.Schema().HasTable("leave_requests") {
		return nil
	}

	return facades.Schema().Table("leave_requests", func(table schema.Blueprint) {
		if !facades.Schema().HasColumn("leave_requests", "medical_report_url") {
			table.String("medical_report_url").Nullable()
		}
		if !facades.Schema().HasColumn("leave_requests", "submitted_at") {
			table.DateTimeTz("submitted_at").Nullable()
		}
		if !facades.Schema().HasColumn("leave_requests", "advance_notice_met") {
			table.Boolean("advance_notice_met").Default(false)
		}
		if !facades.Schema().HasColumn("leave_requests", "approval_stage") {
			table.String("approval_stage").Default("supervisor")
		}
		if !facades.Schema().HasColumn("leave_requests", "carry_over_requested") {
			table.Boolean("carry_over_requested").Default(false)
		}
	})
}

func (r *M20260708000001AttendanceLeaveOosModule) createOutOfStationReasons() error {
	if facades.Schema().HasTable("out_of_station_reasons") {
		return nil
	}

	return facades.Schema().Create("out_of_station_reasons", func(table schema.Blueprint) {
		table.ID()
		table.String("reason")
		table.Boolean("is_active").Default(true)
		table.TimestampsTz()
	})
}

func (r *M20260708000001AttendanceLeaveOosModule) createOutOfStationRequests() error {
	if facades.Schema().HasTable("out_of_station_requests") {
		return nil
	}

	return facades.Schema().Create("out_of_station_requests", func(table schema.Blueprint) {
		table.ID()
		table.String("entry_id")
		table.UnsignedBigInteger("staff_id")
		table.UnsignedBigInteger("reason_id")
		table.Date("start_date")
		table.Date("end_date")
		table.Text("remarks").Nullable()
		table.String("attachment_url").Nullable()
		table.String("destination_name")
		table.String("destination_address").Nullable()
		table.Decimal("destination_latitude")
		table.Decimal("destination_longitude")
		table.Integer("geofence_radius_meters").Default(500)
		table.String("status").Default("draft")
		table.UnsignedTinyInteger("current_approval_sequence").Default(1)
		table.DateTimeTz("submitted_at").Nullable()
		table.TimestampsTz()
		table.Unique("entry_id")
		table.Index("staff_id")
		table.Index("status")
	})
}

func (r *M20260708000001AttendanceLeaveOosModule) createOutOfStationApprovals() error {
	if facades.Schema().HasTable("out_of_station_approvals") {
		return nil
	}

	return facades.Schema().Create("out_of_station_approvals", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("out_of_station_request_id")
		table.UnsignedBigInteger("supervisor_staff_id")
		table.UnsignedTinyInteger("sequence")
		table.String("status").Default("pending")
		table.Text("comments").Nullable()
		table.DateTimeTz("acted_at").Nullable()
		table.TimestampsTz()
	})
}

func (r *M20260708000001AttendanceLeaveOosModule) createAttendanceClocks() error {
	if facades.Schema().HasTable("attendance_clocks") {
		return nil
	}

	return facades.Schema().Create("attendance_clocks", func(table schema.Blueprint) {
		table.ID()
		table.String("entry_id")
		table.UnsignedBigInteger("staff_id")
		table.String("clock_type")
		table.Date("clock_date")
		table.DateTimeTz("clocked_at")
		table.Decimal("latitude")
		table.Decimal("longitude")
		table.Decimal("accuracy_meters").Nullable()
		table.String("source").Default("mobile")
		table.UnsignedBigInteger("out_of_station_request_id").Nullable()
		table.String("verification_status").Default("pending")
		table.Decimal("distance_from_destination_meters").Nullable()
		table.String("location_label").Nullable()
		table.TimestampsTz()
		table.Unique("entry_id")
		table.Index("staff_id", "clock_date")
	})
}

func (r *M20260708000001AttendanceLeaveOosModule) Down() error {
	tables := []string{
		"attendance_clocks",
		"out_of_station_approvals",
		"out_of_station_requests",
		"out_of_station_reasons",
		"leave_balances",
		"leave_entitlements",
	}

	for _, name := range tables {
		if err := facades.Schema().DropIfExists(name); err != nil {
			return err
		}
	}

	return nil
}
