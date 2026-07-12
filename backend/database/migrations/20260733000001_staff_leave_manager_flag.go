package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260733000001StaffLeaveManagerFlag struct{}

func (r *M20260733000001StaffLeaveManagerFlag) Signature() string {
	return "20260733000001_staff_leave_manager_flag"
}

func (r *M20260733000001StaffLeaveManagerFlag) Up() error {
	if !facades.Schema().HasTable("staff_hr_profiles") {
		return nil
	}
	return facades.Schema().Table("staff_hr_profiles", func(table schema.Blueprint) {
		if !facades.Schema().HasColumn("staff_hr_profiles", "is_leave_manager") {
			table.Boolean("is_leave_manager").Default(false)
		}
	})
}

func (r *M20260733000001StaffLeaveManagerFlag) Down() error {
	if !facades.Schema().HasTable("staff_hr_profiles") {
		return nil
	}
	if !facades.Schema().HasColumn("staff_hr_profiles", "is_leave_manager") {
		return nil
	}
	return facades.Schema().Table("staff_hr_profiles", func(table schema.Blueprint) {
		table.DropColumn("is_leave_manager")
	})
}
