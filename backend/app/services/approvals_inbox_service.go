package services

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type ApprovalsInboxService struct {
	approval    *ApprovalService
	performance *PerformanceService
}

func NewApprovalsInboxService() *ApprovalsInboxService {
	return &ApprovalsInboxService{
		approval:    NewApprovalService(),
		performance: NewPerformanceService(),
	}
}

type UnifiedApprovalItem struct {
	ID          string         `json:"id"`
	Module      string         `json:"module"`
	TypeLabel   string         `json:"type_label"`
	StaffName   string         `json:"staff_name"`
	Title       string         `json:"title"`
	Subtitle    string         `json:"subtitle"`
	Status      string         `json:"status"`
	StageName   string         `json:"stage_name,omitempty"`
	SubmittedAt string         `json:"submitted_at,omitempty"`
	ActedAt     string         `json:"acted_at,omitempty"`
	WaitingDays int            `json:"waiting_days"`
	CanAct      bool           `json:"can_act"`
	ApprovalID  uint           `json:"approval_id,omitempty"`
	RequestID   uint           `json:"request_id,omitempty"`
	ReportID    uint           `json:"report_id,omitempty"`
	PpaID       uint           `json:"ppa_id,omitempty"`
	Meta        map[string]any `json:"meta,omitempty"`
}

type ApproverInboxStats struct {
	PendingTotal       int     `json:"pending_total"`
	LeavePending       int     `json:"leave_pending"`
	OosPending         int     `json:"oos_pending"`
	PerformancePending int     `json:"performance_pending"`
	PpaPending         int     `json:"ppa_pending"`
	CompletedCount     int     `json:"completed_count"`
	HistoryCount       int     `json:"history_count"`
	AvgApprovalHours   float64 `json:"avg_approval_hours"`
	AvgApprovalLabel   string  `json:"avg_approval_label"`
}

type ApprovalsInboxResponse struct {
	Stats     ApproverInboxStats    `json:"stats"`
	Pending   []UnifiedApprovalItem `json:"pending"`
	History   []UnifiedApprovalItem `json:"history"`
	Generated string                `json:"generated_at"`
}

type ApprovalWorkflowStep struct {
	Sequence     uint8  `json:"sequence"`
	RoleLabel    string `json:"role_label"`
	ApproverName string `json:"approver_name"`
	Status       string `json:"status"`
	ActedAt      string `json:"acted_at,omitempty"`
	Comments     string `json:"comments,omitempty"`
	IsCurrent    bool   `json:"is_current"`
}

type ApprovalTrailEntry struct {
	Action     string `json:"action"`
	ActorName  string `json:"actor_name"`
	Role       string `json:"role,omitempty"`
	Comments   string `json:"comments,omitempty"`
	OccurredAt string `json:"occurred_at,omitempty"`
}

type UnifiedApprovalDetail struct {
	Module      string                 `json:"module"`
	TypeLabel   string                 `json:"type_label"`
	StaffName   string                 `json:"staff_name"`
	Title       string                 `json:"title"`
	Subtitle    string                 `json:"subtitle"`
	Status      string                 `json:"status"`
	StageName   string                 `json:"stage_name,omitempty"`
	SubmittedAt string                 `json:"submitted_at,omitempty"`
	CanAct      bool                   `json:"can_act"`
	ApprovalID  uint                   `json:"approval_id,omitempty"`
	RequestID   uint                   `json:"request_id,omitempty"`
	ReportID    uint                   `json:"report_id,omitempty"`
	PpaID       uint                   `json:"ppa_id,omitempty"`
	Reason      string                 `json:"reason,omitempty"`
	Approvers   []ApprovalWorkflowStep `json:"approvers"`
	Trail       []ApprovalTrailEntry   `json:"trail"`
	Meta        map[string]any         `json:"meta,omitempty"`
}

