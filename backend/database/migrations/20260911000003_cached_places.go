package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260911000003CachedPlaces struct{}

func (r *M20260911000003CachedPlaces) Signature() string {
	return "20260911000003_cached_places"
}

func (r *M20260911000003CachedPlaces) Up() error {
	if facades.Schema().HasTable("cached_places") {
		return nil
	}
	return facades.Schema().Create("cached_places", func(table schema.Blueprint) {
		table.ID()
		table.String("name")
		table.String("address").Nullable()
		table.Float("latitude")
		table.Float("longitude")
		table.String("country_code")
		table.String("google_place_id").Nullable()
		table.String("normalized_name")
		table.String("source")
		table.String("source_ref").Nullable()
		table.Integer("hit_count").Default(0)
		table.TimestampTz("last_hit_at").Nullable()
		table.TimestampsTz()
		table.Unique("google_place_id")
		table.Index("country_code", "normalized_name")
	})
}

func (r *M20260911000003CachedPlaces) Down() error {
	return facades.Schema().DropIfExists("cached_places")
}
