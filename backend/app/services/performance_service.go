package services

import (
	"fmt"
	"math"
	"sort"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type PerformanceService struct {
	cache  *StaffCacheService
	config *PerformanceConfigService
}

func NewPerformanceService() *PerformanceService {
	return &PerformanceService{
		cache:  NewStaffCacheService(),
		config: NewPerformanceConfigService(),
	}
}

type PerformanceSummary struct {
	PPA              PpaSummary              `json:"ppa"`
	Kpis             []KpiWeightSummary      `json:"kpis"`
	SubjectGroups    []SubjectAreaKpiGroup   `json:"subject_groups"`
	Quarters         []QuarterCycleSummary   `json:"quarters"`
	FinancialYear    string                  `json:"financial_year"`
	ReportingConfig  ReportingConfigSummary  `json:"reporting_config"`
	PpaWindow        ReportingWindowStatus   `json:"ppa_window"`
}

type PpaSummary struct {
	Status       string  `json:"status"`
	TotalWeight  float64 `json:"total_weight"`
	Progress     int     `json:"progress_percent"`
	CurrentStage string  `json:"current_stage"`
}

type KpiWeightSummary struct {
	ID            uint    `json:"id,omitempty"`
	PpaKpiID      uint    `json:"ppa_kpi_id,omitempty"`
	Name          string  `json:"name"`
	Weight        float64 `json:"weight"`
	Target        float64 `json:"target,omitempty"`
	SubjectArea   string  `json:"subject_area,omitempty"`
	Source        string  `json:"source,omitempty"`
	IsMandatory   bool    `json:"is_mandatory,omitempty"`
	Frequency     string  `json:"frequency,omitempty"`
	Computation   string  `json:"computation_category,omitempty"`
	IsCumulative  bool    `json:"is_cumulative,omitempty"`
}

type SubjectAreaKpiGroup struct {
	SubjectAreaID   uint8              `json:"subject_area_id"`
	SubjectAreaName string             `json:"subject_area_name"`
	Kpis            []KpiWeightSummary `json:"kpis"`
}

type QuarterCycleSummary struct {
	ID              string `json:"id"`
	Label           string `json:"label"`
	Window          string `json:"window"`
	Status          string `json:"status"`
	IsOpen          bool   `json:"is_open"`
	OpenAt          string `json:"open_at,omitempty"`
	CloseAt         string `json:"close_at,omitempty"`
	DaysRemaining   int    `json:"days_remaining,omitempty"`
	ReportingWindow string `json:"reporting_window,omitempty"`
}

type ReportingConfigSummary struct {
	EnforceWindows  bool `json:"enforce_windows"`
	TestOverride    bool `json:"test_override"`
	WindowWeeks     int  `json:"window_weeks"`
	WindowShiftDays int  `json:"window_shift_days"`
}

type AvailableKpi struct {
	ID                   uint     `json:"id"`
	PpaKpiID             uint     `json:"ppa_kpi_id,omitempty"`
	Code                 string   `json:"code"`
	Name                 string   `json:"name"`
	Frequency            string   `json:"frequency"`
	ComputationCategory  string   `json:"computation_category"`
	SubjectAreaID        uint8    `json:"subject_area_id"`
	SubjectAreaName      string   `json:"subject_area_name"`
	Source               string   `json:"source"`
	IsMandatory          bool     `json:"is_mandatory"`
	DefaultTarget        *int     `json:"default_target,omitempty"`
	InCurrentPpa         bool     `json:"in_current_ppa"`
	WeightPercentage     float64  `json:"weight_percentage,omitempty"`
	TargetValue          *float64 `json:"target_value,omitempty"`
	Numerator            string   `json:"numerator,omitempty"`
	Denominator          string   `json:"denominator,omitempty"`
	IsCumulative         bool     `json:"is_cumulative"`
}

type SubjectAreaAvailableGroup struct {
	SubjectAreaID   uint8          `json:"subject_area_id"`
	SubjectAreaName string         `json:"subject_area_name"`
	Kpis            []AvailableKpi `json:"kpis"`
}

type PpaKpiInput struct {
	KpiID            uint    `json:"kpi_id"`
	WeightPercentage float64 `json:"weight_percentage"`
	TargetValue      float64 `json:"target_value"`
}

type ReportEntryInput struct {
	PpaKpiID    uint    `json:"ppa_kpi_id"`
	ActualValue float64 `json:"actual_value"`
	Narrative   string  `json:"narrative"`
}

type PriorReportSnapshot struct {
	ReportType  string  `json:"report_type"`
	Label       string  `json:"label"`
	ActualValue float64 `json:"actual_value"`
}

type ReportKpiField struct {
	PpaKpiID            uint                  `json:"ppa_kpi_id"`
	KpiID               uint                  `json:"kpi_id"`
	Code                string                `json:"code"`
	Name                string                `json:"name"`
	Frequency           string                `json:"frequency"`
	ComputationCategory string                `json:"computation_category"`
	SubjectAreaName     string                `json:"subject_area_name"`
	Source              string                `json:"source"`
	WeightPercentage    float64               `json:"weight_percentage"`
	TargetValue         float64               `json:"target_value"`
	ActualValue         float64               `json:"actual_value,omitempty"`
	Narrative           string                `json:"narrative,omitempty"`
	ProgressPercent     float64               `json:"progress_percent,omitempty"`
	IsCumulative        bool                  `json:"is_cumulative"`
	PriorReports        []PriorReportSnapshot `json:"prior_reports,omitempty"`
	ReportingHint       string                `json:"reporting_hint,omitempty"`
}

type ReportFormGroup struct {
	SubjectAreaID   uint8            `json:"subject_area_id"`
	SubjectAreaName string           `json:"subject_area_name"`
	Kpis            []ReportKpiField `json:"kpis"`
}

type ReportForm struct {
	ReportType      string                 `json:"report_type"`
	FinancialYear   string                 `json:"financial_year"`
	PpaStatus       string                 `json:"ppa_status"`
	ReportStatus    string                 `json:"report_status,omitempty"`
	SubjectGroups   []ReportFormGroup      `json:"subject_groups"`
	ReportingWindow ReportingWindowStatus  `json:"reporting_window"`
	Appraisal       *AppraisalBundle       `json:"appraisal,omitempty"`
}

type staffContext struct {
	StaffID      uint
	JobID        uint
	DepartmentID *uint
}

type resolvedKpi struct {
	KpiID       uint
	Source      string
	IsMandatory bool
}

func (s *PerformanceService) SummaryForStaff(staffID uint) (PerformanceSummary, error) {
	summary := PerformanceSummary{}

	fy, fyErr := s.currentFinancialYear()
	if fyErr != nil {
		summary.FinancialYear = "FY 2025/2026"
		summary.PPA = PpaSummary{Status: "draft", CurrentStage: "Define objectives & KPIs", Progress: 0}
		return summary, nil
	}
	summary.FinancialYear = fy.YearLabel

	settings, _ := s.config.LoadSettings()
	summary.ReportingConfig = ReportingConfigSummary{
		EnforceWindows:  settings.EnforceWindows,
		TestOverride:    settings.TestOverride,
		WindowWeeks:     settings.WindowWeeks,
		WindowShiftDays: settings.WindowShiftDays,
	}
	if windows, err := s.config.ListWindowStatuses(fy, time.Now()); err == nil {
		summary.Quarters = quarterSummariesFromWindows(windows)
		for _, w := range windows {
			if w.Phase == "ppa" {
				summary.PpaWindow = w
				break
			}
		}
	}

	ppa, ppaErr := s.loadPpa(staffID, fy.ID)
	if ppaErr != nil {
		summary.PPA = PpaSummary{Status: "draft", CurrentStage: "Define objectives & KPIs", Progress: 0}
		return summary, nil
	}

	progress := int(ppa.TotalWeight)
	if progress > 100 {
		progress = 100
	}
	stage := "Supervisor review & sign-off"
	switch ppa.Status {
	case "draft":
		stage = "Define objectives & KPIs"
	case "approved":
		stage = "HR validation complete"
	}

	summary.PPA = PpaSummary{
		Status:       ppa.Status,
		TotalWeight:  ppa.TotalWeight,
		Progress:     progress,
		CurrentStage: stage,
	}

	groups, err := s.buildPpaKpiGroups(staffID, ppa.ID)
	if err == nil {
		summary.SubjectGroups = groups
		for _, g := range groups {
			summary.Kpis = append(summary.Kpis, g.Kpis...)
		}
	}

	return summary, nil
}

func (s *PerformanceService) SummaryForStaffOrError(staffID uint) (PerformanceSummary, error) {
	if staffID == 0 {
		return PerformanceSummary{}, fmt.Errorf("staff record required")
	}
	return s.SummaryForStaff(staffID)
}

func (s *PerformanceService) CurrentFinancialYear() (models.FinancialYear, error) {
	return s.currentFinancialYear()
}

func (s *PerformanceService) currentFinancialYear() (models.FinancialYear, error) {
	var fy models.FinancialYear
	if err := facades.Orm().Query().Where("is_current", true).Order("id desc").First(&fy); err != nil || fy.ID == 0 {
		return fy, fmt.Errorf("no active financial year configured")
	}
	return fy, nil
}

func (s *PerformanceService) loadPpa(staffID, fyID uint) (models.Ppa, error) {
	var ppa models.Ppa
	if err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("financial_year_id", fyID).
		First(&ppa); err != nil || ppa.ID == 0 {
		return ppa, fmt.Errorf("ppa not found")
	}
	return ppa, nil
}

func (s *PerformanceService) ensurePpa(staffID uint, fy models.FinancialYear) (models.Ppa, error) {
	var ppa models.Ppa
	if err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("financial_year_id", fy.ID).
		FirstOr(&ppa, func() error {
			ppa = models.Ppa{
				StaffID:         staffID,
				FinancialYearID: fy.ID,
				Status:          "draft",
			}
			return facades.Orm().Query().Create(&ppa)
		}); err != nil {
		return ppa, err
	}
	return ppa, nil
}

func (s *PerformanceService) staffContext(staffID uint) (staffContext, error) {
	var contract models.StaffContract
	if err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("contract_status", "active").
		First(&contract); err != nil || contract.ID == 0 {
		return staffContext{}, fmt.Errorf("active contract not found")
	}
	return staffContext{
		StaffID:      staffID,
		JobID:        contract.JobID,
		DepartmentID: contract.DepartmentID,
	}, nil
}

func (s *PerformanceService) resolveAssignedKpis(ctx staffContext) (map[uint]resolvedKpi, error) {
	out := map[uint]resolvedKpi{}

	var assignments []models.KpiAssignment
	if err := facades.Orm().Query().Where("is_active", true).Get(&assignments); err != nil {
		return nil, err
	}

	for _, a := range assignments {
		switch a.AssignableType {
		case "job":
			if a.JobID != nil && *a.JobID == ctx.JobID {
				out[a.KpiID] = resolvedKpi{KpiID: a.KpiID, Source: "job", IsMandatory: true}
			}
		case "department":
			if ctx.DepartmentID != nil && a.DepartmentID != nil && *a.DepartmentID == *ctx.DepartmentID {
				existing, ok := out[a.KpiID]
				if !ok {
					out[a.KpiID] = resolvedKpi{KpiID: a.KpiID, Source: "department", IsMandatory: false}
				} else if existing.Source == "department" {
					continue
				}
			}
		case "facility":
			if a.FacilityID != nil {
				var contract models.StaffContract
				if err := facades.Orm().Query().
					Where("staff_id", ctx.StaffID).
					Where("contract_status", "active").
					First(&contract); err == nil && contract.ID > 0 && contract.FacilityID == *a.FacilityID {
					_, ok := out[a.KpiID]
					if !ok {
						out[a.KpiID] = resolvedKpi{KpiID: a.KpiID, Source: "facility", IsMandatory: false}
					}
				}
			}
		case "facility_type":
			if a.FacilityTypeRefID != nil {
				var contract models.StaffContract
				if err := facades.Orm().Query().
					Where("staff_id", ctx.StaffID).
					Where("contract_status", "active").
					First(&contract); err == nil && contract.ID > 0 {
					var facility models.Facility
					if err := facades.Orm().Query().Where("id", contract.FacilityID).First(&facility); err == nil && facility.ID > 0 &&
						facility.FacilityTypeRefID != nil && *facility.FacilityTypeRefID == *a.FacilityTypeRefID {
						_, ok := out[a.KpiID]
						if !ok {
							out[a.KpiID] = resolvedKpi{KpiID: a.KpiID, Source: "facility_type", IsMandatory: false}
						}
					}
				}
			}
		case "staff":
			if a.StaffID != nil && *a.StaffID == ctx.StaffID {
				out[a.KpiID] = resolvedKpi{KpiID: a.KpiID, Source: "individual", IsMandatory: true}
			}
		}
	}

	return out, nil
}

func (s *PerformanceService) kpiDisplayName(kpi models.Kpi) string {
	if kpi.ShortName != nil && *kpi.ShortName != "" {
		return *kpi.ShortName
	}
	return kpi.IndicatorStatement
}

func (s *PerformanceService) buildAvailableKpi(kpi models.Kpi, meta resolvedKpi, ppaKpi *models.PpaKpi) AvailableKpi {
	item := AvailableKpi{
		ID:                  kpi.ID,
		Code:                kpi.KpiCode,
		Name:                s.kpiDisplayName(kpi),
		Frequency:           kpi.Frequency,
		ComputationCategory: kpi.ComputationCategory,
		SubjectAreaID:       SubjectAreaSortKey(kpi.SubjectArea),
		SubjectAreaName:     SubjectAreaNamePtr(kpi.SubjectArea),
		Source:              meta.Source,
		IsMandatory:         meta.IsMandatory,
		DefaultTarget:       kpi.CurrentTarget,
		IsCumulative:        kpi.IsCumulative,
	}
	if kpi.Numerator != nil {
		item.Numerator = *kpi.Numerator
	}
	if kpi.Denominator != nil {
		item.Denominator = *kpi.Denominator
	}
	if ppaKpi != nil {
		item.InCurrentPpa = true
		item.PpaKpiID = ppaKpi.ID
		item.WeightPercentage = ppaKpi.WeightPercentage
		item.TargetValue = ppaKpi.TargetValue
	}
	return item
}

func (s *PerformanceService) ListAvailableKpisGrouped(staffID uint) ([]SubjectAreaAvailableGroup, error) {
	cacheKey := s.cache.key("perf-grouped", fmt.Sprintf("%d", staffID))
	var cached []SubjectAreaAvailableGroup
	if s.cache.Get(cacheKey, &cached) {
		return cached, nil
	}

	ctx, err := s.staffContext(staffID)
	if err != nil {
		return nil, err
	}

	fy, err := s.currentFinancialYear()
	if err != nil {
		return nil, err
	}

	ppa, _ := s.ensurePpa(staffID, fy)
	ppaKpiByKpi := map[uint]models.PpaKpi{}
	var ppaKpis []models.PpaKpi
	_ = facades.Orm().Query().Where("ppa_id", ppa.ID).Get(&ppaKpis)
	for _, row := range ppaKpis {
		ppaKpiByKpi[row.KpiID] = row
	}

	resolved, err := s.resolveAssignedKpis(ctx)
	if err != nil {
		return nil, err
	}

	byArea := map[uint8][]AvailableKpi{}
	for kpiID, meta := range resolved {
		var kpi models.Kpi
		if err := facades.Orm().Query().Where("id", kpiID).Where("status", true).First(&kpi); err != nil || kpi.ID == 0 {
			continue
		}
		var ppaKpi *models.PpaKpi
		if row, ok := ppaKpiByKpi[kpi.ID]; ok {
			copy := row
			ppaKpi = &copy
		}
		areaID := SubjectAreaSortKey(kpi.SubjectArea)
		byArea[areaID] = append(byArea[areaID], s.buildAvailableKpi(kpi, meta, ppaKpi))
	}

	groups := s.sortAvailableGroups(byArea)
	s.cache.Put(cacheKey, groups)
	return groups, nil
}

func (s *PerformanceService) ListAvailableKpis(staffID uint) ([]AvailableKpi, error) {
	groups, err := s.ListAvailableKpisGrouped(staffID)
	if err != nil {
		return nil, err
	}
	var flat []AvailableKpi
	for _, g := range groups {
		flat = append(flat, g.Kpis...)
	}
	if flat == nil {
		flat = []AvailableKpi{}
	}
	return flat, nil
}

func (s *PerformanceService) buildPpaKpiGroups(staffID, ppaID uint) ([]SubjectAreaKpiGroup, error) {
	var rows []models.PpaKpi
	if err := facades.Orm().Query().Where("ppa_id", ppaID).Get(&rows); err != nil {
		return nil, err
	}

	ctx, _ := s.staffContext(staffID)
	resolved, _ := s.resolveAssignedKpis(ctx)

	byArea := map[uint8][]KpiWeightSummary{}
	for _, row := range rows {
		var kpi models.Kpi
		if err := facades.Orm().Query().Where("id", row.KpiID).First(&kpi); err != nil || kpi.ID == 0 {
			continue
		}
		meta := resolved[kpi.ID]
		target := 0.0
		if row.TargetValue != nil {
			target = *row.TargetValue
		}
		byArea[SubjectAreaSortKey(kpi.SubjectArea)] = append(byArea[SubjectAreaSortKey(kpi.SubjectArea)], KpiWeightSummary{
			ID:          kpi.ID,
			PpaKpiID:    row.ID,
			Name:        s.kpiDisplayName(kpi),
			Weight:      row.WeightPercentage,
			Target:      target,
			SubjectArea: SubjectAreaNamePtr(kpi.SubjectArea),
			Source:      meta.Source,
			IsMandatory: meta.IsMandatory,
			Frequency:   kpi.Frequency,
			Computation: kpi.ComputationCategory,
			IsCumulative: kpi.IsCumulative,
		})
	}

	return s.sortWeightGroups(byArea), nil
}

func (s *PerformanceService) GetReportForm(staffID uint, reportType string) (ReportForm, error) {
	if reportType == "" {
		reportType = "q1"
	}

	fy, err := s.currentFinancialYear()
	if err != nil {
		return ReportForm{}, err
	}

	if err := s.config.AssertOpen(reportType, fy, time.Now()); err != nil {
		return ReportForm{}, err
	}

	ppa, err := s.loadPpa(staffID, fy.ID)
	if err != nil {
		return ReportForm{}, fmt.Errorf("submit your performance plan before filing quarterly reports")
	}

	quarter, err := s.ensureQuarter(fy, reportType)
	if err != nil {
		return ReportForm{}, err
	}

	var report models.PerformanceReport
	_ = facades.Orm().Query().
		Where("staff_id", staffID).
		Where("financial_year_id", fy.ID).
		Where("quarter_id", quarter.ID).
		First(&report)

	entriesByPpaKpi := map[uint]models.PerformanceReportEntry{}
	if report.ID > 0 {
		var entries []models.PerformanceReportEntry
		_ = facades.Orm().Query().Where("performance_report_id", report.ID).Get(&entries)
		for _, e := range entries {
			entriesByPpaKpi[e.PpaKpiID] = e
		}
	}

	ctx, _ := s.staffContext(staffID)
	resolved, _ := s.resolveAssignedKpis(ctx)

	var ppaKpis []models.PpaKpi
	if err := facades.Orm().Query().Where("ppa_id", ppa.ID).Get(&ppaKpis); err != nil {
		return ReportForm{}, err
	}

	byArea := map[uint8][]ReportKpiField{}
	for _, row := range ppaKpis {
		var kpi models.Kpi
		if err := facades.Orm().Query().Where("id", row.KpiID).First(&kpi); err != nil || kpi.ID == 0 {
			continue
		}
		meta := resolved[kpi.ID]
		target := 0.0
		if row.TargetValue != nil {
			target = *row.TargetValue
		}
		field := ReportKpiField{
			PpaKpiID:            row.ID,
			KpiID:               kpi.ID,
			Code:                kpi.KpiCode,
			Name:                s.kpiDisplayName(kpi),
			Frequency:           kpi.Frequency,
			ComputationCategory: kpi.ComputationCategory,
			SubjectAreaName:     SubjectAreaNamePtr(kpi.SubjectArea),
			Source:              meta.Source,
			WeightPercentage:    row.WeightPercentage,
			TargetValue:         target,
			IsCumulative:        kpi.IsCumulative,
		}
		if kpi.IsCumulative {
			field.PriorReports = s.priorCumulativeReports(staffID, fy.ID, row.ID, reportType)
			field.ReportingHint = "Enter your year-to-date cumulative actual. Progress is tracked against your annual target as performance builds through the year."
		}
		if entry, ok := entriesByPpaKpi[row.ID]; ok {
			if entry.Narrative != nil {
				field.Narrative = *entry.Narrative
			}
		}
		actual, hasActual := resolveReportKpiActual(entriesByPpaKpi[row.ID], reportType, target, kpi.IsCumulative, field.PriorReports)
		if hasActual {
			field.ActualValue = actual
			if target > 0 {
				field.ProgressPercent = (actual / target) * 100
				if field.ProgressPercent > 100 {
					field.ProgressPercent = 100
				}
			}
		}
		byArea[SubjectAreaSortKey(kpi.SubjectArea)] = append(byArea[SubjectAreaSortKey(kpi.SubjectArea)], field)
	}

	groups := make([]ReportFormGroup, 0, len(byArea))
	areaIDs := make([]uint8, 0, len(byArea))
	for id := range byArea {
		areaIDs = append(areaIDs, id)
	}
	sort.Slice(areaIDs, func(i, j int) bool { return areaIDs[i] < areaIDs[j] })
	for _, id := range areaIDs {
		groups = append(groups, ReportFormGroup{
			SubjectAreaID:   id,
			SubjectAreaName: SubjectAreaName(id),
			Kpis:            byArea[id],
		})
	}

	settings, _ := s.config.LoadSettings()
	windowStatus := s.config.WindowStatus(reportType, fy, settings, time.Now())

	form := ReportForm{
		ReportType:      reportType,
		FinancialYear:   fy.YearLabel,
		PpaStatus:       ppa.Status,
		SubjectGroups:   groups,
		ReportingWindow: windowStatus,
	}
	if report.ID > 0 {
		form.ReportStatus = report.Status
		if reportType == "endterm" {
			bundle, err := s.loadAppraisalBundle(report, staffID)
			if err == nil {
				form.Appraisal = &bundle
			}
		}
	} else if reportType == "endterm" {
		// Empty appraisal scaffold for planning before first save
		bundle, _ := s.loadAppraisalBundle(models.PerformanceReport{
			StaffID:    staffID,
			ReportType: reportType,
			Status:     "draft",
		}, staffID)
		form.Appraisal = &bundle
	}

	return form, nil
}

func (s *PerformanceService) sortAvailableGroups(byArea map[uint8][]AvailableKpi) []SubjectAreaAvailableGroup {
	ids := make([]uint8, 0, len(byArea))
	for id := range byArea {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })

	groups := make([]SubjectAreaAvailableGroup, 0, len(ids))
	for _, id := range ids {
		kpis := byArea[id]
		sort.Slice(kpis, func(i, j int) bool { return kpis[i].Name < kpis[j].Name })
		name := SubjectAreaName(id)
		if id == 99 {
			name = "General"
		}
		groups = append(groups, SubjectAreaAvailableGroup{
			SubjectAreaID:   id,
			SubjectAreaName: name,
			Kpis:            kpis,
		})
	}
	return groups
}

