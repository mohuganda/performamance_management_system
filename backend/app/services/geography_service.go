package services

import (
	"strings"

	"goravel/app/facades"
	"goravel/app/models"
)

type GeographyService struct{}

func NewGeographyService() *GeographyService {
	return &GeographyService{}
}

type FacilityGeoFields struct {
	DistrictRefID *uint
	RegionID      *uint
	RegionCode    *string
	DistrictID    *string
	DistrictName  *string
	Latitude      *float64
	Longitude     *float64
}

func (g *GeographyService) EnrichFacility(row models.IhrisData) FacilityGeoFields {
	ihrisDistrictKey := normalizeDistrictKey(deref(row.DistrictID))
	if ihrisDistrictKey == "" {
		ihrisDistrictKey = normalizeDistrictKey(deref(row.DhisDistrictID))
	}
	districtName := strings.TrimSpace(deref(row.District))
	regionName := strings.TrimSpace(deref(row.Region))

	region := g.UpsertRegion(regionName)
	district := g.ResolveDistrict(region, ihrisDistrictKey, districtName)

	if district != nil && region == nil && district.RegionID != nil && *district.RegionID > 0 {
		var loaded models.Region
		if err := facades.Orm().Query().Where("id", *district.RegionID).First(&loaded); err == nil && loaded.ID > 0 {
			region = &loaded
		}
	}
	if district != nil && region == nil && strings.TrimSpace(district.Region) != "" {
		region = g.UpsertRegion(district.Region)
	}

	out := FacilityGeoFields{}
	if region != nil {
		out.RegionID = &region.ID
		out.RegionCode = &region.Code
	}
	if district != nil {
		out.DistrictRefID = &district.ID
		out.DistrictID = strPtr(district.Code)
		if strings.TrimSpace(district.Name) != "" {
			out.DistrictName = strPtr(district.Name)
		}
		if district.Latitude != 0 || district.Longitude != 0 {
			lat, lng := district.Latitude, district.Longitude
			out.Latitude = &lat
			out.Longitude = &lng
		}
	} else if ihrisDistrictKey != "" {
		out.DistrictID = strPtr(ihrisDistrictKey)
	}
	if out.DistrictName == nil && districtName != "" {
		out.DistrictName = strPtr(districtName)
	}
	return out
}

func (g *GeographyService) BackfillFacilityDistrictLinks() (int, error) {
	var facilities []models.Facility
	if err := facades.Orm().Query().
		Where("(district_ref_id IS NULL OR district_ref_id = 0)").
		Get(&facilities); err != nil {
		return 0, err
	}

	updated := 0
	for _, facility := range facilities {
		row := models.IhrisData{
			DistrictID:     facility.DistrictID,
			District:       facility.DistrictName,
			DhisDistrictID: facility.DistrictID,
		}
		geo := g.EnrichFacility(row)
		if geo.DistrictRefID == nil {
			continue
		}
		facility.DistrictRefID = geo.DistrictRefID
		if geo.DistrictID != nil {
			facility.DistrictID = geo.DistrictID
		}
		if geo.DistrictName != nil {
			facility.DistrictName = geo.DistrictName
		}
		if geo.RegionID != nil {
			facility.RegionID = geo.RegionID
		}
		if geo.RegionCode != nil {
			facility.RegionCode = geo.RegionCode
		}
		if geo.Latitude != nil {
			facility.Latitude = geo.Latitude
		}
		if geo.Longitude != nil {
			facility.Longitude = geo.Longitude
		}
		if err := facades.Orm().Query().Save(&facility); err == nil {
			updated++
		}
	}
	return updated, nil
}

// BackfillDistrictIhrisIDs copies facilities.district_id onto districts.ihris_district_id when codes match.
func (g *GeographyService) BackfillDistrictIhrisIDs() (int, error) {
	var districts []models.District
	_ = facades.Orm().Query().Get(&districts)
	updated := 0
	for _, district := range districts {
		if district.IhrisDistrictID != nil && strings.TrimSpace(*district.IhrisDistrictID) != "" {
			continue
		}
		ihrisID := district.Code
		district.IhrisDistrictID = &ihrisID
		if err := facades.Orm().Query().Save(&district); err == nil {
			updated++
		}
	}
	return updated, nil
}

