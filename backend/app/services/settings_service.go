package services

import (
	"encoding/json"
	"fmt"
	"strings"

	"goravel/app/facades"
	"goravel/app/models"
)

type SettingsService struct{}

func NewSettingsService() *SettingsService {
	return &SettingsService{}
}

func (s *SettingsService) GetString(key, fallback string) string {
	var cfg models.SystemConfig
	if err := facades.Orm().Query().Where("key", key).First(&cfg); err == nil && cfg.ID > 0 {
		var parsed string
		if json.Unmarshal([]byte(cfg.Value), &parsed) == nil && parsed != "" {
			return parsed
		}
		if cfg.Value != "" {
			return cfg.Value
		}
	}
	return fallback
}

func (s *SettingsService) GetBool(key string, fallback bool) bool {
	raw := s.GetString(key, "")
	if raw == "" {
		return fallback
	}
	return raw == "true" || raw == "1"
}

func (s *SettingsService) Set(key, group string, value any, isPublic bool) error {
	payload, err := json.Marshal(value)
	if err != nil {
		return err
	}
	var existing models.SystemConfig
	if err := facades.Orm().Query().Where("key", key).FirstOr(&existing, func() error {
		return facades.Orm().Query().Create(&models.SystemConfig{
			Key:       key,
			Value:     string(payload),
			GroupName: group,
			IsPublic:  isPublic,
		})
	}); err != nil {
		return err
	}
	if existing.ID > 0 {
		existing.Value = string(payload)
		existing.GroupName = group
		existing.IsPublic = isPublic
		return facades.Orm().Query().Save(&existing)
	}
	return nil
}

func (s *SettingsService) GroupSettings(group string) map[string]any {
	var rows []models.SystemConfig
	_ = facades.Orm().Query().Where("group_name", group).Get(&rows)
	out := map[string]any{}
	for _, row := range rows {
		shortKey := strings.TrimPrefix(row.Key, group+".")
		if shortKey == row.Key {
			parts := strings.SplitN(row.Key, ".", 2)
			if len(parts) == 2 {
				shortKey = parts[1]
			}
		}
		var parsed any
		if json.Unmarshal([]byte(row.Value), &parsed) == nil {
			out[shortKey] = parsed
		} else {
			out[shortKey] = row.Value
		}
	}
	return out
}

func (s *SettingsService) AdminSettings() map[string]any {
	return map[string]any{
		"data_sources":  s.dataSourcesConfig(),
		"email":         s.emailConfig(),
		"notifications": s.notificationsConfig(),
		"ui":            s.uiConfig(),
	}
}

func (s *SettingsService) PublicSettings() map[string]any {
	return map[string]any{
		"data_sources": map[string]any{
			"ihris": map[string]any{
				"sync_enabled":    s.GetBool("ihris.sync_enabled", true),
				"require_email":   s.GetBool("ihris.require_email", true),
				"last_sync_at":    s.GetString("ihris.last_sync_at", ""),
				"last_sync_status": s.GetString("ihris.last_sync_status", ""),
			},
		},
		"notifications": s.notificationsConfig(),
	}
}

func (s *SettingsService) dataSourcesConfig() map[string]any {
	return map[string]any{
		"ihris": map[string]any{
			"api_url":         s.GetString("ihris.api_url", ihrisAPIURL()),
			"sync_enabled":    s.GetBool("ihris.sync_enabled", true),
			"use_demo_data":   s.GetBool("ihris.use_demo_data", false),
			"overwrite_enabled": s.GetBool("ihris.overwrite_enabled", false),
			"require_email":   s.GetBool("ihris.require_email", true),
			"require_mobile":  s.GetBool("ihris.require_mobile", false),
			"last_sync_at":    s.GetString("ihris.last_sync_at", ""),
			"last_sync_status": s.GetString("ihris.last_sync_status", ""),
		},
		"hrm_attend": map[string]any{
			"api_url":           s.GetString("hrm_attend.api_url", "http://localhost/attend"),
			"summary_path":      s.GetString("hrm_attend.summary_path", "/attendance/attendance_summary"),
			"enabled":           s.GetBool("hrm_attend.enabled", true),
			"last_sync_at":      s.GetString("hrm_attend.last_sync_at", ""),
			"last_sync_status":  s.GetString("hrm_attend.last_sync_status", ""),
		},
	}
}

func (s *SettingsService) emailConfig() map[string]any {
	driver := s.GetString("email.driver", "smtp")
	return map[string]any{
		"driver": driver,
		"smtp": map[string]any{
			"host":       s.GetString("email.smtp.host", facades.Config().GetString("mail.host", "")),
			"port":       s.GetString("email.smtp.port", "587"),
			"username":   s.GetString("email.smtp.username", ""),
			"encryption": s.GetString("email.smtp.encryption", "tls"),
			"from_address": s.GetString("email.smtp.from_address", facades.Config().GetString("mail.from.address", "")),
			"from_name":    s.GetString("email.smtp.from_name", facades.Config().GetString("mail.from.name", "MoH PMS")),
		},
		"exchange": map[string]any{
			"host":         s.GetString("email.exchange.host", ""),
			"username":     s.GetString("email.exchange.username", ""),
			"from_address": s.GetString("email.exchange.from_address", ""),
			"from_name":    s.GetString("email.exchange.from_name", "MoH PMS"),
		},
	}
}

