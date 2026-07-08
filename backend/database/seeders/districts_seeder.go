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
	for _, row := range ugandaDistricts {
		code := strings.ToUpper(strings.TrimSpace(row.Code))
		var existing models.District
		err := facades.Orm().Query().Where("code", code).FirstOr(&existing, func() error {
			return facades.Orm().Query().Create(&models.District{
				Code:      code,
				Name:      row.Name,
				Region:    row.Region,
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
			existing.Latitude = row.Latitude
			existing.Longitude = row.Longitude
			existing.IsActive = true
			if err := facades.Orm().Query().Save(&existing); err != nil {
				return err
			}
		}
	}
	return nil
}
