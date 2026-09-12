package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260912000001RequestClarification struct{}

func (r *M20260912000001RequestClarification) Signature() string {
	return "20260912000001_request_clarification"
}

func (r *M20260912000001RequestClarification) Up() error {
	if facades.Schema().HasTable("leave_requests") && !facades.Schema().HasColumn("leave_requests", "clarification") {
		if err := facades.Schema().Table("leave_requests", func(table schema.Blueprint) {
			table.Text("clarification").Nullable()
		}); err != nil {
			return err
		}
	}
	if facades.Schema().HasTable("out_of_station_requests") && !facades.Schema().HasColumn("out_of_station_requests", "clarification") {
		if err := facades.Schema().Table("out_of_station_requests", func(table schema.Blueprint) {
			table.Text("clarification").Nullable()
		}); err != nil {
			return err
		}
	}
	return nil
}

func (r *M20260912000001RequestClarification) Down() error {
	return nil
}
