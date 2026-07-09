package seeders

import (
	"fmt"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type KpiAssignmentsSeeder struct{}

func (s *KpiAssignmentsSeeder) Signature() string {
	return "KpiAssignmentsSeeder"
}

func (s *KpiAssignmentsSeeder) Run() error {
	if err := s.syncSubjectAreas(); err != nil {
		return err
	}
	if err := s.seedJobAssignments(); err != nil {
		return err
	}
	if err := s.seedDepartmentAssignments(); err != nil {
		return err
	}
	if err := s.seedScoreCardAssignments(); err != nil {
		return err
	}
	if err := s.seedDemoStaffAssignments(); err != nil {
		return err
	}
	if err := s.seedDemoPpas(); err != nil {
		return err
	}
	return s.seedDemoPerformanceReports()
}

func (s *KpiAssignmentsSeeder) seedDemoPerformanceReports() error {
	staffID, err := s.staffIDByEmail("worker@moh.go.ug")
	if err != nil {
		return nil
	}
	fy, err := s.ensureFinancialYear()
	if err != nil {
		return err
	}
	var ppa models.Ppa
	if err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("financial_year_id", fy.ID).
		First(&ppa); err != nil || ppa.ID == 0 {
		return nil
	}

	type reportSeed struct {
		reportType string
		status     string
		actuals    map[string]float64
	}
	seeds := []reportSeed{
		{
			reportType: "q1",
			status:     "submitted",
			actuals:    map[string]float64{"201": 88, "202": 90, "203": 79, "204": 84, "205": 92},
		},
		{
			reportType: "midterm",
			status:     "draft",
			actuals:    map[string]float64{"201": 91, "202": 91, "203": 82, "204": 86, "205": 94},
		},
		{
			reportType: "q3",
			status:     "draft",
			actuals:    map[string]float64{"201": 93, "202": 94, "203": 84, "204": 88, "205": 95},
		},
		{
			reportType: "endterm",
			status:     "draft",
			actuals:    map[string]float64{"201": 96, "202": 97, "203": 87, "204": 91, "205": 98},
		},
	}

	for _, seed := range seeds {
		if err := s.seedPerformanceReport(staffID, fy.ID, ppa.ID, seed.reportType, seed.status, seed.actuals); err != nil {
			return err
		}
	}
	return nil
}

func (s *KpiAssignmentsSeeder) seedPerformanceReport(
	staffID, fyID, ppaID uint,
	reportType, status string,
	actuals map[string]float64,
) error {
	var quarter models.Quarter
	if err := facades.Orm().Query().
		Where("financial_year_id", fyID).
		Where("report_type", reportType).
		FirstOr(&quarter, func() error {
			qNum := uint8(1)
			switch reportType {
			case "midterm":
				qNum = 2
			case "q3":
				qNum = 3
			case "endterm":
				qNum = 4
			}
			quarter = models.Quarter{
				FinancialYearID: fyID,
				QuarterNumber:   qNum,
				Label:           reportType,
				ReportType:      reportType,
				StartDate:       time.Date(2025, 7, 1, 0, 0, 0, 0, time.UTC),
				EndDate:         time.Date(2026, 6, 30, 0, 0, 0, 0, time.UTC),
			}
			return facades.Orm().Query().Create(&quarter)
		}); err != nil {
		return err
	}

	var report models.PerformanceReport
	if err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("financial_year_id", fyID).
		Where("quarter_id", quarter.ID).
		FirstOr(&report, func() error {
			report = models.PerformanceReport{
				StaffID:         staffID,
				FinancialYearID: fyID,
				QuarterID:       quarter.ID,
				ReportType:      reportType,
				Status:          status,
			}
			return facades.Orm().Query().Create(&report)
		}); err != nil {
		return err
	}
	report.Status = status
	if err := facades.Orm().Query().Save(&report); err != nil {
		return err
	}

	for code, actual := range actuals {
		kpiID, err := s.kpiIDByCode(code)
		if err != nil {
			continue
		}
		var ppaKpi models.PpaKpi
		if err := facades.Orm().Query().
			Where("ppa_id", ppaID).
			Where("kpi_id", kpiID).
			First(&ppaKpi); err != nil || ppaKpi.ID == 0 {
			continue
		}
		val := actual
		narrative := fmt.Sprintf("Demo %s report entry for KPI %s.", reportType, code)
		var entry models.PerformanceReportEntry
		if err := facades.Orm().Query().
			Where("performance_report_id", report.ID).
			Where("ppa_kpi_id", ppaKpi.ID).
			FirstOr(&entry, func() error {
				entry = models.PerformanceReportEntry{
					PerformanceReportID: report.ID,
					PpaKpiID:            ppaKpi.ID,
					ActualValue:         &val,
					Narrative:           &narrative,
				}
				return facades.Orm().Query().Create(&entry)
			}); err != nil {
			return err
		}
		entry.ActualValue = &val
		entry.Narrative = &narrative
		_ = facades.Orm().Query().Save(&entry)
	}
	return nil
}

func (s *KpiAssignmentsSeeder) syncSubjectAreas() error {
	var legacy []models.LegacyKpi
	if err := facades.Orm().Query().Get(&legacy); err != nil {
		return nil
	}
	for _, lk := range legacy {
		if lk.SubjectArea == nil {
			continue
		}
		area := uint8(*lk.SubjectArea)
		var kpi models.Kpi
		if err := facades.Orm().Query().Where("kpi_code", lk.KpiID).First(&kpi); err != nil || kpi.ID == 0 {
			continue
		}
		kpi.SubjectArea = &area
		_ = facades.Orm().Query().Save(&kpi)
	}
	return nil
}

func (s *KpiAssignmentsSeeder) ensureAssignment(assignableType string, kpiID uint, jobID, deptID, staffID *uint) error {
	query := facades.Orm().Query().
		Where("kpi_id", kpiID).
		Where("assignable_type", assignableType)
	if jobID != nil {
		query = query.Where("job_id", *jobID)
	}
	if deptID != nil {
		query = query.Where("department_id", *deptID)
	}
	if staffID != nil {
		query = query.Where("staff_id", *staffID)
	}

	var existing models.KpiAssignment
	if err := query.FirstOr(&existing, func() error {
		row := models.KpiAssignment{
			KpiID:          kpiID,
			AssignableType: assignableType,
			DepartmentID:   deptID,
			JobID:          jobID,
			StaffID:        staffID,
			IsActive:       true,
		}
		return facades.Orm().Query().Create(&row)
	}); err != nil {
		return err
	}
	return nil
}

func (s *KpiAssignmentsSeeder) seedJobAssignments() error {
	var mappings []models.KpiJobMapping
	if err := facades.Orm().Query().Get(&mappings); err != nil {
		return err
	}
	for _, m := range mappings {
		jobID := m.JobID
		if err := s.ensureAssignment("job", m.KpiID, &jobID, nil, nil); err != nil {
			return err
		}
	}
	return nil
}

func (s *KpiAssignmentsSeeder) seedDepartmentAssignments() error {
	var dept models.Department
	if err := facades.Orm().Query().Where("external_system_id", "moh-clinical-services").First(&dept); err != nil || dept.ID == 0 {
		if err := facades.Orm().Query().Where("external_system_id", "clinical-services").First(&dept); err != nil || dept.ID == 0 {
			return nil
		}
	}

	codes := []string{"201", "202", "203", "204", "205", "211"}
	for _, code := range codes {
		kpiID, err := s.kpiIDByCode(code)
		if err != nil {
			continue
		}
		deptID := dept.ID
		if err := s.ensureAssignment("department", kpiID, nil, &deptID, nil); err != nil {
			return err
		}
	}
	return nil
}

func (s *KpiAssignmentsSeeder) seedScoreCardAssignments() error {
	var job models.JobTitle
	if err := facades.Orm().Query().Where("external_job_id", "1").First(&job); err != nil || job.ID == 0 {
		return nil
	}
	codes := []string{"SC-001", "SC-002", "SC-003", "SC-004"}
	for _, code := range codes {
		kpiID, err := s.kpiIDByCode(code)
		if err != nil {
			continue
		}
		jobID := job.ID
		if err := s.ensureAssignment("job", kpiID, &jobID, nil, nil); err != nil {
			return err
		}
	}
	return nil
}

type demoKpiPlan struct {
	email   string
	status  string
	entries []struct {
		code   string
		weight float64
		target float64
	}
}

func (s *KpiAssignmentsSeeder) seedDemoStaffAssignments() error {
	plans := []demoKpiPlan{
		{
			email: "worker@moh.go.ug",
			entries: []struct {
				code   string
				weight float64
				target float64
			}{
				{"201", 25, 100}, {"202", 20, 100}, {"203", 20, 90}, {"204", 20, 95}, {"205", 15, 100},
			},
		},
		{
			email: "supervisor@moh.go.ug",
			entries: []struct {
				code   string
				weight float64
				target float64
			}{
				{"201", 20, 100}, {"209", 20, 100}, {"210", 20, 100}, {"211", 20, 100}, {"214", 20, 100},
			},
		},
		{
			email: "depthead@moh.go.ug",
			entries: []struct {
				code   string
				weight float64
				target float64
			}{
				{"128", 20, 100}, {"129", 20, 100}, {"130", 20, 100}, {"136", 20, 100}, {"214", 20, 100},
			},
		},
		{
			email: "hr@moh.go.ug",
			entries: []struct {
				code   string
				weight float64
				target float64
			}{
				{"127", 15, 100}, {"128", 20, 100}, {"130", 20, 100}, {"131", 15, 100}, {"132", 10, 1}, {"211", 20, 100},
			},
		},
	}

	for _, plan := range plans {
		staffID, err := s.staffIDByEmail(plan.email)
		if err != nil {
			continue
		}
		for _, entry := range plan.entries {
			kpiID, err := s.kpiIDByCode(entry.code)
			if err != nil {
				continue
			}
			sid := staffID
			if err := s.ensureAssignment("staff", kpiID, nil, nil, &sid); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *KpiAssignmentsSeeder) seedDemoPpas() error {
	plans := []demoKpiPlan{
		{
			email:  "worker@moh.go.ug",
			status: "supervisor_review",
			entries: []struct {
				code   string
				weight float64
				target float64
			}{
				{"201", 25, 100}, {"202", 20, 100}, {"203", 20, 90}, {"204", 20, 95}, {"205", 15, 100},
			},
		},
		{
			email:  "supervisor@moh.go.ug",
			status: "approved",
			entries: []struct {
				code   string
				weight float64
				target float64
			}{
				{"201", 20, 100}, {"209", 20, 100}, {"210", 20, 100}, {"211", 20, 100}, {"214", 20, 100},
			},
		},
		{
			email:  "depthead@moh.go.ug",
			status: "approved",
			entries: []struct {
				code   string
				weight float64
				target float64
			}{
				{"128", 20, 100}, {"129", 20, 100}, {"130", 20, 100}, {"136", 20, 100}, {"214", 20, 100},
			},
		},
		{
			email:  "hr@moh.go.ug",
			status: "approved",
			entries: []struct {
				code   string
				weight float64
				target float64
			}{
				{"127", 15, 100}, {"128", 20, 100}, {"130", 20, 100}, {"131", 15, 100}, {"132", 10, 1}, {"211", 20, 100},
			},
		},
	}

	fy, err := s.ensureFinancialYear()
	if err != nil {
		return err
	}

	for _, plan := range plans {
		staffID, err := s.staffIDByEmail(plan.email)
		if err != nil {
			continue
		}
		total := 0.0
		for _, e := range plan.entries {
			total += e.weight
		}

		var ppa models.Ppa
		if err := facades.Orm().Query().
			Where("staff_id", staffID).
			Where("financial_year_id", fy.ID).
			FirstOr(&ppa, func() error {
				ppa = models.Ppa{
					StaffID:         staffID,
					FinancialYearID: fy.ID,
					Status:          plan.status,
					TotalWeight:     total,
				}
				return facades.Orm().Query().Create(&ppa)
			}); err != nil {
			return err
		}
		ppa.Status = plan.status
		ppa.TotalWeight = total
		if err := facades.Orm().Query().Save(&ppa); err != nil {
			return err
		}

		for _, entry := range plan.entries {
			kpiID, err := s.kpiIDByCode(entry.code)
			if err != nil {
				continue
			}
			target := entry.target
			var ppaKpi models.PpaKpi
			if err := facades.Orm().Query().
				Where("ppa_id", ppa.ID).
				Where("kpi_id", kpiID).
				FirstOr(&ppaKpi, func() error {
					ppaKpi = models.PpaKpi{
						PpaID:            ppa.ID,
						KpiID:            kpiID,
						WeightPercentage: entry.weight,
						TargetValue:      &target,
					}
					return facades.Orm().Query().Create(&ppaKpi)
				}); err != nil {
				return err
			}
			ppaKpi.WeightPercentage = entry.weight
			ppaKpi.TargetValue = &target
			_ = facades.Orm().Query().Save(&ppaKpi)
		}
	}
	return nil
}

func (s *KpiAssignmentsSeeder) kpiIDByCode(code string) (uint, error) {
	var kpi models.Kpi
	if err := facades.Orm().Query().Where("kpi_code", code).First(&kpi); err != nil || kpi.ID == 0 {
		return 0, fmt.Errorf("kpi %s not found", code)
	}
	return kpi.ID, nil
}

func (s *KpiAssignmentsSeeder) staffIDByEmail(email string) (uint, error) {
	var user models.User
	if err := facades.Orm().Query().Where("email", email).First(&user); err != nil || user.ID == 0 {
		return 0, fmt.Errorf("user not found")
	}
	if user.StaffID == nil {
		return 0, fmt.Errorf("user has no staff")
	}
	return *user.StaffID, nil
}

func (s *KpiAssignmentsSeeder) ensureFinancialYear() (models.FinancialYear, error) {
	label := "FY 2025/2026"
	var fy models.FinancialYear
	if err := facades.Orm().Query().Where("year_label", label).FirstOr(&fy, func() error {
		start := time.Date(2025, 7, 1, 0, 0, 0, 0, time.UTC)
		end := time.Date(2026, 6, 30, 0, 0, 0, 0, time.UTC)
		fy = models.FinancialYear{YearLabel: label, StartDate: start, EndDate: end, IsCurrent: true}
		return facades.Orm().Query().Create(&fy)
	}); err != nil {
		return fy, err
	}
	return fy, nil
}
