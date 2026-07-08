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
		&seeders.AttendanceModuleSeeder{},
		&seeders.PmsSeeder{},
		&seeders.DemoAccountsSeeder{},
		&seeders.KpiAssignmentsSeeder{},
	}
}
