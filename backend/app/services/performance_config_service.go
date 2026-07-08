package services

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type PerformanceConfigService struct{}

func NewPerformanceConfigService() *PerformanceConfigService {
	return &PerformanceConfigService{}
}

type PerformanceReportingSettings struct {
	EnforceWindows  bool `json:"enforce_windows"`
	TestOverride    bool `json:"test_override"`
	WindowWeeks     int  `json:"window_weeks"`
	WindowShiftDays int  `json:"window_shift_days"`
}

type ReportingWindowBounds struct {
	Phase           string    `json:"phase"`
	Label           string    `json:"label"`
	CoveragePeriod  string    `json:"coverage_period"`
	ReportingWindow string    `json:"reporting_window"`
	OpenAt          time.Time `json:"-"`
	CloseAt         time.Time `json:"-"`
}

type ReportingWindowStatus struct {
	Phase           string `json:"phase"`
	Label           string `json:"label"`
	CoveragePeriod  string `json:"coverage_period"`
	ReportingWindow string `json:"reporting_window"`
	Status          string `json:"status"`
	IsOpen          bool   `json:"is_open"`
	OpenAt          string `json:"open_at"`
	CloseAt         string `json:"close_at"`
	DaysRemaining   int    `json:"days_remaining"`
}

func (s *PerformanceConfigService) defaultSettings() PerformanceReportingSettings {
	return PerformanceReportingSettings{
		EnforceWindows:  true,
		TestOverride:    true,
		WindowWeeks:     3,
		WindowShiftDays: 0,
	}
}

func (s *PerformanceConfigService) LoadSettings() (PerformanceReportingSettings, error) {
	settings := s.defaultSettings()
	var configs []models.SystemConfig
	if err := facades.Orm().Query().Where("group_name", "performance").Get(&configs); err != nil {
		return settings, err
	}
	for _, cfg := range configs {
		switch cfg.Key {
		case "enforce_windows":
			var v bool
			if json.Unmarshal([]byte(cfg.Value), &v) == nil {
				settings.EnforceWindows = v
			}
		case "test_override":
			var v bool
			if json.Unmarshal([]byte(cfg.Value), &v) == nil {
				settings.TestOverride = v
			}
		case "window_weeks":
			var v int
			if json.Unmarshal([]byte(cfg.Value), &v) == nil && v > 0 {
				settings.WindowWeeks = v
			}
		case "window_shift_days":
			var v int
			if json.Unmarshal([]byte(cfg.Value), &v) == nil {
				settings.WindowShiftDays = v
			}
		}
	}
	return settings, nil
}

func (s *PerformanceConfigService) SaveSetting(key string, value any, description string, isPublic bool) error {
	payload, err := json.Marshal(value)
	if err != nil {
		return err
	}

	var existing models.SystemConfig
	err = facades.Orm().Query().Where("key", key).First(&existing)
	if err != nil {
		cfg := models.SystemConfig{
			Key:       key,
			Value:     string(payload),
			GroupName: "performance",
			IsPublic:  isPublic,
		}
		if description != "" {
			cfg.Description = &description
		}
		return facades.Orm().Query().Create(&cfg)
	}

	existing.Value = string(payload)
	existing.GroupName = "performance"
	existing.IsPublic = isPublic
	if description != "" {
		existing.Description = &description
	}
	return facades.Orm().Query().Save(&existing)
}

func (s *PerformanceConfigService) WindowsBypassed(settings PerformanceReportingSettings) bool {
	return !settings.EnforceWindows || settings.TestOverride
}

func (s *PerformanceConfigService) AssertOpen(phase string, fy models.FinancialYear, at time.Time) error {
	settings, err := s.LoadSettings()
	if err != nil {
		return err
	}
	if s.WindowsBypassed(settings) {
		return nil
	}

	status := s.WindowStatus(phase, fy, settings, at)
	if status.IsOpen {
		return nil
	}

	label := status.Label
	if label == "" {
		label = phase
	}
	if status.Status == "upcoming" {
		return fmt.Errorf("%s reporting opens on %s", label, formatMoHDate(status.OpenAt))
	}
	return fmt.Errorf("%s reporting closed on %s", label, formatMoHDate(status.CloseAt))
}

func (s *PerformanceConfigService) ListWindowStatuses(fy models.FinancialYear, at time.Time) ([]ReportingWindowStatus, error) {
	settings, err := s.LoadSettings()
	if err != nil {
		return nil, err
	}

	phases := []string{"ppa", "q1", "midterm", "q3", "endterm"}
	out := make([]ReportingWindowStatus, 0, len(phases))
	for _, phase := range phases {
		out = append(out, s.WindowStatus(phase, fy, settings, at))
	}
	return out, nil
}

func (s *PerformanceConfigService) WindowStatus(phase string, fy models.FinancialYear, settings PerformanceReportingSettings, at time.Time) ReportingWindowStatus {
	bounds := s.computeBounds(phase, fy, settings)
	status := s.resolveStatus(bounds.OpenAt, bounds.CloseAt, at)
	isOpen := status == "open"
	if s.WindowsBypassed(settings) {
		isOpen = true
		if status == "closed" {
			status = "open"
		}
	}

	daysRemaining := 0
	if isOpen && !bounds.CloseAt.IsZero() {
		daysRemaining = int(bounds.CloseAt.Sub(at).Hours()/24) + 1
		if daysRemaining < 0 {
			daysRemaining = 0
		}
	}

	return ReportingWindowStatus{
		Phase:           bounds.Phase,
		Label:           bounds.Label,
		CoveragePeriod:  bounds.CoveragePeriod,
		ReportingWindow: bounds.ReportingWindow,
		Status:          status,
		IsOpen:          isOpen,
		OpenAt:          bounds.OpenAt.Format(time.RFC3339),
		CloseAt:         bounds.CloseAt.Format(time.RFC3339),
		DaysRemaining:   daysRemaining,
	}
}

