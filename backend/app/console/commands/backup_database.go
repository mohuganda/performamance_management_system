package commands

import (
	"github.com/goravel/framework/contracts/console"
	"github.com/goravel/framework/contracts/console/command"

	"goravel/app/services"
)

type BackupDatabaseCommand struct{}

func (c *BackupDatabaseCommand) Signature() string {
	return "backup:database"
}

func (c *BackupDatabaseCommand) Description() string {
	return "Dump the primary OLTP database (DB_CONNECTION) into DB_BACKUP_DIR and apply retention"
}

func (c *BackupDatabaseCommand) Extend() command.Extend {
	return command.Extend{}
}

func (c *BackupDatabaseCommand) Handle(ctx console.Context) error {
	info, err := services.NewBackupService().RunBackup()
	if err != nil {
		ctx.Error(err.Error())
		return err
	}
	ctx.Info("Backup written: " + info.Filename)
	return nil
}
