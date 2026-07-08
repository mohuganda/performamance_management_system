package services

import (
	"fmt"
	"strings"
	"time"

	"goravel/app/facades"
	"goravel/app/http/authctx"
	"goravel/app/models"
)

type InAppNotificationService struct {
	settings *SettingsService
	mail     *NotificationService
}

func NewInAppNotificationService() *InAppNotificationService {
	return &InAppNotificationService{
		settings: NewSettingsService(),
		mail:     NewNotificationService(),
	}
}

type NotificationRow struct {
	ID        uint    `json:"id"`
	Type      string  `json:"type"`
	Category  string  `json:"category"`
	Title     string  `json:"title"`
	Message   string  `json:"message"`
	ActionURL *string `json:"action_url,omitempty"`
	ReadAt    *time.Time `json:"read_at,omitempty"`
	CreatedAt string  `json:"created_at"`
	IsRead    bool    `json:"is_read"`
}

type NotificationListFilter struct {
	UnreadOnly bool
	Page       int
	PerPage    int
}

func (s *InAppNotificationService) SyncForPrincipal(principal authctx.Principal) error {
	if principal.User.ID == 0 {
		return nil
	}
	if principal.StaffID != nil && *principal.StaffID > 0 {
		if err := s.syncApprovalNotifications(principal.User.ID, *principal.StaffID, principal.Permissions); err != nil {
			return err
		}
		if err := s.syncStaffStatusNotifications(principal.User.ID, *principal.StaffID); err != nil {
			return err
		}
	}
	return s.syncSystemReminders(principal.User.ID, principal.Permissions)
}

func (s *InAppNotificationService) UnreadCount(userID uint) (int, error) {
	var rows []models.UserNotification
	err := facades.Orm().Query().
		Where("user_id", userID).
		Where("read_at IS NULL").
		Get(&rows)
	return len(rows), err
}

func (s *InAppNotificationService) List(userID uint, filter NotificationListFilter) (PaginatedResult[NotificationRow], error) {
	page, perPage := ResolvePage(filter.Page, filter.PerPage)
	query := facades.Orm().Query().
		Where("user_id", userID).
		Order("created_at desc")
	if filter.UnreadOnly {
		query = query.Where("read_at IS NULL")
	}

	var rows []models.UserNotification
	if err := query.Get(&rows); err != nil {
		return PaginatedResult[NotificationRow]{}, err
	}

	out := make([]NotificationRow, 0, len(rows))
	for _, row := range rows {
		out = append(out, s.toRow(row))
	}
	return PaginateSlice(out, page, perPage), nil
}

func (s *InAppNotificationService) MarkRead(userID, notificationID uint) error {
	var row models.UserNotification
	if err := facades.Orm().Query().
		Where("id", notificationID).
		Where("user_id", userID).
		First(&row); err != nil || row.ID == 0 {
		return fmt.Errorf("notification not found")
	}
	if row.ReadAt != nil {
		return nil
	}
	now := time.Now()
	row.ReadAt = &now
	return facades.Orm().Query().Save(&row)
}

func (s *InAppNotificationService) MarkAllRead(userID uint) error {
	now := time.Now()
	_, err := facades.Orm().Query().Model(&models.UserNotification{}).
		Where("user_id", userID).
		Where("read_at IS NULL").
		Update("read_at", now)
	return err
}

