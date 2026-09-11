package migrations

import (
	"github.com/goravel/framework/facades"

	"goravel/app/support/dbdialect"
)

type M20260901000001ProfileAssetsLongtext struct{}

func (r *M20260901000001ProfileAssetsLongtext) Signature() string {
	return "20260901000001_profile_assets_longtext"
}

func (r *M20260901000001ProfileAssetsLongtext) Up() error {
	if !facades.Schema().HasTable("users") {
		return nil
	}
	if dbdialect.IsPostgres() {
		// Postgres TEXT is already unbounded; nothing to widen.
		return nil
	}
	// data:image/* URLs exceed MySQL TEXT (64KB); store as LONGTEXT.
	_, err := facades.Orm().Query().Exec(
		"ALTER TABLE users MODIFY profile_photo LONGTEXT NULL, MODIFY signature_image LONGTEXT NULL",
	)
	return err
}

func (r *M20260901000001ProfileAssetsLongtext) Down() error {
	if !facades.Schema().HasTable("users") {
		return nil
	}
	if dbdialect.IsPostgres() {
		return nil
	}
	_, err := facades.Orm().Query().Exec(
		"ALTER TABLE users MODIFY profile_photo TEXT NULL, MODIFY signature_image TEXT NULL",
	)
	return err
}
