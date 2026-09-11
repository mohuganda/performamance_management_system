package providers

import (
	"time"

	"github.com/goravel/framework/contracts/foundation"

	"goravel/app/facades"
	"goravel/app/services"
)

// SyncScheduleProvider registers iHRIS, HRM inbound, and HRM export push jobs.
type SyncScheduleProvider struct{}

func (p *SyncScheduleProvider) Register(app foundation.Application) {}

func (p *SyncScheduleProvider) Boot(app foundation.Application) {
	facades.Schedule().
		Call(func() {
			_, _ = services.NewIhrisSyncService().StartBackgroundIhrisSync(0)
		}).
		Name("ihris:sync").
		DailyAt("03:00").
		SkipIfStillRunning()

	facades.Schedule().
		Call(func() {
			ym := time.Now().AddDate(0, -1, 0).Format("2006-01")
			_, _ = services.NewHrmAttendService().StartBackgroundHrmSync(ym, 0)
		}).
		Name("hrm-attend:sync").
		Cron("15 0 1 * *").
		SkipIfStillRunning()

	facades.Schedule().
		Call(func() {
			_, _ = services.NewHrmAttendService().PushPendingClocks(200)
		}).
		Name("hrm-attend:export-push").
		DailyAt("03:30").
		SkipIfStillRunning()
}
