package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260707000001CreatePmsSchema struct{}

func (r *M20260707000001CreatePmsSchema) Signature() string {
	return "20260707000001_create_pms_schema"
}

func (r *M20260707000001CreatePmsSchema) Up() error {
	tables := []func() error{
		r.createFacilities,
		r.createDepartments,
		r.createJobs,
		r.createStaff,
		r.createStaffContracts,
		r.createStaffSupervisors,
		r.createKpiCategories,
		r.createKpis,
		r.createKpiJobMappings,
		r.createFinancialYears,
		r.createQuarters,
		r.createObjectives,
		r.createDepartmentObjectives,
		r.createKpiAssignments,
		r.createPpas,
		r.createPpaKpis,
		r.createPerformanceReports,
		r.createPerformanceReportEntries,
		r.createLeaveTypes,
		r.createLeaveRequests,
		r.createLeaveApprovals,
		r.createSystemConfigs,
		r.createUsers,
	}

	for _, create := range tables {
		if err := create(); err != nil {
			return err
		}
	}

	return nil
}

func (r *M20260707000001CreatePmsSchema) createFacilities() error {
	if facades.Schema().HasTable("facilities") {
		return nil
	}

	return facades.Schema().Create("facilities", func(table schema.Blueprint) {
		table.ID()
		table.String("ihris_facility_id")
		table.String("nfrid").Nullable()
		table.String("dhis_facility_id").Nullable()
		table.String("name")
		table.String("facility_type_id").Nullable()
		table.String("district_id").Nullable()
		table.String("district_name").Nullable()
		table.String("institution_type_id").Nullable()
		table.String("institution_type_name").Nullable()
		table.Boolean("is_active").Default(true)
		table.TimestampsTz()
		table.Unique("ihris_facility_id")
	})
}

func (r *M20260707000001CreatePmsSchema) createDepartments() error {
	if facades.Schema().HasTable("departments") {
		return nil
	}

	return facades.Schema().Create("departments", func(table schema.Blueprint) {
		table.ID()
		table.String("name")
		table.String("external_system_id")
		table.TimestampsTz()
		table.Unique("external_system_id")
	})
}

func (r *M20260707000001CreatePmsSchema) createJobs() error {
	if facades.Schema().HasTable("job_titles") {
		return nil
	}

	return facades.Schema().Create("job_titles", func(table schema.Blueprint) {
		table.ID()
		table.String("external_job_id")
		table.String("job_title")
		table.TimestampsTz()
		table.Unique("external_job_id")
	})
}

func (r *M20260707000001CreatePmsSchema) createStaff() error {
	if facades.Schema().HasTable("staff") {
		return nil
	}

	return facades.Schema().Create("staff", func(table schema.Blueprint) {
		table.ID()
		table.String("ihris_pid")
		table.String("nin").Nullable()
		table.String("card_number").Nullable()
		table.String("ipps").Nullable()
		table.String("surname")
		table.String("firstname")
		table.String("othername").Nullable()
		table.String("gender").Nullable()
		table.String("mobile").Nullable()
		table.String("telephone").Nullable()
		table.String("email").Nullable()
		table.TimestampsTz()
		table.Unique("ihris_pid")
	})
}

func (r *M20260707000001CreatePmsSchema) createStaffContracts() error {
	if facades.Schema().HasTable("staff_contracts") {
		return nil
	}

	return facades.Schema().Create("staff_contracts", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("staff_id")
		table.UnsignedBigInteger("facility_id")
		table.UnsignedBigInteger("job_id")
		table.UnsignedBigInteger("department_id").Nullable()
		table.String("employment_terms").Nullable()
		table.String("salary_grade").Nullable()
		table.String("division").Nullable()
		table.String("section").Nullable()
		table.String("unit").Nullable()
		table.String("district_id").Nullable()
		table.String("district_name").Nullable()
		table.String("contract_status").Default("active")
		table.DateTimeTz("started_at").Nullable()
		table.DateTimeTz("ended_at").Nullable()
		table.TimestampsTz()
		table.Index("staff_id")
		table.Index("contract_status")
	})
}

func (r *M20260707000001CreatePmsSchema) createStaffSupervisors() error {
	if facades.Schema().HasTable("staff_supervisors") {
		return nil
	}

	return facades.Schema().Create("staff_supervisors", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("staff_contract_id")
		table.UnsignedBigInteger("supervisor_staff_id")
		table.UnsignedTinyInteger("approval_sequence")
		table.Boolean("is_current").Default(true)
		table.TimestampsTz()
		table.Index("staff_contract_id")
		table.Unique("staff_contract_id", "approval_sequence")
	})
}

