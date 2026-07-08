package services

import (
	"fmt"
	"math"
	"sort"
	"strings"

	"goravel/app/facades"
	"goravel/app/http/authctx"
	"goravel/app/models"
)

var reportPeriodOrder = []string{"q1", "midterm", "q3", "endterm"}

type PeriodScoreDetail struct {
	ReportType          string  `json:"report_type"`
	Label               string  `json:"label"`
	SubmissionStatus    string  `json:"submission_status"`
	ApprovalStatus      string  `json:"approval_status"`
	SubmittedAt         *string `json:"submitted_at,omitempty"`
	ApprovedAt          *string `json:"approved_at,omitempty"`
	RawWeightedScore    float64 `json:"raw_weighted_score"`
	NormalizedScore     float64 `json:"normalized_score"`
	TotalWeightUsed     float64 `json:"total_weight_used"`
	KpiCount            int     `json:"kpi_count"`
	HasEntries          bool    `json:"has_entries"`
}

type PerformanceStatusRow struct {
	StaffID            uint                `json:"staff_id"`
	StaffName          string              `json:"staff_name"`
	IhrisPID           string              `json:"ihris_pid,omitempty"`
	FacilityName       string              `json:"facility_name,omitempty"`
	DepartmentName     string              `json:"department_name,omitempty"`
	JobTitle           string              `json:"job_title,omitempty"`
	PpaStatus          string              `json:"ppa_status"`
	PpaSubmitted       bool                `json:"ppa_submitted"`
	PpaApproved        bool                `json:"ppa_approved"`
	PpaTotalWeight     float64             `json:"ppa_total_weight"`
	Periods            []PeriodScoreDetail `json:"periods"`
	OverallRawScore    float64             `json:"overall_raw_score"`
	OverallNormalized  float64             `json:"overall_normalized_score"`
	LatestPeriodScore  float64             `json:"latest_period_normalized_score"`
}

type PerformanceStatusReport struct {
	FinancialYear string                  `json:"financial_year"`
	ScopeNote     string                  `json:"scope_note"`
	Rows          []PerformanceStatusRow  `json:"rows"`
	Totals        map[string]int          `json:"totals"`
}

type OverallRatingBreakdown struct {
	FinancialYear      string              `json:"financial_year"`
	Periods            []PeriodScoreDetail `json:"periods"`
	OverallRawScore    float64             `json:"overall_raw_score"`
	OverallNormalized  float64             `json:"overall_normalized_score"`
	LatestNormalized   float64             `json:"latest_normalized_score"`
	PpaStatus          string              `json:"ppa_status"`
}

// ScorePeriod applies Overall Performance Rating style:
// contribution = (actual/target) * weight for each KPI, sum = raw_weighted_score.
// If total weights ≠ 100, normalized_score = raw * (100 / total_weight).
func ScorePeriod(weight, target, actual float64) (contribution float64) {
	if target <= 0 || weight <= 0 {
		return 0
	}
	return (actual / target) * weight
}

func finalizePeriodScore(raw, totalWeight float64) (rawOut, normalized float64) {
	rawOut = math.Round(raw*10) / 10
	if totalWeight <= 0 {
		return rawOut, 0
	}
	normalized = math.Round(raw*(100.0/totalWeight)*10) / 10
	return rawOut, normalized
}

