package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

const hrmExportSource = "performance_system"

// HrmAttendClockPayload matches Attend POST /api/outoftstation_clockin (clone of clock_user).
type HrmAttendClockPayload struct {
	ID                    uint     `json:"id,omitempty"`
	IhrisPID              string   `json:"ihris_pid"`
	EmployeeNumber        string   `json:"employee_number,omitempty"`
	FacilityID            string   `json:"facility_id,omitempty"`
	ClockStatus           string   `json:"clock_status"`
	ClockType             string   `json:"clock_type,omitempty"`
	ClockTime             string   `json:"clock_time,omitempty"`
	Latitude              float64  `json:"latitude"`
	Longitude             float64  `json:"longitude"`
	Accuracy              *float64 `json:"accuracy,omitempty"`
	LocationLabel         *string  `json:"location_label,omitempty"`
	VerificationStatus    string   `json:"verification_status,omitempty"`
	OutOfStationRequestID *uint    `json:"out_of_station_request_id,omitempty"`
	EntryID               string   `json:"entry_id,omitempty"`
	Source                string   `json:"source"`
}

type HrmAttendExportPushResult struct {
	Status  string `json:"status"`
	Pushed  int    `json:"pushed"`
	Failed  int    `json:"failed"`
	Skipped int    `json:"skipped"`
	Pending int    `json:"pending"`
	Message string `json:"message,omitempty"`
}

