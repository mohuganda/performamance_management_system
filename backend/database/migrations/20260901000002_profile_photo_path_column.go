package migrations

import (
	"github.com/goravel/framework/facades"

	"goravel/app/support/dbdialect"
)

type M20260901000002ProfilePhotoPathColumn struct{}

func (r *M20260901000002ProfilePhotoPathColumn) Signature() string {
	return "20260901000002_profile_photo_path_column"
}

func (r *M20260901000002ProfilePhotoPathColumn) Up() error {
	if !facades.Schema().HasTable("users") {
		return nil
	}
	// Drop any inline data URLs before shrinking the column to a path/URL field.
	_, _ = facades.Orm().Query().Exec("UPDATE users SET profile_photo = NULL WHERE profile_photo LIKE 'data:%'")
	_, _ = facades.Orm().Query().Exec("UPDATE users SET signature_image = NULL WHERE signature_image LIKE 'data:%'")
	if dbdialect.IsPostgres() {
		_, err := facades.Orm().Query().Exec(`
			ALTER TABLE users
			  ALTER COLUMN profile_photo TYPE VARCHAR(512) USING LEFT(profile_photo, 512),
			  ALTER COLUMN signature_image TYPE VARCHAR(512) USING LEFT(signature_image, 512)`)
		return err
	}
	_, err := facades.Orm().Query().Exec(
		"ALTER TABLE users MODIFY profile_photo VARCHAR(512) NULL, MODIFY signature_image VARCHAR(512) NULL",
	)
	return err
}

func (r *M20260901000002ProfilePhotoPathColumn) Down() error {
	if !facades.Schema().HasTable("users") {
		return nil
	}
	if dbdialect.IsPostgres() {
		_, err := facades.Orm().Query().Exec(`
			ALTER TABLE users
			  ALTER COLUMN profile_photo TYPE TEXT,
			  ALTER COLUMN signature_image TYPE TEXT`)
		return err
	}
	_, err := facades.Orm().Query().Exec(
		"ALTER TABLE users MODIFY profile_photo LONGTEXT NULL, MODIFY signature_image LONGTEXT NULL",
	)
	return err
}