func (s *PerformanceService) sortWeightGroups(byArea map[uint8][]KpiWeightSummary) []SubjectAreaKpiGroup {
	ids := make([]uint8, 0, len(byArea))
	for id := range byArea {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })

	groups := make([]SubjectAreaKpiGroup, 0, len(ids))
	for _, id := range ids {
		name := SubjectAreaName(id)
		if id == 99 {
			name = "General"
		}
		groups = append(groups, SubjectAreaKpiGroup{
			SubjectAreaID:   id,
			SubjectAreaName: name,
			Kpis:            byArea[id],
		})
	}
	return groups
}

func (s *PerformanceService) SavePpaPlan(staffID uint, inputs []PpaKpiInput) (models.Ppa, error) {
	fy, err := s.currentFinancialYear()
	if err != nil {
		return models.Ppa{}, err
	}

	if err := s.config.AssertOpen("ppa", fy, time.Now()); err != nil {
		return models.Ppa{}, err
	}

	ppa, err := s.ensurePpa(staffID, fy)
	if err != nil {
		return models.Ppa{}, err
	}
	if ppa.Status != "draft" && ppa.Status != "supervisor_review" {
		return models.Ppa{}, fmt.Errorf("PPA cannot be edited in status %s", ppa.Status)
	}

	total := 0.0
	for _, input := range inputs {
		total += input.WeightPercentage
	}
	if total > 100.01 {
		return models.Ppa{}, fmt.Errorf("total KPI weight cannot exceed 100%% (got %.1f)", total)
	}

	for _, input := range inputs {
		target := input.TargetValue
		var existing models.PpaKpi
		if err := facades.Orm().Query().
			Where("ppa_id", ppa.ID).
			Where("kpi_id", input.KpiID).
			FirstOr(&existing, func() error {
				existing = models.PpaKpi{
					PpaID:            ppa.ID,
					KpiID:            input.KpiID,
					WeightPercentage: input.WeightPercentage,
					TargetValue:      &target,
				}
				return facades.Orm().Query().Create(&existing)
			}); err != nil {
			return models.Ppa{}, err
		}
		if existing.ID > 0 {
			existing.WeightPercentage = input.WeightPercentage
			existing.TargetValue = &target
			if err := facades.Orm().Query().Save(&existing); err != nil {
				return models.Ppa{}, err
			}
		}
	}

	ppa.TotalWeight = total
	ppa.Status = "draft"
	if err := facades.Orm().Query().Save(&ppa); err != nil {
		return models.Ppa{}, err
	}

	s.cache.Invalidate()
	return ppa, nil
}

