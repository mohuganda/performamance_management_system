package migrations

import (
	"goravel/database/seeders"
)

type M20260729000001BackfillDistrictsCatalog struct{}

func (r *M20260729000001BackfillDistrictsCatalog) Signature() string {
	return "20260729000001_backfill_districts_catalog"
}

func (r *M20260729000001BackfillDistrictsCatalog) Up() error {
	return (&seeders.DistrictsSeeder{}).Run()
}

func (r *M20260729000001BackfillDistrictsCatalog) Down() error {
	return nil
}