func (s *ApprovalsInboxService) Inbox(approverStaffID uint) (ApprovalsInboxResponse, error) {
	if approverStaffID == 0 {
		return ApprovalsInboxResponse{}, fmt.Errorf("staff record required")
	}

	items := make([]UnifiedApprovalItem, 0)

	leaveRows, err := s.approval.ListPendingLeaveApprovals(approverStaffID)
	if err != nil {
		return ApprovalsInboxResponse{}, err
	}
	for _, row := range leaveRows {
		items = append(items, s.leaveItem(row))
	}

	oosRows, err := s.approval.ListPendingOosApprovals(approverStaffID)
	if err != nil {
		return ApprovalsInboxResponse{}, err
	}
	for _, row := range oosRows {
		items = append(items, s.oosItem(row))
	}

	appraisalRows, err := s.performance.ListPendingAppraisalReviews(approverStaffID)
	if err != nil {
		return ApprovalsInboxResponse{}, err
	}
	for _, row := range appraisalRows {
		if row.CanAct {
			items = append(items, s.appraisalItem(row))
		}
	}

	ppaRows, err := s.performance.ListPendingPpaReviews(approverStaffID)
	if err != nil {
		return ApprovalsInboxResponse{}, err
	}
	for _, row := range ppaRows {
		items = append(items, s.ppaItem(row))
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].CanAct != items[j].CanAct {
			return items[i].CanAct
		}
		if items[i].WaitingDays != items[j].WaitingDays {
			return items[i].WaitingDays > items[j].WaitingDays
		}
		return items[i].SubmittedAt < items[j].SubmittedAt
	})

	avgHours, completed := s.approverAverageHours(approverStaffID)
	history := s.History(approverStaffID)
	stats := ApproverInboxStats{
		PendingTotal:       len(items),
		LeavePending:       len(leaveRows),
		OosPending:         len(oosRows),
		PerformancePending: countModule(items, "performance"),
		PpaPending:         len(ppaRows),
		CompletedCount:     completed,
		HistoryCount:       len(history),
		AvgApprovalHours:   avgHours,
		AvgApprovalLabel:   formatApprovalDuration(avgHours),
	}

	return ApprovalsInboxResponse{
		Stats:     stats,
		Pending:   items,
		History:   history,
		Generated: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *ApprovalsInboxService) History(approverStaffID uint) []UnifiedApprovalItem {
	if approverStaffID == 0 {
		return []UnifiedApprovalItem{}
	}
	items := make([]UnifiedApprovalItem, 0)

	var leaveApprovals []models.LeaveApproval
	_ = facades.Orm().Query().
		Where("supervisor_staff_id", approverStaffID).
		WhereIn("status", []any{"approved", "rejected"}).
		Order("acted_at desc").
		Limit(100).
		Get(&leaveApprovals)
	leaveReqIDs := make([]uint, 0, len(leaveApprovals))
	for _, row := range leaveApprovals {
		leaveReqIDs = append(leaveReqIDs, row.LeaveRequestID)
	}
	leaveReqMap := map[uint]models.LeaveRequest{}
	if len(leaveReqIDs) > 0 {
		var reqs []models.LeaveRequest
		_ = facades.Orm().Query().WhereIn("id", uintsToAny(leaveReqIDs)).Get(&reqs)
		for _, req := range reqs {
			leaveReqMap[req.ID] = req
		}
	}
	leaveTypeIDs := make([]uint, 0)
	staffIDs := map[uint]bool{}
	for _, req := range leaveReqMap {
		leaveTypeIDs = append(leaveTypeIDs, req.LeaveTypeID)
		staffIDs[req.StaffID] = true
	}
	leaveTypeMap := map[uint]models.LeaveType{}
	if len(leaveTypeIDs) > 0 {
		var types []models.LeaveType
		_ = facades.Orm().Query().WhereIn("id", uintsToAny(uniqueUints(leaveTypeIDs))).Get(&types)
		for _, t := range types {
			leaveTypeMap[t.ID] = t
		}
	}

	var oosApprovals []models.OutOfStationApproval
	_ = facades.Orm().Query().
		Where("supervisor_staff_id", approverStaffID).
		WhereIn("status", []any{"approved", "rejected"}).
		Order("acted_at desc").
		Limit(100).
		Get(&oosApprovals)
	oosReqIDs := make([]uint, 0, len(oosApprovals))
	for _, row := range oosApprovals {
		oosReqIDs = append(oosReqIDs, row.OutOfStationRequestID)
	}
	oosReqMap := map[uint]models.OutOfStationRequest{}
	if len(oosReqIDs) > 0 {
		var reqs []models.OutOfStationRequest
		_ = facades.Orm().Query().WhereIn("id", uintsToAny(oosReqIDs)).Get(&reqs)
		for _, req := range reqs {
			oosReqMap[req.ID] = req
			staffIDs[req.StaffID] = true
		}
	}
	reasonIDs := make([]uint, 0)
	for _, req := range oosReqMap {
		reasonIDs = append(reasonIDs, req.ReasonID)
	}
	reasonMap := map[uint]models.OutOfStationReason{}
	if len(reasonIDs) > 0 {
		var reasons []models.OutOfStationReason
		_ = facades.Orm().Query().WhereIn("id", uintsToAny(uniqueUints(reasonIDs))).Get(&reasons)
		for _, r := range reasons {
			reasonMap[r.ID] = r
		}
	}

	var trails []models.PerformanceApprovalTrail
	_ = facades.Orm().Query().
		Where("actor_staff_id", approverStaffID).
		WhereIn("action", []any{"approved", "returned", "countersigned", "responsible_approved"}).
		Order("created_at desc").
		Limit(100).
		Get(&trails)
	reportIDs := make([]uint, 0, len(trails))
	for _, trail := range trails {
		reportIDs = append(reportIDs, trail.PerformanceReportID)
	}
	reportMap := map[uint]models.PerformanceReport{}
	if len(reportIDs) > 0 {
		var reports []models.PerformanceReport
		_ = facades.Orm().Query().WhereIn("id", uintsToAny(uniqueUints(reportIDs))).Get(&reports)
		for _, report := range reports {
			reportMap[report.ID] = report
			staffIDs[report.StaffID] = true
		}
	}

	// PPAs approved while this person was an assigned supervisor of the staff member.
	supervised := s.performance.supervisedStaffIDs(approverStaffID)
	var ppas []models.Ppa
	if len(supervised) > 0 {
		_ = facades.Orm().Query().
			WhereIn("staff_id", uintsToAny(supervised)).
			WhereIn("status", []any{"approved", "returned"}).
			Order("updated_at desc").
			Limit(100).
			Get(&ppas)
		for _, ppa := range ppas {
			staffIDs[ppa.StaffID] = true
		}
	}

	staffIDList := make([]uint, 0, len(staffIDs))
	for id := range staffIDs {
		staffIDList = append(staffIDList, id)
	}
	staffMap := map[uint]models.Staff{}
	if len(staffIDList) > 0 {
		var staffRows []models.Staff
		_ = facades.Orm().Query().WhereIn("id", uintsToAny(staffIDList)).Get(&staffRows)
		for _, st := range staffRows {
			staffMap[st.ID] = st
		}
	}

	for _, row := range leaveApprovals {
		req, ok := leaveReqMap[row.LeaveRequestID]
		if !ok {
			continue
		}
		leaveTypeName := "Leave"
		if t, ok := leaveTypeMap[req.LeaveTypeID]; ok && t.Name != "" {
			leaveTypeName = t.Name
		}
		acted := ""
		if row.ActedAt != nil {
			acted = row.ActedAt.Format(time.RFC3339)
		}
		submitted := ""
		if req.SubmittedAt != nil {
			submitted = req.SubmittedAt.Format(time.RFC3339)
		}
		stage := ""
		if row.StageName != nil {
			stage = *row.StageName
		}
		items = append(items, UnifiedApprovalItem{
			ID:          fmt.Sprintf("leave-history:%d", row.ID),
			Module:      "leave",
			TypeLabel:   "Leave",
			StaffName:   staffDisplayName(staffMap[req.StaffID]),
			Title:       leaveTypeName,
			Subtitle:    fmt.Sprintf("%s – %s · %d day(s)", req.StartDate.Format("2006-01-02"), req.EndDate.Format("2006-01-02"), req.DaysRequested),
			Status:      row.Status,
			StageName:   stage,
			SubmittedAt: submitted,
			ActedAt:     acted,
			CanAct:      false,
			ApprovalID:  row.ID,
			RequestID:   req.ID,
		})
	}

	for _, row := range oosApprovals {
		req, ok := oosReqMap[row.OutOfStationRequestID]
		if !ok {
			continue
		}
		reasonName := "Out of station"
		if r, ok := reasonMap[req.ReasonID]; ok && r.Reason != "" {
			reasonName = r.Reason
		}
		acted := ""
		if row.ActedAt != nil {
			acted = row.ActedAt.Format(time.RFC3339)
		}
		submitted := ""
		if req.SubmittedAt != nil {
			submitted = req.SubmittedAt.Format(time.RFC3339)
		}
		items = append(items, UnifiedApprovalItem{
			ID:          fmt.Sprintf("oos-history:%d", row.ID),
			Module:      "oos",
			TypeLabel:   "Out of station",
			StaffName:   staffDisplayName(staffMap[req.StaffID]),
			Title:       reasonName,
			Subtitle:    fmt.Sprintf("%s – %s · %s", req.StartDate.Format("2006-01-02"), req.EndDate.Format("2006-01-02"), req.DestinationName),
			Status:      row.Status,
			SubmittedAt: submitted,
			ActedAt:     acted,
			CanAct:      false,
			ApprovalID:  row.ID,
			RequestID:   req.ID,
		})
	}

	for _, trail := range trails {
		report, ok := reportMap[trail.PerformanceReportID]
		if !ok {
			continue
		}
		acted := ""
		if trail.CreatedAt != nil {
			acted = trail.CreatedAt.StdTime().Format(time.RFC3339)
		}
		submitted := ""
		if report.SubmittedAt != nil {
			submitted = report.SubmittedAt.Format(time.RFC3339)
		}
		status := trail.Action
		if status == "countersigned" || status == "responsible_approved" {
			status = "approved"
		}
		items = append(items, UnifiedApprovalItem{
			ID:          fmt.Sprintf("performance-history:%d", trail.ID),
			Module:      "performance",
			TypeLabel:   "Performance",
			StaffName:   staffDisplayName(staffMap[report.StaffID]),
			Title:       reportTypeLabel(report.ReportType),
			Subtitle:    fmt.Sprintf("Your decision: %s", trail.Action),
			Status:      status,
			SubmittedAt: submitted,
			ActedAt:     acted,
			CanAct:      false,
			ReportID:    report.ID,
		})
	}

	for _, ppa := range ppas {
		if ppa.Status != "approved" && ppa.Status != "returned" {
			continue
		}
		acted := ""
		if ppa.ApprovedAt != nil {
			acted = ppa.ApprovedAt.Format(time.RFC3339)
		} else if ppa.UpdatedAt != nil {
			acted = ppa.UpdatedAt.StdTime().Format(time.RFC3339)
		}
		submitted := ""
		if ppa.SubmittedAt != nil {
			submitted = ppa.SubmittedAt.Format(time.RFC3339)
		}
		items = append(items, UnifiedApprovalItem{
			ID:          fmt.Sprintf("ppa-history:%d", ppa.ID),
			Module:      "ppa",
			TypeLabel:   "PPA",
			StaffName:   staffDisplayName(staffMap[ppa.StaffID]),
			Title:       "Performance Plan Agreement",
			Subtitle:    fmt.Sprintf("Status: %s", ppa.Status),
			Status:      ppa.Status,
			SubmittedAt: submitted,
			ActedAt:     acted,
			CanAct:      false,
			PpaID:       ppa.ID,
		})
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].ActedAt > items[j].ActedAt
	})
	if len(items) > 100 {
		items = items[:100]
	}
	return items
}

