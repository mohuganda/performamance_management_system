package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260714000001RbacExecutiveAudit struct{}

func (r *M20260714000001RbacExecutiveAudit) Signature() string {
	return "20260714000001_rbac_executive_audit"
}

func (r *M20260714000001RbacExecutiveAudit) Up() error {
	if err := r.alterRoles(); err != nil {
		return err
	}
	return r.createAuditLogs()
}

func (r *M20260714000001RbacExecutiveAudit) alterRoles() error {
	if !facades.Schema().HasTable("roles") {
		return nil
	}
	return facades.Schema().Table("roles", func(table schema.Blueprint) {
		if !facades.Schema().HasColumn("roles", "category") {
			table.String("category").Default("operational")
		}
	})
}

func (r *M20260714000001RbacExecutiveAudit) createAuditLogs() error {
	if facades.Schema().HasTable("audit_logs") {
		return nil
	}
	return facades.Schema().Create("audit_logs", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("actor_user_id").Nullable()
		table.String("actor_name").Nullable()
		table.String("actor_email").Nullable()
		table.String("module")
		table.String("action")
		table.String("entity_type").Nullable()
		table.UnsignedBigInteger("entity_id").Nullable()
		table.Text("summary")
		table.Text("metadata").Nullable()
		table.Boolean("is_dangerous").Default(false)
		table.Boolean("is_recoverable").Default(false)
		table.Boolean("is_recovered").Default(false)
		table.DateTimeTz("recovered_at").Nullable()
		table.UnsignedBigInteger("recovered_by_user_id").Nullable()
		table.String("ip_address").Nullable()
		table.TimestampsTz()
		table.Index("module", "action")
		table.Index("created_at")
	})
}

func (r *M20260714000001RbacExecutiveAudit) Down() error {
	_ = facades.Schema().DropIfExists("audit_logs")
	if !facades.Schema().HasTable("roles") {
		return nil
	}
	return facades.Schema().Table("roles", func(table schema.Blueprint) {
		table.DropColumn("category")
	})
}