func (s *InAppNotificationService) upsert(userID uint, notifType, category, title, message, dedupeKey, actionURL string) error {
	dedupeKey = strings.TrimSpace(dedupeKey)
	if dedupeKey == "" {
		dedupeKey = fmt.Sprintf("%d:%s:%d", userID, category, time.Now().UnixNano())
	}

	var existing models.UserNotification
	err := facades.Orm().Query().
		Where("user_id", userID).
		Where("dedupe_key", dedupeKey).
		First(&existing)
	if err == nil && existing.ID > 0 {
		existing.Title = title
		existing.Message = message
		existing.Type = notifType
		existing.Category = category
		if actionURL != "" {
			existing.ActionURL = strPtr(actionURL)
		}
		if err := facades.Orm().Query().Save(&existing); err != nil {
			return err
		}
		if existing.EmailedAt == nil && existing.ReadAt == nil {
			s.sendEmailCopy(existing.ID, userID, title, message, actionURL)
		}
		return nil
	}

	row := models.UserNotification{
		UserID:    userID,
		Type:      notifType,
		Category:  category,
		Title:     title,
		Message:   message,
		DedupeKey: strPtr(dedupeKey),
	}
	if actionURL != "" {
		row.ActionURL = strPtr(actionURL)
	}
	if err := facades.Orm().Query().Create(&row); err != nil {
		return err
	}
	s.sendEmailCopy(row.ID, userID, title, message, actionURL)
	return nil
}

func (s *InAppNotificationService) sendEmailCopy(notificationID, userID uint, title, message, actionURL string) {
	if !s.settings.GetBool("notifications.in_app.email_copy", true) {
		return
	}

	var user models.User
	if err := facades.Orm().Query().Where("id", userID).First(&user); err != nil || user.ID == 0 {
		return
	}
	email := strings.TrimSpace(user.Email)
	if email == "" || !strings.Contains(email, "@") {
		return
	}

	body := message + "\n\n— Ministry of Health Uganda · Performance Management System"
	if actionURL != "" {
		base := strings.TrimRight(s.settings.GetString("app.public_url", "http://127.0.0.1:5173"), "/")
		path := actionURL
		if !strings.HasPrefix(path, "/") {
			path = "/" + path
		}
		body += fmt.Sprintf("\n\nOpen in PMS: %s%s", base, path)
	}

	if err := s.mail.sendTo(email, title, body); err != nil {
		return
	}

	now := time.Now()
	_, _ = facades.Orm().Query().Model(&models.UserNotification{}).
		Where("id", notificationID).
		Where("user_id", userID).
		Update("emailed_at", now)
}