func (g *GeographyService) UpsertRegion(regionName string) *models.Region {
	name := strings.TrimSpace(regionName)
	if name == "" {
		return nil
	}
	code := normalizeRegionCode(name)
	extID := "UG-REGION-" + code
	iso := regionISOCode(code)

	var region models.Region
	err := facades.Orm().Query().Where("code", code).First(&region)
	if err != nil || region.ID == 0 {
		payload := models.Region{
			Code:             code,
			Name:             titleCaseRegion(name),
			ExternalSystemID: strPtr(extID),
			ISOCode:          strPtr(iso),
			IsActive:         true,
		}
		if createErr := facades.Orm().Query().Create(&payload); createErr != nil {
			return nil
		}
		return &payload
	}

	region.Name = titleCaseRegion(name)
	region.ExternalSystemID = strPtr(extID)
	region.ISOCode = strPtr(iso)
	region.IsActive = true
	_ = facades.Orm().Query().Save(&region)
	return &region
}

func (g *GeographyService) ResolveDistrict(region *models.Region, ihrisDistrictID, districtName string) *models.District {
	extID := normalizeDistrictKey(ihrisDistrictID)
	name := strings.TrimSpace(districtName)
	if extID == "" && name == "" {
		return nil
	}

	var district models.District
	found := false

	if extID != "" {
		code := normalizeDistrictCode(extID)
		err := facades.Orm().Query().Where("code", code).First(&district)
		found = err == nil && district.ID > 0
		if !found {
			err = facades.Orm().Query().Where("ihris_district_id", extID).First(&district)
			found = err == nil && district.ID > 0
		}
	}
	if !found && name != "" {
		code := normalizeDistrictCode(name)
		err := facades.Orm().Query().Where("code", code).First(&district)
		found = err == nil && district.ID > 0
		if !found {
			err = facades.Orm().Query().Where("UPPER(name) = ?", strings.ToUpper(name)).First(&district)
			found = err == nil && district.ID > 0
		}
	}

	if !found {
		code := normalizeDistrictCode(name)
		if code == "" && extID != "" {
			code = normalizeDistrictCode(extID)
		}
		if code == "" {
			return nil
		}
		regionName := ""
		regionID := (*uint)(nil)
		if region != nil {
			regionName = region.Name
			regionID = &region.ID
		}
		displayName := name
		if displayName == "" {
			displayName = strings.ReplaceAll(code, "_", " ")
		}
		payload := models.District{
			Code:            code,
			Name:            displayName,
			Region:          regionName,
			RegionID:        regionID,
			IhrisDistrictID: optionalString(extID),
			IsActive:        true,
		}
		if createErr := facades.Orm().Query().Create(&payload); createErr != nil {
			return nil
		}
		return &payload
	}

	if extID != "" {
		district.IhrisDistrictID = optionalString(extID)
	}
	if name != "" {
		district.Name = name
	}
	if region != nil {
		district.RegionID = &region.ID
		district.Region = region.Name
	}
	district.IsActive = true
	_ = facades.Orm().Query().Save(&district)
	return &district
}

func normalizeDistrictKey(value string) string {
	v := strings.ToUpper(strings.TrimSpace(value))
	if v == "" || v == "DHIS_DISTRICT_ID" {
		return ""
	}
	return v
}

func normalizeRegionCode(name string) string {
	n := strings.ToUpper(strings.TrimSpace(name))
	switch {
	case strings.Contains(n, "BUGANDA") || strings.Contains(n, "CENTRAL"):
		return "CENTRAL"
	case strings.Contains(n, "EASTERN") || strings.Contains(n, "EAST"):
		return "EASTERN"
	case strings.Contains(n, "NORTHERN") || strings.Contains(n, "NORTH"):
		return "NORTHERN"
	case strings.Contains(n, "WESTERN") || strings.Contains(n, "WEST"):
		return "WESTERN"
	default:
		return strings.ReplaceAll(n, " ", "_")
	}
}

func titleCaseRegion(name string) string {
	code := normalizeRegionCode(name)
	switch code {
	case "CENTRAL":
		return "Central"
	case "EASTERN":
		return "Eastern"
	case "NORTHERN":
		return "Northern"
	case "WESTERN":
		return "Western"
	default:
		return strings.TrimSpace(name)
	}
}

func regionISOCode(code string) string {
	switch code {
	case "CENTRAL":
		return "UG-C"
	case "EASTERN":
		return "UG-E"
	case "NORTHERN":
		return "UG-N"
	case "WESTERN":
		return "UG-W"
	default:
		return ""
	}
}

func normalizeDistrictCode(name string) string {
	n := strings.ToUpper(strings.TrimSpace(name))
	n = strings.ReplaceAll(n, "-", " ")
	return strings.ReplaceAll(n, " ", "_")
}

func optionalString(v string) *string {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	return &v
}
