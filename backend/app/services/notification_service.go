package services

import (
	"fmt"
	"strings"
	"time"

	"github.com/goravel/framework/contracts/mail"

	"goravel/app/facades"
	"goravel/app/models"
)

type NotificationService struct {
	settings *SettingsService
}

func NewNotificationService() *NotificationService {
	return &NotificationService{settings: NewSettingsService()}
}

type ReminderSendResult struct {
	Sent   int      `json:"sent"`
	Failed int      `json:"failed"`
	Errors []string `json:"errors,omitempty"`
}

type simpleMailable struct {
	to      []string
	subject string
	body    string
	from    mail.Address
}

func (m *simpleMailable) Attachments() []string { return nil }
func (m *simpleMailable) Content() *mail.Content {
	return &mail.Content{Text: m.body, Html: "<p>" + strings.ReplaceAll(m.body, "\n", "<br/>") + "</p>"}
}
func (m *simpleMailable) Envelope() *mail.Envelope {
	return &mail.Envelope{From: m.from, To: m.to, Subject: m.subject}
}
func (m *simpleMailable) Headers() map[string]string { return nil }
func (m *simpleMailable) Queue() *mail.Queue         { return nil }

func (s *NotificationService) fromAddress() mail.Address {
	driver := s.settings.GetString("email.driver", "smtp")
	if driver == "exchange" {
		return mail.Address{
			Address: s.settings.GetString("email.exchange.from_address", "noreply@moh.go.ug"),
			Name:    s.settings.GetString("email.exchange.from_name", "MoH PMS"),
		}
	}
	return mail.Address{
		Address: s.settings.GetString("email.smtp.from_address", facades.Config().GetString("mail.from.address", "noreply@moh.go.ug")),
		Name:    s.settings.GetString("email.smtp.from_name", facades.Config().GetString("mail.from.name", "MoH PMS")),
	}
}

func (s *NotificationService) sendTo(email, subject, body string) error {
	email = strings.TrimSpace(email)
	if email == "" || !strings.Contains(email, "@") {
		return fmt.Errorf("invalid email")
	}
	m := &simpleMailable{
		to:      []string{email},
		subject: subject,
		body:    body,
		from:    s.fromAddress(),
	}
	return facades.Mail().Send(m)
}

func (s *NotificationService) SendAllReminders() (map[string]ReminderSendResult, error) {
	out := map[string]ReminderSendResult{}
	if s.settings.GetBool("notifications.ppa_reminder.enabled", true) {
		res, err := s.SendPPAReminders()
		out["ppa_reminder"] = res
		if err != nil {
			return out, err
		}
	}
	if s.settings.GetBool("notifications.midterm_reminder.enabled", true) {
		res, _ := s.SendMidtermReminders()
		out["midterm_reminder"] = res
	}
	if s.settings.GetBool("notifications.quarterly_reminder.enabled", true) {
		res, _ := s.SendQuarterlyReminders()
		out["quarterly_reminder"] = res
	}
	if s.settings.GetBool("notifications.supervisor_approval.enabled", true) {
		res, _ := s.SendSupervisorApprovalReminders()
		out["supervisor_approval_reminder"] = res
	}
	return out, nil
}

func (s *NotificationService) SendPPAReminders() (ReminderSendResult, error) {
	result := ReminderSendResult{}
	fy, err := s.currentFinancialYear()
	if err != nil {
		return result, err
	}

	var staffRows []models.Staff
	_ = facades.Orm().Query().Where("email IS NOT NULL").Get(&staffRows)

	for _, staff := range staffRows {
		email := deref(staff.Email)
		if email == "" {
			continue
		}
		var ppa models.Ppa
		_ = facades.Orm().Query().Where("staff_id", staff.ID).Where("financial_year_id", fy.ID).First(&ppa)
		if ppa.ID > 0 && ppa.Status != "draft" {
			continue
		}
		subject := "Reminder: Complete your Performance Plan (PPA)"
		body := fmt.Sprintf(
			"Dear %s,\n\nThis is a reminder to complete and submit your Performance Plan (PPA) for %s.\n\nLog in to the MoH Performance Management System to define your KPIs and submit your plan for supervisor review.\n\nMinistry of Health Uganda – PMS",
			staffDisplayName(staff), fy.YearLabel,
		)
		if err := s.sendTo(email, subject, body); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", email, err))
			continue
		}
		result.Sent++
	}
	return result, nil
}

func (s *NotificationService) SendMidtermReminders() (ReminderSendResult, error) {
	return s.sendPerformancePhaseReminder(
		"midterm",
		"Reminder: Submit your Midterm performance report",
		"Please submit your midterm (Q2) progress report in the MoH PMS.",
	)
}

func (s *NotificationService) SendQuarterlyReminders() (ReminderSendResult, error) {
	return s.sendPerformancePhaseReminder(
		"quarterly",
		"Reminder: Submit your quarterly performance report",
		"Please submit your quarterly performance report in the MoH PMS.",
	)
}