func (s *PerformanceService) SubmitPpa(staffID uint) error {
	fy, err := s.currentFinancialYear()
	if err != nil {
		return err
	}

	if err := s.config.AssertOpen("ppa", fy, time.Now()); err != nil {
		return err
	}

	var ppa models.Ppa
	if err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("financial_year_id", fy.ID).
		First(&ppa); err != nil || ppa.ID == 0 {
		return fmt.Errorf("performance plan not found — add KPIs first")
	}
	if ppa.TotalWeight < 99.9 {
		return fmt.Errorf("PPA total weight must reach 100%% before submission (currently %.1f%%)", ppa.TotalWeight)
	}

	ppa.Status = "supervisor_review"
	now := time.Now()
	ppa.SubmittedAt = &now
	if err := facades.Orm().Query().Save(&ppa); err != nil {
		return err
	}
	s.cache.Invalidate()
	return nil
}

func (s *PerformanceService) ensureQuarter(fy models.FinancialYear, reportType string) (models.Quarter, error) {
	var quarter models.Quarter
	if err := facades.Orm().Query().
		Where("financial_year_id", fy.ID).
		Where("report_type", reportType).
		First(&quarter); err == nil && quarter.ID > 0 {
		return quarter, nil
	}

	qNum := quarterNumberForReportType(reportType)
	quarter = models.Quarter{
		FinancialYearID: fy.ID,
		QuarterNumber:   qNum,
		Label:           reportTypeLabel(reportType),
		ReportType:      reportType,
		StartDate:       fy.StartDate,
		EndDate:         fy.EndDate,
	}
	if err := facades.Orm().Query().Create(&quarter); err != nil {
		return quarter, err
	}
	return quarter, nil
}