func (s *HrmAttendService) ExportPushPath() string {
	path := strings.TrimSpace(s.settings.GetString("hrm_attend.export_push_path", "/api/outoftstation_clockin"))
	if path == "" {
		path = "/api/outoftstation_clockin"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return path
}

func (s *HrmAttendService) exportHTTPClient() *http.Client {
	return &http.Client{Timeout: 60 * time.Second}
}

// ObtainExportJWT logs into Attend with configured credentials and returns the Bearer token.
func (s *HrmAttendService) ObtainExportJWT() (string, error) {
	if cached := strings.TrimSpace(s.settings.GetString("hrm_attend.jwt_token", "")); cached != "" {
		return cached, nil
	}
	user := strings.TrimSpace(s.settings.GetString("hrm_attend.basic_user", ""))
	pass := s.settings.GetString("hrm_attend.basic_password", "")
	if user == "" || pass == "" {
		return "", fmt.Errorf("configure HRM Attend API username/password (or paste a JWT) for export push")
	}
	endpoint := s.BaseURL() + "/api/login"
	body, _ := json.Marshal(map[string]string{
		"username": user,
		"password": pass,
	})
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := s.exportHTTPClient().Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("HRM Attend login failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	var parsed struct {
		Status string `json:"status"`
		User   struct {
			Token string `json:"token"`
		} `json:"user"`
		Token string `json:"token"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", fmt.Errorf("HRM Attend login response invalid: %w", err)
	}
	token := strings.TrimSpace(parsed.User.Token)
	if token == "" {
		token = strings.TrimSpace(parsed.Token)
	}
	if token == "" {
		return "", fmt.Errorf("HRM Attend login did not return a JWT")
	}
	return token, nil
}

func HasSuccessfulExport(clockID uint) bool {
	if clockID == 0 {
		return false
	}
	var log models.HrmAttendExportLog
	err := facades.Orm().Query().
		Where("attendance_clock_id", clockID).
		Where("status", "success").
		First(&log)
	return err == nil && log.ID > 0
}

func StaffEmployeeNumber(staff *models.Staff) string {
	if staff == nil {
		return ""
	}
	if staff.CardNumber != nil && strings.TrimSpace(*staff.CardNumber) != "" {
		return strings.TrimSpace(*staff.CardNumber)
	}
	if staff.Ipps != nil && strings.TrimSpace(*staff.Ipps) != "" {
		return strings.TrimSpace(*staff.Ipps)
	}
	return strings.TrimSpace(staff.IhrisPID)
}

func clockStatusFromType(clockType string) string {
	switch strings.ToLower(strings.TrimSpace(clockType)) {
	case "out", "clock_out", "clocked_out", "clockout":
		return "OUT"
	default:
		return "IN"
	}
}

func staffFacilityIhrisID(staffID uint) string {
	var contract models.StaffContract
	err := facades.Orm().Query().
		With("Facility").
		Where("staff_id", staffID).
		Where("contract_status", "active").
		Order("id desc").
		First(&contract)
	if err != nil || contract.ID == 0 {
		_ = facades.Orm().Query().With("Facility").Where("staff_id", staffID).Order("id desc").First(&contract)
	}
	if contract.Facility.ID > 0 && strings.TrimSpace(contract.Facility.IhrisFacilityID) != "" {
		return strings.TrimSpace(contract.Facility.IhrisFacilityID)
	}
	return ""
}

func MapAttendanceClockPayload(clock models.AttendanceClock, staff *models.Staff) HrmAttendClockPayload {
	return MapAttendanceClockPayloadWithFacility(clock, staff, "")
}

func MapAttendanceClockPayloadWithFacility(clock models.AttendanceClock, staff *models.Staff, facilityID string) HrmAttendClockPayload {
	ihrisPID := ""
	if staff != nil {
		ihrisPID = strings.TrimSpace(staff.IhrisPID)
	}
	if ihrisPID == "" {
		ihrisPID = StaffEmployeeNumber(staff)
	}
	return HrmAttendClockPayload{
		ID:                    clock.ID,
		IhrisPID:              ihrisPID,
		EmployeeNumber:        StaffEmployeeNumber(staff),
		FacilityID:            facilityID,
		ClockStatus:           clockStatusFromType(clock.ClockType),
		ClockType:             clock.ClockType,
		ClockTime:             clock.ClockedAt.Format(time.RFC3339),
		Latitude:              clock.Latitude,
		Longitude:             clock.Longitude,
		Accuracy:              clock.AccuracyMeters,
		LocationLabel:         clock.LocationLabel,
		VerificationStatus:    clock.VerificationStatus,
		OutOfStationRequestID: clock.OutOfStationRequestID,
		EntryID:               clock.EntryID,
		Source:                hrmExportSource,
	}
}

func (s *HrmAttendService) ListPendingExportClocks(limit int, sinceID uint) ([]models.AttendanceClock, error) {
	if limit <= 0 {
		limit = 100
	}
	query := facades.Orm().Query().
		Where("out_of_station_request_id is not null").
		Order("id asc")
	if sinceID > 0 {
		query = query.Where("id > ?", sinceID)
	}
	var clocks []models.AttendanceClock
	if err := query.Limit(limit * 3).Find(&clocks); err != nil {
		return nil, err
	}
	out := make([]models.AttendanceClock, 0, limit)
	for _, c := range clocks {
		if !ShouldExportClock(c.ID, HasSuccessfulExport(c.ID)) {
			continue
		}
		out = append(out, c)
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}

func (s *HrmAttendService) CountPendingExportClocks() (int, error) {
	clocks, err := s.ListPendingExportClocks(5000, 0)
	if err != nil {
		return 0, err
	}
	return len(clocks), nil
}

func (s *HrmAttendService) writeExportLog(clockID uint, direction, status string, httpStatus int, snippet string) error {
	now := time.Now()
	var hs *int
	if httpStatus > 0 {
		hs = &httpStatus
	}
	var snip *string
	if snippet != "" {
		if len(snippet) > 500 {
			snippet = snippet[:500]
		}
		snip = &snippet
	}
	row := models.HrmAttendExportLog{
		AttendanceClockID: clockID,
		Direction:         direction,
		Status:            status,
		HTTPStatus:        hs,
		ResponseSnippet:   snip,
		ExportedAt:        now,
	}
	return facades.Orm().Query().Create(&row)
}

func (s *HrmAttendService) PushPendingClocks(limit int) (HrmAttendExportPushResult, error) {
	result := HrmAttendExportPushResult{Status: "completed"}
	if !s.settings.GetBool("hrm_attend.enabled", true) {
		return result, fmt.Errorf("HRM Attend integration is disabled")
	}
	if !s.settings.GetBool("hrm_attend.export_push_enabled", false) {
		result.Status = "skipped"
		result.Message = "export push is disabled"
		return result, nil
	}
	if s.NeedsHostConfiguration() {
		return result, s.syncBlockedError()
	}

	pending, err := s.ListPendingExportClocks(limit, 0)
	if err != nil {
		return result, err
	}
	result.Pending = len(pending)
	if len(pending) == 0 {
		result.Message = "no pending clocks"
		_ = s.settings.Set("hrm_attend.export_last_push_at", "data_sources", time.Now().Format(time.RFC3339), true)
		_ = s.settings.Set("hrm_attend.export_last_push_status", "data_sources", "idle", true)
		return result, nil
	}

	staffIDs := map[uint]struct{}{}
	for _, c := range pending {
		staffIDs[c.StaffID] = struct{}{}
	}
	ids := make([]uint, 0, len(staffIDs))
	for id := range staffIDs {
		ids = append(ids, id)
	}
	var staffRows []models.Staff
	_ = facades.Orm().Query().Where("id in ?", ids).Find(&staffRows)
	staffByID := map[uint]*models.Staff{}
	for i := range staffRows {
		staffByID[staffRows[i].ID] = &staffRows[i]
	}

	endpoint := s.BaseURL() + s.ExportPushPath()
	client := s.exportHTTPClient()

	jwtToken, err := s.ObtainExportJWT()
	if err != nil {
		return result, err
	}

	for _, clock := range pending {
		payload := MapAttendanceClockPayloadWithFacility(clock, staffByID[clock.StaffID], staffFacilityIhrisID(clock.StaffID))
		body, _ := json.Marshal(payload)
		req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
		if err != nil {
			result.Failed++
			_ = s.writeExportLog(clock.ID, "push", "failed", 0, err.Error())
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")
		req.Header.Set("Authorization", "Bearer "+jwtToken)
		resp, err := client.Do(req)
		if err != nil {
			result.Failed++
			_ = s.writeExportLog(clock.ID, "push", "failed", 0, err.Error())
			continue
		}
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		_ = resp.Body.Close()
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			result.Pushed++
			_ = s.writeExportLog(clock.ID, "push", "success", resp.StatusCode, string(respBody))
		} else {
			result.Failed++
			_ = s.writeExportLog(clock.ID, "push", "failed", resp.StatusCode, string(respBody))
		}
	}

	status := "completed"
	if result.Failed > 0 && result.Pushed == 0 {
		status = "failed"
	} else if result.Failed > 0 {
		status = "partial"
	}
	result.Status = status
	_ = s.settings.Set("hrm_attend.export_last_push_at", "data_sources", time.Now().Format(time.RFC3339), true)
	_ = s.settings.Set("hrm_attend.export_last_push_status", "data_sources", status, true)
	return result, nil
}

func (s *HrmAttendService) ListClocksForPull(from, to string, sinceID uint, limit int) ([]HrmAttendClockPayload, error) {
	if limit <= 0 {
		limit = 200
	}
	query := facades.Orm().Query().
		Where("out_of_station_request_id is not null").
		Order("id asc").
		Limit(limit)
	if sinceID > 0 {
		query = query.Where("id > ?", sinceID)
	}
	if from != "" {
		query = query.Where("clocked_at >= ?", from)
	}
	if to != "" {
		query = query.Where("clocked_at <= ?", to)
	}
	var clocks []models.AttendanceClock
	if err := query.Find(&clocks); err != nil {
		return nil, err
	}
	staffIDs := map[uint]struct{}{}
	for _, c := range clocks {
		staffIDs[c.StaffID] = struct{}{}
	}
	ids := make([]uint, 0, len(staffIDs))
	for id := range staffIDs {
		ids = append(ids, id)
	}
	var staffRows []models.Staff
	if len(ids) > 0 {
		_ = facades.Orm().Query().Where("id in ?", ids).Find(&staffRows)
	}
	staffByID := map[uint]*models.Staff{}
	for i := range staffRows {
		staffByID[staffRows[i].ID] = &staffRows[i]
	}
	out := make([]HrmAttendClockPayload, 0, len(clocks))
	for _, c := range clocks {
		out = append(out, MapAttendanceClockPayloadWithFacility(c, staffByID[c.StaffID], staffFacilityIhrisID(c.StaffID)))
	}
	return out, nil
}

func (s *HrmAttendService) MarkClocksExported(clockIDs []uint) error {
	for _, id := range clockIDs {
		if id == 0 || HasSuccessfulExport(id) {
			continue
		}
		if err := s.writeExportLog(id, "pull", "success", 200, "marked via pull"); err != nil {
			return err
		}
	}
	return nil
}

func (s *HrmAttendService) ValidateExportPullToken(token string) bool {
	expected := strings.TrimSpace(s.settings.GetString("hrm_attend.export_pull_token", ""))
	if expected == "" {
		return false
	}
	return strings.TrimSpace(token) == expected
}
