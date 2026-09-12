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
		&migrations.M20260717000001DistrictsMapIso{},
		&migrations.M20260718000001PerformanceAppraisal{},
		&migrations.M20260718000002RepairRoleDataScopes{},
		&migrations.M20260719000001GeographyHierarchy{},
		&migrations.M20260719000002GeographyRegionLinks{},
		&migrations.M20260720000001BackfillFacilityDistrictLinks{},
		&migrations.M20260721000001SettingsTabPermissions{},
		&migrations.M20260722000001LeaveWorkflow{},
		&migrations.M20260722000002LeaveWorkflowIndexesSeed{},
		&migrations.M20260723000001UserPermissionsLeaveWorkflow{},
		&migrations.M20260724000001DepartmentFacilityLink{},
		&migrations.M20260725000001StaffAttendanceMonthlySummaries{},
		&migrations.M20260726000001UserActivationTotp{},
		&migrations.M20260727000001LeavePolicyOosDeliverables{},
		&migrations.M20260728000001OrgCatalogTypes{},
		&migrations.M20260729000001BackfillDistrictsCatalog{},
		&migrations.M20260730000001BackfillOrgCatalogFromFacilities{},
		&migrations.M20260731000001SeedOrgCatalog{},
		&migrations.M20260732000001KpiAssignmentOrgTargets{},
		&migrations.M20260733000001StaffLeaveManagerFlag{},
		&migrations.M20260817000001LeavePlansAndOic{},
		&migrations.M20260901000001ProfileAssetsLongtext{},
		&migrations.M20260901000002ProfilePhotoPathColumn{},
		&migrations.M20260911000001AttendanceOosAccuracy{},
		&migrations.M20260911000002DutyStationPin{},
		&migrations.M20260911000003CachedPlaces{},
		&migrations.M20260911000004SettingsBackupsPermission{},
		&migrations.M20260911000005HrmExportAndSyncRuns{},
		&migrations.M20260911000006DocumentVerifications{},
	}
}
