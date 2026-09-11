package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260911000001AttendanceOosAccuracy struct{}

func (r *M20260911000001AttendanceOosAccuracy) Signature() string {
	return "20260911000001_attendance_oos_accuracy"
}

func (r *M20260911000001AttendanceOosAccuracy) Up() error {
	if !facades.Schema().HasTable("attendance_clocks") {
		return nil
	}
	if facades.Schema().HasColumn("attendance_clocks", "location_accuracy_percent") {
		return nil
	}
	return facades.Schema().Table("attendance_clocks", func(table schema.Blueprint) {
		table.Float("location_accuracy_percent").Nullable()
	})
}

func (r *M20260911000001AttendanceOosAccuracy) Down() error {
	if !facades.Schema().HasTable("attendance_clocks") {
		return nil
	}
	if !facades.Schema().HasColumn("attendance_clocks", "location_accuracy_percent") {
		return nil
	}
	return facades.Schema().Table("attendance_clocks", func(table schema.Blueprint) {
		table.DropColumn("location_accuracy_percent")
	})
}
