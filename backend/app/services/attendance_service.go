package services

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"math"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type AttendanceService struct {
	oos *OutOfStationService
}

func NewAttendanceService() *AttendanceService {
	return &AttendanceService{oos: NewOutOfStationService()}
}

type ClockInput struct {
	StaffID                 uint
	ClockType               string
	Latitude                float64
	Longitude               float64
	AccuracyMeters          float64
	LocationLabel           string
	Source                  string
	OutOfStationRequestID   *uint
}

// LocationAccuracyPercent returns 100 at the destination and 0 at/beyond the geofence edge.
func LocationAccuracyPercent(distanceM, radiusM float64) float64 {
	if radiusM <= 0 {
		return 0
	}
	pct := (1 - distanceM/radiusM) * 100
	if pct < 0 {
		return 0
	}
	if pct > 100 {
		return 100
	}
	return pct
}

func (s *AttendanceService) Clock(input ClockInput) (models.AttendanceClock, error) {
	if input.ClockType != "in" && input.ClockType != "out" {
		return models.AttendanceClock{}, fmt.Errorf("clock_type must be in or out")
	}
	if input.Latitude == 0 && input.Longitude == 0 {
		return models.AttendanceClock{}, fmt.Errorf("GPS coordinates are required")
	}

	now := time.Now()
	day := now.Format("2006-01-02")
	entrySeed := fmt.Sprintf("%d-%s-%s-%s", input.StaffID, day, input.ClockType, now.Format(time.RFC3339Nano))
	hash := md5.Sum([]byte(entrySeed))
	entryID := hex.EncodeToString(hash[:])

	source := input.Source
	if source == "" {
		source = "mobile"
	}

	clock := models.AttendanceClock{
		EntryID:            entryID,
		StaffID:            input.StaffID,
		ClockType:          input.ClockType,
		ClockDate:          now,
		ClockedAt:          now,
		Latitude:           input.Latitude,
		Longitude:          input.Longitude,
		AccuracyMeters:     &input.AccuracyMeters,
		Source:             source,
		VerificationStatus: "pending",
		LocationLabel:      strPtrIf(input.LocationLabel),
	}

	settings := NewSettingsService()
	minPct := float64(settings.GetInt("oos.attendance.min_accuracy_percent", 70))
	defaultRadius := settings.GetInt("oos.attendance.default_geofence_radius_meters", 500)

	if input.OutOfStationRequestID != nil && *input.OutOfStationRequestID > 0 {
		oosReq, err := s.oos.GetApprovedOwnedForDate(input.StaffID, *input.OutOfStationRequestID, now)
		if err != nil || oosReq == nil {
			return models.AttendanceClock{}, fmt.Errorf("select a valid approved out-of-station request covering today")
		}
		distance := haversineMeters(input.Latitude, input.Longitude, oosReq.DestinationLatitude, oosReq.DestinationLongitude)
		radius := float64(oosReq.GeofenceRadiusMeters)
		if radius <= 0 {
			radius = float64(defaultRadius)
		}
		pct := LocationAccuracyPercent(distance, radius)
		clock.OutOfStationRequestID = &oosReq.ID
		clock.DistanceFromDestinationMeters = &distance
		clock.LocationAccuracyPercent = &pct
		if pct >= minPct {
			clock.VerificationStatus = "verified_oos"
		} else {
			clock.VerificationStatus = "outside_geofence"
		}
	} else {
		eff := NewDutyStationService().ResolveEffectiveDutyStation(input.StaffID)
		minPct := float64(settings.GetInt("attendance.duty_station.min_accuracy_percent", 90))
		if eff.Source == "none" || !HasCoords(eff.Latitude, eff.Longitude) {
			clock.VerificationStatus = "unverified_no_station_geo"
		} else {
			distance := haversineMeters(input.Latitude, input.Longitude, eff.Latitude, eff.Longitude)
			radius := float64(eff.RadiusMeters)
			if radius <= 0 {
				radius = float64(settings.GetInt("attendance.duty_station.default_geofence_radius_meters", 500))
			}
			pct := LocationAccuracyPercent(distance, radius)
			clock.DistanceFromDestinationMeters = &distance
			clock.LocationAccuracyPercent = &pct
			if pct >= minPct {
				clock.VerificationStatus = "at_duty_station"
			} else {
				clock.VerificationStatus = "outside_geofence"
			}
		}
	}

	if err := facades.Orm().Query().Create(&clock); err != nil {
		return models.AttendanceClock{}, err
	}

	return clock, nil
}

func (s *AttendanceService) ListForStaff(staffID uint, from, to time.Time) ([]models.AttendanceClock, error) {
	var rows []models.AttendanceClock
	err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("clock_date >= ?", from.Format("2006-01-02")).
		Where("clock_date <= ?", to.Format("2006-01-02")).
		Order("clocked_at desc").
		Get(&rows)
	return rows, err
}

func haversineMeters(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadius = 6371000.0
	rad := math.Pi / 180
	dLat := (lat2 - lat1) * rad
	dLon := (lon2 - lon1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadius * c
}
