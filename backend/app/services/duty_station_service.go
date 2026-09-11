package services

import (
	"goravel/app/facades"
	"goravel/app/models"
	"fmt"
	"strings"
)

type EffectiveDutyStation struct {
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	Label        string  `json:"label"`
	RadiusMeters int     `json:"radius_meters"`
	Source       string  `json:"source"` // personal | facility | none
}

type DutyStationService struct{}

func NewDutyStationService() *DutyStationService {
	return &DutyStationService{}
}

func HasCoords(lat, lng float64) bool {
	return lat != 0 || lng != 0
}

// PickEffectiveDutyStation chooses personal override, then facility, then none.
func PickEffectiveDutyStation(
	personalLat, personalLng *float64,
	personalLabel *string,
	personalRadius *int,
	facilityLat, facilityLng float64,
	facilityName string,
	defaultRadius int,
) EffectiveDutyStation {
	if defaultRadius <= 0 {
		defaultRadius = 500
	}
	if personalLat != nil && personalLng != nil && HasCoords(*personalLat, *personalLng) {
		r := defaultRadius
		if personalRadius != nil && *personalRadius > 0 {
			r = *personalRadius
		}
		label := ""
		if personalLabel != nil {
			label = *personalLabel
		}
		if label == "" {
			label = facilityName
		}
		return EffectiveDutyStation{
			Latitude:     *personalLat,
			Longitude:    *personalLng,
			Label:        label,
			RadiusMeters: r,
			Source:       "personal",
		}
	}
	if HasCoords(facilityLat, facilityLng) {
		return EffectiveDutyStation{
			Latitude:     facilityLat,
			Longitude:    facilityLng,
			Label:        facilityName,
			RadiusMeters: defaultRadius,
			Source:       "facility",
		}
	}
	return EffectiveDutyStation{
		Label:        facilityName,
		RadiusMeters: defaultRadius,
		Source:       "none",
	}
}

func (s *DutyStationService) ResolveEffectiveDutyStation(staffID uint) EffectiveDutyStation {
	settings := NewSettingsService()
	defaultRadius := settings.GetInt("attendance.duty_station.default_geofence_radius_meters", 500)

	var personalLat, personalLng *float64
	var personalLabel *string
	var personalRadius *int
	var profile models.StaffHrProfile
	if err := facades.Orm().Query().Where("staff_id", staffID).First(&profile); err == nil && profile.ID > 0 {
		personalLat = profile.DutyStationLatitude
		personalLng = profile.DutyStationLongitude
		personalLabel = profile.DutyStationLabel
		personalRadius = profile.DutyStationRadiusMeters
	}

	var facilityLat, facilityLng float64
	facilityName := ""
	var contract models.StaffContract
	if err := facades.Orm().Query().Where("staff_id", staffID).Where("contract_status", "active").First(&contract); err == nil && contract.ID > 0 {
		var facility models.Facility
		if err := facades.Orm().Query().Where("id", contract.FacilityID).First(&facility); err == nil && facility.ID > 0 {
			facilityName = facility.Name
			if facility.Latitude != nil {
				facilityLat = *facility.Latitude
			}
			if facility.Longitude != nil {
				facilityLng = *facility.Longitude
			}
		}
	}

	return PickEffectiveDutyStation(
		personalLat, personalLng, personalLabel, personalRadius,
		facilityLat, facilityLng, facilityName, defaultRadius,
	)
}

type DutyStationUpdate struct {
	Latitude     *float64
	Longitude    *float64
	Label        *string
	RadiusMeters *int
	Clear        bool
}

func ApplyDutyStationFields(profile *models.StaffHrProfile, input DutyStationUpdate) error {
	if profile == nil {
		return fmt.Errorf("profile required")
	}
	if input.Clear {
		profile.DutyStationLatitude = nil
		profile.DutyStationLongitude = nil
		profile.DutyStationLabel = nil
		profile.DutyStationRadiusMeters = nil
		return nil
	}
	if input.Latitude == nil || input.Longitude == nil {
		return fmt.Errorf("duty_station_latitude and duty_station_longitude are required")
	}
	if !HasCoords(*input.Latitude, *input.Longitude) {
		return fmt.Errorf("duty station coordinates are invalid")
	}
	lat := *input.Latitude
	lng := *input.Longitude
	profile.DutyStationLatitude = &lat
	profile.DutyStationLongitude = &lng
	if input.Label != nil {
		label := strings.TrimSpace(*input.Label)
		if label == "" {
			profile.DutyStationLabel = nil
		} else {
			profile.DutyStationLabel = &label
		}
	}
	if input.RadiusMeters != nil {
		if *input.RadiusMeters <= 0 {
			profile.DutyStationRadiusMeters = nil
		} else {
			r := *input.RadiusMeters
			profile.DutyStationRadiusMeters = &r
		}
	}
	return nil
}

func UpsertStaffDutyStation(staffID uint, updatedByUserID *uint, input DutyStationUpdate) error {
	if staffID == 0 {
		return fmt.Errorf("staff linkage required to set duty station")
	}
	var profile models.StaffHrProfile
	if err := facades.Orm().Query().Where("staff_id", staffID).FirstOr(&profile, func() error {
		profile = models.StaffHrProfile{StaffID: staffID}
		return facades.Orm().Query().Create(&profile)
	}); err != nil {
		return err
	}
	if err := ApplyDutyStationFields(&profile, input); err != nil {
		return err
	}
	if updatedByUserID != nil {
		profile.UpdatedByUserID = updatedByUserID
	}
	return facades.Orm().Query().Save(&profile)
}
