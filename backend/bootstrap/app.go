package bootstrap

import (
	contractsconsole "github.com/goravel/framework/contracts/console"
	contractsfoundation "github.com/goravel/framework/contracts/foundation"
	"github.com/goravel/framework/foundation"

	"goravel/app/console/commands"
	"goravel/config"
	"goravel/routes"
)

func Commands() []contractsconsole.Command {
	return []contractsconsole.Command{
		&commands.BackupDatabaseCommand{},
		&commands.IhrisSyncCommand{},
		&commands.HrmAttendSyncCommand{},
		&commands.HrmAttendExportPushCommand{},
		&commands.KpiSeedCatalogCommand{},
	}
}

func Boot() contractsfoundation.Application {
	return foundation.Setup().
		WithMigrations(Migrations).
		WithSeeders(Seeders).
		WithCommands(Commands).
		WithRouting(func() {
			routes.Web()
			routes.Api()
			routes.Grpc()
		}).
		WithProviders(Providers).
		WithConfig(config.Boot).
		Create()
}