func uintsToAny(ids []uint) []any {
	out := make([]any, 0, len(ids))
	for _, id := range ids {
		out = append(out, id)
	}
	return out
}

func uniqueUints(ids []uint) []uint {
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

func countModule(items []UnifiedApprovalItem, module string) int {
	n := 0
	for _, item := range items {
		if item.Module == module {
			n++
		}
	}
	return n
}

func (s *ApprovalsInboxService) leaveItem(row PendingLeaveApproval) UnifiedApprovalItem {
	submitted := row.StartDate
	waiting := waitingDaysFromDate(submitted)
	stage := row.StageName
	if stage == "" {
		stage = "Supervisor approval"
	}
	return UnifiedApprovalItem{
		ID:          fmt.Sprintf("leave:%d", row.ApprovalID),
		Module:      "leave",
		TypeLabel:   "Leave",
		StaffName:   row.StaffName,
		Title:       row.LeaveTypeName,
		Subtitle:    fmt.Sprintf("%s – %s · %d day(s)", row.StartDate, row.EndDate, row.DaysRequested),
		Status:      row.Status,
		StageName:   stage,
		SubmittedAt: submitted,
		WaitingDays: waiting,
		CanAct:      true,
		ApprovalID:  row.ApprovalID,
		RequestID:   row.RequestID,
		Meta: map[string]any{
			"reason": row.Reason,
			"stage_code": row.StageCode,
		},
	}
}

func (s *ApprovalsInboxService) oosItem(row PendingOosApproval) UnifiedApprovalItem {
	submitted := row.StartDate
	return UnifiedApprovalItem{
		ID:          fmt.Sprintf("oos:%d", row.ApprovalID),
		Module:      "oos",
		TypeLabel:   "Out of station",
		StaffName:   row.StaffName,
		Title:       row.ReasonName,
		Subtitle:    fmt.Sprintf("%s – %s · %s", row.StartDate, row.EndDate, row.Destination),
		Status:      row.Status,
		StageName:   "Supervisor approval",
		SubmittedAt: submitted,
		WaitingDays: waitingDaysFromDate(submitted),
		CanAct:      true,
		ApprovalID:  row.ApprovalID,
		RequestID:   row.RequestID,
	}
}

func (s *ApprovalsInboxService) appraisalItem(row PendingAppraisalReview) UnifiedApprovalItem {
	waiting := 0
	if row.SubmittedAt != "" {
		if t, err := time.Parse(time.RFC3339, row.SubmittedAt); err == nil {
			waiting = waitingDaysFromTime(t)
		}
	}
	typeLabel := "Performance report"
	stage := appraisalStageLabel(row.Status)
	if row.ReportType == "endterm" {
		typeLabel = "Performance appraisal"
	} else {
		stage = "Supervisor approval"
	}
	return UnifiedApprovalItem{
		ID:          fmt.Sprintf("performance:%d", row.ReportID),
		Module:      "performance",
		TypeLabel:   typeLabel,
		StaffName:   row.StaffName,
		Title:       row.ReportLabel,
		Subtitle:    humanizeStatus(row.Status),
		Status:      row.Status,
		StageName:   stage,
		SubmittedAt: row.SubmittedAt,
		WaitingDays: waiting,
		CanAct:      row.CanAct,
		ReportID:    row.ReportID,
		Meta: map[string]any{
			"staff_id":                    row.StaffID,
			"report_type":                 row.ReportType,
			"pending_supervisor_sequence": row.PendingSupervisorSequence,
		},
	}
}

func (s *ApprovalsInboxService) ppaItem(row PendingPpaReview) UnifiedApprovalItem {
	waiting := 0
	if row.SubmittedAt != "" {
		if t, err := time.Parse(time.RFC3339, row.SubmittedAt); err == nil {
			waiting = waitingDaysFromTime(t)
		}
	}
	return UnifiedApprovalItem{
		ID:          fmt.Sprintf("ppa:%d", row.PpaID),
		Module:      "ppa",
		TypeLabel:   "Performance plan (PPA)",
		StaffName:   row.StaffName,
		Title:       "Performance Plan Agreement",
		Subtitle:    fmt.Sprintf("%.0f%% KPI weight · awaiting your review", row.TotalWeight),
		Status:      row.Status,
		StageName:   "Supervisor review",
		SubmittedAt: row.SubmittedAt,
		WaitingDays: waiting,
		CanAct:      true,
		PpaID:       row.PpaID,
		Meta: map[string]any{
			"staff_id": row.StaffID,
		},
	}
}

func appraisalStageLabel(status string) string {
	switch status {
	case "supervisor_review":
		return "Appraiser review"
	case "countersigning":
		return "Countersigning"
	case "responsible_review":
		return "Responsible officer"
	default:
		return "Performance review"
	}
}

func humanizeStatus(status string) string {
	return strings.ReplaceAll(strings.ReplaceAll(status, "_", " "), "-", " ")
}

func waitingDaysFromDate(dateStr string) int {
	if dateStr == "" {
		return 0
	}
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return 0
	}
	return waitingDaysFromTime(t)
}

