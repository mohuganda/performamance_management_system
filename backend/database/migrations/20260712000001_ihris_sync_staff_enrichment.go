package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260712000001IhrisSyncStaffEnrichment struct{}

func (r *M20260712000001IhrisSyncStaffEnrichment) Signature() string {
	return "20260712000001_ihris_sync_staff_enrichment"
}

func (r *M20260712000001IhrisSyncStaffEnrichment) Up() error {
	if err := r.alterStaff(); err != nil {
		return err
	}
	if err := r.createIhrisSyncRuns(); err != nil {
		return err
	}
	return r.createStaffHrProfiles()
}

func (r *M20260712000001IhrisSyncStaffEnrichment) alterStaff() error {
	if !facades.Schema().HasTable("staff") {
		return nil
	}
	return facades.Schema().Table("staff", func(table schema.Blueprint) {
		if !facades.Schema().HasColumn("staff", "cadre") {
			table.String("cadre").Nullable()
		}
		if !facades.Schema().HasColumn("staff", "region") {
			table.String("region").Nullable()
		}
		if !facades.Schema().HasColumn("staff", "ihris_last_sync_at") {
			table.DateTimeTz("ihris_last_sync_at").Nullable()
		}
	})
}

func (r *M20260712000001IhrisSyncStaffEnrichment) createIhrisSyncRuns() error {
	if facades.Schema().HasTable("ihris_sync_runs") {
		return nil
	}
	return facades.Schema().Create("ihris_sync_runs", func(table schema.Blueprint) {
		table.ID()
		table.String("status").Default("running")
		table.UnsignedInteger("current_page").Default(1)
		table.UnsignedInteger("total_pages").Nullable()
		table.UnsignedInteger("total_records").Nullable()
		table.UnsignedInteger("processed_records").Default(0)
		table.UnsignedInteger("imported_records").Default(0)
		table.UnsignedInteger("skipped_records").Default(0)
		table.UnsignedInteger("failed_records").Default(0)
		table.Text("last_error").Nullable()
		table.Text("summary_json").Nullable()
		table.DateTimeTz("started_at")
		table.DateTimeTz("finished_at").Nullable()
		table.TimestampsTz()
	})
}

func (r *M20260712000001IhrisSyncStaffEnrichment) createStaffHrProfiles() error {
	if facades.Schema().HasTable("staff_hr_profiles") {
		return nil
	}
	return facades.Schema().Create("staff_hr_profiles", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("staff_id")
		table.Unique("staff_id")
		table.UnsignedBigInteger("hr_department_id").Nullable()
		table.String("hr_email").Nullable()
		table.String("hr_mobile").Nullable()
		table.Text("locked_fields").Nullable()
		table.Text("notes").Nullable()
		table.UnsignedBigInteger("updated_by_user_id").Nullable()
		table.TimestampsTz()
	})
}

func (r *M20260712000001IhrisSyncStaffEnrichment) Down() error {
	_ = facades.Schema().DropIfExists("staff_hr_profiles")
	_ = facades.Schema().DropIfExists("ihris_sync_runs")
	return nil
}
