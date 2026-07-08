package seeders

import (
	"encoding/json"

	"goravel/app/facades"
	"goravel/app/models"
)

type PerformanceConfigSeeder struct{}

func (s *PerformanceConfigSeeder) Signature() string {
	return "PerformanceConfigSeeder"
}

func (s *PerformanceConfigSeeder) Run() error {
	settings := []struct {
		key         string
		value       any
		description string
	}{
		{"enforce_windows", true, "Enforce performance reporting submission windows"},
		{"test_override", true, "When enabled, all reporting windows are open (for testing)"},
		{"window_weeks", 3, "Number of weeks each quarterly report window stays open"},
		{"window_shift_days", 0, "Shift all reporting windows by N days (positive = later)"},
	}

	for _, setting := range settings {
		var existing models.SystemConfig
		if err := facades.Orm().Query().Where("key", setting.key).FirstOr(&existing, func() error {
			payload, _ := json.Marshal(setting.value)
			desc := setting.description
			return facades.Orm().Query().Create(&models.SystemConfig{
				Key:         setting.key,
				Value:       string(payload),
				GroupName:   "performance",
				Description: &desc,
				IsPublic:    true,
			})
		}); err != nil {
			return err
		}
	}
	return nil
}
