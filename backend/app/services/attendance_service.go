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
	StaffID        uint
	ClockType      string
	Latitude       float64
	Longitude      float64
	AccuracyMeters float64
	LocationLabel  string
	Source         string
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

	if oosReq, err := s.oos.ActiveApprovedForDate(input.StaffID, now); err == nil && oosReq != nil {
		distance := haversineMeters(input.Latitude, input.Longitude, oosReq.DestinationLatitude, oosReq.DestinationLongitude)
		clock.OutOfStationRequestID = &oosReq.ID
		clock.DistanceFromDestinationMeters = &distance

		radius := float64(oosReq.GeofenceRadiusMeters)
		if distance <= radius {
			clock.VerificationStatus = "verified_oos"
		} else {
			clock.VerificationStatus = "outside_geofence"
		}
	} else {
		clock.VerificationStatus = "at_duty_station"
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