func (s *NotificationService) sendPerformancePhaseReminder(phase, subject, intro string) (ReminderSendResult, error) {
	result := ReminderSendResult{}
	fy, err := s.currentFinancialYear()
	if err != nil {
		return result, err
	}

	var staffRows []models.Staff
	_ = facades.Orm().Query().Where("email IS NOT NULL").Get(&staffRows)

	for _, staff := range staffRows {
		email := deref(staff.Email)
		if email == "" {
			continue
		}
		var ppa models.Ppa
		if err := facades.Orm().Query().Where("staff_id", staff.ID).Where("financial_year_id", fy.ID).First(&ppa); err != nil || ppa.ID == 0 || ppa.Status == "draft" {
			continue
		}
		body := fmt.Sprintf("Dear %s,\n\n%s\n\nFinancial year: %s\nPhase: %s\n\nMinistry of Health Uganda – PMS", staffDisplayName(staff), intro, fy.YearLabel, phase)
		if err := s.sendTo(email, subject, body); err != nil {
			result.Failed++
			continue
		}
		result.Sent++
	}
	return result, nil
}

func (s *NotificationService) SendSupervisorApprovalReminders() (ReminderSendResult, error) {
	result := ReminderSendResult{}
	byEmail := map[string]*struct {
		email string
		name  string
		count int
	}{}

	add := func(email, name string, n int) {
		if email == "" {
			return
		}
		if byEmail[email] == nil {
			byEmail[email] = &struct {
				email string
				name  string
				count int
			}{email: email, name: name}
		}
		byEmail[email].count += n
	}

	var leaveApprovals []models.LeaveApproval
	_ = facades.Orm().Query().Where("status", "pending").Get(&leaveApprovals)
	for _, approval := range leaveApprovals {
		var supervisor models.Staff
		if err := facades.Orm().Query().Where("id", approval.SupervisorStaffID).First(&supervisor); err != nil || supervisor.ID == 0 {
			continue
		}
		add(deref(supervisor.Email), staffDisplayName(supervisor), 1)
	}

	var oosApprovals []models.OutOfStationApproval
	_ = facades.Orm().Query().Where("status", "pending").Get(&oosApprovals)
	for _, approval := range oosApprovals {
		var supervisor models.Staff
		if err := facades.Orm().Query().Where("id", approval.SupervisorStaffID).First(&supervisor); err != nil || supervisor.ID == 0 {
			continue
		}
		add(deref(supervisor.Email), staffDisplayName(supervisor), 1)
	}

	ppaPending, _ := s.listPpasAwaitingSupervisor()
	for _, row := range ppaPending {
		add(row.SupervisorEmail, row.SupervisorName, 1)
	}

	for _, b := range byEmail {
		if b.count == 0 {
			continue
		}
		subject := "Reminder: Pending approvals in MoH PMS"
		body := fmt.Sprintf(
			"Dear %s,\n\nYou have %d pending approval(s) (leave, out-of-station, or performance plans) awaiting your action in the MoH Performance Management System.\n\nPlease log in to review and approve or reject these requests.\n\nMinistry of Health Uganda – PMS",
			b.name, b.count,
		)
		if err := s.sendTo(b.email, subject, body); err != nil {
			result.Failed++
			continue
		}
		result.Sent++
	}
	return result, nil
}

type supervisorPendingRow struct {
	SupervisorEmail string
	SupervisorName  string
}

func (s *NotificationService) listPpasAwaitingSupervisor() ([]supervisorPendingRow, error) {
	fy, err := s.currentFinancialYear()
	if err != nil {
		return nil, err
	}
	var ppas []models.Ppa
	if err := facades.Orm().Query().Where("financial_year_id", fy.ID).Where("status", "supervisor_review").Get(&ppas); err != nil {
		return nil, err
	}
	rows := make([]supervisorPendingRow, 0, len(ppas))
	supervisors := NewSupervisorService()
	for _, ppa := range ppas {
		var staff models.Staff
		if err := facades.Orm().Query().Where("id", ppa.StaffID).First(&staff); err != nil || staff.ID == 0 {
			continue
		}
		contract, err := supervisors.activeContract(ppa.StaffID)
		if err != nil {
			continue
		}
		var sup models.StaffSupervisor
		if err := facades.Orm().Query().Where("staff_contract_id", contract.ID).Where("is_current", true).First(&sup); err != nil || sup.ID == 0 {
			continue
		}
		var supervisor models.Staff
		if err := facades.Orm().Query().Where("id", sup.SupervisorStaffID).First(&supervisor); err != nil || supervisor.ID == 0 {
			continue
		}
		rows = append(rows, supervisorPendingRow{
			SupervisorEmail: deref(supervisor.Email),
			SupervisorName:  staffDisplayName(supervisor),
		})
	}
	return rows, nil
}

func (s *NotificationService) currentFinancialYear() (models.FinancialYear, error) {
	var fy models.FinancialYear
	now := time.Now()
	if err := facades.Orm().Query().
		Where("start_date <= ?", now).
		Where("end_date >= ?", now).
		First(&fy); err != nil || fy.ID == 0 {
		return fy, fmt.Errorf("active financial year not found")
	}
	return fy, nil
}
