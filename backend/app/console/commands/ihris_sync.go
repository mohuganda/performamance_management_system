package commands

import (
	"github.com/goravel/framework/contracts/console"
	"github.com/goravel/framework/contracts/console/command"

	"goravel/app/services"
)

type IhrisSyncCommand struct{}

func (c *IhrisSyncCommand) Signature() string {
	return "ihris:sync"
}

func (c *IhrisSyncCommand) Description() string {
	return "Start or resume background iHRIS staff sync"
}

func (c *IhrisSyncCommand) Extend() command.Extend {
	return command.Extend{}
}

func (c *IhrisSyncCommand) Handle(ctx console.Context) error {
	status, err := services.NewIhrisSyncService().StartBackgroundIhrisSync(0)
	if err != nil {
		ctx.Error(err.Error())
		return err
	}
	ctx.Info("iHRIS sync started")
	if s, ok := status["status"].(string); ok {
		ctx.Info("status=" + s)
	}
	return nil
}
