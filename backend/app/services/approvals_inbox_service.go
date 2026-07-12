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
	AvgApprovalHours   float64 `json:"avg_approval_hours"`
	AvgApprovalLabel   string  `json:"avg_approval_label"`
}

type ApprovalsInboxResponse struct {
	Stats     ApproverInboxStats    `json:"stats"`
	Pending   []UnifiedApprovalItem `json:"pending"`
	Generated string                `json:"generated_at"`
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
	stats := ApproverInboxStats{
		PendingTotal:       len(items),
		LeavePending:       len(leaveRows),
		OosPending:         len(oosRows),
		PerformancePending: countModule(items, "performance"),
		PpaPending:         len(ppaRows),
		CompletedCount:     completed,
		AvgApprovalHours:   avgHours,
		AvgApprovalLabel:   formatApprovalDuration(avgHours),
	}

	return ApprovalsInboxResponse{
		Stats:     stats,
		Pending:   items,
		Generated: time.Now().Format(time.RFC3339),
	}, nil
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
	return UnifiedApprovalItem{
		ID:          fmt.Sprintf("performance:%d", row.ReportID),
		Module:      "performance",
		TypeLabel:   "Performance appraisal",
		StaffName:   row.StaffName,
		Title:       row.ReportLabel,
		Subtitle:    humanizeStatus(row.Status),
		Status:      row.Status,
		StageName:   appraisalStageLabel(row.Status),
		SubmittedAt: row.SubmittedAt,
		WaitingDays: waiting,
		CanAct:      row.CanAct,
		ReportID:    row.ReportID,
		Meta: map[string]any{
			"staff_id":                    row.StaffID,
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
