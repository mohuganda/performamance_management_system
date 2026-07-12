package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260727000001LeavePolicyOosDeliverables struct{}

func (r *M20260727000001LeavePolicyOosDeliverables) Signature() string {
	return "20260727000001_leave_policy_oos_deliverables"
}

func (r *M20260727000001LeavePolicyOosDeliverables) Up() error {
	if facades.Schema().HasTable("out_of_station_requests") {
		if err := facades.Schema().Table("out_of_station_requests", func(table schema.Blueprint) {
			if !facades.Schema().HasColumn("out_of_station_requests", "expected_deliverables") {
				table.Text("expected_deliverables").Nullable()
			}
		}); err != nil {
			return err
		}
	}

	return nil
}

func (r *M20260727000001LeavePolicyOosDeliverables) Down() error {
	if facades.Schema().HasTable("out_of_station_requests") &&
		facades.Schema().HasColumn("out_of_station_requests", "expected_deliverables") {
		return facades.Schema().Table("out_of_station_requests", func(table schema.Blueprint) {
			table.DropColumn("expected_deliverables")
		})
	}
	return nil
}