func (s *PerformanceService) VisibleStaffIDs(principal authctx.Principal) ([]uint, string, error) {
	scope := NewScopeService()

	if principal.IsSuperAdmin || scope.HasNationalScope(principal.User) {
		var staff []models.Staff
		_ = facades.Orm().Query().Get(&staff)
		ids := make([]uint, 0, len(staff))
		for _, st := range staff {
			ids = append(ids, st.ID)
		}
		return ids, "National scope — all staff with performance records", nil
	}

	if principal.StaffID == nil || *principal.StaffID == 0 {
		return nil, "No staff profile linked", fmt.Errorf("staff profile required")
	}

	actorID := *principal.StaffID
	rbac := NewRbacService()
	rules, _ := rbac.RoleScopes(principal.Roles)
	if len(rules) == 0 {
		rules = defaultScopeRulesForRoles(principal.Roles)
	}

	hasSupervised := false
	hasSelfOnly := true
	for _, rule := range rules {
		if rule.Operator == "supervised" {
			hasSupervised = true
			hasSelfOnly = false
		}
		if rule.Operator == "eq" || rule.Operator == "in" || rule.Operator == "all" {
			hasSelfOnly = false
		}
	}

	if hasSupervised {
		ids := s.supervisedStaffIDs(actorID)
		ids = append(ids, actorID)
		return uniqueUint(ids), "Supervisor scope — self and supervised staff", nil
	}

	if hasSelfOnly {
		return []uint{actorID}, "Employee scope — own record only", nil
	}

	// District / facility / region scoped roles: filter contracts by actor overrides and assignments.
	actor, err := scope.LoadActorScope(principal)
	if err != nil {
		return []uint{actorID}, "Limited to own record", nil
	}

	assignments := scope.LoadUserScopeAssignments(principal.User.ID)
	if len(assignments) > 0 {
		var contracts []models.StaffContract
		_ = facades.Orm().Query().Where("contract_status", "active").Get(&contracts)
		ids := make([]uint, 0)
		for _, c := range contracts {
			target, terr := scope.LoadStaffScope(c.StaffID)
			if terr != nil {
				continue
			}
			if scope.TargetMatchesAssignments(target, assignments) {
				ids = append(ids, c.StaffID)
			}
		}
		if len(ids) > 0 {
			return uniqueUint(ids), "Assigned geographic scope — staff in your selected areas", nil
		}
	}

	query := facades.Orm().Query().Model(&models.StaffContract{}).Where("contract_status", "active")

	districtScope := false
	departmentScope := false
	for _, rule := range rules {
		if rule.Field == "district_id" && (rule.Operator == "eq" || rule.Operator == "in") {
			districtScope = true
		}
		if rule.Field == "department_id" && (rule.Operator == "eq" || rule.Operator == "in") {
			departmentScope = true
		}
	}

	if actor.DistrictID != nil && strings.TrimSpace(*actor.DistrictID) != "" {
		query = query.Where("district_id", strings.ToUpper(strings.TrimSpace(*actor.DistrictID)))
	}
	if departmentScope && actor.DepartmentID != nil && *actor.DepartmentID > 0 {
		query = query.Where("department_id", *actor.DepartmentID)
	} else if !districtScope && actor.FacilityID != nil && *actor.FacilityID > 0 {
		query = query.Where("facility_id", *actor.FacilityID)
	}

	var contracts []models.StaffContract
	_ = query.Get(&contracts)
	ids := make([]uint, 0, len(contracts))
	for _, c := range contracts {
		ids = append(ids, c.StaffID)
	}
	if len(ids) == 0 {
		ids = []uint{actorID}
	}
	return uniqueUint(ids), "Organizational scope — staff in your assigned area", nil
}

func defaultScopeRulesForRoles(roles []string) []RoleScope {
	for _, role := range roles {
		switch role {
		case "staff":
			return []RoleScope{{Field: "staff_id", Operator: "self"}}
		case "supervisor":
			return []RoleScope{{Field: "staff_id", Operator: "supervised"}}
		case "department_head":
			return []RoleScope{{Field: "department_id", Operator: "eq"}}
		case "hr_officer", "director":
			return []RoleScope{{Field: "district_id", Operator: "eq"}}
		case "permanent_secretary", "executive_office", "admin":
			return []RoleScope{{Field: "staff_id", Operator: "all"}}
		}
	}
	return []RoleScope{{Field: "staff_id", Operator: "self"}}
}

func (s *PerformanceService) supervisedStaffIDs(supervisorStaffID uint) []uint {
	var rows []models.StaffSupervisor
	_ = facades.Orm().Query().
		Where("supervisor_staff_id", supervisorStaffID).
		Where("is_current", true).
		Get(&rows)
	if len(rows) == 0 {
		return nil
	}
	contractIDs := make([]uint, 0, len(rows))
	for _, r := range rows {
		contractIDs = append(contractIDs, r.StaffContractID)
	}
	var contracts []models.StaffContract
	_ = facades.Orm().Query().WhereIn("id", toAnySlice(contractIDs)).Get(&contracts)
	ids := make([]uint, 0, len(contracts))
	for _, c := range contracts {
		ids = append(ids, c.StaffID)
	}
	return ids
}

func (s *PerformanceService) OverallRatingForStaff(staffID uint) (OverallRatingBreakdown, error) {
	out := OverallRatingBreakdown{Periods: []PeriodScoreDetail{}}
	fy, err := s.currentFinancialYear()
	if err != nil {
		return out, err
	}
	out.FinancialYear = fy.YearLabel

	ppa, ppaErr := s.loadPpa(staffID, fy.ID)
	if ppaErr != nil {
		out.PpaStatus = "not_started"
		return out, nil
	}
	out.PpaStatus = ppa.Status

	periods := s.scoreAllPeriods(staffID, fy.ID, ppa.ID)
	out.Periods = periods

	var rawSum, normSum float64
	var counted int
	for _, p := range periods {
		if !p.HasEntries {
			continue
		}
		rawSum += p.RawWeightedScore
		normSum += p.NormalizedScore
		counted++
		out.LatestNormalized = p.NormalizedScore
	}
	if counted > 0 {
		out.OverallRawScore = math.Round((rawSum/float64(counted))*10) / 10
		out.OverallNormalized = math.Round((normSum/float64(counted))*10) / 10
	}
	return out, nil
}

