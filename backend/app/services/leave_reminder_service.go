package services

import (
	"fmt"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type LeaveReminderService struct {
	settings *SettingsService
	inApp    *InAppNotificationService
}

func NewLeaveReminderService() *LeaveReminderService {
	return &LeaveReminderService{
		settings: NewSettingsService(),
		inApp:    NewInAppNotificationService(),
	}
}

func (s *LeaveReminderService) SendAll() (map[string]ReminderSendResult, error) {
	out := map[string]ReminderSendResult{}
	if s.settings.GetBool("notifications.leave_plan_reminder.enabled", true) {
		out["leave_plan_reminder"] = s.sendPlanReminders()
	}
	if s.settings.GetBool("notifications.leave_start_reminder.enabled", true) {
		out["leave_start_reminder"] = s.sendApprovedLeaveReminders()
	}
	return out, nil
}

func (s *LeaveReminderService) offsets() []int {
	raw := s.settings.GetString("notifications.leave_reminder.days_before", "7,1")
	offsets := ParseReminderDayOffsets(raw)
	if len(offsets) == 0 {
		return []int{7, 1}
	}
	return offsets
}

func (s *LeaveReminderService) sendPlanReminders() ReminderSendResult {
	result := ReminderSendResult{}
	today := time.Now().UTC()
	today = time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.UTC)
	for _, d := range s.offsets() {
		target := today.AddDate(0, 0, d)
		targetStr := target.Format("2006-01-02")
		var plans []models.LeavePlan
		_ = facades.Orm().Query().Get(&plans)
		for _, plan := range plans {
			if plan.StartDate.Format("2006-01-02") != targetStr {
				continue
			}
			dedupe := fmt.Sprintf("leave_plan:%d:d%d", plan.ID, d)
			title := "Upcoming planned leave"
			msg := fmt.Sprintf("Your annual leave plan starts on %s (in %d day(s)).", targetStr, d)
			s.notifyStaffAndPrimarySupervisor(plan.StaffID, "leave_plan_reminder", "leave", title, msg, dedupe, "/leave-plan", d, targetStr, &result)
		}
	}
	return result
}

func (s *LeaveReminderService) sendApprovedLeaveReminders() ReminderSendResult {
	result := ReminderSendResult{}
	today := time.Now().UTC()
	today = time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.UTC)
	for _, d := range s.offsets() {
		target := today.AddDate(0, 0, d)
		targetStr := target.Format("2006-01-02")
		var reqs []models.LeaveRequest
		_ = facades.Orm().Query().Get(&reqs)
		for _, req := range reqs {
			if req.StartDate.Format("2006-01-02") != targetStr {
				continue
			}
			if req.Status != "approved" && req.ApprovalStage != "completed" {
				continue
			}
			dedupe := fmt.Sprintf("leave_request:%d:d%d", req.ID, d)
			title := "Upcoming approved leave"
			msg := fmt.Sprintf("Your approved leave starts on %s (in %d day(s)).", targetStr, d)
			s.notifyStaffAndPrimarySupervisor(req.StaffID, "leave_start_reminder", "leave", title, msg, dedupe, "/leave", d, targetStr, &result)
		}
	}
	return result
}

func (s *LeaveReminderService) notifyStaffAndPrimarySupervisor(
	staffID uint,
	notifType, category, title, message, dedupe, actionURL string,
	days int,
	startDate string,
	result *ReminderSendResult,
) {
	if userID, err := FindUserIDByStaffID(staffID); err == nil && userID > 0 {
		if err := s.inApp.Notify(userID, notifType, category, title, message, dedupe+":emp", actionURL); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, err.Error())
		} else {
			result.Sent++
		}
	}

	supervisorID, err := primarySupervisorStaffID(staffID)
	if err != nil || supervisorID == 0 {
		return
	}
	var emp models.Staff
	_ = facades.Orm().Query().Where("id", staffID).First(&emp)
	supMsg := fmt.Sprintf("%s has leave starting on %s (in %d day(s)).", staffDisplayName(emp), startDate, days)
	if userID, err := FindUserIDByStaffID(supervisorID); err == nil && userID > 0 {
		if err := s.inApp.Notify(userID, notifType, category, title, supMsg, dedupe+":sup", actionURL); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, err.Error())
		} else {
			result.Sent++
		}
	}
}

func primarySupervisorStaffID(staffID uint) (uint, error) {
	var contract models.StaffContract
	if err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("contract_status", "active").
		First(&contract); err != nil || contract.ID == 0 {
		return 0, fmt.Errorf("active contract not found")
	}
	var link models.StaffSupervisor
	err := facades.Orm().Query().
		Where("staff_contract_id", contract.ID).
		Where("approval_sequence", 1).
		Where("is_current", true).
		First(&link)
	if err != nil || link.ID == 0 {
		return 0, err
	}
	return link.SupervisorStaffID, nil
}