func waitingDaysFromTime(t time.Time) int {
	days := int(time.Since(t).Hours() / 24)
	if days < 0 {
		return 0
	}
	return days
}

func formatApprovalDuration(hours float64) string {
	if hours <= 0 {
		return "—"
	}
	if hours < 24 {
		return fmt.Sprintf("%.1f hours", hours)
	}
	days := hours / 24
	if days < 14 {
		return fmt.Sprintf("%.1f days", days)
	}
	return fmt.Sprintf("%.1f weeks", days/7)
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func (s *ApprovalsInboxService) approverAverageHours(approverStaffID uint) (float64, int) {
	var totalHours float64
	count := 0

	var leaveApprovals []models.LeaveApproval
	_ = facades.Orm().Query().
		Where("supervisor_staff_id", approverStaffID).
		WhereIn("status", []any{"approved", "rejected"}).
		Get(&leaveApprovals)
	for _, row := range leaveApprovals {
		if row.ActedAt == nil || row.CreatedAt == nil {
			continue
		}
		totalHours += row.ActedAt.Sub(row.CreatedAt.StdTime()).Hours()
		count++
	}

	var oosApprovals []models.OutOfStationApproval
	_ = facades.Orm().Query().
		Where("supervisor_staff_id", approverStaffID).
		WhereIn("status", []any{"approved", "rejected"}).
		Get(&oosApprovals)
	for _, row := range oosApprovals {
		if row.ActedAt == nil || row.CreatedAt == nil {
			continue
		}
		totalHours += row.ActedAt.Sub(row.CreatedAt.StdTime()).Hours()
		count++
	}

	var trails []models.PerformanceApprovalTrail
	_ = facades.Orm().Query().
		Where("actor_staff_id", approverStaffID).
		WhereIn("action", []any{"approved", "returned", "countersigned", "responsible_approved"}).
		Get(&trails)
	for _, trail := range trails {
		var report models.PerformanceReport
		if err := facades.Orm().Query().Where("id", trail.PerformanceReportID).First(&report); err != nil || report.ID == 0 {
			continue
		}
		start := report.CreatedAt.StdTime()
		if report.SubmittedAt != nil {
			start = *report.SubmittedAt
		}
		if trail.CreatedAt == nil {
			continue
		}
		totalHours += trail.CreatedAt.StdTime().Sub(start).Hours()
		count++
	}

	if count == 0 {
		return 0, 0
	}
	return math.Round((totalHours/float64(count))*10) / 10, count
}

func (s *ApprovalsInboxService) Detail(viewerStaffID uint, module string, refID uint) (UnifiedApprovalDetail, error) {
	if viewerStaffID == 0 || refID == 0 {
		return UnifiedApprovalDetail{}, fmt.Errorf("not authorized")
	}
	switch strings.ToLower(strings.TrimSpace(module)) {
	case "leave":
		return s.leaveDetail(viewerStaffID, refID)
	case "oos":
		return s.oosDetail(viewerStaffID, refID)
	case "ppa":
		return s.ppaDetail(viewerStaffID, refID)
	case "performance":
		return s.performanceDetail(viewerStaffID, refID)
	default:
		return UnifiedApprovalDetail{}, fmt.Errorf("unsupported approval module")
	}
}

func (s *ApprovalsInboxService) leaveDetail(viewerStaffID, approvalID uint) (UnifiedApprovalDetail, error) {
	var approval models.LeaveApproval
	if err := facades.Orm().Query().Where("id", approvalID).First(&approval); err != nil || approval.ID == 0 {
		return UnifiedApprovalDetail{}, fmt.Errorf("leave approval not found")
	}
	var request models.LeaveRequest
	if err := facades.Orm().Query().Where("id", approval.LeaveRequestID).First(&request); err != nil || request.ID == 0 {
		return UnifiedApprovalDetail{}, fmt.Errorf("leave request not found")
	}
	if !s.canViewLeaveRequest(viewerStaffID, request.StaffID, request.ID) {
		return UnifiedApprovalDetail{}, fmt.Errorf("not authorized to view this approval")
	}

	var approvals []models.LeaveApproval
	_ = facades.Orm().Query().Where("leave_request_id", request.ID).Order("sequence asc").Get(&approvals)

	leaveType, _ := NewLeaveConfigService().GetTypeByID(request.LeaveTypeID)
	staffMap := loadStaffByIDs([]uint{request.StaffID})
	reason := ""
	if request.Reason != nil {
		reason = *request.Reason
	}

	approvers := make([]ApprovalWorkflowStep, 0, len(approvals))
	trail := make([]ApprovalTrailEntry, 0, len(approvals)+1)
	if request.SubmittedAt != nil {
		trail = append(trail, ApprovalTrailEntry{
			Action:     "submitted",
			ActorName:  staffDisplayName(staffMap[request.StaffID]),
			Role:       "staff",
			OccurredAt: request.SubmittedAt.Format(time.RFC3339),
		})
	}
	for _, row := range approvals {
		role := deref(row.StageName)
		if role == "" {
			role = fmt.Sprintf("Approver %d", row.Sequence)
		}
		step := ApprovalWorkflowStep{
			Sequence:     row.Sequence,
			RoleLabel:    role,
			ApproverName: staffDisplayNameFromID(row.SupervisorStaffID),
			Status:       row.Status,
			IsCurrent:    request.Status == "pending" && request.CurrentApprovalSequence == row.Sequence && row.Status == "pending",
		}
		if row.Comments != nil {
			step.Comments = *row.Comments
		}
		if row.ActedAt != nil {
			step.ActedAt = row.ActedAt.Format(time.RFC3339)
			trail = append(trail, ApprovalTrailEntry{
				Action:     row.Status,
				ActorName:  step.ApproverName,
				Role:       role,
				Comments:   step.Comments,
				OccurredAt: step.ActedAt,
			})
		}
		approvers = append(approvers, step)
	}

	canAct := approval.Status == "pending" &&
		approval.SupervisorStaffID == viewerStaffID &&
		request.Status == "pending" &&
		request.CurrentApprovalSequence == approval.Sequence

	submitted := ""
	if request.SubmittedAt != nil {
		submitted = request.SubmittedAt.Format(time.RFC3339)
	} else {
		submitted = request.StartDate.Format("2006-01-02")
	}

	return UnifiedApprovalDetail{
		Module:      "leave",
		TypeLabel:   "Leave",
		StaffName:   staffDisplayName(staffMap[request.StaffID]),
		Title:       leaveType.Name,
		Subtitle:    fmt.Sprintf("%s – %s · %d day(s)", request.StartDate.Format("2006-01-02"), request.EndDate.Format("2006-01-02"), request.DaysRequested),
		Status:      request.Status,
		StageName:   deref(approval.StageName),
		SubmittedAt: submitted,
		CanAct:      canAct,
		ApprovalID:  approval.ID,
		RequestID:   request.ID,
		Reason:      reason,
		Approvers:   approvers,
		Trail:       trail,
	}, nil
}

func (s *ApprovalsInboxService) oosDetail(viewerStaffID, approvalID uint) (UnifiedApprovalDetail, error) {
	var approval models.OutOfStationApproval
	if err := facades.Orm().Query().Where("id", approvalID).First(&approval); err != nil || approval.ID == 0 {
		return UnifiedApprovalDetail{}, fmt.Errorf("out-of-station approval not found")
	}
	var request models.OutOfStationRequest
	if err := facades.Orm().Query().Where("id", approval.OutOfStationRequestID).First(&request); err != nil || request.ID == 0 {
		return UnifiedApprovalDetail{}, fmt.Errorf("out-of-station request not found")
	}
	if !s.canViewOosRequest(viewerStaffID, request.StaffID, request.ID) {
		return UnifiedApprovalDetail{}, fmt.Errorf("not authorized to view this approval")
	}

	var approvals []models.OutOfStationApproval
	_ = facades.Orm().Query().Where("out_of_station_request_id", request.ID).Order("sequence asc").Get(&approvals)

	var reason models.OutOfStationReason
	_ = facades.Orm().Query().Where("id", request.ReasonID).First(&reason)
	staffMap := loadStaffByIDs([]uint{request.StaffID})
	remarks := ""
	if request.Remarks != nil {
		remarks = *request.Remarks
	}

	approvers := make([]ApprovalWorkflowStep, 0, len(approvals))
	trail := make([]ApprovalTrailEntry, 0, len(approvals)+1)
	if request.SubmittedAt != nil {
		trail = append(trail, ApprovalTrailEntry{
			Action:     "submitted",
			ActorName:  staffDisplayName(staffMap[request.StaffID]),
			Role:       "staff",
			OccurredAt: request.SubmittedAt.Format(time.RFC3339),
		})
	}
	for _, row := range approvals {
		role := fmt.Sprintf("Approver %d", row.Sequence)
		step := ApprovalWorkflowStep{
			Sequence:     row.Sequence,
			RoleLabel:    role,
			ApproverName: staffDisplayNameFromID(row.SupervisorStaffID),
			Status:       row.Status,
			IsCurrent:    request.Status == "pending" && request.CurrentApprovalSequence == row.Sequence && row.Status == "pending",
		}
		if row.Comments != nil {
			step.Comments = *row.Comments
		}
		if row.ActedAt != nil {
			step.ActedAt = row.ActedAt.Format(time.RFC3339)
			trail = append(trail, ApprovalTrailEntry{
				Action:     row.Status,
				ActorName:  step.ApproverName,
				Role:       role,
				Comments:   step.Comments,
				OccurredAt: step.ActedAt,
			})
		}
		approvers = append(approvers, step)
	}

	canAct := approval.Status == "pending" &&
		approval.SupervisorStaffID == viewerStaffID &&
		request.Status == "pending" &&
		request.CurrentApprovalSequence == approval.Sequence

	submitted := request.StartDate.Format("2006-01-02")
	if request.SubmittedAt != nil {
		submitted = request.SubmittedAt.Format(time.RFC3339)
	}

	return UnifiedApprovalDetail{
		Module:      "oos",
		TypeLabel:   "Out of station",
		StaffName:   staffDisplayName(staffMap[request.StaffID]),
		Title:       reason.Reason,
		Subtitle:    fmt.Sprintf("%s – %s · %s", request.StartDate.Format("2006-01-02"), request.EndDate.Format("2006-01-02"), request.DestinationName),
		Status:      request.Status,
		StageName:   "Supervisor approval",
		SubmittedAt: submitted,
		CanAct:      canAct,
		ApprovalID:  approval.ID,
		RequestID:   request.ID,
		Reason:      remarks,
		Approvers:   approvers,
		Trail:       trail,
		Meta: map[string]any{
			"destination": request.DestinationName,
		},
	}, nil
}

func (s *ApprovalsInboxService) ppaDetail(viewerStaffID, ppaID uint) (UnifiedApprovalDetail, error) {
	detail, err := s.performance.GetPpaReviewDetail(viewerStaffID, ppaID)
	if err != nil {
		return UnifiedApprovalDetail{}, err
	}
	approvers := []ApprovalWorkflowStep{}
	supervisors, _ := NewSupervisorService().GetStaffSupervisors(detail.StaffID)
	for _, sup := range supervisors {
		status := "waiting"
		isCurrent := false
		if detail.Status == "supervisor_review" && sup.Sequence == 1 {
			status = "pending"
			isCurrent = true
		} else if detail.Status == "approved" {
			status = "approved"
		} else if detail.Status == "returned" {
			status = "returned"
		}
		name := sup.SupervisorName
		if name == "" {
			name = staffDisplayNameFromID(sup.SupervisorStaffID)
		}
		approvers = append(approvers, ApprovalWorkflowStep{
			Sequence:     sup.Sequence,
			RoleLabel:    fmt.Sprintf("Supervisor %d", sup.Sequence),
			ApproverName: name,
			Status:       status,
			IsCurrent:    isCurrent && viewerStaffID == sup.SupervisorStaffID,
		})
	}
	trail := []ApprovalTrailEntry{}
	if detail.SubmittedAt != "" {
		trail = append(trail, ApprovalTrailEntry{
			Action:     "submitted",
			ActorName:  detail.StaffName,
			Role:       "staff",
			OccurredAt: detail.SubmittedAt,
		})
	}
	if detail.ApprovedAt != "" {
		trail = append(trail, ApprovalTrailEntry{
			Action:     "approved",
			ActorName:  "Supervisor",
			Role:       "supervisor",
			OccurredAt: detail.ApprovedAt,
		})
	} else if detail.Status == "returned" {
		trail = append(trail, ApprovalTrailEntry{
			Action:    "returned",
			ActorName: "Supervisor",
			Role:      "supervisor",
		})
	}

	canAct := detail.Status == "supervisor_review" && s.performance.isAssignedSupervisor(viewerStaffID, detail.StaffID)
	return UnifiedApprovalDetail{
		Module:      "ppa",
		TypeLabel:   "Performance plan (PPA)",
		StaffName:   detail.StaffName,
		Title:       "Performance Plan Agreement",
		Subtitle:    fmt.Sprintf("%s · %.0f%% KPI weight", detail.FinancialYear, detail.TotalWeight),
		Status:      detail.Status,
		StageName:   "Supervisor review",
		SubmittedAt: detail.SubmittedAt,
		CanAct:      canAct,
		PpaID:       detail.PpaID,
		Approvers:   approvers,
		Trail:       trail,
	}, nil
}

func (s *ApprovalsInboxService) performanceDetail(viewerStaffID, reportID uint) (UnifiedApprovalDetail, error) {
	detail, err := s.performance.GetReportReviewDetail(viewerStaffID, reportID)
	if err != nil {
		return UnifiedApprovalDetail{}, err
	}

	approvers := []ApprovalWorkflowStep{}
	trail := []ApprovalTrailEntry{}
	if detail.SubmittedAt != "" {
		trail = append(trail, ApprovalTrailEntry{
			Action:     "submitted",
			ActorName:  detail.StaffName,
			Role:       "staff",
			OccurredAt: detail.SubmittedAt,
		})
	}

	if detail.ReportType == "endterm" && detail.Appraisal != nil {
		for _, sup := range detail.Appraisal.Supervisors {
			status := "waiting"
			isCurrent := detail.Status == "supervisor_review" && detail.Appraisal.PendingSupervisorSequence == sup.Sequence
			if isCurrent {
				status = "pending"
			} else if detail.Status == "approved" || detail.Status == "countersigning" || detail.Status == "responsible_review" {
				if sup.Sequence < detail.Appraisal.PendingSupervisorSequence || detail.Appraisal.PendingSupervisorSequence == 0 {
					status = "approved"
				}
			}
			approvers = append(approvers, ApprovalWorkflowStep{
				Sequence:     sup.Sequence,
				RoleLabel:    fmt.Sprintf("Appraiser %d", sup.Sequence),
				ApproverName: firstNonEmpty(sup.SupervisorName, staffDisplayNameFromID(sup.SupervisorStaffID)),
				Status:       status,
				IsCurrent:    isCurrent,
			})
		}
		for _, entry := range detail.Appraisal.ApprovalTrail {
			trail = append(trail, ApprovalTrailEntry{
				Action:     entry.Action,
				ActorName:  entry.ActorName,
				Role:       entry.Role,
				Comments:   entry.Comments,
				OccurredAt: entry.OccurredAt,
			})
		}
	} else {
		supervisors, _ := NewSupervisorService().GetStaffSupervisors(detail.StaffID)
		for _, sup := range supervisors {
			status := "waiting"
			isCurrent := detail.Status == "submitted" && sup.Sequence == 1
			if detail.Status == "approved" {
				status = "approved"
			} else if detail.Status == "returned" {
				status = "returned"
			} else if isCurrent {
				status = "pending"
			}
			name := sup.SupervisorName
			if name == "" {
				name = staffDisplayNameFromID(sup.SupervisorStaffID)
			}
			approvers = append(approvers, ApprovalWorkflowStep{
				Sequence:     sup.Sequence,
				RoleLabel:    fmt.Sprintf("Supervisor %d", sup.Sequence),
				ApproverName: name,
				Status:       status,
				IsCurrent:    isCurrent,
			})
		}
		var rows []models.PerformanceApprovalTrail
		_ = facades.Orm().Query().Where("performance_report_id", reportID).Order("id asc").Get(&rows)
		for _, row := range rows {
			actor := ""
			if row.ActorName != nil {
				actor = *row.ActorName
			}
			role := ""
			if row.Role != nil {
				role = *row.Role
			}
			comments := ""
			if row.Comments != nil {
				comments = *row.Comments
			}
			occurred := ""
			if row.CreatedAt != nil {
				occurred = row.CreatedAt.StdTime().Format(time.RFC3339)
			}
			trail = append(trail, ApprovalTrailEntry{
				Action:     row.Action,
				ActorName:  actor,
				Role:       role,
				Comments:   comments,
				OccurredAt: occurred,
			})
		}
	}

	typeLabel := "Performance report"
	stage := "Supervisor approval"
	if detail.ReportType == "endterm" {
		typeLabel = "Performance appraisal"
		stage = appraisalStageLabel(detail.Status)
	}
	canAct := false
	if detail.ReportType == "endterm" {
		canAct = s.performance.isAssignedSupervisor(viewerStaffID, detail.StaffID) &&
			(detail.Status == "submitted" || detail.Status == "supervisor_review" || detail.Status == "countersigning" || detail.Status == "responsible_review")
	} else {
		canAct = detail.Status == "submitted" && s.performance.isAssignedSupervisor(viewerStaffID, detail.StaffID)
	}

	return UnifiedApprovalDetail{
		Module:      "performance",
		TypeLabel:   typeLabel,
		StaffName:   detail.StaffName,
		Title:       detail.ReportLabel,
		Subtitle:    humanizeStatus(detail.Status),
		Status:      detail.Status,
		StageName:   stage,
		SubmittedAt: detail.SubmittedAt,
		CanAct:      canAct,
		ReportID:    detail.ReportID,
		Approvers:   approvers,
		Trail:       trail,
		Meta: map[string]any{
			"report_type": detail.ReportType,
			"staff_id":    detail.StaffID,
		},
	}, nil
}

func (s *ApprovalsInboxService) canViewLeaveRequest(viewerStaffID, ownerStaffID, requestID uint) bool {
	if viewerStaffID == ownerStaffID {
		return true
	}
	var count int64
	count, _ = facades.Orm().Query().Model(&models.LeaveApproval{}).
		Where("leave_request_id", requestID).
		Where("supervisor_staff_id", viewerStaffID).
		Count()
	return count > 0
}

func (s *ApprovalsInboxService) canViewOosRequest(viewerStaffID, ownerStaffID, requestID uint) bool {
	if viewerStaffID == ownerStaffID {
		return true
	}
	var count int64
	count, _ = facades.Orm().Query().Model(&models.OutOfStationApproval{}).
		Where("out_of_station_request_id", requestID).
		Where("supervisor_staff_id", viewerStaffID).
		Count()
	return count > 0
}
