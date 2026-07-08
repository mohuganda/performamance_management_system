package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260717000001DistrictsMapIso struct{}

func (r *M20260717000001DistrictsMapIso) Signature() string {
	return "20260717000001_districts_map_iso"
}

func (r *M20260717000001DistrictsMapIso) Up() error {
	if !facades.Schema().HasTable("districts") {
		return nil
	}
	return facades.Schema().Table("districts", func(table schema.Blueprint) {
		if !facades.Schema().HasColumn("districts", "map_key") {
			table.String("map_key").Nullable()
		}
		if !facades.Schema().HasColumn("districts", "iso_code") {
			table.String("iso_code").Nullable()
		}
	})
}

func (r *M20260717000001DistrictsMapIso) Down() error {
	if !facades.Schema().HasTable("districts") {
		return nil
	}
	return facades.Schema().Table("districts", func(table schema.Blueprint) {
		if facades.Schema().HasColumn("districts", "map_key") {
			table.DropColumn("map_key")
		}
		if facades.Schema().HasColumn("districts", "iso_code") {
			table.DropColumn("iso_code")
		}
	})
}