func (s *InAppNotificationService) syncApprovalNotifications(userID, staffID uint, perms map[string]bool) error {
	if perms["leave.requests.approve"] {
		var pending []models.LeaveApproval
		_ = facades.Orm().Query().
			Where("supervisor_staff_id", staffID).
			Where("status", "pending").
			Get(&pending)
		for _, approval := range pending {
			var req models.LeaveRequest
			if err := facades.Orm().Query().Where("id", approval.LeaveRequestID).First(&req); err != nil || req.ID == 0 {
				continue
			}
			var staff models.Staff
			_ = facades.Orm().Query().Where("id", req.StaffID).First(&staff)
			name := staffDisplayName(staff)
			if err := s.upsert(
				userID, "warning", "leave",
				"Leave approval pending",
				fmt.Sprintf("%s has a leave request awaiting your approval.", name),
				fmt.Sprintf("leave-approval:%d", approval.ID),
				"/leave",
			); err != nil {
				return err
			}
		}
	}

	if perms["oos.requests.approve"] {
		var pending []models.OutOfStationApproval
		_ = facades.Orm().Query().
			Where("supervisor_staff_id", staffID).
			Where("status", "pending").
			Get(&pending)
		for _, approval := range pending {
			var req models.OutOfStationRequest
			if err := facades.Orm().Query().Where("id", approval.OutOfStationRequestID).First(&req); err != nil || req.ID == 0 {
				continue
			}
			var staff models.Staff
			_ = facades.Orm().Query().Where("id", req.StaffID).First(&staff)
			name := staffDisplayName(staff)
			if err := s.upsert(
				userID, "warning", "oos",
				"Out-of-station approval pending",
				fmt.Sprintf("%s has an out-of-station request awaiting your approval.", name),
				fmt.Sprintf("oos-approval:%d", approval.ID),
				"/out-of-station",
			); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *InAppNotificationService) syncStaffStatusNotifications(userID, staffID uint) error {
	var leaveRows []models.LeaveRequest
	_ = facades.Orm().Query().
		Where("staff_id", staffID).
		Where("status IN ?", []string{"approved", "rejected"}).
		Order("updated_at desc").
		Limit(5).
		Get(&leaveRows)
	for _, req := range leaveRows {
		notifType := "success"
		title := "Leave request approved"
		if req.Status == "rejected" {
			notifType = "error"
			title = "Leave request rejected"
		}
		if err := s.upsert(
			userID, notifType, "leave",
			title,
			fmt.Sprintf("Your leave request (%s to %s) was %s.", req.StartDate.Format("2 Jan 2006"), req.EndDate.Format("2 Jan 2006"), req.Status),
			fmt.Sprintf("leave-status:%d:%s", req.ID, req.Status),
			"/leave",
		); err != nil {
			return err
		}
	}

	fy, err := currentFinancialYear()
	if err == nil {
		var ppa models.Ppa
		if err := facades.Orm().Query().
			Where("staff_id", staffID).
			Where("financial_year_id", fy.ID).
			First(&ppa); err == nil && ppa.ID > 0 {
			switch ppa.Status {
			case "draft":
				_ = s.upsert(
					userID, "info", "performance",
					"Complete your PPA",
					fmt.Sprintf("Your Performance Plan for %s is still in draft. Submit it for supervisor review.", fy.YearLabel),
					fmt.Sprintf("ppa-draft:%d", ppa.ID),
					"/performance",
				)
			case "supervisor_review":
				_ = s.upsert(
					userID, "warning", "performance",
					"PPA awaiting supervisor sign-off",
					"Your Planning & Performance Agreement is with your supervisor for approval.",
					fmt.Sprintf("ppa-review:%d", ppa.ID),
					"/performance",
				)
			case "approved":
				_ = s.upsert(
					userID, "success", "performance",
					"PPA approved",
					fmt.Sprintf("Your Performance Plan for %s has been approved.", fy.YearLabel),
					fmt.Sprintf("ppa-approved:%d", ppa.ID),
					"/performance",
				)
			}
		}
	}
	return nil
}

func (s *InAppNotificationService) syncSystemReminders(userID uint, perms map[string]bool) error {
	if perms["dashboard.staff"] || perms["performance.view"] {
		_ = s.upsert(
			userID, "info", "system",
			"Quarterly reporting window",
			"Submit quarterly progress reports before the deadline in the Performance module.",
			"system:quarterly-reminder",
			"/performance",
		)
	}
	if perms["dashboard.supervisor"] || perms["dashboard.department_head"] {
		_ = s.upsert(
			userID, "info", "system",
			"Review team submissions",
			"Check pending leave, out-of-station, and performance approvals for your team.",
			"system:supervisor-reminder",
			"/dashboard",
		)
	}
	return nil
}

func (s *InAppNotificationService) toRow(row models.UserNotification) NotificationRow {
	created := ""
	if row.CreatedAt != nil {
		created = row.CreatedAt.StdTime().Format(time.RFC3339)
	}
	return NotificationRow{
		ID:        row.ID,
		Type:      row.Type,
		Category:  row.Category,
		Title:     row.Title,
		Message:   row.Message,
		ActionURL: row.ActionURL,
		ReadAt:    row.ReadAt,
		CreatedAt: created,
		IsRead:    row.ReadAt != nil,
	}
}

func currentFinancialYear() (models.FinancialYear, error) {
	var fy models.FinancialYear
	now := time.Now()
	err := facades.Orm().Query().
		Where("start_date <= ?", now).
		Where("end_date >= ?", now).
		First(&fy)
	if err != nil || fy.ID == 0 {
		return fy, fmt.Errorf("active financial year not found")
	}
	return fy, nil
}
