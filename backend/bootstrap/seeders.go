package bootstrap

import (
	"github.com/goravel/framework/contracts/database/seeder"

	"goravel/database/seeders"
)

func Seeders() []seeder.Seeder {
	return []seeder.Seeder{
		&seeders.RbacSeeder{},
		&seeders.LeaveConfigSeeder{},
		&seeders.PerformanceConfigSeeder{},
		&seeders.SystemConfigSeeder{},
		&seeders.DistrictsSeeder{},
		&seeders.OrgCatalogSeeder{},
		&seeders.AttendanceModuleSeeder{},
		&seeders.PmsSeeder{},
		&seeders.DemoAccountsSeeder{},
		&seeders.KpiAssignmentsSeeder{},
	}
}
