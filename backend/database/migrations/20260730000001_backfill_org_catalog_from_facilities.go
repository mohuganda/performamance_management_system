package migrations

import (
	"goravel/app/services"
)

type M20260730000001BackfillOrgCatalogFromFacilities struct{}

func (r *M20260730000001BackfillOrgCatalogFromFacilities) Signature() string {
	return "20260730000001_backfill_org_catalog_from_facilities"
}

func (r *M20260730000001BackfillOrgCatalogFromFacilities) Up() error {
	catalog := services.NewOrgCatalogService()
	_, _, err := catalog.BackfillCatalogFromFacilities()
	if err != nil {
		return err
	}
	_, err = catalog.BackfillDepartmentTypeLinks()
	return err
}

func (r *M20260730000001BackfillOrgCatalogFromFacilities) Down() error {
	return nil
}
