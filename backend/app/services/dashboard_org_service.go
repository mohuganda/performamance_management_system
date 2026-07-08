package services

import (
	"fmt"
	"strings"

	"goravel/app/facades"
	"goravel/app/models"
)

// OrgContext uses Ministry of Health / iHRIS naming — not generic "sector".
type OrgContext struct {
	ScopeLevel      string   `json:"scope_level"`
	InstitutionType string   `json:"institution_type,omitempty"`
	Facility        string   `json:"facility,omitempty"`
	Department      string   `json:"department,omitempty"`
	Division        string   `json:"division,omitempty"`
	Section         string   `json:"section,omitempty"`
	Unit            string   `json:"unit,omitempty"`
	Region          string   `json:"region,omitempty"`
	District        string   `json:"district,omitempty"`
	DisplayContext  string   `json:"display_context"`
	Breadcrumb      []string `json:"breadcrumb"`
}

type FacilityPerformanceRow struct {
	Facility        string `json:"facility"`
	InstitutionType string `json:"institution_type"`
	District        string `json:"district"`
	Region          string `json:"region,omitempty"`
	Staff           int    `json:"staff"`
	Departments     int    `json:"departments"`
	AvgTaskPercent  int    `json:"avg_task_percent"`
	Attendance      int    `json:"attendance"`
	ActivePips      int    `json:"active_pips"`
	Status          string `json:"status"`
}

type DashboardOrgService struct{}

func NewDashboardOrgService() *DashboardOrgService {
	return &DashboardOrgService{}
}

func (s *DashboardOrgService) ResolveForStaff(staffID uint) OrgContext {
	if staffID == 0 {
		return s.NationalContext()
	}

	var contract models.StaffContract
	err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("contract_status", "active").
		With("Facility").
		With("Department").
		First(&contract)
	if err != nil || contract.ID == 0 {
		return s.NationalContext()
	}

	ctx := OrgContext{ScopeLevel: "facility"}
	if contract.Facility.ID > 0 {
		ctx.Facility = contract.Facility.Name
		if contract.Facility.InstitutionTypeName != nil {
			ctx.InstitutionType = *contract.Facility.InstitutionTypeName
		}
		if contract.Facility.DistrictName != nil {
			ctx.District = *contract.Facility.DistrictName
		}
	}
	if contract.Department != nil && contract.Department.Name != "" {
		ctx.Department = contract.Department.Name
		ctx.ScopeLevel = "department"
	}
	if contract.Division != nil && strings.TrimSpace(*contract.Division) != "" {
		ctx.Division = strings.TrimSpace(*contract.Division)
	}
	if contract.Section != nil && strings.TrimSpace(*contract.Section) != "" {
		ctx.Section = strings.TrimSpace(*contract.Section)
	}
	if contract.Unit != nil && strings.TrimSpace(*contract.Unit) != "" {
		ctx.Unit = strings.TrimSpace(*contract.Unit)
	}
	if contract.DistrictName != nil && *contract.DistrictName != "" {
		ctx.District = *contract.DistrictName
	}

	var staff models.Staff
	if facades.Orm().Query().Where("id", staffID).First(&staff); staff.ID > 0 && staff.Region != nil {
		ctx.Region = strings.TrimSpace(*staff.Region)
	}

	ctx.DisplayContext = s.formatContext(ctx)
	ctx.Breadcrumb = s.breadcrumb(ctx)
	return ctx
}

func (s *DashboardOrgService) NationalContext() OrgContext {
	ctx := OrgContext{
		ScopeLevel:      "national",
		InstitutionType: "Ministry of Health Uganda",
		Facility:        facades.Config().GetString("pms.demo.focus_facility_name", "Ministry of Health"),
	}
	ctx.DisplayContext = "National overview · " + ctx.Facility
	ctx.Breadcrumb = []string{"National", ctx.Facility}
	return ctx
}

func (s *DashboardOrgService) formatContext(ctx OrgContext) string {
	if ctx.ScopeLevel == "national" {
		return ctx.DisplayContext
	}
	parts := make([]string, 0, 6)
	if ctx.Facility != "" {
		parts = append(parts, ctx.Facility)
	}
	if ctx.InstitutionType != "" && !strings.EqualFold(ctx.InstitutionType, ctx.Facility) {
		parts = append(parts, ctx.InstitutionType)
	}
	if ctx.Department != "" {
		parts = append(parts, ctx.Department)
	}
	if ctx.Division != "" {
		parts = append(parts, ctx.Division)
	}
	if ctx.District != "" {
		parts = append(parts, ctx.District)
	}
	if len(parts) == 0 {
		return "Ministry of Health Uganda"
	}
	return strings.Join(parts, " · ")
}

func (s *DashboardOrgService) breadcrumb(ctx OrgContext) []string {
	parts := make([]string, 0, 7)
	if ctx.ScopeLevel == "national" {
		return []string{"National", ctx.Facility}
	}
	if ctx.Facility != "" {
		parts = append(parts, ctx.Facility)
	}
	if ctx.InstitutionType != "" {
		parts = append(parts, ctx.InstitutionType)
	}
	if ctx.Department != "" {
		parts = append(parts, ctx.Department)
	}
	if ctx.Division != "" {
		parts = append(parts, ctx.Division)
	}
	if ctx.Section != "" {
		parts = append(parts, ctx.Section)
	}
	if ctx.Unit != "" {
		parts = append(parts, ctx.Unit)
	}
	if ctx.District != "" {
		parts = append(parts, ctx.District)
	}
	return parts
}

