package bootstrap

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/database/migrations"
)

func Migrations() []schema.Migration {
	return []schema.Migration{
		&migrations.M20210101000001CreateJobsTable{},
		&migrations.M20260707000001CreatePmsSchema{},
		&migrations.M20260708000001AttendanceLeaveOosModule{},
		&migrations.M20260709000001DynamicLeaveConfig{},
		&migrations.M20260710000001RbacAuth{},
		&migrations.M20260711000001AddKpiSubjectArea{},
		&migrations.M20260712000001IhrisSyncStaffEnrichment{},
		&migrations.M20260713000001UserProfileAssets{},
		&migrations.M20260714000001RbacExecutiveAudit{},
		&migrations.M20260715000001UserNotificationsScope{},
		&migrations.M20260715000002NotificationEmailCopy{},
		&migrations.M20260716000001CreateDistrictsTable{},
	}
}
