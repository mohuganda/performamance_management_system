package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"goravel/app/facades"
)

type HrmAttendService struct {
	settings *SettingsService
	client   *http.Client
}

func NewHrmAttendService() *HrmAttendService {
	return &HrmAttendService{
		settings: NewSettingsService(),
		client:   &http.Client{Timeout: 4 * time.Second},
	}
}

type HrmAttendSummary struct {
	Month              string  `json:"month"`
	DutyStationPercent float64 `json:"duty_station_percent"`
	StaffCount         int     `json:"staff_count"`
	Source             string  `json:"source"`
}

type HrmAttendConnection struct {
	Status      string `json:"status"`
	BaseURL     string `json:"base_url"`
	LastSyncAt  string `json:"last_sync_at,omitempty"`
	Message     string `json:"message,omitempty"`
}

func (s *HrmAttendService) BaseURL() string {
	url := strings.TrimSpace(s.settings.GetString("hrm_attend.api_url", ""))
	if url == "" {
		url = strings.TrimSpace(facades.Config().GetString("pms.hrm_attend.api_base_url", "http://localhost/attend"))
	}
	return strings.TrimRight(url, "/")
}

func (s *HrmAttendService) ConnectionStatus() HrmAttendConnection {
	base := s.BaseURL()
	status := HrmAttendConnection{
		BaseURL: base,
		Status:  "demo",
		Message: "Using integrated demo summaries — connect HRM Attend for live duty-station data",
	}
	if !s.settings.GetBool("hrm_attend.enabled", true) {
		status.Status = "disabled"
		status.Message = "HRM Attend integration is disabled in settings"
		return status
	}

	req, err := http.NewRequest(http.MethodGet, base+"/api/v1/health", nil)
	if err != nil {
		return status
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return status
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		status.Status = "connected"
		status.Message = "Receiving daily attendance summaries from HRM Attend"
		status.LastSyncAt = s.settings.GetString("hrm_attend.last_sync_at", time.Now().Format(time.RFC3339))
	}
	return status
}

func (s *HrmAttendService) MonthlySummaries(months int) []HrmAttendSummary {
	if months <= 0 {
		months = 4
	}
	if live := s.fetchLiveSummaries(months); len(live) > 0 {
		return live
	}
	return s.demoSummaries(months)
}

func (s *HrmAttendService) fetchLiveSummaries(months int) []HrmAttendSummary {
	if !s.settings.GetBool("hrm_attend.enabled", true) {
		return nil
	}
	url := fmt.Sprintf("%s/api/v1/attendance/summaries?months=%d", s.BaseURL(), months)
	resp, err := s.client.Get(url)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}
	var payload struct {
		Data []HrmAttendSummary `json:"data"`
	}
	if json.Unmarshal(body, &payload) == nil && len(payload.Data) > 0 {
		for i := range payload.Data {
			payload.Data[i].Source = "hrm_attend"
		}
		_ = s.settings.Set("hrm_attend.last_sync_at", "data_sources", time.Now().Format(time.RFC3339), false)
		return payload.Data
	}
	var rows []HrmAttendSummary
	if json.Unmarshal(body, &rows) == nil && len(rows) > 0 {
		for i := range rows {
			rows[i].Source = "hrm_attend"
		}
		_ = s.settings.Set("hrm_attend.last_sync_at", "data_sources", time.Now().Format(time.RFC3339), false)
		return rows
	}
	return nil
}

func (s *HrmAttendService) demoSummaries(months int) []HrmAttendSummary {
	now := time.Now()
	base := []float64{93.5, 94.2, 95.1, 94.8, 96.0, 95.4}
	rows := make([]HrmAttendSummary, 0, months)
	for i := months - 1; i >= 0; i-- {
		t := now.AddDate(0, -i, 0)
		idx := len(base) - 1 - i
		if idx < 0 {
			idx = 0
		}
		if idx >= len(base) {
			idx = len(base) - 1
		}
		rows = append(rows, HrmAttendSummary{
			Month:              t.Format("Jan 2006"),
			DutyStationPercent: base[idx],
			StaffCount:         0,
			Source:             "demo",
		})
	}
	return rows
}

func (s *HrmAttendService) IntegrationMeta() map[string]any {
	conn := s.ConnectionStatus()
	return map[string]any{
		"title":              "Unified Attendance View",
		"connection":         conn,
		"pms_tracks":         []string{"Out-of-station GPS clock-in/out", "Approved leave requests", "Geofence verification at duty destinations"},
		"hrm_attend_provides": []string{"Daily duty-station attendance summaries", "Facility clock-in aggregates", "Monthly attendance reporting baselines"},
		"pms_exports_to_hrm": []string{"Out-of-station raw clock logs", "Approved leave periods", "GPS verification metadata"},
		"combined_outcome":   "HRM Attend + PMS together produce a complete employee attendance record across duty station and field assignments.",
	}
}
