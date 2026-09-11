package commands

import (
	"fmt"

	"github.com/goravel/framework/contracts/console"
	"github.com/goravel/framework/contracts/console/command"

	"goravel/app/services"
)

type HrmAttendExportPushCommand struct{}

func (c *HrmAttendExportPushCommand) Signature() string {
	return "hrm-attend:export-push"
}

func (c *HrmAttendExportPushCommand) Description() string {
	return "Push pending OOS attendance clocks to HRM Attend outoftstation_clockin_post"
}

func (c *HrmAttendExportPushCommand) Extend() command.Extend {
	return command.Extend{}
}

func (c *HrmAttendExportPushCommand) Handle(ctx console.Context) error {
	result, err := services.NewHrmAttendService().PushPendingClocks(200)
	if err != nil {
		ctx.Error(err.Error())
		return err
	}
	ctx.Info(fmt.Sprintf("export push status=%s pushed=%d failed=%d pending=%d", result.Status, result.Pushed, result.Failed, result.Pending))
	return nil
}
