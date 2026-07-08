package seeders

import (
	"fmt"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type AttendanceModuleSeeder struct{}

func (s *AttendanceModuleSeeder) Signature() string {
	return "AttendanceModuleSeeder"
}

func (s *AttendanceModuleSeeder) Run() error {
	reasons := []string{
		"Official duty",
		"Training / Workshop",
		"Supervision / Mentorship",
		"Meeting",
		"Field work",
		"Conference",
	}
	for _, reason := range reasons {
		var existing models.OutOfStationReason
		if err := facades.Orm().Query().Where("reason", reason).FirstOr(&existing, func() error {
			return facades.Orm().Query().Create(&models.OutOfStationReason{Reason: reason, IsActive: true})
		}); err != nil {
			return err
		}
	}

	return s.seedDemoClocks()
}

func (s *AttendanceModuleSeeder) seedDemoClocks() error {
	var existing []models.AttendanceClock
	_ = facades.Orm().Query().Limit(1).Get(&existing)
	if len(existing) > 0 {
		return nil
	}

	var staffRows []models.Staff
	_ = facades.Orm().Query().Limit(8).Get(&staffRows)
	if len(staffRows) == 0 {
		return nil
	}

	now := time.Now()
	for i, st := range staffRows {
		for _, clockType := range []string{"in", "out"} {
			t := now.AddDate(0, 0, -i).Add(time.Duration(i) * time.Hour)
			status := "at_duty_station"
			if i%3 == 0 {
				status = "verified_oos"
			}
			acc := 12.5
			_ = facades.Orm().Query().Create(&models.AttendanceClock{
				EntryID:            fmt.Sprintf("demo-%d-%s-%d", st.ID, clockType, i),
				StaffID:            st.ID,
				ClockType:          clockType,
				ClockDate:          t,
				ClockedAt:          t,
				Latitude:           0.3476 + float64(i)*0.01,
				Longitude:          32.5825 + float64(i)*0.01,
				AccuracyMeters:     &acc,
				Source:             "mobile",
				VerificationStatus: status,
			})
		}
	}
	return nil
}
