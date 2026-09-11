package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260911000002DutyStationPin struct{}

func (r *M20260911000002DutyStationPin) Signature() string {
	return "20260911000002_duty_station_pin"
}

func (r *M20260911000002DutyStationPin) Up() error {
	if !facades.Schema().HasTable("staff_hr_profiles") {
		return nil
	}
	return facades.Schema().Table("staff_hr_profiles", func(table schema.Blueprint) {
		if !facades.Schema().HasColumn("staff_hr_profiles", "duty_station_latitude") {
			table.Float("duty_station_latitude").Nullable()
		}
		if !facades.Schema().HasColumn("staff_hr_profiles", "duty_station_longitude") {
			table.Float("duty_station_longitude").Nullable()
		}
		if !facades.Schema().HasColumn("staff_hr_profiles", "duty_station_label") {
			table.String("duty_station_label").Nullable()
		}
		if !facades.Schema().HasColumn("staff_hr_profiles", "duty_station_radius_meters") {
			table.Integer("duty_station_radius_meters").Nullable()
		}
	})
}

func (r *M20260911000002DutyStationPin) Down() error {
	if !facades.Schema().HasTable("staff_hr_profiles") {
		return nil
	}
	return facades.Schema().Table("staff_hr_profiles", func(table schema.Blueprint) {
		if facades.Schema().HasColumn("staff_hr_profiles", "duty_station_latitude") {
			table.DropColumn("duty_station_latitude")
		}
		if facades.Schema().HasColumn("staff_hr_profiles", "duty_station_longitude") {
			table.DropColumn("duty_station_longitude")
		}
		if facades.Schema().HasColumn("staff_hr_profiles", "duty_station_label") {
			table.DropColumn("duty_station_label")
		}
		if facades.Schema().HasColumn("staff_hr_profiles", "duty_station_radius_meters") {
			table.DropColumn("duty_station_radius_meters")
		}
	})
}
