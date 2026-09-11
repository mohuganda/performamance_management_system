package providers

import (
	"github.com/goravel/framework/contracts/foundation"

	"goravel/app/facades"
	"goravel/app/services"
)

// BackupScheduleProvider registers the daily primary-DB dump.
type BackupScheduleProvider struct{}

func (p *BackupScheduleProvider) Register(app foundation.Application) {}

func (p *BackupScheduleProvider) Boot(app foundation.Application) {
	facades.Schedule().
		Call(func() {
			_, _ = services.NewBackupService().RunBackup()
		}).
		Name("backup:database").
		DailyAt("02:15").
		SkipIfStillRunning()
}