func (s *PerformanceConfigService) computeBounds(phase string, fy models.FinancialYear, settings PerformanceReportingSettings) ReportingWindowBounds {
	weeks := settings.WindowWeeks
	if weeks < 1 {
		weeks = 3
	}
	shift := time.Duration(settings.WindowShiftDays) * 24 * time.Hour

	startYear := fy.StartDate.Year()
	q1Start := dateOnly(fy.StartDate)
	q1End := endOfDay(time.Date(startYear, time.September, 30, 0, 0, 0, 0, time.UTC))
	q2Start := time.Date(startYear, time.October, 1, 0, 0, 0, 0, time.UTC)
	q3Start := time.Date(startYear+1, time.January, 1, 0, 0, 0, 0, time.UTC)
	q4Start := time.Date(startYear+1, time.April, 1, 0, 0, 0, 0, time.UTC)
	nextFYStart := time.Date(startYear+1, time.July, 1, 0, 0, 0, 0, time.UTC)

	openForWeeks := func(start time.Time) (time.Time, time.Time) {
		open := dateOnly(start.Add(shift))
		close := endOfDay(open.AddDate(0, 0, weeks*7-1))
		return open, close
	}

	switch phase {
	case "ppa":
		open, close := q1Start, q1End
		return ReportingWindowBounds{
			Phase:           "ppa",
			Label:           "Planning & Performance Agreement",
			CoveragePeriod:  "July – September",
			ReportingWindow: fmt.Sprintf("%s – %s", formatMoHDate(open.Format(time.RFC3339)), formatMoHDate(close.Format(time.RFC3339))),
			OpenAt:          open,
			CloseAt:         close,
		}
	case "q1":
		open, close := openForWeeks(q2Start)
		return ReportingWindowBounds{
			Phase:           "q1",
			Label:           "Q1 Report",
			CoveragePeriod:  "July – September",
			ReportingWindow: fmt.Sprintf("First %d weeks of Q2 · %s – %s", weeks, formatMoHDate(open.Format(time.RFC3339)), formatMoHDate(close.Format(time.RFC3339))),
			OpenAt:          open,
			CloseAt:         close,
		}
	case "midterm":
		open, close := openForWeeks(q3Start)
		return ReportingWindowBounds{
			Phase:           "midterm",
			Label:           "Midterm Review",
			CoveragePeriod:  "October – December",
			ReportingWindow: fmt.Sprintf("First %d weeks of Q3 · %s – %s", weeks, formatMoHDate(open.Format(time.RFC3339)), formatMoHDate(close.Format(time.RFC3339))),
			OpenAt:          open,
			CloseAt:         close,
		}
	case "q3":
		open, close := openForWeeks(q4Start)
		return ReportingWindowBounds{
			Phase:           "q3",
			Label:           "Q3 Progress Report",
			CoveragePeriod:  "January – March",
			ReportingWindow: fmt.Sprintf("First %d weeks of Q4 · %s – %s", weeks, formatMoHDate(open.Format(time.RFC3339)), formatMoHDate(close.Format(time.RFC3339))),
			OpenAt:          open,
			CloseAt:         close,
		}
	case "endterm":
		open, close := openForWeeks(nextFYStart)
		return ReportingWindowBounds{
			Phase:           "endterm",
			Label:           "End of Year Appraisal",
			CoveragePeriod:  "April – June",
			ReportingWindow: fmt.Sprintf("First %d weeks of new FY Q1 · %s – %s", weeks, formatMoHDate(open.Format(time.RFC3339)), formatMoHDate(close.Format(time.RFC3339))),
			OpenAt:          open,
			CloseAt:         close,
		}
	default:
		open, close := openForWeeks(q2Start)
		return ReportingWindowBounds{
			Phase:           phase,
			Label:           phase,
			CoveragePeriod:  "",
			ReportingWindow: fmt.Sprintf("%s – %s", formatMoHDate(open.Format(time.RFC3339)), formatMoHDate(close.Format(time.RFC3339))),
			OpenAt:          open,
			CloseAt:         close,
		}
	}
}

func (s *PerformanceConfigService) PublicConfig(fy models.FinancialYear) (map[string]any, error) {
	settings, err := s.LoadSettings()
	if err != nil {
		return nil, err
	}
	windows, err := s.ListWindowStatuses(fy, time.Now())
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"settings": settings,
		"windows":  windows,
	}, nil
}

func (s *PerformanceConfigService) AdminConfig(fy models.FinancialYear) (map[string]any, error) {
	public, err := s.PublicConfig(fy)
	if err != nil {
		return nil, err
	}
	public["financial_year"] = fy.YearLabel
	return public, nil
}

func dateOnly(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

func endOfDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 0, time.UTC)
}

func resolveStatus(openAt, closeAt, at time.Time) string {
	if at.Before(openAt) {
		return "upcoming"
	}
	if at.After(closeAt) {
		return "closed"
	}
	return "open"
}

func (s *PerformanceConfigService) resolveStatus(openAt, closeAt, at time.Time) string {
	return resolveStatus(openAt, closeAt, at)
}

func formatMoHDate(iso string) string {
	if iso == "" {
		return "—"
	}
	t, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		if t2, err2 := time.Parse("2006-01-02", strings.TrimSpace(iso)); err2 == nil {
			t = t2
		} else {
			return iso
		}
	}
	return t.Format("2 Jan 2006")
}
