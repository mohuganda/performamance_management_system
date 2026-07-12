package migrations

import (
	"goravel/database/seeders"
)

type M20260731000001SeedOrgCatalog struct{}

func (r *M20260731000001SeedOrgCatalog) Signature() string {
	return "20260731000001_seed_org_catalog"
}

func (r *M20260731000001SeedOrgCatalog) Up() error {
	return (&seeders.OrgCatalogSeeder{}).Run()
}

func (r *M20260731000001SeedOrgCatalog) Down() error {
	return nil
}
