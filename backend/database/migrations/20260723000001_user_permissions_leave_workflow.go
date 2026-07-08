package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/services"
)

type M20260723000001UserPermissionsLeaveWorkflow struct{}

func (r *M20260723000001UserPermissionsLeaveWorkflow) Signature() string {
	return "20260723000001_user_permissions_leave_workflow"
}

func (r *M20260723000001UserPermissionsLeaveWorkflow) Up() error {
	if err := r.createUserPermissions(); err != nil {
		return err
	}
	return r.seedLeaveWorkflowPermission()
}

func (r *M20260723000001UserPermissionsLeaveWorkflow) createUserPermissions() error {
	if facades.Schema().HasTable("user_permissions") {
		return nil
	}
	return facades.Schema().Create("user_permissions", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("user_id")
		table.UnsignedBigInteger("permission_id")
		table.TimestampsTz()
		table.Unique("user_id", "permission_id")
	})
}

func (r *M20260723000001UserPermissionsLeaveWorkflow) seedLeaveWorkflowPermission() error {
	perm := models.Permission{
		Code:   "leave.workflow.manage",
		Module: "leave",
		Action: "manage",
		Name:   "Manage leave approval workflows",
	}
	var existing models.Permission
	if err := facades.Orm().Query().Where("code", perm.Code).FirstOr(&existing, func() error {
		return facades.Orm().Query().Create(&perm)
	}); err != nil {
		return err
	}

	rbac := services.NewRbacService()
	for _, roleCode := range []string{"admin", "super_admin"} {
		if err := rbac.GrantPermission(roleCode, perm.Code); err != nil {
			return err
		}
	}
	return nil
}

func (r *M20260723000001UserPermissionsLeaveWorkflow) Down() error {
	return nil
}
