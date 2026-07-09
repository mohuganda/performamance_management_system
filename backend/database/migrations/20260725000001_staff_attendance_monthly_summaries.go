package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260725000001StaffAttendanceMonthlySummaries struct{}

func (r *M20260725000001StaffAttendanceMonthlySummaries) Signature() string {
	return "20260725000001_staff_attendance_monthly_summaries"
}

func (r *M20260725000001StaffAttendanceMonthlySummaries) Up() error {
	if facades.Schema().HasTable("staff_attendance_monthly_summaries") {
		return nil
	}

	return facades.Schema().Create("staff_attendance_monthly_summaries", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("staff_id")
		table.String("year_month", 7)
		table.Decimal("duty_station_percent").Default(0)
		table.Integer("days_present").Nullable()
		table.Integer("days_expected").Nullable()
		table.String("source").Default("hrm_attend")
		table.String("external_ref").Nullable()
		table.TimestampsTz()
		table.Unique("staff_id", "year_month")
		table.Index("year_month")
	})
}

func (r *M20260725000001StaffAttendanceMonthlySummaries) Down() error {
	return facades.Schema().DropIfExists("staff_attendance_monthly_summaries")
}
