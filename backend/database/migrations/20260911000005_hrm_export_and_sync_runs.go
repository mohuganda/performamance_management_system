package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20260911000005HrmExportAndSyncRuns struct{}

func (r *M20260911000005HrmExportAndSyncRuns) Signature() string {
	return "20260911000005_hrm_export_and_sync_runs"
}

func (r *M20260911000005HrmExportAndSyncRuns) Up() error {
	if err := r.createHrmAttendExportLog(); err != nil {
		return err
	}
	return r.createHrmAttendSyncRuns()
}

func (r *M20260911000005HrmExportAndSyncRuns) createHrmAttendExportLog() error {
	if facades.Schema().HasTable("hrm_attend_export_log") {
		return nil
	}
	return facades.Schema().Create("hrm_attend_export_log", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("attendance_clock_id")
		table.String("direction") // push | pull
		table.String("status")    // success | failed
		table.Integer("http_status").Nullable()
		table.Text("response_snippet").Nullable()
		table.DateTimeTz("exported_at")
		table.TimestampsTz()
		table.Index("attendance_clock_id")
		table.Index("status", "attendance_clock_id")
	})
}

func (r *M20260911000005HrmExportAndSyncRuns) createHrmAttendSyncRuns() error {
	if facades.Schema().HasTable("hrm_attend_sync_runs") {
		return nil
	}
	return facades.Schema().Create("hrm_attend_sync_runs", func(table schema.Blueprint) {
		table.ID()
		table.String("status").Default("running") // running | completed | failed | cancelled
		table.String("year_month")
		table.UnsignedInteger("imported").Default(0)
		table.UnsignedInteger("skipped_unknown").Default(0)
		table.UnsignedInteger("skipped_invalid").Default(0)
		table.UnsignedInteger("total_fetched").Default(0)
		table.Text("last_error").Nullable()
		table.Text("summary_json").Nullable()
		table.DateTimeTz("started_at")
		table.DateTimeTz("finished_at").Nullable()
		table.TimestampsTz()
	})
}

func (r *M20260911000005HrmExportAndSyncRuns) Down() error {
	_ = facades.Schema().DropIfExists("hrm_attend_export_log")
	_ = facades.Schema().DropIfExists("hrm_attend_sync_runs")
	return nil
}
