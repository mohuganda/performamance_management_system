package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260710000001RbacAuth struct{}

func (r *M20260710000001RbacAuth) Signature() string {
	return "20260710000001_rbac_auth"
}

func (r *M20260710000001RbacAuth) Up() error {
	tables := []func() error{
		r.alterUsers,
		r.createRoles,
		r.createPermissions,
		r.createRolePermissions,
		r.createUserRoles,
		r.createRoleDataScopes,
	}

	for _, create := range tables {
		if err := create(); err != nil {
			return err
		}
	}
	return nil
}

func (r *M20260710000001RbacAuth) alterUsers() error {
	if !facades.Schema().HasTable("users") {
		return nil
	}

	return facades.Schema().Table("users", func(table schema.Blueprint) {
		if !facades.Schema().HasColumn("users", "failed_login_attempts") {
			table.UnsignedTinyInteger("failed_login_attempts").Default(0)
		}
		if !facades.Schema().HasColumn("users", "locked_until") {
			table.DateTimeTz("locked_until").Nullable()
		}
		if !facades.Schema().HasColumn("users", "last_login_at") {
			table.DateTimeTz("last_login_at").Nullable()
		}
		if !facades.Schema().HasColumn("users", "password_changed_at") {
			table.DateTimeTz("password_changed_at").Nullable()
		}
		if !facades.Schema().HasColumn("users", "is_super_admin") {
			table.Boolean("is_super_admin").Default(false)
		}
		if !facades.Schema().HasColumn("users", "must_change_password") {
			table.Boolean("must_change_password").Default(false)
		}
	})
}

func (r *M20260710000001RbacAuth) createRoles() error {
	if facades.Schema().HasTable("roles") {
		return nil
	}

	return facades.Schema().Create("roles", func(table schema.Blueprint) {
		table.ID()
		table.String("code")
		table.String("name")
		table.Text("description").Nullable()
		table.UnsignedTinyInteger("hierarchy_level").Default(1)
		table.Boolean("is_system").Default(false)
		table.Boolean("is_active").Default(true)
		table.TimestampsTz()
		table.Unique("code")
	})
}

func (r *M20260710000001RbacAuth) createPermissions() error {
	if facades.Schema().HasTable("permissions") {
		return nil
	}

	return facades.Schema().Create("permissions", func(table schema.Blueprint) {
		table.ID()
		table.String("code")
		table.String("module")
		table.String("action")
		table.String("name")
		table.Text("description").Nullable()
		table.String("guard").Default("api")
		table.TimestampsTz()
		table.Unique("code")
	})
}

func (r *M20260710000001RbacAuth) createRolePermissions() error {
	if facades.Schema().HasTable("role_permissions") {
		return nil
	}

	return facades.Schema().Create("role_permissions", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("role_id")
		table.UnsignedBigInteger("permission_id")
		table.TimestampsTz()
		table.Unique("role_id", "permission_id")
	})
}

func (r *M20260710000001RbacAuth) createUserRoles() error {
	if facades.Schema().HasTable("user_roles") {
		return nil
	}

	return facades.Schema().Create("user_roles", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("user_id")
		table.UnsignedBigInteger("role_id")
		table.TimestampsTz()
		table.Unique("user_id", "role_id")
	})
}

func (r *M20260710000001RbacAuth) createRoleDataScopes() error {
	if facades.Schema().HasTable("role_data_scopes") {
		return nil
	}

	return facades.Schema().Create("role_data_scopes", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("role_id")
		table.String("scope_field")
		table.String("scope_operator")
		table.Text("scope_values").Nullable()
		table.Text("description").Nullable()
		table.TimestampsTz()
	})
}

func (r *M20260710000001RbacAuth) Down() error {
	tables := []string{
		"role_data_scopes",
		"user_roles",
		"role_permissions",
		"permissions",
		"roles",
	}
	for _, name := range tables {
		if err := facades.Schema().DropIfExists(name); err != nil {
			return err
		}
	}
	return nil
}
