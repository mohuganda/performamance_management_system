package services

import (
	"strings"

	"goravel/app/facades"
	"goravel/app/models"
)

type OrgCatalogService struct{}

func NewOrgCatalogService() *OrgCatalogService {
	return &OrgCatalogService{}
}

func ihrisRefDisplayName(ref *string) string {
	if ref == nil {
		return ""
	}
	v := strings.TrimSpace(*ref)
	if v == "" {
		return ""
	}
	if idx := strings.LastIndex(v, "|"); idx >= 0 && idx < len(v)-1 {
		return strings.TrimSpace(v[idx+1:])
	}
	return v
}

func ihrisRefExternalID(ref *string) string {
	if ref == nil {
		return ""
	}
	return strings.TrimSpace(*ref)
}

// InstitutionUsesFacilityScopedDepartments is true for MoH and national referral hospitals.
func InstitutionUsesFacilityScopedDepartments(institutionTypeName string) bool {
	n := strings.ToLower(strings.TrimSpace(institutionTypeName))
	if n == "" {
		return false
	}
	return strings.Contains(n, "national referral") ||
		strings.Contains(n, "ministry of health") ||
		strings.Contains(n, "ministry")
}

func (s *OrgCatalogService) UpsertFacilityType(externalID, name string) (*uint, error) {
	externalID = strings.TrimSpace(externalID)
	if externalID == "" {
		return nil, nil
	}
	if name == "" {
		name = ihrisRefDisplayName(&externalID)
	}
	if name == "" {
		name = externalID
	}

	var row models.FacilityType
	err := facades.Orm().Query().Where("external_system_id", externalID).First(&row)
	if err != nil || row.ID == 0 {
		row = models.FacilityType{
			ExternalSystemID: externalID,
			Name:             name,
			IsActive:         true,
		}
		if createErr := facades.Orm().Query().Create(&row); createErr != nil {
			return nil, createErr
		}
		id := row.ID
		return &id, nil
	}

	row.Name = name
	row.IsActive = true
	if saveErr := facades.Orm().Query().Save(&row); saveErr != nil {
		return nil, saveErr
	}
	id := row.ID
	return &id, nil
}

func (s *OrgCatalogService) UpsertInstitutionType(externalID, name string) (*uint, error) {
	externalID = strings.TrimSpace(externalID)
	if externalID == "" {
		return nil, nil
	}
	if name == "" {
		name = ihrisRefDisplayName(&externalID)
	}
	if name == "" {
		name = externalID
	}

	var row models.InstitutionType
	err := facades.Orm().Query().Where("external_system_id", externalID).First(&row)
	if err != nil || row.ID == 0 {
		row = models.InstitutionType{
			ExternalSystemID: externalID,
			Name:             name,
			IsActive:         true,
		}
		if createErr := facades.Orm().Query().Create(&row); createErr != nil {
			return nil, createErr
		}
		id := row.ID
		return &id, nil
	}

	row.Name = name
	row.IsActive = true
	if saveErr := facades.Orm().Query().Save(&row); saveErr != nil {
		return nil, saveErr
	}
	id := row.ID
	return &id, nil
}

func resolveFacilityTypeName(ref *string) string {
	if name := ihrisRefDisplayName(ref); name != "" {
		return name
	}
	return ihrisRefExternalID(ref)
}

func resolveInstitutionTypeExternalID(ref *string, name string) string {
	if ext := ihrisRefExternalID(ref); ext != "" {
		return ext
	}
	return strings.TrimSpace(name)
}

func (s *OrgCatalogService) backfillFacilityTypeLink(facility *models.Facility) bool {
	ext := ihrisRefExternalID(facility.FacilityTypeID)
	name := resolveFacilityTypeName(facility.FacilityTypeID)
	if ext == "" {
		return false
	}
	refID, err := s.UpsertFacilityType(ext, name)
	if err != nil || refID == nil {
		return false
	}
	if facility.FacilityTypeRefID == nil || *facility.FacilityTypeRefID != *refID {
		facility.FacilityTypeRefID = refID
		return true
	}
	return false
}

