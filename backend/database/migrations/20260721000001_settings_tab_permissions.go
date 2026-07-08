package migrations

import (
	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/services"
)

type M20260721000001SettingsTabPermissions struct{}

func (r *M20260721000001SettingsTabPermissions) Signature() string {
	return "20260721000001_settings_tab_permissions"
}

func (r *M20260721000001SettingsTabPermissions) Up() error {
	permissions := []models.Permission{
		{Code: "settings.preferences.manage", Module: "settings", Action: "manage", Name: "Manage user preferences and admin pagination"},
		{Code: "settings.lists.manage", Module: "settings", Action: "manage", Name: "Manage reference lists (regions, districts, facilities)"},
		{Code: "settings.data_sources.manage", Module: "settings", Action: "manage", Name: "Manage data source and integration settings"},
		{Code: "settings.email.manage", Module: "settings", Action: "manage", Name: "Manage email configuration"},
		{Code: "settings.notifications.manage", Module: "settings", Action: "manage", Name: "Manage notification settings"},
		{Code: "settings.performance.manage", Module: "settings", Action: "manage", Name: "Manage performance reporting windows"},
		{Code: "settings.kpi.manage", Module: "settings", Action: "manage", Name: "Access KPI settings shortcut"},
	}
	for _, perm := range permissions {
		var existing models.Permission
		if err := facades.Orm().Query().Where("code", perm.Code).FirstOr(&existing, func() error {
			return facades.Orm().Query().Create(&perm)
		}); err != nil {
			return err
		}
	}

	rbac := services.NewRbacService()
	adminPerms := []string{
		"settings.preferences.manage",
		"settings.lists.manage",
		"settings.data_sources.manage",
		"settings.email.manage",
		"settings.notifications.manage",
		"settings.performance.manage",
		"settings.kpi.manage",
		"settings.manage",
	}
	for _, code := range adminPerms {
		if err := rbac.GrantPermission("admin", code); err != nil {
			return err
		}
	}

	// HR officer should not have full settings access by default.
	_ = rbac.RevokePermission("hr_officer", "settings.manage")

	return nil
}

func (r *M20260721000001SettingsTabPermissions) Down() error {
	return nil
}
