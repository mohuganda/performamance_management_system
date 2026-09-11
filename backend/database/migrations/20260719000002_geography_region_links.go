package migrations

import (
	"goravel/app/facades"
	"goravel/app/support/dbdialect"
)

// Runs after 20260719000001 so Schema DDL has committed (avoids Postgres pool deadlocks).
type M20260719000002GeographyRegionLinks struct{}

func (r *M20260719000002GeographyRegionLinks) Signature() string {
	return "20260719000002_geography_region_links"
}

func (r *M20260719000002GeographyRegionLinks) Up() error {
	if !facades.Schema().HasTable("regions") {
		return nil
	}

	regions := []struct {
		code, name, extID, iso string
	}{
		{"CENTRAL", "Central", "UG-REGION-CENTRAL", "UG-C"},
		{"EASTERN", "Eastern", "UG-REGION-EASTERN", "UG-E"},
		{"NORTHERN", "Northern", "UG-REGION-NORTHERN", "UG-N"},
		{"WESTERN", "Western", "UG-REGION-WESTERN", "UG-W"},
	}
	for _, reg := range regions {
		activeLiteral := "1"
		if dbdialect.IsPostgres() {
			activeLiteral = "TRUE"
		}
		_, _ = facades.Orm().Query().Exec(
			`INSERT INTO regions (code, name, external_system_id, iso_code, is_active, created_at, updated_at)
			 SELECT ?, ?, ?, ?, `+activeLiteral+`, NOW(), NOW()
			 WHERE NOT EXISTS (SELECT 1 FROM regions WHERE code = ?)`,
			reg.code, reg.name, reg.extID, reg.iso, reg.code,
		)
	}

	if !facades.Schema().HasTable("districts") || !facades.Schema().HasColumn("districts", "region_id") {
		return nil
	}

	if dbdialect.IsPostgres() {
		_, _ = facades.Orm().Query().Exec(`
			UPDATE districts d
			SET region_id = r.id
			FROM regions r
			WHERE UPPER(TRIM(d.region)) = UPPER(TRIM(r.name))
			  AND (d.region_id IS NULL OR d.region_id = 0)`)
	} else {
		_, _ = facades.Orm().Query().Exec(`
			UPDATE districts d
			JOIN regions r ON UPPER(TRIM(d.region)) = UPPER(TRIM(r.name))
			SET d.region_id = r.id
			WHERE d.region_id IS NULL OR d.region_id = 0`)
	}
	return nil
}

func (r *M20260719000002GeographyRegionLinks) Down() error {
	return nil
}
