package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260713000001UserProfileAssets struct{}

func (r *M20260713000001UserProfileAssets) Signature() string {
	return "20260713000001_user_profile_assets"
}

func (r *M20260713000001UserProfileAssets) Up() error {
	if !facades.Schema().HasTable("users") {
		return nil
	}

	return facades.Schema().Table("users", func(table schema.Blueprint) {
		if !facades.Schema().HasColumn("users", "profile_photo") {
			table.Text("profile_photo").Nullable()
		}
		if !facades.Schema().HasColumn("users", "signature_image") {
			table.Text("signature_image").Nullable()
		}
		if !facades.Schema().HasColumn("users", "signature_updated_at") {
			table.DateTimeTz("signature_updated_at").Nullable()
		}
	})
}

func (r *M20260713000001UserProfileAssets) Down() error {
	if !facades.Schema().HasTable("users") {
		return nil
	}

	return facades.Schema().Table("users", func(table schema.Blueprint) {
		table.DropColumn("profile_photo", "signature_image", "signature_updated_at")
	})
}
