package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260711000001AddKpiSubjectArea struct{}

func (r *M20260711000001AddKpiSubjectArea) Signature() string {
	return "20260711000001_add_kpi_subject_area"
}

func (r *M20260711000001AddKpiSubjectArea) Up() error {
	if !facades.Schema().HasTable("kpis") {
		return nil
	}
	if !facades.Schema().HasColumn("kpis", "subject_area") {
		if err := facades.Schema().Table("kpis", func(table schema.Blueprint) {
			table.UnsignedTinyInteger("subject_area").Nullable().After("computation_category")
		}); err != nil {
			return err
		}
	}
	return nil
}

func (r *M20260711000001AddKpiSubjectArea) Down() error {
	if facades.Schema().HasColumn("kpis", "subject_area") {
		return facades.Schema().Table("kpis", func(table schema.Blueprint) {
			table.DropColumn("subject_area")
		})
	}
	return nil
}
