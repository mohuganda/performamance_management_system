package commands

import (
	"time"

	"github.com/goravel/framework/contracts/console"
	"github.com/goravel/framework/contracts/console/command"

	"goravel/app/services"
)

type HrmAttendSyncCommand struct{}

func (c *HrmAttendSyncCommand) Signature() string {
	return "hrm-attend:sync"
}

func (c *HrmAttendSyncCommand) Description() string {
	return "Start background HRM Attend monthly summary sync (previous month by default)"
}

func (c *HrmAttendSyncCommand) Extend() command.Extend {
	return command.Extend{}
}

func (c *HrmAttendSyncCommand) Handle(ctx console.Context) error {
	ym := time.Now().AddDate(0, -1, 0).Format("2006-01")
	status, err := services.NewHrmAttendService().StartBackgroundHrmSync(ym, 0)
	if err != nil {
		ctx.Error(err.Error())
		return err
	}
	ctx.Info("HRM Attend sync started for " + ym)
	if s, ok := status["status"].(string); ok {
		ctx.Info("status=" + s)
	}
	return nil
}
