package services

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type ActionPlanInput struct {
	PerformanceGap string `json:"performance_gap"`
	AgreedAction   string `json:"agreed_action"`
	TimeFrame      string `json:"time_frame"`
}

type ActionPlanRow struct {
	ID             uint   `json:"id"`
	PerformanceGap string `json:"performance_gap"`
	AgreedAction   string `json:"agreed_action"`
	TimeFrame      string `json:"time_frame"`
	SortOrder      int    `json:"sort_order"`
}

type AppraisalCommentRow struct {
	CommentRole        string  `json:"comment_role"`
	SupervisorSequence *uint8  `json:"supervisor_sequence,omitempty"`
	AuthorStaffID      uint    `json:"author_staff_id"`
	AuthorName         string  `json:"author_name"`
	JobTitle           string  `json:"job_title"`
	Comments           string  `json:"comments"`
	SignedAt           *string `json:"signed_at,omitempty"`
	CanEdit            bool    `json:"can_edit"`
}

type SupervisorSlotView struct {
	Sequence          uint8  `json:"sequence"`
	SupervisorStaffID uint   `json:"supervisor_staff_id"`
	SupervisorName    string `json:"supervisor_name"`
}

type ApprovalTrailRow struct {
	ID         uint   `json:"id"`
	Action     string `json:"action"`
	ActorName  string `json:"actor_name"`
	Role       string `json:"role"`
	Comments   string `json:"comments"`
	OccurredAt string `json:"occurred_at"`
}

type AppraisalBundle struct {
	ReportID                  uint                  `json:"report_id"`
	ReportStatus              string                `json:"report_status"`
	PendingSupervisorSequence uint8                 `json:"pending_supervisor_sequence"`
	ActionPlans               []ActionPlanRow       `json:"action_plans"`
	Comments                  []AppraisalCommentRow `json:"comments"`
	Supervisors               []SupervisorSlotView    `json:"supervisors"`
	ApprovalTrail             []ApprovalTrailRow    `json:"approval_trail"`
	CanEditAppraisee          bool                  `json:"can_edit_appraisee"`
	CanEditActionPlan         bool                  `json:"can_edit_action_plan"`
}

type AppraisalSaveInput struct {
	ReportType   string            `json:"report_type"`
	ActionPlans  []ActionPlanInput `json:"action_plans"`
	AppraiseeComments string       `json:"appraisee_comments"`
}

type AppraisalReviewInput struct {
	ReportID   uint   `json:"report_id"`
	Decision   string `json:"decision"` // approve, return
	Comments   string `json:"comments"`
	JobTitle   string `json:"job_title"`
	CommentRole string `json:"comment_role"` // appraiser, countersigning, responsible_officer
}

type PendingAppraisalReview struct {
	ReportID                  uint   `json:"report_id"`
	StaffID                   uint   `json:"staff_id"`
	StaffName                 string `json:"staff_name"`
	ReportType                string `json:"report_type"`
	ReportLabel               string `json:"report_label"`
	Status                    string `json:"status"`
	PendingSupervisorSequence uint8  `json:"pending_supervisor_sequence"`
	CanAct                    bool   `json:"can_act"`
	SubmittedAt               string `json:"submitted_at,omitempty"`
}

func (s *PerformanceService) supervisorService() *SupervisorService {
	return NewSupervisorService()
}