func quarterNumberForReportType(reportType string) uint8 {
	switch reportType {
	case "q1":
		return 1
	case "midterm":
		return 2
	case "q3":
		return 3
	case "endterm":
		return 4
	default:
		return 1
	}
}

func reportTypesBefore(reportType string) []string {
	current := quarterNumberForReportType(reportType)
	order := []string{"q1", "midterm", "q3", "endterm"}
	out := make([]string, 0, 3)
	for _, rt := range order {
		if quarterNumberForReportType(rt) < current {
			out = append(out, rt)
		}
	}
	return out
}

func (s *PerformanceService) priorCumulativeReports(staffID, fyID, ppaKpiID uint, beforeReportType string) []PriorReportSnapshot {
	priorTypes := reportTypesBefore(beforeReportType)
	if len(priorTypes) == 0 {
		return nil
	}

	var reports []models.PerformanceReport
	_ = facades.Orm().Query().
		Where("staff_id", staffID).
		Where("financial_year_id", fyID).
		Get(&reports)

	reportByType := map[string]models.PerformanceReport{}
	for _, r := range reports {
		reportByType[r.ReportType] = r
	}

	out := make([]PriorReportSnapshot, 0, len(priorTypes))
	for _, rt := range priorTypes {
		report, ok := reportByType[rt]
		if !ok || report.ID == 0 {
			continue
		}
		var entry models.PerformanceReportEntry
		if err := facades.Orm().Query().
			Where("performance_report_id", report.ID).
			Where("ppa_kpi_id", ppaKpiID).
			First(&entry); err != nil || entry.ID == 0 || entry.ActualValue == nil {
			continue
		}
		out = append(out, PriorReportSnapshot{
			ReportType:  rt,
			Label:       reportTypeLabel(rt),
			ActualValue: *entry.ActualValue,
		})
	}
	return out
}

