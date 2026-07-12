package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260726000001UserActivationTotp struct{}

func (r *M20260726000001UserActivationTotp) Signature() string {
	return "20260726000001_user_activation_totp"
}

func (r *M20260726000001UserActivationTotp) Up() error {
	if facades.Schema().HasTable("users") {
		if err := facades.Schema().Table("users", func(table schema.Blueprint) {
			if !facades.Schema().HasColumn("users", "totp_secret") {
				table.String("totp_secret", 255).Nullable()
			}
			if !facades.Schema().HasColumn("users", "totp_enabled") {
				table.Boolean("totp_enabled").Default(false)
			}
			if !facades.Schema().HasColumn("users", "totp_confirmed_at") {
				table.DateTimeTz("totp_confirmed_at").Nullable()
			}
			if !facades.Schema().HasColumn("users", "activation_completed_at") {
				table.DateTimeTz("activation_completed_at").Nullable()
			}
		}); err != nil {
			return err
		}
	}

	if facades.Schema().HasTable("account_activation_tokens") {
		return nil
	}

	return facades.Schema().Create("account_activation_tokens", func(table schema.Blueprint) {
		table.ID()
		table.String("token", 128)
		table.String("email", 255)
		table.UnsignedBigInteger("staff_id")
		table.UnsignedBigInteger("user_id").Nullable()
		table.DateTimeTz("expires_at")
		table.DateTimeTz("used_at").Nullable()
		table.TimestampsTz()
		table.Unique("token")
		table.Index("email")
		table.Index("staff_id")
	})
}

func (r *M20260726000001UserActivationTotp) Down() error {
	if facades.Schema().HasTable("account_activation_tokens") {
		if err := facades.Schema().DropIfExists("account_activation_tokens"); err != nil {
			return err
		}
	}
	if !facades.Schema().HasTable("users") {
		return nil
	}
	return facades.Schema().Table("users", func(table schema.Blueprint) {
		table.DropColumn("totp_secret", "totp_enabled", "totp_confirmed_at", "activation_completed_at")
	})
}