func (s *OrgCatalogService) backfillInstitutionTypeLink(facility *models.Facility) bool {
	ext := resolveInstitutionTypeExternalID(facility.InstitutionTypeID, deref(facility.InstitutionTypeName))
	name := strings.TrimSpace(deref(facility.InstitutionTypeName))
	if name == "" {
		name = ihrisRefDisplayName(facility.InstitutionTypeID)
	}
	if ext == "" && name != "" {
		ext = name
	}
	if ext == "" {
		return false
	}
	if name == "" {
		name = ihrisRefDisplayName(&ext)
	}
	if name == "" {
		name = ext
	}
	refID, err := s.UpsertInstitutionType(ext, name)
	if err != nil || refID == nil {
		return false
	}
	if facility.InstitutionTypeRefID == nil || *facility.InstitutionTypeRefID != *refID {
		facility.InstitutionTypeRefID = refID
		return true
	}
	return false
}

func (s *OrgCatalogService) SeedCanonicalTypes() error {
	for _, row := range []struct{ ext, name string }{
		{"institution_type|1315301", "National Referral Hospital"},
		{"institution_type|1315300", "Regional Referral Hospital"},
		{"institution_type|1315297", "District"},
		{"institution_type|1315299", "Ministry"},
		{"institution_type|1388964", "City"},
	} {
		if _, err := s.UpsertInstitutionType(row.ext, row.name); err != nil {
			return err
		}
	}

	for _, row := range []struct{ ext, name string }{
		{"National Referral Hospital", "National Referral Hospital"},
		{"Regional Referral Hospital", "Regional Referral Hospital"},
		{"General Hospital", "General Hospital"},
		{"HCIV", "HCIV"},
		{"HCIII", "HCIII"},
		{"HCII", "HCII"},
		{"DHOs Office", "DHOs Office"},
		{"Ministry", "Ministry"},
		{"facility_type|Division", "Division"},
	} {
		if _, err := s.UpsertFacilityType(row.ext, row.name); err != nil {
			return err
		}
	}
	return nil
}

func (s *OrgCatalogService) BackfillCatalogFromFacilities() (int, int, error) {
	var facilities []models.Facility
	if err := facades.Orm().Query().Get(&facilities); err != nil {
		return 0, 0, err
	}

	ftCount := 0
	itCount := 0
	for i := range facilities {
		facility := &facilities[i]
		changed := false
		if s.backfillFacilityTypeLink(facility) {
			changed = true
			ftCount++
		}
		if s.backfillInstitutionTypeLink(facility) {
			changed = true
			itCount++
		}
		if changed {
			_ = facades.Orm().Query().Save(facility)
		}
	}
	return ftCount, itCount, nil
}

func (s *OrgCatalogService) BackfillDepartmentTypeLinks() (int, error) {
	updated := 0
	var departments []models.Department
	if err := facades.Orm().Query().Get(&departments); err != nil {
		return 0, err
	}

	for _, dept := range departments {
		if dept.FacilityTypeRefID != nil && *dept.FacilityTypeRefID > 0 {
			continue
		}
		if dept.FacilityID == nil || *dept.FacilityID == 0 {
			continue
		}
		var facility models.Facility
		if err := facades.Orm().Query().Where("id", *dept.FacilityID).First(&facility); err != nil || facility.ID == 0 {
			continue
		}
		instName := deref(facility.InstitutionTypeName)
		if InstitutionUsesFacilityScopedDepartments(instName) {
			continue
		}
		if facility.FacilityTypeRefID == nil {
			continue
		}
		dept.FacilityTypeRefID = facility.FacilityTypeRefID
		dept.FacilityID = nil
		if err := facades.Orm().Query().Save(&dept); err == nil {
			updated++
		}
	}
	return updated, nil
}
