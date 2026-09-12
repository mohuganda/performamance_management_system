package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260911000006DocumentVerifications struct{}

func (r *M20260911000006DocumentVerifications) Signature() string {
	return "20260911000006_document_verifications"
}

func (r *M20260911000006DocumentVerifications) Up() error {
	if facades.Schema().HasTable("document_verifications") {
		return nil
	}
	return facades.Schema().Create("document_verifications", func(table schema.Blueprint) {
		table.ID()
		table.String("token", 64)
		table.String("document_type")
		table.UnsignedBigInteger("ref_id")
		table.UnsignedBigInteger("staff_id").Nullable()
		table.String("staff_name").Default("")
		table.String("title").Default("")
		table.String("period_label").Default("")
		table.String("status").Default("approved")
		table.DateTimeTz("issued_at")
		table.UnsignedBigInteger("issued_by").Nullable()
		table.DateTimeTz("revoked_at").Nullable()
		table.TimestampsTz()
		table.Unique("token")
		table.Index("document_type", "ref_id")
	})
}

func (r *M20260911000006DocumentVerifications) Down() error {
	return facades.Schema().DropIfExists("document_verifications")
}