func (s *PerformanceService) loadAppraisalBundle(report models.PerformanceReport, viewerStaffID uint) (AppraisalBundle, error) {
	bundle := AppraisalBundle{
		ReportID:                  report.ID,
		ReportStatus:              report.Status,
		PendingSupervisorSequence: report.PendingSupervisorSequence,
		ActionPlans:               []ActionPlanRow{},
		Comments:                  []AppraisalCommentRow{},
		Supervisors:               []SupervisorSlotView{},
		ApprovalTrail:             []ApprovalTrailRow{},
	}

	supervisors, _ := s.supervisorService().GetStaffSupervisors(report.StaffID)
	for _, sup := range supervisors {
		bundle.Supervisors = append(bundle.Supervisors, SupervisorSlotView{
			Sequence:          sup.Sequence,
			SupervisorStaffID: sup.SupervisorStaffID,
			SupervisorName:    sup.SupervisorName,
		})
	}

	var plans []models.PerformanceActionPlan
	if report.ID > 0 {
		_ = facades.Orm().Query().
			Where("performance_report_id", report.ID).
			Order("sort_order asc").
			Order("id asc").
			Get(&plans)
	}
	for _, p := range plans {
		bundle.ActionPlans = append(bundle.ActionPlans, ActionPlanRow{
			ID:             p.ID,
			PerformanceGap: p.PerformanceGap,
			AgreedAction:   p.AgreedAction,
			TimeFrame:      p.TimeFrame,
			SortOrder:      p.SortOrder,
		})
	}

	var comments []models.PerformanceAppraisalComment
	if report.ID > 0 {
		_ = facades.Orm().Query().Where("performance_report_id", report.ID).Get(&comments)
	}
	commentRows := s.buildCommentRows(report, comments, supervisors, viewerStaffID)
	bundle.Comments = commentRows

	var trail []models.PerformanceApprovalTrail
	if report.ID > 0 {
		_ = facades.Orm().Query().
			Where("performance_report_id", report.ID).
			Order("created_at asc").
			Get(&trail)
	}
	for _, t := range trail {
		bundle.ApprovalTrail = append(bundle.ApprovalTrail, ApprovalTrailRow{
			ID:         t.ID,
			Action:     t.Action,
			ActorName:  derefStr(t.ActorName),
			Role:       derefStr(t.Role),
			Comments:   derefStr(t.Comments),
			OccurredAt: t.CreatedAt.Format(time.RFC3339),
		})
	}

	isOwner := viewerStaffID == report.StaffID
	editable := isOwner && (report.Status == "draft" || report.Status == "" || report.Status == "returned")
	bundle.CanEditAppraisee = editable
	bundle.CanEditActionPlan = editable && report.ReportType == "endterm"

	return bundle, nil
}

func (s *PerformanceService) buildCommentRows(
	report models.PerformanceReport,
	saved []models.PerformanceAppraisalComment,
	supervisors []SupervisorAssignment,
	viewerStaffID uint,
) []AppraisalCommentRow {
	byKey := map[string]models.PerformanceAppraisalComment{}
	for _, c := range saved {
		key := appraisalCommentKey(c.CommentRole, c.SupervisorSequence)
		byKey[key] = c
	}

	rows := make([]AppraisalCommentRow, 0, 4+len(supervisors))

	// Appraisee
	appraisee := byKey["appraisee:"]
	rows = append(rows, s.commentRowFromModel(appraisee, "appraisee", nil, report, viewerStaffID))

	// One section per appraiser supervisor
	for _, sup := range supervisors {
		seq := sup.Sequence
		key := appraisalCommentKey("appraiser", &seq)
		row := s.commentRowFromModel(byKey[key], "appraiser", &seq, report, viewerStaffID)
		if row.AuthorName == "" {
			row.AuthorName = sup.SupervisorName
		}
		if row.CanEdit && sup.SupervisorStaffID != viewerStaffID {
			row.CanEdit = false
		}
		if !row.CanEdit && sup.SupervisorStaffID == viewerStaffID {
			row.CanEdit = s.supervisorCanReview(report, sup.Sequence, viewerStaffID, "appraiser")
		}
		rows = append(rows, row)
	}

	// Countersigning officer
	counter := byKey["countersigning:"]
	counterRow := s.commentRowFromModel(counter, "countersigning", nil, report, viewerStaffID)
	counterRow.CanEdit = s.canCountersign(report, viewerStaffID, supervisors)
	rows = append(rows, counterRow)

	// Responsible officer
	resp := byKey["responsible_officer:"]
	respRow := s.commentRowFromModel(resp, "responsible_officer", nil, report, viewerStaffID)
	respRow.CanEdit = s.canResponsibleOfficer(report, viewerStaffID)
	rows = append(rows, respRow)

	return rows
}

