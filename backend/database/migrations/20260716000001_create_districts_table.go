package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260716000001CreateDistrictsTable struct{}

func (r *M20260716000001CreateDistrictsTable) Signature() string {
	return "20260716000001_create_districts_table"
}

func (r *M20260716000001CreateDistrictsTable) Up() error {
	return facades.Schema().Create("districts", func(table schema.Blueprint) {
		table.ID()
		table.String("code")
		table.String("name")
		table.String("region").Nullable()
		table.Decimal("latitude")
		table.Decimal("longitude")
		table.Boolean("is_active").Default(true)
		table.TimestampsTz()
		table.Unique("code")
	})
}

func (r *M20260716000001CreateDistrictsTable) Down() error {
	return facades.Schema().DropIfExists("districts")
}
