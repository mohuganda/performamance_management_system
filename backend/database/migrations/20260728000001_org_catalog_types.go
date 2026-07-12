package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260728000001OrgCatalogTypes struct{}

func (r *M20260728000001OrgCatalogTypes) Signature() string {
	return "20260728000001_org_catalog_types"
}

func (r *M20260728000001OrgCatalogTypes) Up() error {
	if !facades.Schema().HasTable("facility_types") {
		if err := facades.Schema().Create("facility_types", func(table schema.Blueprint) {
			table.ID()
			table.String("external_system_id")
			table.String("name")
			table.Boolean("is_active").Default(true)
			table.TimestampsTz()
			table.Unique("external_system_id")
		}); err != nil {
			return err
		}
	}

	if !facades.Schema().HasTable("institution_types") {
		if err := facades.Schema().Create("institution_types", func(table schema.Blueprint) {
			table.ID()
			table.String("external_system_id")
			table.String("name")
			table.Boolean("is_active").Default(true)
			table.TimestampsTz()
			table.Unique("external_system_id")
		}); err != nil {
			return err
		}
	}

	if facades.Schema().HasTable("facilities") {
		if err := facades.Schema().Table("facilities", func(table schema.Blueprint) {
			if !facades.Schema().HasColumn("facilities", "facility_type_ref_id") {
				table.UnsignedBigInteger("facility_type_ref_id").Nullable()
			}
			if !facades.Schema().HasColumn("facilities", "institution_type_ref_id") {
				table.UnsignedBigInteger("institution_type_ref_id").Nullable()
			}
		}); err != nil {
			return err
		}
	}

	if facades.Schema().HasTable("departments") {
		if err := facades.Schema().Table("departments", func(table schema.Blueprint) {
			if !facades.Schema().HasColumn("departments", "facility_type_ref_id") {
				table.UnsignedBigInteger("facility_type_ref_id").Nullable()
			}
		}); err != nil {
			return err
		}
	}

	return nil
}

func (r *M20260728000001OrgCatalogTypes) Down() error {
	if facades.Schema().HasTable("departments") &&
		facades.Schema().HasColumn("departments", "facility_type_ref_id") {
		if err := facades.Schema().Table("departments", func(table schema.Blueprint) {
			table.DropColumn("facility_type_ref_id")
		}); err != nil {
			return err
		}
	}
	if facades.Schema().HasTable("facilities") {
		if err := facades.Schema().Table("facilities", func(table schema.Blueprint) {
			if facades.Schema().HasColumn("facilities", "facility_type_ref_id") {
				table.DropColumn("facility_type_ref_id")
			}
			if facades.Schema().HasColumn("facilities", "institution_type_ref_id") {
				table.DropColumn("institution_type_ref_id")
			}
		}); err != nil {
			return err
		}
	}
	if facades.Schema().HasTable("facility_types") {
		if err := facades.Schema().Drop("facility_types"); err != nil {
			return err
		}
	}
	if facades.Schema().HasTable("institution_types") {
		return facades.Schema().Drop("institution_types")
	}
	return nil
}