func (s *PerformanceService) StatusReport(principal authctx.Principal) (PerformanceStatusReport, error) {
	report := PerformanceStatusReport{
		Rows:   []PerformanceStatusRow{},
		Totals: map[string]int{},
	}

	fy, err := s.currentFinancialYear()
	if err != nil {
		return report, err
	}
	report.FinancialYear = fy.YearLabel

	staffIDs, scopeNote, err := s.VisibleStaffIDs(principal)
	if err != nil {
		return report, err
	}
	report.ScopeNote = scopeNote
	if len(staffIDs) == 0 {
		return report, nil
	}

	staffByID := map[uint]models.Staff{}
	var staffRows []models.Staff
	_ = facades.Orm().Query().WhereIn("id", toAnySlice(staffIDs)).Get(&staffRows)
	for _, st := range staffRows {
		staffByID[st.ID] = st
	}

	metaByStaff := s.staffWorkMeta(staffIDs)

	var ppas []models.Ppa
	_ = facades.Orm().Query().
		Where("financial_year_id", fy.ID).
		WhereIn("staff_id", toAnySlice(staffIDs)).
		Get(&ppas)
	ppaByStaff := map[uint]models.Ppa{}
	for _, p := range ppas {
		ppaByStaff[p.StaffID] = p
	}

	for _, staffID := range staffIDs {
		st := staffByID[staffID]
		meta := metaByStaff[staffID]
		name := strings.TrimSpace(st.Firstname + " " + st.Surname)
		if name == "" {
			name = st.IhrisPID
		}

		row := PerformanceStatusRow{
			StaffID:        staffID,
			StaffName:      name,
			IhrisPID:       st.IhrisPID,
			FacilityName:   meta.Facility,
			DepartmentName: meta.Department,
			JobTitle:       meta.JobTitle,
			PpaStatus:      "not_started",
		}

		if ppa, ok := ppaByStaff[staffID]; ok {
			row.PpaStatus = ppa.Status
			row.PpaTotalWeight = ppa.TotalWeight
			row.PpaSubmitted = ppa.Status != "draft" && ppa.Status != ""
			row.PpaApproved = ppa.Status == "approved" || ppa.Status == "hr_validated"
			row.Periods = s.scoreAllPeriods(staffID, fy.ID, ppa.ID)
		} else {
			row.Periods = emptyPeriodScores()
		}

		var rawSum, normSum float64
		var counted int
		for _, p := range row.Periods {
			if !p.HasEntries {
				continue
			}
			rawSum += p.RawWeightedScore
			normSum += p.NormalizedScore
			counted++
			row.LatestPeriodScore = p.NormalizedScore
		}
		if counted > 0 {
			row.OverallRawScore = math.Round((rawSum/float64(counted))*10) / 10
			row.OverallNormalized = math.Round((normSum/float64(counted))*10) / 10
		}

		report.Rows = append(report.Rows, row)
	}

	sort.Slice(report.Rows, func(i, j int) bool {
		return report.Rows[i].StaffName < report.Rows[j].StaffName
	})

	report.Totals["staff"] = len(report.Rows)
	for _, row := range report.Rows {
		if row.PpaSubmitted {
			report.Totals["ppa_submitted"]++
		}
		if row.PpaApproved {
			report.Totals["ppa_approved"]++
		}
		for _, p := range row.Periods {
			if p.SubmissionStatus == "submitted" || p.SubmissionStatus == "approved" {
				report.Totals[p.ReportType+"_submitted"]++
			}
			if p.ApprovalStatus == "approved" {
				report.Totals[p.ReportType+"_approved"]++
			}
		}
	}

	return report, nil
}

type staffWorkMeta struct {
	Facility   string
	Department string
	JobTitle   string
}

