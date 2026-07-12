package seeders

import (
	"goravel/app/services"
)

type OrgCatalogSeeder struct{}

func (s *OrgCatalogSeeder) Signature() string {
	return "OrgCatalogSeeder"
}

func (s *OrgCatalogSeeder) Run() error {
	catalog := services.NewOrgCatalogService()
	if err := catalog.SeedCanonicalTypes(); err != nil {
		return err
	}
	_, _, err := catalog.BackfillCatalogFromFacilities()
	if err != nil {
		return err
	}
	_, _ = catalog.BackfillDepartmentTypeLinks()
	return nil
}
