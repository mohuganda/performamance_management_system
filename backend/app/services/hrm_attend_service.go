package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
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
	raw := strings.TrimSpace(s.settings.GetString("hrm_attend.api_url", ""))
	if raw == "" {
		raw = strings.TrimSpace(facades.Config().GetString("pms.hrm_attend.api_base_url", "http://localhost/attend"))
	}
	return strings.TrimRight(raw, "/")
}

// NeedsHostConfiguration is true on production when HRM still points at localhost.
// Admins must set the real HRM host in Settings before sync or live fetch runs.
func (s *HrmAttendService) NeedsHostConfiguration() bool {
	if !isProductionDeployment() {
		return false
	}
	return isLocalhostURL(s.BaseURL())
}

func (s *HrmAttendService) syncBlockedError() error {
	return fmt.Errorf(
		"configure the production HRM Attend base URL in Settings → Data sources before syncing (localhost is only valid in local development)",
	)
}

func isProductionDeployment() bool {
	env := strings.ToLower(strings.TrimSpace(facades.Config().GetString("app.env", "")))
	if env == "production" || env == "prod" {
		return true
	}
	appURL := strings.TrimSpace(facades.Config().GetString("app.url", ""))
	if appURL == "" {
		return false
	}
	return !isLocalhostHost(urlHost(appURL))
}

func isLocalhostURL(raw string) bool {
	host := urlHost(raw)
	return host == "" || isLocalhostHost(host)
}

func urlHost(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if !strings.Contains(raw, "://") {
		raw = "http://" + raw
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return strings.ToLower(strings.TrimSpace(raw))
	}
	host := parsed.Hostname()
	if i := strings.Index(host, "%"); i >= 0 {
		host = host[:i]
	}
	return strings.ToLower(host)
}

func isLocalhostHost(host string) bool {
	host = strings.ToLower(strings.TrimSpace(host))
	switch host {
	case "localhost", "127.0.0.1", "::1":
		return true
	}
	return strings.HasPrefix(host, "127.")
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
	if s.NeedsHostConfiguration() {
		status.Status = "needs_configuration"
		status.Message = "Set the production HRM Attend base URL in Settings → Data sources, then run a manual sync"
		return status
	}

	req, err := http.NewRequest(http.MethodGet, base+s.SummaryPath(), nil)
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
		status.Message = "Receiving monthly attendance summaries from HRM Attend"
		status.LastSyncAt = s.settings.GetString("hrm_attend.last_sync_at", time.Now().Format(time.RFC3339))
	}
	return status
}

func (s *HrmAttendService) MonthlySummaries(months int) []HrmAttendSummary {
	if months <= 0 {
		months = 4
	}
	if stored := s.AggregatedMonthlySummaries(months); len(stored) > 0 {
		return stored
	}
	if s.NeedsHostConfiguration() {
		return nil
	}
	if live := s.fetchLiveSummaries(months); len(live) > 0 {
		return live
	}
	if isProductionDeployment() {
		return nil
	}
	return s.demoSummaries(months)
}

func (s *HrmAttendService) fetchLiveSummaries(months int) []HrmAttendSummary {
	if !s.settings.GetBool("hrm_attend.enabled", true) {
		return nil
	}
	if s.NeedsHostConfiguration() {
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
		"hrm_attend_provides": []string{"Monthly duty-station attendance summaries per staff", "Facility clock-in aggregates", "End-of-month attendance reporting baselines"},
		"pms_exports_to_hrm": []string{"Out-of-station raw clock logs", "Approved leave periods", "GPS verification metadata"},
		"combined_outcome":   "HRM Attend + PMS together produce a complete employee attendance record across duty station and field assignments.",
	}
}
