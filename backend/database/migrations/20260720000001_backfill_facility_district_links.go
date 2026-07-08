package migrations

import (
	"goravel/app/services"
)

type M20260720000001BackfillFacilityDistrictLinks struct{}

func (r *M20260720000001BackfillFacilityDistrictLinks) Signature() string {
	return "20260720000001_backfill_facility_district_links"
}

func (r *M20260720000001BackfillFacilityDistrictLinks) Up() error {
	_, _ = services.NewGeographyService().BackfillFacilityDistrictLinks()

	// Align district catalog with iHRIS district_id codes already stored on facilities.
	_, _ = services.NewGeographyService().BackfillDistrictIhrisIDs()
	return nil
}

func (r *M20260720000001BackfillFacilityDistrictLinks) Down() error {
	return nil
}