func (s *SettingsService) uiConfig() map[string]any {
	return map[string]any{
		"admin_page_size": s.GetInt("ui.admin_page_size", 20),
	}
}

func (s *SettingsService) notificationsConfig() map[string]any {
	return map[string]any{
		"ppa_reminder": map[string]any{
			"enabled":      s.GetBool("notifications.ppa_reminder.enabled", true),
			"days_before":  s.GetString("notifications.ppa_reminder.days_before", "14,7,3"),
			"description":  "Remind employees to complete and submit their Performance Plan (PPA)",
		},
		"midterm_reminder": map[string]any{
			"enabled":     s.GetBool("notifications.midterm_reminder.enabled", true),
			"days_before": s.GetString("notifications.midterm_reminder.days_before", "14,7"),
			"description": "Remind employees to submit midterm progress reports",
		},
		"quarterly_reminder": map[string]any{
			"enabled":     s.GetBool("notifications.quarterly_reminder.enabled", true),
			"days_before": s.GetString("notifications.quarterly_reminder.days_before", "14,7"),
			"description": "Remind employees to submit Q1/Q3 quarterly performance reports",
		},
		"supervisor_approval_reminder": map[string]any{
			"enabled":     s.GetBool("notifications.supervisor_approval.enabled", true),
			"days_before": s.GetString("notifications.supervisor_approval.days_before", "3,1"),
			"description": "Remind supervisors to approve leave, travel, and performance plans",
		},
		"in_app_email_copy": map[string]any{
			"enabled":     s.GetBool("notifications.in_app.email_copy", true),
			"description": "Send an email copy when in-app notifications are created for a user",
		},
	}
}

func (s *SettingsService) UpdateGroup(group string, payload map[string]any) error {
	if group == "ui" {
		for key, value := range payload {
			storeKey := key
			if !strings.HasPrefix(key, "ui.") {
				storeKey = "ui." + key
			}
			if err := s.Set(storeKey, group, value, true); err != nil {
				return err
			}
		}
		return nil
	}
	flat := flattenMap("", payload)
	for key, value := range flat {
		if strings.Contains(key, "password") && fmt.Sprint(value) == "" {
			continue
		}
		if err := s.Set(key, group, value, strings.HasPrefix(key, "ihris.") || strings.HasPrefix(key, "notifications.")); err != nil {
			return err
		}
	}
	return nil
}

func flattenMap(prefix string, data map[string]any) map[string]any {
	out := map[string]any{}
	for k, v := range data {
		key := k
		if prefix != "" {
			key = prefix + "." + k
		}
		if nested, ok := v.(map[string]any); ok {
			for nk, nv := range flattenMap(key, nested) {
				out[nk] = nv
			}
			continue
		}
		out[key] = v
	}
	return out
}

func lockedFieldsSet(profile *models.StaffHrProfile) map[string]bool {
	out := map[string]bool{}
	if profile == nil || profile.LockedFields == nil || *profile.LockedFields == "" {
		return out
	}
	var fields []string
	if json.Unmarshal([]byte(*profile.LockedFields), &fields) == nil {
		for _, f := range fields {
			out[f] = true
		}
	}
	return out
}

// effectiveIhrisLocks merges per-profile locks with global iHRIS overwrite policy.
// When ihris.overwrite_enabled is false (default), email/mobile/department are protected from sync.
func effectiveIhrisLocks(profile *models.StaffHrProfile) map[string]bool {
	locked := lockedFieldsSet(profile)
	settings := NewSettingsService()
	if !settings.GetBool("ihris.overwrite_enabled", false) {
		locked["email"] = true
		locked["mobile"] = true
		locked["department_id"] = true
	}
	return locked
}

func mergeStringPtr(existing *string, incoming *string, locked bool) *string {
	if locked && existing != nil && strings.TrimSpace(*existing) != "" {
		return existing
	}
	if incoming == nil || strings.TrimSpace(*incoming) == "" {
		return existing
	}
	v := strings.TrimSpace(*incoming)
	return &v
}

func mergeString(existing string, incoming string, locked bool) string {
	if locked && strings.TrimSpace(existing) != "" {
		return existing
	}
	if strings.TrimSpace(incoming) == "" {
		return existing
	}
	return strings.TrimSpace(incoming)
}

func hasValidEmail(rec IhrisAPIRecord) bool {
	return rec.Email != nil && strings.TrimSpace(*rec.Email) != "" && strings.Contains(*rec.Email, "@")
}

func hasValidMobile(rec IhrisAPIRecord) bool {
	return rec.Mobile != nil && strings.TrimSpace(*rec.Mobile) != ""
}
