package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260715000001UserNotificationsScope struct{}

func (r *M20260715000001UserNotificationsScope) Signature() string {
	return "20260715000001_user_notifications_scope"
}

func (r *M20260715000001UserNotificationsScope) Up() error {
	if err := r.alterUsers(); err != nil {
		return err
	}
	return r.createUserNotifications()
}

func (r *M20260715000001UserNotificationsScope) alterUsers() error {
	if !facades.Schema().HasTable("users") {
		return nil
	}
	return facades.Schema().Table("users", func(table schema.Blueprint) {
		if !facades.Schema().HasColumn("users", "scope_level") {
			table.String("scope_level").Nullable()
		}
		if !facades.Schema().HasColumn("users", "scope_district_id") {
			table.String("scope_district_id").Nullable()
		}
		if !facades.Schema().HasColumn("users", "scope_facility_id") {
			table.UnsignedBigInteger("scope_facility_id").Nullable()
		}
	})
}

func (r *M20260715000001UserNotificationsScope) createUserNotifications() error {
	if facades.Schema().HasTable("user_notifications") {
		return nil
	}
	return facades.Schema().Create("user_notifications", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("user_id")
		table.String("type").Default("info")
		table.String("category").Default("system")
		table.String("title")
		table.Text("message")
		table.String("action_url").Nullable()
		table.String("dedupe_key").Nullable()
		table.DateTimeTz("read_at").Nullable()
		table.TimestampsTz()
		table.Index("user_id")
		table.Unique("user_id", "dedupe_key")
	})
}

func (r *M20260715000001UserNotificationsScope) Down() error {
	_ = facades.Schema().DropIfExists("user_notifications")
	if !facades.Schema().HasTable("users") {
		return nil
	}
	return facades.Schema().Table("users", func(table schema.Blueprint) {
		if facades.Schema().HasColumn("users", "scope_level") {
			table.DropColumn("scope_level")
		}
		if facades.Schema().HasColumn("users", "scope_district_id") {
			table.DropColumn("scope_district_id")
		}
		if facades.Schema().HasColumn("users", "scope_facility_id") {
			table.DropColumn("scope_facility_id")
		}
	})
}