func appraisalCommentKey(role string, seq *uint8) string {
	if seq != nil {
		return fmt.Sprintf("%s:%d", role, *seq)
	}
	return role + ":"
}

func (s *PerformanceService) commentRowFromModel(
	c models.PerformanceAppraisalComment,
	role string,
	seq *uint8,
	report models.PerformanceReport,
	viewerStaffID uint,
) AppraisalCommentRow {
	row := AppraisalCommentRow{
		CommentRole:        role,
		SupervisorSequence: seq,
		CanEdit:            false,
	}
	if c.ID > 0 {
		row.AuthorStaffID = c.AuthorStaffID
		row.AuthorName = derefStr(c.AuthorName)
		row.JobTitle = derefStr(c.JobTitle)
		row.Comments = c.Comments
		if c.SignedAt != nil {
			iso := c.SignedAt.Format(time.RFC3339)
			row.SignedAt = &iso
		}
	}
	if report.StaffID == viewerStaffID && role == "appraisee" &&
		(report.Status == "draft" || report.Status == "" || report.Status == "returned") {
		row.CanEdit = true
	}
	return row
}

func (s *PerformanceService) supervisorCanReview(
	report models.PerformanceReport,
	sequence uint8,
	supervisorStaffID uint,
	role string,
) bool {
	if role != "appraiser" {
		return false
	}
	if report.Status != "submitted" && report.Status != "supervisor_review" {
		return false
	}
	if report.PendingSupervisorSequence != sequence {
		return false
	}
	for _, sup := range s.supervisorsForStaff(report.StaffID) {
		if sup.Sequence == sequence && sup.SupervisorStaffID == supervisorStaffID {
			return true
		}
	}
	return false
}

func (s *PerformanceService) supervisorsForStaff(staffID uint) []SupervisorAssignment {
	sups, _ := s.supervisorService().GetStaffSupervisors(staffID)
	return sups
}

func (s *PerformanceService) canCountersign(report models.PerformanceReport, viewerStaffID uint, supervisors []SupervisorAssignment) bool {
	if report.Status != "countersigning" {
		return false
	}
	// Any assigned supervisor who is not the pending appraiser may countersign, or HR via responsible flow
	for _, sup := range supervisors {
		if sup.SupervisorStaffID == viewerStaffID && sup.Sequence > 1 {
			return true
		}
	}
	return s.canResponsibleOfficer(report, viewerStaffID)
}

func (s *PerformanceService) canResponsibleOfficer(report models.PerformanceReport, viewerStaffID uint) bool {
	if report.Status != "countersigning" && report.Status != "responsible_review" {
		return false
	}
	// Supervisors with sequence 1 can act as responsible when no HR linkage exists
	for _, sup := range s.supervisorsForStaff(report.StaffID) {
		if sup.SupervisorStaffID == viewerStaffID {
			return report.Status == "responsible_review" || report.Status == "countersigning"
		}
	}
	return false
}

func (s *PerformanceService) SaveAppraisalDraft(staffID uint, input AppraisalSaveInput) (AppraisalBundle, error) {
	if input.ReportType != "endterm" {
		return AppraisalBundle{}, fmt.Errorf("appraisal sections apply to end of year reports only")
	}

	fy, err := s.currentFinancialYear()
	if err != nil {
		return AppraisalBundle{}, err
	}

	quarter, err := s.ensureQuarter(fy, input.ReportType)
	if err != nil {
		return AppraisalBundle{}, err
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
				ReportType:      input.ReportType,
				Status:          "draft",
			}
			return facades.Orm().Query().Create(&report)
		}); err != nil {
		return AppraisalBundle{}, err
	}

	if report.Status != "draft" && report.Status != "" && report.Status != "returned" {
		return AppraisalBundle{}, fmt.Errorf("appraisal sections cannot be edited after submission")
	}

	if err := s.replaceActionPlans(report.ID, input.ActionPlans); err != nil {
		return AppraisalBundle{}, err
	}

	if err := s.upsertAppraisalComment(report.ID, staffID, "appraisee", nil, input.AppraiseeComments, "", false); err != nil {
		return AppraisalBundle{}, err
	}

	_ = s.appendTrail(report.ID, staffID, "saved", "appraisee", "Appraisal sections saved")

	return s.loadAppraisalBundle(report, staffID)
}

