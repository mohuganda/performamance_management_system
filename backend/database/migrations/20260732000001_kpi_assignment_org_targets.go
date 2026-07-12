package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260732000001KpiAssignmentOrgTargets struct{}

func (r *M20260732000001KpiAssignmentOrgTargets) Signature() string {
	return "20260732000001_kpi_assignment_org_targets"
}

func (r *M20260732000001KpiAssignmentOrgTargets) Up() error {
	if !facades.Schema().HasTable("kpi_assignments") {
		return nil
	}
	return facades.Schema().Table("kpi_assignments", func(table schema.Blueprint) {
		if !facades.Schema().HasColumn("kpi_assignments", "facility_type_ref_id") {
			table.UnsignedBigInteger("facility_type_ref_id").Nullable()
		}
		if !facades.Schema().HasColumn("kpi_assignments", "facility_id") {
			table.UnsignedBigInteger("facility_id").Nullable()
		}
	})
}

func (r *M20260732000001KpiAssignmentOrgTargets) Down() error {
	if !facades.Schema().HasTable("kpi_assignments") {
		return nil
	}
	return facades.Schema().Table("kpi_assignments", func(table schema.Blueprint) {
		if facades.Schema().HasColumn("kpi_assignments", "facility_type_ref_id") {
			table.DropColumn("facility_type_ref_id")
		}
		if facades.Schema().HasColumn("kpi_assignments", "facility_id") {
			table.DropColumn("facility_id")
		}
	})
}