func (s *DashboardOrgService) TaskCompletionLabel(ctx OrgContext) string {
	switch ctx.ScopeLevel {
	case "department":
		if ctx.Department != "" {
			return fmt.Sprintf("%s — task completion", ctx.Department)
		}
		return "Department task completion"
	case "facility":
		if ctx.Facility != "" {
			return fmt.Sprintf("%s — task completion", ctx.Facility)
		}
		return "Facility task completion"
	default:
		return "National task completion"
	}
}

func (s *DashboardOrgService) ListFacilityPerformance(limit int) []FacilityPerformanceRow {
	if limit <= 0 {
		limit = 15
	}

	type facilityAgg struct {
		facility        models.Facility
		staff           map[uint]bool
		departments     map[uint]bool
	}

	aggs := map[uint]*facilityAgg{}
	var contracts []models.StaffContract
	_ = facades.Orm().Query().
		Where("contract_status", "active").
		With("Facility").
		Get(&contracts)

	for _, c := range contracts {
		if c.FacilityID == 0 {
			continue
		}
		agg := aggs[c.FacilityID]
		if agg == nil {
			fac := c.Facility
			if fac.ID == 0 {
				var loaded models.Facility
				_ = facades.Orm().Query().Where("id", c.FacilityID).First(&loaded)
				fac = loaded
			}
			agg = &facilityAgg{facility: fac, staff: map[uint]bool{}, departments: map[uint]bool{}}
			aggs[c.FacilityID] = agg
		}
		agg.staff[c.StaffID] = true
		if c.DepartmentID != nil && *c.DepartmentID > 0 {
			agg.departments[*c.DepartmentID] = true
		}
	}

	rows := make([]FacilityPerformanceRow, 0, len(aggs))
	idx := 0
	for _, agg := range aggs {
		staffCount := len(agg.staff)
		if staffCount == 0 {
			continue
		}
		instType := ""
		if agg.facility.InstitutionTypeName != nil {
			instType = *agg.facility.InstitutionTypeName
		}
		district := ""
		if agg.facility.DistrictName != nil {
			district = *agg.facility.DistrictName
		}
		// Performance metrics remain illustrative until KPI rollups are wired.
		taskPct := 55 + (staffCount % 35)
		attendance := 76 + (staffCount % 20)
		pips := staffCount % 16
		status := "on_track"
		if taskPct < 60 {
			status = "off_track"
		} else if taskPct < 80 {
			status = "at_risk"
		}
		rows = append(rows, FacilityPerformanceRow{
			Facility:        agg.facility.Name,
			InstitutionType: instType,
			District:        district,
			Staff:           staffCount,
			Departments:     len(agg.departments),
			AvgTaskPercent:  taskPct,
			Attendance:      attendance,
			ActivePips:      pips,
			Status:          status,
		})
		idx++
	}

	for i := 0; i < len(rows); i++ {
		for j := i + 1; j < len(rows); j++ {
			if rows[j].Staff > rows[i].Staff {
				rows[i], rows[j] = rows[j], rows[i]
			}
		}
	}
	if len(rows) > limit {
		rows = rows[:limit]
	}
	if len(rows) == 0 {
		return s.demoFacilityPerformance()
	}
	return rows
}

func (s *DashboardOrgService) demoFacilityPerformance() []FacilityPerformanceRow {
	return []FacilityPerformanceRow{
		{Facility: "Ministry of Health", InstitutionType: "Ministry", District: "KAMPALA", Staff: 120, Departments: 8, AvgTaskPercent: 78, Attendance: 94, ActivePips: 2, Status: "on_track"},
		{Facility: "Mulago National Referral Hospital", InstitutionType: "National Referral Hospital", District: "KAMPALA", Staff: 2500, Departments: 42, AvgTaskPercent: 78, Attendance: 92, ActivePips: 3, Status: "on_track"},
		{Facility: "Jinja Regional Referral Hospital", InstitutionType: "Regional Referral Hospital", District: "JINJA", Staff: 450, Departments: 18, AvgTaskPercent: 55, Attendance: 76, ActivePips: 15, Status: "off_track"},
	}
}

func (s *DashboardOrgService) SummarizeFacilities(rows []FacilityPerformanceRow) map[string]int {
	total := len(rows)
	onTrack, atRisk, offTrack := 0, 0, 0
	staffTotal := 0
	for _, row := range rows {
		staffTotal += row.Staff
		switch row.Status {
		case "on_track":
			onTrack++
		case "at_risk":
			atRisk++
		case "off_track":
			offTrack++
		}
	}
	percent := 0
	if total > 0 {
		percent = int(float64(onTrack) / float64(total) * 100)
	}
	return map[string]int{
		"percent":          percent,
		"on_track":         onTrack,
		"total":            total,
		"at_risk":          atRisk,
		"off_track":        offTrack,
		"total_facilities": total,
		"total_staff":      staffTotal,
	}
}
