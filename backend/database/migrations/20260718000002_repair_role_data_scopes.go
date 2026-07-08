package migrations

import (
	"goravel/app/facades"
)

type M20260718000002RepairRoleDataScopes struct{}

func (r *M20260718000002RepairRoleDataScopes) Signature() string {
	return "20260718000002_repair_role_data_scopes"
}

func (r *M20260718000002RepairRoleDataScopes) Up() error {
	if !facades.Schema().HasTable("role_data_scopes") || !facades.Schema().HasTable("roles") {
		return nil
	}

	_, _ = facades.Orm().Query().Exec("DELETE FROM role_data_scopes")

	type scopeRow struct {
		roleCode string
		field    string
		operator string
		desc     string
	}
	rows := []scopeRow{
		{"staff", "staff_id", "self", "Own records only"},
		{"supervisor", "staff_id", "supervised", "Supervised staff"},
		{"department_head", "department_id", "eq", "Same department"},
		{"hr_officer", "district_id", "eq", "Same district"},
		{"director", "district_id", "eq", "District-wide visibility"},
		{"permanent_secretary", "staff_id", "all", "Organization-wide executive access"},
		{"executive_office", "staff_id", "all", "Organization-wide"},
		{"admin", "staff_id", "all", "Full data access"},
	}

	for _, row := range rows {
		var role struct {
			ID uint
		}
		if err := facades.Orm().Query().Table("roles").Where("code", row.roleCode).First(&role); err != nil || role.ID == 0 {
			continue
		}
		_, err := facades.Orm().Query().Exec(
			"INSERT INTO role_data_scopes (role_id, scope_field, scope_operator, scope_values, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
			role.ID, row.field, row.operator, "[]", row.desc,
		)
		if err != nil {
			return err
		}
	}

	return nil
}

func (r *M20260718000002RepairRoleDataScopes) Down() error {
	return nil
}