func (s *PerformanceService) replaceActionPlans(reportID uint, inputs []ActionPlanInput) error {
	_, _ = facades.Orm().Query().
		Where("performance_report_id", reportID).
		Delete(&models.PerformanceActionPlan{})

	for i, row := range inputs {
		gap := strings.TrimSpace(row.PerformanceGap)
		action := strings.TrimSpace(row.AgreedAction)
		tf := strings.TrimSpace(row.TimeFrame)
		if gap == "" && action == "" && tf == "" {
			continue
		}
		if err := facades.Orm().Query().Create(&models.PerformanceActionPlan{
			PerformanceReportID: reportID,
			PerformanceGap:      gap,
			AgreedAction:        action,
			TimeFrame:           tf,
			SortOrder:           i,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *PerformanceService) upsertAppraisalComment(
	reportID, authorStaffID uint,
	role string,
	sequence *uint8,
	comments, jobTitle string,
	sign bool,
) error {
	var existing models.PerformanceAppraisalComment
	q := facades.Orm().Query().
		Where("performance_report_id", reportID).
		Where("comment_role", role)
	if sequence != nil {
		q = q.Where("supervisor_sequence", *sequence)
	} else {
		q = q.Where("supervisor_sequence IS NULL")
	}
	_ = q.First(&existing)

	name := staffDisplayNameFromID(authorStaffID)
	now := time.Now()
	var signedAt *time.Time
	if sign {
		signedAt = &now
	}

	if existing.ID > 0 {
		existing.Comments = strings.TrimSpace(comments)
		existing.JobTitle = strPtrIf(jobTitle)
		existing.AuthorName = &name
		if sign {
			existing.SignedAt = signedAt
		}
		return facades.Orm().Query().Save(&existing)
	}

	return facades.Orm().Query().Create(&models.PerformanceAppraisalComment{
		PerformanceReportID: reportID,
		CommentRole:         role,
		SupervisorSequence:  sequence,
		AuthorStaffID:       authorStaffID,
		Comments:            strings.TrimSpace(comments),
		AuthorName:          &name,
		JobTitle:            strPtrIf(jobTitle),
		SignedAt:            signedAt,
	})
}

func staffDisplayNameFromID(staffID uint) string {
	var staff models.Staff
	if err := facades.Orm().Query().Where("id", staffID).First(&staff); err != nil || staff.ID == 0 {
		return ""
	}
	return staffDisplayName(staff)
}

func (s *PerformanceService) appendTrail(reportID, actorStaffID uint, action, role, comments string) error {
	name := staffDisplayNameFromID(actorStaffID)
	return facades.Orm().Query().Create(&models.PerformanceApprovalTrail{
		PerformanceReportID: reportID,
		Action:              action,
		ActorStaffID:        actorStaffID,
		ActorName:           &name,
		Role:                &role,
		Comments:            strPtrIf(comments),
	})
}

func (s *PerformanceService) initAppraisalOnSubmit(report *models.PerformanceReport, staffID uint) error {
	if report.ReportType != "endterm" {
		return nil
	}

	supervisors := s.supervisorsForStaff(staffID)
	if len(supervisors) == 0 {
		report.Status = "approved"
		now := time.Now()
		report.ApprovedAt = &now
		report.PendingSupervisorSequence = 0
		return s.appendTrail(report.ID, staffID, "submitted", "appraisee", "End of year report submitted (no supervisors assigned)")
	}

	sort.Slice(supervisors, func(i, j int) bool { return supervisors[i].Sequence < supervisors[j].Sequence })
	report.Status = "supervisor_review"
	report.PendingSupervisorSequence = supervisors[0].Sequence
	return s.appendTrail(report.ID, staffID, "submitted", "appraisee", "End of year report submitted for supervisor review")
}

func (s *PerformanceService) ListPendingAppraisalReviews(supervisorStaffID uint) ([]PendingAppraisalReview, error) {
	supervised := s.supervisedStaffIDs(supervisorStaffID)
	if len(supervised) == 0 {
		return []PendingAppraisalReview{}, nil
	}

	fy, err := s.currentFinancialYear()
	if err != nil {
		return nil, err
	}

	var reports []models.PerformanceReport
	if err := facades.Orm().Query().
		WhereIn("staff_id", toAnySlice(supervised)).
		Where("financial_year_id", fy.ID).
		Where("report_type", "endterm").
		WhereIn("status", []any{"submitted", "supervisor_review", "countersigning", "responsible_review"}).
		Get(&reports); err != nil {
		return nil, err
	}

	staffMap := loadStaffByIDs(supervised)
	out := make([]PendingAppraisalReview, 0, len(reports))
	for _, r := range reports {
		staff := staffMap[r.StaffID]
		item := PendingAppraisalReview{
			ReportID:                  r.ID,
			StaffID:                   r.StaffID,
			StaffName:                 staffDisplayName(staff),
			ReportType:                r.ReportType,
			ReportLabel:               reportTypeLabel(r.ReportType),
			Status:                    r.Status,
			PendingSupervisorSequence: r.PendingSupervisorSequence,
		}
		if r.SubmittedAt != nil {
			item.SubmittedAt = r.SubmittedAt.Format(time.RFC3339)
		}
		item.CanAct = s.supervisorCanReview(r, r.PendingSupervisorSequence, supervisorStaffID, "appraiser") ||
			s.canCountersign(r, supervisorStaffID, s.supervisorsForStaff(r.StaffID)) ||
			s.canResponsibleOfficer(r, supervisorStaffID)
		out = append(out, item)
	}

	sort.Slice(out, func(i, j int) bool {
		if out[i].CanAct != out[j].CanAct {
			return out[i].CanAct
		}
		return out[i].SubmittedAt < out[j].SubmittedAt
	})

	return out, nil
}

func (s *PerformanceService) GetAppraisalForReview(viewerStaffID, reportID uint) (AppraisalBundle, error) {
	var report models.PerformanceReport
	if err := facades.Orm().Query().Where("id", reportID).First(&report); err != nil || report.ID == 0 {
		return AppraisalBundle{}, fmt.Errorf("performance report not found")
	}

	if report.StaffID != viewerStaffID {
		supervised := s.supervisedStaffIDs(viewerStaffID)
		allowed := false
		for _, id := range supervised {
			if id == report.StaffID {
				allowed = true
				break
			}
		}
		if !allowed {
			return AppraisalBundle{}, fmt.Errorf("not authorized to view this appraisal")
		}
	}

	return s.loadAppraisalBundle(report, viewerStaffID)
}

func (s *PerformanceService) ReviewAppraisal(supervisorStaffID uint, input AppraisalReviewInput) (AppraisalBundle, error) {
	decision := strings.ToLower(strings.TrimSpace(input.Decision))
	if decision != "approve" && decision != "return" {
		return AppraisalBundle{}, fmt.Errorf("decision must be approve or return")
	}

	var report models.PerformanceReport
	if err := facades.Orm().Query().Where("id", input.ReportID).First(&report); err != nil || report.ID == 0 {
		return AppraisalBundle{}, fmt.Errorf("performance report not found")
	}

	role := strings.TrimSpace(input.CommentRole)
	if role == "" {
		role = "appraiser"
	}

	if decision == "return" {
		if !s.supervisorCanReview(report, report.PendingSupervisorSequence, supervisorStaffID, "appraiser") {
			return AppraisalBundle{}, fmt.Errorf("not authorized to return this appraisal")
		}
		seq := report.PendingSupervisorSequence
		if err := s.upsertAppraisalComment(report.ID, supervisorStaffID, "appraiser", &seq, input.Comments, input.JobTitle, true); err != nil {
			return AppraisalBundle{}, err
		}
		report.Status = "returned"
		report.PendingSupervisorSequence = 0
		if err := facades.Orm().Query().Save(&report); err != nil {
			return AppraisalBundle{}, err
		}
		_ = s.appendTrail(report.ID, supervisorStaffID, "returned", "appraiser", input.Comments)
		return s.loadAppraisalBundle(report, supervisorStaffID)
	}

	switch role {
	case "appraiser":
		return s.approveAsAppraiser(supervisorStaffID, report, input)
	case "countersigning":
		return s.approveAsCountersigning(supervisorStaffID, report, input)
	case "responsible_officer":
		return s.approveAsResponsibleOfficer(supervisorStaffID, report, input)
	default:
		return AppraisalBundle{}, fmt.Errorf("unsupported comment role")
	}
}

func (s *PerformanceService) approveAsAppraiser(supervisorStaffID uint, report models.PerformanceReport, input AppraisalReviewInput) (AppraisalBundle, error) {
	seq := report.PendingSupervisorSequence
	if !s.supervisorCanReview(report, seq, supervisorStaffID, "appraiser") {
		return AppraisalBundle{}, fmt.Errorf("not your turn to review this appraisal")
	}

	if err := s.upsertAppraisalComment(report.ID, supervisorStaffID, "appraiser", &seq, input.Comments, input.JobTitle, true); err != nil {
		return AppraisalBundle{}, err
	}

	action := fmt.Sprintf("appraiser_%d_approved", seq)
	_ = s.appendTrail(report.ID, supervisorStaffID, action, "appraiser", input.Comments)

	supervisors := s.supervisorsForStaff(report.StaffID)
	sort.Slice(supervisors, func(i, j int) bool { return supervisors[i].Sequence < supervisors[j].Sequence })

	nextSeq := uint8(0)
	for _, sup := range supervisors {
		if sup.Sequence > seq {
			nextSeq = sup.Sequence
			break
		}
	}

	if nextSeq > 0 {
		report.Status = "supervisor_review"
		report.PendingSupervisorSequence = nextSeq
	} else {
		report.Status = "countersigning"
		report.PendingSupervisorSequence = 0
		_ = s.appendTrail(report.ID, supervisorStaffID, "awaiting_countersigning", "system", "All appraisers have reviewed — awaiting countersigning")
	}

	if err := facades.Orm().Query().Save(&report); err != nil {
		return AppraisalBundle{}, err
	}
	return s.loadAppraisalBundle(report, supervisorStaffID)
}

func (s *PerformanceService) approveAsCountersigning(supervisorStaffID uint, report models.PerformanceReport, input AppraisalReviewInput) (AppraisalBundle, error) {
	if !s.canCountersign(report, supervisorStaffID, s.supervisorsForStaff(report.StaffID)) {
		return AppraisalBundle{}, fmt.Errorf("not authorized to countersign")
	}
	if err := s.upsertAppraisalComment(report.ID, supervisorStaffID, "countersigning", nil, input.Comments, input.JobTitle, true); err != nil {
		return AppraisalBundle{}, err
	}
	report.Status = "responsible_review"
	_ = s.appendTrail(report.ID, supervisorStaffID, "countersigned", "countersigning", input.Comments)
	if err := facades.Orm().Query().Save(&report); err != nil {
		return AppraisalBundle{}, err
	}
	return s.loadAppraisalBundle(report, supervisorStaffID)
}

func (s *PerformanceService) approveAsResponsibleOfficer(supervisorStaffID uint, report models.PerformanceReport, input AppraisalReviewInput) (AppraisalBundle, error) {
	if report.Status != "responsible_review" && report.Status != "countersigning" {
		return AppraisalBundle{}, fmt.Errorf("appraisal is not awaiting responsible officer sign-off")
	}
	if err := s.upsertAppraisalComment(report.ID, supervisorStaffID, "responsible_officer", nil, input.Comments, input.JobTitle, true); err != nil {
		return AppraisalBundle{}, err
	}
	now := time.Now()
	report.Status = "approved"
	report.ApprovedAt = &now
	report.PendingSupervisorSequence = 0
	_ = s.appendTrail(report.ID, supervisorStaffID, "approved", "responsible_officer", input.Comments)
	if err := facades.Orm().Query().Save(&report); err != nil {
		return AppraisalBundle{}, err
	}
	return s.loadAppraisalBundle(report, supervisorStaffID)
}

type PendingPpaReview struct {
	PpaID       uint    `json:"ppa_id"`
	StaffID     uint    `json:"staff_id"`
	StaffName   string  `json:"staff_name"`
	Status      string  `json:"status"`
	TotalWeight float64 `json:"total_weight"`
	SubmittedAt string  `json:"submitted_at,omitempty"`
}

func (s *PerformanceService) ListPendingPpaReviews(supervisorStaffID uint) ([]PendingPpaReview, error) {
	supervised := s.supervisedStaffIDs(supervisorStaffID)
	if len(supervised) == 0 {
		return []PendingPpaReview{}, nil
	}

	fy, err := s.currentFinancialYear()
	if err != nil {
		return nil, err
	}

	var ppas []models.Ppa
	if err := facades.Orm().Query().
		WhereIn("staff_id", toAnySlice(supervised)).
		Where("financial_year_id", fy.ID).
		Where("status", "supervisor_review").
		Get(&ppas); err != nil {
		return nil, err
	}

	staffMap := loadStaffByIDs(supervised)
	out := make([]PendingPpaReview, 0, len(ppas))
	for _, ppa := range ppas {
		staff := staffMap[ppa.StaffID]
		item := PendingPpaReview{
			PpaID:       ppa.ID,
			StaffID:     ppa.StaffID,
			StaffName:   staffDisplayName(staff),
			Status:      ppa.Status,
			TotalWeight: ppa.TotalWeight,
		}
		if ppa.SubmittedAt != nil {
			item.SubmittedAt = ppa.SubmittedAt.Format(time.RFC3339)
		}
		out = append(out, item)
	}

	sort.Slice(out, func(i, j int) bool { return out[i].SubmittedAt < out[j].SubmittedAt })
	return out, nil
}

type PpaReviewInput struct {
	PpaID    uint   `json:"ppa_id"`
	Approve  bool   `json:"approve"`
	Comments string `json:"comments"`
}

func (s *PerformanceService) ReviewPpa(supervisorStaffID uint, input PpaReviewInput) (models.Ppa, error) {
	if input.PpaID == 0 {
		return models.Ppa{}, fmt.Errorf("ppa_id is required")
	}

	var ppa models.Ppa
	if err := facades.Orm().Query().Where("id", input.PpaID).First(&ppa); err != nil || ppa.ID == 0 {
		return models.Ppa{}, fmt.Errorf("performance plan not found")
	}
	if ppa.Status != "supervisor_review" {
		return models.Ppa{}, fmt.Errorf("PPA is not awaiting supervisor review")
	}

	supervised := s.supervisedStaffIDs(supervisorStaffID)
	allowed := false
	for _, id := range supervised {
		if id == ppa.StaffID {
			allowed = true
			break
		}
	}
	if !allowed {
		return models.Ppa{}, fmt.Errorf("not authorized to review this PPA")
	}

	if input.Approve {
		now := time.Now()
		ppa.Status = "approved"
		ppa.ApprovedAt = &now
	} else {
		ppa.Status = "draft"
		ppa.ApprovedAt = nil
	}
	if err := facades.Orm().Query().Save(&ppa); err != nil {
		return models.Ppa{}, err
	}
	s.cache.Invalidate()
	return ppa, nil
}

func derefStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
