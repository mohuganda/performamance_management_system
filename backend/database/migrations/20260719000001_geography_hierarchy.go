package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260719000001GeographyHierarchy struct{}

func (r *M20260719000001GeographyHierarchy) Signature() string {
	return "20260719000001_geography_hierarchy"
}

func (r *M20260719000001GeographyHierarchy) Up() error {
	if !facades.Schema().HasTable("regions") {
		if err := facades.Schema().Create("regions", func(table schema.Blueprint) {
			table.ID()
			table.String("code")
			table.String("name")
			table.String("external_system_id").Nullable()
			table.String("iso_code").Nullable()
			table.Boolean("is_active").Default(true)
			table.TimestampsTz()
		}); err != nil {
			return err
		}
	}

	if facades.Schema().HasTable("districts") {
		_ = facades.Schema().Table("districts", func(table schema.Blueprint) {
			if !facades.Schema().HasColumn("districts", "region_id") {
				table.UnsignedBigInteger("region_id").Nullable()
			}
			if !facades.Schema().HasColumn("districts", "ihris_district_id") {
				table.String("ihris_district_id").Nullable()
			}
		})
	}

	if facades.Schema().HasTable("facilities") {
		_ = facades.Schema().Table("facilities", func(table schema.Blueprint) {
			if !facades.Schema().HasColumn("facilities", "district_ref_id") {
				table.UnsignedBigInteger("district_ref_id").Nullable()
			}
			if !facades.Schema().HasColumn("facilities", "region_id") {
				table.UnsignedBigInteger("region_id").Nullable()
			}
			if !facades.Schema().HasColumn("facilities", "region_code") {
				table.String("region_code").Nullable()
			}
			if !facades.Schema().HasColumn("facilities", "latitude") {
				table.Decimal("latitude").Nullable()
			}
			if !facades.Schema().HasColumn("facilities", "longitude") {
				table.Decimal("longitude").Nullable()
			}
		})
	}

	if !facades.Schema().HasTable("user_scope_assignments") {
		if err := facades.Schema().Create("user_scope_assignments", func(table schema.Blueprint) {
			table.ID()
			table.UnsignedBigInteger("user_id")
			table.String("scope_type")
			table.UnsignedBigInteger("ref_id").Nullable()
			table.String("ref_code").Nullable()
			table.String("label").Nullable()
			table.TimestampsTz()
		}); err != nil {
			return err
		}
	}

	// Seed Uganda macro-regions (no FK constraints — logical hierarchy only).
	regions := []struct {
		code, name, extID, iso string
	}{
		{"CENTRAL", "Central", "UG-REGION-CENTRAL", "UG-C"},
		{"EASTERN", "Eastern", "UG-REGION-EASTERN", "UG-E"},
		{"NORTHERN", "Northern", "UG-REGION-NORTHERN", "UG-N"},
		{"WESTERN", "Western", "UG-REGION-WESTERN", "UG-W"},
	}
	for _, reg := range regions {
		_, _ = facades.Orm().Query().Exec(
			`INSERT INTO regions (code, name, external_system_id, iso_code, is_active, created_at, updated_at)
			 SELECT ?, ?, ?, ?, 1, NOW(), NOW()
			 WHERE NOT EXISTS (SELECT 1 FROM regions WHERE code = ?)`,
			reg.code, reg.name, reg.extID, reg.iso, reg.code,
		)
	}

	// Link seeded districts to regions by name (flexible string match).
	_, _ = facades.Orm().Query().Exec(`
		UPDATE districts d
		JOIN regions r ON UPPER(TRIM(d.region)) = UPPER(TRIM(r.name))
		SET d.region_id = r.id
		WHERE d.region_id IS NULL OR d.region_id = 0`)

	return nil
}

func (r *M20260719000001GeographyHierarchy) Down() error {
	if facades.Schema().HasTable("user_scope_assignments") {
		_ = facades.Schema().DropIfExists("user_scope_assignments")
	}
	if facades.Schema().HasTable("facilities") {
		_ = facades.Schema().Table("facilities", func(table schema.Blueprint) {
			for _, col := range []string{"district_ref_id", "region_id", "region_code", "latitude", "longitude"} {
				if facades.Schema().HasColumn("facilities", col) {
					table.DropColumn(col)
				}
			}
		})
	}
	if facades.Schema().HasTable("districts") {
		_ = facades.Schema().Table("districts", func(table schema.Blueprint) {
			if facades.Schema().HasColumn("districts", "region_id") {
				table.DropColumn("region_id")
			}
			if facades.Schema().HasColumn("districts", "ihris_district_id") {
				table.DropColumn("ihris_district_id")
			}
		})
	}
	return facades.Schema().DropIfExists("regions")
}
