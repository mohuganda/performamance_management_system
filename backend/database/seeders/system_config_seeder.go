package seeders

import (
	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/services"
)

type SystemConfigSeeder struct{}

func (s *SystemConfigSeeder) Signature() string {
	return "SystemConfigSeeder"
}

func (s *SystemConfigSeeder) Run() error {
	settings := services.NewSettingsService()
	defaults := map[string]struct {
		group string
		value any
		public bool
	}{
		"ihris.api_url": {
			group: "data_sources",
			value: "https://hris.health.go.ug/apiv1/index.php/api/ihrisdatapaginated/92cfdef7-8f2c-433e-ba62-49fa7a243974",
			public: false,
		},
		"ihris.sync_enabled":   {group: "data_sources", value: true, public: true},
		"ihris.use_demo_data":    {group: "data_sources", value: false, public: false},
		"ihris.require_email":    {group: "data_sources", value: true, public: true},
		"ihris.require_mobile":   {group: "data_sources", value: false, public: true},
		"hrm_attend.api_url":     {group: "data_sources", value: "http://localhost/attend", public: false},
		"hrm_attend.enabled":     {group: "data_sources", value: true, public: true},
		"hrm_attend.last_sync_at": {group: "data_sources", value: "", public: true},
		"email.driver":           {group: "email", value: "smtp", public: false},
		"email.smtp.host":        {group: "email", value: "", public: false},
		"email.smtp.port":        {group: "email", value: "587", public: false},
		"email.smtp.encryption":  {group: "email", value: "tls", public: false},
		"email.smtp.from_address": {group: "email", value: "pms@moh.go.ug", public: false},
		"email.smtp.from_name":   {group: "email", value: "MoH Performance Management System", public: false},
		"notifications.ppa_reminder.enabled":              {group: "notifications", value: true, public: true},
		"notifications.ppa_reminder.days_before":          {group: "notifications", value: "14,7,3", public: true},
		"notifications.midterm_reminder.enabled":          {group: "notifications", value: true, public: true},
		"notifications.midterm_reminder.days_before":      {group: "notifications", value: "14,7", public: true},
		"notifications.quarterly_reminder.enabled":          {group: "notifications", value: true, public: true},
		"notifications.quarterly_reminder.days_before":      {group: "notifications", value: "14,7", public: true},
		"notifications.supervisor_approval.enabled":       {group: "notifications", value: true, public: true},
		"notifications.supervisor_approval.days_before":   {group: "notifications", value: "3,1", public: true},
		"notifications.in_app.email_copy":                 {group: "notifications", value: true, public: true},
		"app.public_url":                                  {group: "app", value: "http://127.0.0.1:5173", public: true},
		"ui.admin_page_size": {group: "ui", value: 20, public: true},
	}

	for key, item := range defaults {
		var existing models.SystemConfig
		if err := facades.Orm().Query().Where("key", key).First(&existing); err == nil && existing.ID > 0 {
			continue
		}
		if err := settings.Set(key, item.group, item.value, item.public); err != nil {
			return err
		}
	}
	return nil
}
