package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260715000002NotificationEmailCopy struct{}

func (r *M20260715000002NotificationEmailCopy) Signature() string {
	return "20260715000002_notification_email_copy"
}

func (r *M20260715000002NotificationEmailCopy) Up() error {
	if !facades.Schema().HasTable("user_notifications") {
		return nil
	}
	return facades.Schema().Table("user_notifications", func(table schema.Blueprint) {
		if !facades.Schema().HasColumn("user_notifications", "emailed_at") {
			table.DateTimeTz("emailed_at").Nullable()
		}
	})
}

func (r *M20260715000002NotificationEmailCopy) Down() error {
	if !facades.Schema().HasTable("user_notifications") {
		return nil
	}
	return facades.Schema().Table("user_notifications", func(table schema.Blueprint) {
		if facades.Schema().HasColumn("user_notifications", "emailed_at") {
			table.DropColumn("emailed_at")
		}
	})
}