func (s *PerformanceService) staffWorkMeta(staffIDs []uint) map[uint]staffWorkMeta {
	out := map[uint]staffWorkMeta{}
	if len(staffIDs) == 0 {
		return out
	}
	var contracts []models.StaffContract
	_ = facades.Orm().Query().
		Where("contract_status", "active").
		WhereIn("staff_id", toAnySlice(staffIDs)).
		Get(&contracts)

	facilityIDs := map[uint]bool{}
	jobIDs := map[uint]bool{}
	deptIDs := map[uint]bool{}
	for _, c := range contracts {
		facilityIDs[c.FacilityID] = true
		jobIDs[c.JobID] = true
		if c.DepartmentID != nil {
			deptIDs[*c.DepartmentID] = true
		}
	}

	facilities := map[uint]string{}
	var facRows []models.Facility
	_ = facades.Orm().Query().WhereIn("id", mapKeys(facilityIDs)).Get(&facRows)
	for _, f := range facRows {
		facilities[f.ID] = f.Name
	}

	jobs := map[uint]string{}
	var jobRows []models.JobTitle
	_ = facades.Orm().Query().WhereIn("id", mapKeys(jobIDs)).Get(&jobRows)
	for _, j := range jobRows {
		jobs[j.ID] = j.JobTitle
	}

	depts := map[uint]string{}
	var deptRows []models.Department
	_ = facades.Orm().Query().WhereIn("id", mapKeys(deptIDs)).Get(&deptRows)
	for _, d := range deptRows {
		depts[d.ID] = d.Name
	}

	for _, c := range contracts {
		if _, exists := out[c.StaffID]; exists {
			continue
		}
		meta := staffWorkMeta{
			Facility: facilities[c.FacilityID],
			JobTitle: jobs[c.JobID],
		}
		if c.DepartmentID != nil {
			meta.Department = depts[*c.DepartmentID]
		}
		out[c.StaffID] = meta
	}
	return out
}

func (s *PerformanceService) scoreAllPeriods(staffID, fyID, ppaID uint) []PeriodScoreDetail {
	var ppaKpis []models.PpaKpi
	_ = facades.Orm().Query().Where("ppa_id", ppaID).Get(&ppaKpis)
	kpiByID := map[uint]models.PpaKpi{}
	for _, k := range ppaKpis {
		kpiByID[k.ID] = k
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

	out := make([]PeriodScoreDetail, 0, len(reportPeriodOrder))
	for _, rt := range reportPeriodOrder {
		detail := PeriodScoreDetail{
			ReportType:       rt,
			Label:            reportTypeLabel(rt),
			SubmissionStatus: "not_submitted",
			ApprovalStatus:   "pending",
		}
		report, ok := reportByType[rt]
		if !ok {
			out = append(out, detail)
			continue
		}

		detail.SubmissionStatus = report.Status
		if report.Status == "approved" {
			detail.ApprovalStatus = "approved"
		} else if report.Status == "submitted" || report.Status == "supervisor_review" {
			detail.ApprovalStatus = "pending_approval"
			detail.SubmissionStatus = "submitted"
		} else if report.Status == "rejected" {
			detail.ApprovalStatus = "rejected"
		}
		if report.SubmittedAt != nil {
			ts := report.SubmittedAt.Format("2006-01-02")
			detail.SubmittedAt = &ts
		}
		if report.ApprovedAt != nil {
			ts := report.ApprovedAt.Format("2006-01-02")
			detail.ApprovedAt = &ts
		}

		var entries []models.PerformanceReportEntry
		_ = facades.Orm().Query().Where("performance_report_id", report.ID).Get(&entries)
		var raw, weightSum float64
		for _, entry := range entries {
			kpi, exists := kpiByID[entry.PpaKpiID]
			if !exists || entry.ActualValue == nil {
				continue
			}
			target := 0.0
			if kpi.SupervisorAgreedTarget != nil {
				target = *kpi.SupervisorAgreedTarget
			} else if kpi.TargetValue != nil {
				target = *kpi.TargetValue
			}
			raw += ScorePeriod(kpi.WeightPercentage, target, *entry.ActualValue)
			weightSum += kpi.WeightPercentage
			detail.KpiCount++
			detail.HasEntries = true
		}
		detail.TotalWeightUsed = math.Round(weightSum*10) / 10
		detail.RawWeightedScore, detail.NormalizedScore = finalizePeriodScore(raw, weightSum)
		out = append(out, detail)
	}
	return out
}

func emptyPeriodScores() []PeriodScoreDetail {
	out := make([]PeriodScoreDetail, 0, len(reportPeriodOrder))
	for _, rt := range reportPeriodOrder {
		out = append(out, PeriodScoreDetail{
			ReportType:       rt,
			Label:            reportTypeLabel(rt),
			SubmissionStatus: "not_submitted",
			ApprovalStatus:   "pending",
		})
	}
	return out
}

func uniqueUint(ids []uint) []uint {
	seen := map[uint]bool{}
	out := make([]uint, 0, len(ids))
	for _, id := range ids {
		if id == 0 || seen[id] {
			continue
		}
		seen[id] = true
		out = append(out, id)
	}
	return out
}

func toAnySlice(ids []uint) []any {
	out := make([]any, len(ids))
	for i, id := range ids {
		out[i] = id
	}
	return out
}

func mapKeys(m map[uint]bool) []any {
	out := make([]any, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
