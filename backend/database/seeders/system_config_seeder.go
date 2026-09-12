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
		"ihris.overwrite_enabled": {group: "data_sources", value: false, public: true},
		"ihris.require_email":    {group: "data_sources", value: true, public: true},
		"ihris.require_mobile":   {group: "data_sources", value: false, public: true},
		"hrm_attend.api_url":      {group: "data_sources", value: "http://localhost/attend", public: false},
		"hrm_attend.summary_path": {group: "data_sources", value: "/attendance/attendance_summary", public: false},
		"hrm_attend.enabled":      {group: "data_sources", value: true, public: true},
		"hrm_attend.last_sync_at": {group: "data_sources", value: "", public: true},
		"hrm_attend.last_sync_status": {group: "data_sources", value: "", public: true},
		"hrm_attend.export_push_enabled": {group: "data_sources", value: false, public: true},
		"hrm_attend.export_push_path":    {group: "data_sources", value: "/api/outoftstation_clockin", public: false},
		"hrm_attend.basic_user":          {group: "data_sources", value: "", public: false},
		"hrm_attend.basic_password":      {group: "data_sources", value: "", public: false},
		"hrm_attend.jwt_token":           {group: "data_sources", value: "", public: false},
		"hrm_attend.export_pull_token":   {group: "data_sources", value: "", public: false},
		"hrm_attend.export_last_push_at": {group: "data_sources", value: "", public: true},
		"hrm_attend.export_last_push_status": {group: "data_sources", value: "", public: true},
		"google_maps.api_key":         {group: "data_sources", value: "", public: true},
		"google_maps.country_code":    {group: "data_sources", value: "ug", public: true},
		"oos.attendance.min_accuracy_percent":            {group: "data_sources", value: 70, public: true},
		"oos.attendance.default_geofence_radius_meters": {group: "data_sources", value: 500, public: true},
		"attendance.duty_station.min_accuracy_percent":            {group: "data_sources", value: 90, public: true},
		"attendance.duty_station.default_geofence_radius_meters": {group: "data_sources", value: 500, public: true},
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
		"letterhead.org_name":                             {group: "letterhead", value: "Ministry of Health", public: true},
		"letterhead.org_title_line":                       {group: "letterhead", value: "MINISTRY OF HEALTH", public: true},
		"letterhead.tagline":                              {group: "letterhead", value: "Republic of Uganda · Performance Management System", public: true},
		"letterhead.address_line":                         {group: "letterhead", value: "Plot 6, Lourdel Road, Nakasero, Kampala", public: true},
		"letterhead.postal_address":                       {group: "letterhead", value: "P.O. Box 7272, Kampala, Uganda", public: true},
		"letterhead.phone":                                {group: "letterhead", value: "+256 417 712260", public: true},
		"letterhead.toll_free":                            {group: "letterhead", value: "0800-100-066", public: true},
		"letterhead.email":                                {group: "letterhead", value: "info@health.go.ug", public: true},
		"letterhead.website":                              {group: "letterhead", value: "https://www.health.go.ug", public: true},
		"letterhead.footer_note":                          {group: "letterhead", value: "Scan the QR code to verify this document on the MoH PMS.", public: true},
		"ui.admin_page_size":   {group: "ui", value: 20, public: true},
		"ui.nav_preset_id":     {group: "ui", value: "teal", public: true},
		"ui.nav_custom":        {group: "ui", value: map[string]string{"bg": "#0b4f4a", "fg": "#ffffff", "active": "#fcdc04"}, public: true},
		"ui.header_chrome":     {group: "ui", value: "inherit", public: true},
		"ui.floating_labels":   {group: "ui", value: true, public: true},
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
