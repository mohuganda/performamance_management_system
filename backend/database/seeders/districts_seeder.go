package seeders

import (
	"strings"

	"goravel/app/facades"
	"goravel/app/models"
)

type DistrictsSeeder struct{}

func (s *DistrictsSeeder) Signature() string {
	return "DistrictsSeeder"
}

func (s *DistrictsSeeder) Run() error {
	for _, row := range ugandaDistrictMapData {
		code := strings.ToUpper(strings.TrimSpace(row.Code))
		var existing models.District
		err := facades.Orm().Query().Where("code", code).FirstOr(&existing, func() error {
			var regionID *uint
			var region models.Region
			if err := facades.Orm().Query().Where("UPPER(name) = ?", strings.ToUpper(strings.TrimSpace(row.Region))).First(&region); err == nil && region.ID > 0 {
				regionID = &region.ID
			}
			return facades.Orm().Query().Create(&models.District{
				Code:      code,
				Name:      row.Name,
				Region:    row.Region,
				RegionID:  regionID,
				MapKey:    row.MapKey,
				ISOCode:   row.ISOCode,
				Latitude:  row.Latitude,
				Longitude: row.Longitude,
				IsActive:  true,
			})
		})
		if err != nil {
			return err
		}
		if existing.ID > 0 {
			existing.Name = row.Name
			existing.Region = row.Region
			existing.MapKey = row.MapKey
			existing.ISOCode = row.ISOCode
			existing.Latitude = row.Latitude
			existing.Longitude = row.Longitude
			existing.IsActive = true
			var region models.Region
			if err := facades.Orm().Query().Where("UPPER(name) = ?", strings.ToUpper(strings.TrimSpace(row.Region))).First(&region); err == nil && region.ID > 0 {
				existing.RegionID = &region.ID
			}
			if err := facades.Orm().Query().Save(&existing); err != nil {
				return err
			}
		}
	}
	return nil
}