func reportTypeLabel(reportType string) string {
	switch reportType {
	case "q1":
		return "Q1 Report"
	case "midterm":
		return "Midterm Review"
	case "q3":
		return "Q3 Report"
	case "endterm":
		return "End of Year Report"
	default:
		return reportType
	}
}

func resolveReportKpiActual(
	entry models.PerformanceReportEntry,
	reportType string,
	target float64,
	isCumulative bool,
	prior []PriorReportSnapshot,
) (float64, bool) {
	if entry.ID > 0 && entry.ActualValue != nil {
		return *entry.ActualValue, true
	}
	suggested := suggestedReportActual(reportType, target, isCumulative, prior)
	if suggested > 0 {
		return suggested, true
	}
	return 0, false
}

// suggestedReportActual pre-fills report forms when no saved entry exists yet.
func suggestedReportActual(reportType string, target float64, isCumulative bool, prior []PriorReportSnapshot) float64 {
	if target <= 0 {
		return 0
	}
	if isCumulative {
		fraction := cumulativeYtdFraction(reportType)
		ytd := target * fraction
		if len(prior) > 0 {
			last := prior[len(prior)-1].ActualValue
			if ytd < last {
				ytd = last
			}
		}
		return math.Round(ytd*10) / 10
	}
	mult := periodAchievementFactor(reportType)
	return math.Round(target*mult*10) / 10
}

