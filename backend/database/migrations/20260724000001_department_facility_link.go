package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
	"goravel/app/services"
)

type M20260724000001DepartmentFacilityLink struct{}

func (r *M20260724000001DepartmentFacilityLink) Signature() string {
	return "20260724000001_department_facility_link"
}

func (r *M20260724000001DepartmentFacilityLink) Up() error {
	if facades.Schema().HasTable("departments") {
		_ = facades.Schema().Table("departments", func(table schema.Blueprint) {
			if !facades.Schema().HasColumn("departments", "facility_id") {
				table.UnsignedBigInteger("facility_id").Nullable()
			}
		})
	}

	_, _ = services.BackfillDepartmentFacilityLinks()
	return nil
}

func (r *M20260724000001DepartmentFacilityLink) Down() error {
	if facades.Schema().HasTable("departments") && facades.Schema().HasColumn("departments", "facility_id") {
		_ = facades.Schema().Table("departments", func(table schema.Blueprint) {
			table.DropColumn("facility_id")
		})
	}
	return nil
}
