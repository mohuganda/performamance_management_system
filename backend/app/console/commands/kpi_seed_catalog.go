package commands

import (
	"github.com/goravel/framework/contracts/console"
	"github.com/goravel/framework/contracts/console/command"

	"goravel/database/seeders"
)

type KpiSeedCatalogCommand struct{}

func (c *KpiSeedCatalogCommand) Signature() string {
	return "kpi:seed-catalog"
}

func (c *KpiSeedCatalogCommand) Description() string {
	return "Idempotently seed Ordinary + Score card KPI catalog defaults"
}

func (c *KpiSeedCatalogCommand) Extend() command.Extend {
	return command.Extend{}
}

func (c *KpiSeedCatalogCommand) Handle(ctx console.Context) error {
	if err := (&seeders.PmsSeeder{}).Run(); err != nil {
		ctx.Error(err.Error())
		return err
	}
	ctx.Info("KPI catalog seeded (Ordinary defaults + Score card)")
	return nil
}