func (r *M20260707000001CreatePmsSchema) createKpiCategories() error {
	if facades.Schema().HasTable("kpi_categories") {
		return nil
	}

	return facades.Schema().Create("kpi_categories", func(table schema.Blueprint) {
		table.ID()
		table.String("category_name")
		table.TimestampsTz()
		table.Unique("category_name")
	})
}

func (r *M20260707000001CreatePmsSchema) createKpis() error {
	if facades.Schema().HasTable("kpis") {
		return nil
	}

	return facades.Schema().Create("kpis", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("category_id")
		table.String("kpi_code")
		table.Text("short_name").Nullable()
		table.Text("indicator_statement")
		table.Text("description").Nullable()
		table.Text("computation").Nullable()
		table.String("numerator").Nullable()
		table.String("denominator").Nullable()
		table.String("frequency")
		table.String("computation_category").Default("Ratio")
		table.Integer("current_target").Nullable()
		table.Boolean("is_cumulative").Default(false)
		table.String("gauge_type").Default("ascending_scale")
		table.Boolean("status").Default(true)
		table.TimestampsTz()
		table.Index("category_id")
		table.Index("kpi_code")
	})
}

func (r *M20260707000001CreatePmsSchema) createKpiJobMappings() error {
	if facades.Schema().HasTable("kpi_job_mappings") {
		return nil
	}

	return facades.Schema().Create("kpi_job_mappings", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("kpi_id")
		table.UnsignedBigInteger("job_id")
		table.TimestampsTz()
		table.Unique("kpi_id", "job_id")
	})
}

func (r *M20260707000001CreatePmsSchema) createFinancialYears() error {
	if facades.Schema().HasTable("financial_years") {
		return nil
	}

	return facades.Schema().Create("financial_years", func(table schema.Blueprint) {
		table.ID()
		table.String("year_label")
		table.Date("start_date")
		table.Date("end_date")
		table.Boolean("is_current").Default(false)
		table.TimestampsTz()
		table.Unique("year_label")
	})
}

func (r *M20260707000001CreatePmsSchema) createQuarters() error {
	if facades.Schema().HasTable("quarters") {
		return nil
	}

	return facades.Schema().Create("quarters", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("financial_year_id")
		table.UnsignedTinyInteger("quarter_number")
		table.String("label")
		table.String("report_type")
		table.Date("start_date")
		table.Date("end_date")
		table.TimestampsTz()
		table.Unique("financial_year_id", "quarter_number")
	})
}

func (r *M20260707000001CreatePmsSchema) createObjectives() error {
	if facades.Schema().HasTable("objectives") {
		return nil
	}

	return facades.Schema().Create("objectives", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("facility_id")
		table.String("name")
		table.Text("description").Nullable()
		table.UnsignedBigInteger("financial_year_id").Nullable()
		table.Boolean("is_active").Default(true)
		table.TimestampsTz()
	})
}

func (r *M20260707000001CreatePmsSchema) createDepartmentObjectives() error {
	if facades.Schema().HasTable("department_objectives") {
		return nil
	}

	return facades.Schema().Create("department_objectives", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("objective_id")
		table.UnsignedBigInteger("department_id")
		table.TimestampsTz()
		table.Unique("objective_id", "department_id")
	})
}

func (r *M20260707000001CreatePmsSchema) createKpiAssignments() error {
	if facades.Schema().HasTable("kpi_assignments") {
		return nil
	}

	return facades.Schema().Create("kpi_assignments", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("kpi_id")
		table.String("assignable_type")
		table.UnsignedBigInteger("department_id").Nullable()
		table.UnsignedBigInteger("job_id").Nullable()
		table.UnsignedBigInteger("staff_id").Nullable()
		table.UnsignedBigInteger("objective_id").Nullable()
		table.Date("effective_from").Nullable()
		table.Date("effective_to").Nullable()
		table.Boolean("is_active").Default(true)
		table.TimestampsTz()
		table.Index("assignable_type")
	})
}

func (r *M20260707000001CreatePmsSchema) createPpas() error {
	if facades.Schema().HasTable("ppas") {
		return nil
	}

	return facades.Schema().Create("ppas", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("staff_id")
		table.UnsignedBigInteger("financial_year_id")
		table.String("status").Default("draft")
		table.Decimal("total_weight").Default(0)
		table.DateTimeTz("submitted_at").Nullable()
		table.DateTimeTz("approved_at").Nullable()
		table.TimestampsTz()
		table.Unique("staff_id", "financial_year_id")
	})
}

