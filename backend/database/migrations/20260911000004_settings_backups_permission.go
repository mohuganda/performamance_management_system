package migrations

import (
	"strings"

	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/services"
)

type M20260911000004SettingsBackupsPermission struct{}

func (r *M20260911000004SettingsBackupsPermission) Signature() string {
	return "20260911000004_settings_backups_permission"
}

func (r *M20260911000004SettingsBackupsPermission) Up() error {
	perm := models.Permission{
		Code:   "settings.backups.manage",
		Module: "settings",
		Action: "manage",
		Name:   "Manage database backups (list, run, delete, test/restore)",
	}
	var existing models.Permission
	if err := facades.Orm().Query().Where("code", perm.Code).FirstOr(&existing, func() error {
		return facades.Orm().Query().Create(&perm)
	}); err != nil {
		return err
	}

	rbac := services.NewRbacService()
	if err := rbac.GrantPermission("admin", "settings.backups.manage"); err != nil {
		if !strings.Contains(strings.ToLower(err.Error()), "role not found") {
			return err
		}
	}
	return nil
}

func (r *M20260911000004SettingsBackupsPermission) Down() error {
	return nil
}