func cumulativeYtdFraction(reportType string) float64 {
	switch reportType {
	case "q1":
		return 0.27
	case "midterm":
		return 0.52
	case "q3":
		return 0.76
	case "endterm":
		return 0.94
	default:
		return 0.5
	}
}

func periodAchievementFactor(reportType string) float64 {
	switch reportType {
	case "q1":
		return 0.88
	case "midterm":
		return 0.91
	case "q3":
		return 0.93
	case "endterm":
		return 0.96
	default:
		return 0.9
	}
}

func (s *PerformanceService) SubmitReport(staffID uint, reportType string, entries []ReportEntryInput) error {
	fy, err := s.currentFinancialYear()
	if err != nil {
		return err
	}

	ppa, err := s.loadPpa(staffID, fy.ID)
	if err != nil {
		return fmt.Errorf("submit your performance plan before filing quarterly reports")
	}
	if ppa.Status == "draft" {
		return fmt.Errorf("submit your performance plan before filing quarterly reports")
	}

	if err := s.config.AssertOpen(reportType, fy, time.Now()); err != nil {
		return err
	}

	quarter, err := s.ensureQuarter(fy, reportType)
	if err != nil {
		return err
	}

	var report models.PerformanceReport
	if err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("financial_year_id", fy.ID).
		Where("quarter_id", quarter.ID).
		FirstOr(&report, func() error {
			report = models.PerformanceReport{
				StaffID:         staffID,
				FinancialYearID: fy.ID,
				QuarterID:       quarter.ID,
				ReportType:      reportType,
				Status:          "draft",
			}
			return facades.Orm().Query().Create(&report)
		}); err != nil {
		return err
	}

	now := time.Now()
	report.SubmittedAt = &now
	if reportType == "endterm" {
		if err := s.initAppraisalOnSubmit(&report, staffID); err != nil {
			return err
		}
	} else {
		report.Status = "submitted"
	}
	if err := facades.Orm().Query().Save(&report); err != nil {
		return err
	}

	for _, entry := range entries {
		actual := entry.ActualValue
		var row models.PerformanceReportEntry
		if err := facades.Orm().Query().
			Where("performance_report_id", report.ID).
			Where("ppa_kpi_id", entry.PpaKpiID).
			FirstOr(&row, func() error {
				row = models.PerformanceReportEntry{
					PerformanceReportID: report.ID,
					PpaKpiID:            entry.PpaKpiID,
					ActualValue:         &actual,
					Narrative:           strPtrIf(entry.Narrative),
				}
				return facades.Orm().Query().Create(&row)
			}); err != nil {
			return err
		}
		if row.ID > 0 {
			row.ActualValue = &actual
			row.Narrative = strPtrIf(entry.Narrative)
			if err := facades.Orm().Query().Save(&row); err != nil {
				return err
			}
		}
	}

	return nil
}

func quarterSummariesFromWindows(windows []ReportingWindowStatus) []QuarterCycleSummary {
	reportPhases := map[string]bool{"q1": true, "midterm": true, "q3": true, "endterm": true}
	out := make([]QuarterCycleSummary, 0, 4)
	for _, w := range windows {
		if !reportPhases[w.Phase] {
			continue
		}
		out = append(out, QuarterCycleSummary{
			ID:              w.Phase,
			Label:           w.Label,
			Window:          w.CoveragePeriod,
			Status:          w.Status,
			IsOpen:          w.IsOpen,
			OpenAt:          w.OpenAt,
			CloseAt:         w.CloseAt,
			DaysRemaining:   w.DaysRemaining,
			ReportingWindow: w.ReportingWindow,
		})
	}
	return out
}