func (r *M20260707000001CreatePmsSchema) createPpaKpis() error {
	if facades.Schema().HasTable("ppa_kpis") {
		return nil
	}

	return facades.Schema().Create("ppa_kpis", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("ppa_id")
		table.UnsignedBigInteger("kpi_id")
		table.UnsignedBigInteger("kpi_assignment_id").Nullable()
		table.Decimal("weight_percentage")
		table.Decimal("target_value").Nullable()
		table.Decimal("supervisor_agreed_target").Nullable()
		table.TimestampsTz()
	})
}

func (r *M20260707000001CreatePmsSchema) createPerformanceReports() error {
	if facades.Schema().HasTable("performance_reports") {
		return nil
	}

	return facades.Schema().Create("performance_reports", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("staff_id")
		table.UnsignedBigInteger("financial_year_id")
		table.UnsignedBigInteger("quarter_id")
		table.String("report_type")
		table.String("status").Default("draft")
		table.DateTimeTz("submitted_at").Nullable()
		table.DateTimeTz("approved_at").Nullable()
		table.TimestampsTz()
		table.Unique("staff_id", "financial_year_id", "quarter_id")
	})
}

func (r *M20260707000001CreatePmsSchema) createPerformanceReportEntries() error {
	if facades.Schema().HasTable("performance_report_entries") {
		return nil
	}

	return facades.Schema().Create("performance_report_entries", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("performance_report_id")
		table.UnsignedBigInteger("ppa_kpi_id")
		table.Decimal("actual_value").Nullable()
		table.Text("narrative").Nullable()
		table.String("evidence_url").Nullable()
		table.TimestampsTz()
	})
}

func (r *M20260707000001CreatePmsSchema) createLeaveTypes() error {
	if facades.Schema().HasTable("leave_types") {
		return nil
	}

	return facades.Schema().Create("leave_types", func(table schema.Blueprint) {
		table.ID()
		table.String("name")
		table.String("code")
		table.Integer("max_days_per_year").Nullable()
		table.Boolean("requires_supervisor_approval").Default(true)
		table.Boolean("requires_hr_approval").Default(false)
		table.TimestampsTz()
		table.Unique("code")
	})
}

func (r *M20260707000001CreatePmsSchema) createLeaveRequests() error {
	if facades.Schema().HasTable("leave_requests") {
		return nil
	}

	return facades.Schema().Create("leave_requests", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("staff_id")
		table.UnsignedBigInteger("leave_type_id")
		table.Date("start_date")
		table.Date("end_date")
		table.Integer("days_requested")
		table.Text("reason").Nullable()
		table.String("status").Default("draft")
		table.UnsignedTinyInteger("current_approval_sequence").Default(1)
		table.TimestampsTz()
	})
}

func (r *M20260707000001CreatePmsSchema) createLeaveApprovals() error {
	if facades.Schema().HasTable("leave_approvals") {
		return nil
	}

	return facades.Schema().Create("leave_approvals", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("leave_request_id")
		table.UnsignedBigInteger("supervisor_staff_id")
		table.UnsignedTinyInteger("sequence")
		table.String("status").Default("pending")
		table.Text("comments").Nullable()
		table.DateTimeTz("acted_at").Nullable()
		table.TimestampsTz()
	})
}

func (r *M20260707000001CreatePmsSchema) createSystemConfigs() error {
	if facades.Schema().HasTable("system_configs") {
		return nil
	}

	return facades.Schema().Create("system_configs", func(table schema.Blueprint) {
		table.ID()
		table.String("key")
		table.Text("value")
		table.String("group_name").Default("general")
		table.String("description").Nullable()
		table.Boolean("is_public").Default(false)
		table.TimestampsTz()
		table.Unique("key")
	})
}

func (r *M20260707000001CreatePmsSchema) createUsers() error {
	if facades.Schema().HasTable("users") {
		return nil
	}

	return facades.Schema().Create("users", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("staff_id").Nullable()
		table.String("name")
		table.String("email")
		table.String("password")
		table.String("role").Default("health_worker")
		table.Boolean("is_active").Default(true)
		table.TimestampsTz()
		table.Unique("email")
	})
}

func (r *M20260707000001CreatePmsSchema) Down() error {
	tables := []string{
		"leave_approvals", "leave_requests", "leave_types",
		"performance_report_entries", "performance_reports", "ppa_kpis", "ppas",
		"kpi_assignments", "department_objectives", "objectives", "quarters",
		"financial_years", "kpi_job_mappings", "kpis", "kpi_categories",
		"staff_supervisors", "staff_contracts", "staff", "job_titles", "departments",
		"facilities", "system_configs", "users",
	}

	for _, name := range tables {
		if err := facades.Schema().DropIfExists(name); err != nil {
			return err
		}
	}

	return nil
}
