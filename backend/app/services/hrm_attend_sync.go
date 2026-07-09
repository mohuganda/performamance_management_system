package services

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type HrmAttendSyncResult struct {
	Status         string `json:"status"`
	YearMonth      string `json:"year_month"`
	Imported       int    `json:"imported"`
	SkippedUnknown int    `json:"skipped_unknown"`
	SkippedInvalid int    `json:"skipped_invalid"`
	TotalFetched   int    `json:"total_fetched"`
	Message        string `json:"message,omitempty"`
}

type hrmAttendanceSummaryRow struct {
	IhrisPID           string
	CardNumber         string
	Nin                string
	StaffID            uint
	YearMonth          string
	DutyStationPercent float64
	DaysPresent        *int
	DaysExpected       *int
	ExternalRef        string
}

func (s *HrmAttendService) SummaryPath() string {
	path := strings.TrimSpace(s.settings.GetString("hrm_attend.summary_path", "/attendance/attendance_summary"))
	if path == "" {
		path = "/attendance/attendance_summary"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return path
}

func (s *HrmAttendService) SyncMonthlySummaries(yearMonth string) (HrmAttendSyncResult, error) {
	result := HrmAttendSyncResult{Status: "completed"}
	if !s.settings.GetBool("hrm_attend.enabled", true) {
		return result, fmt.Errorf("HRM Attend integration is disabled")
	}
	if s.NeedsHostConfiguration() {
		return result, s.syncBlockedError()
	}

	if yearMonth == "" {
		prev := time.Now().AddDate(0, -1, 0)
		yearMonth = prev.Format("2006-01")
	}
	result.YearMonth = yearMonth

	rows, err := s.fetchAttendanceSummaryRows(yearMonth)
	if err != nil {
		_ = s.settings.Set("hrm_attend.last_sync_status", "data_sources", "failed", false)
		return result, err
	}
	result.TotalFetched = len(rows)

	lookup := s.buildStaffLookup()
	now := time.Now()

	for _, row := range rows {
		staffID, ok := lookup.match(row)
		if !ok {
			result.SkippedUnknown++
			continue
		}
		if row.YearMonth == "" {
			row.YearMonth = yearMonth
		}
		if row.DutyStationPercent < 0 || row.DutyStationPercent > 100 {
			result.SkippedInvalid++
			continue
		}

		var existing models.StaffAttendanceMonthlySummary
		err := facades.Orm().Query().
			Where("staff_id", staffID).
			Where("year_month", row.YearMonth).
			First(&existing)
		if err != nil || existing.ID == 0 {
			record := models.StaffAttendanceMonthlySummary{
				StaffID:            staffID,
				YearMonth:          row.YearMonth,
				DutyStationPercent: row.DutyStationPercent,
				DaysPresent:        row.DaysPresent,
				DaysExpected:       row.DaysExpected,
				Source:             "hrm_attend",
			}
			if row.ExternalRef != "" {
				record.ExternalRef = &row.ExternalRef
			}
			if createErr := facades.Orm().Query().Create(&record); createErr != nil {
				return result, createErr
			}
		} else {
			existing.DutyStationPercent = row.DutyStationPercent
			existing.DaysPresent = row.DaysPresent
			existing.DaysExpected = row.DaysExpected
			existing.Source = "hrm_attend"
			if row.ExternalRef != "" {
				existing.ExternalRef = &row.ExternalRef
			}
			if saveErr := facades.Orm().Query().Save(&existing); saveErr != nil {
				return result, saveErr
			}
		}
		result.Imported++
	}

	_ = s.settings.Set("hrm_attend.last_sync_at", "data_sources", now.Format(time.RFC3339), false)
	_ = s.settings.Set("hrm_attend.last_sync_status", "data_sources", "completed", false)
	result.Message = fmt.Sprintf(
		"Imported %d staff summaries for %s (%d unknown, %d invalid)",
		result.Imported, yearMonth, result.SkippedUnknown, result.SkippedInvalid,
	)
	return result, nil
}

func (s *HrmAttendService) fetchAttendanceSummaryRows(yearMonth string) ([]hrmAttendanceSummaryRow, error) {
	endpoint := s.BaseURL() + s.SummaryPath()
	if yearMonth != "" {
		sep := "?"
		if strings.Contains(endpoint, "?") {
			sep = "&"
		}
		endpoint += sep + "year_month=" + url.QueryEscape(yearMonth)
	}

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("could not reach HRM Attend: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("HRM Attend returned HTTP %d: %s", resp.StatusCode, truncateBody(body, 200))
	}

	rows, err := parseHrmAttendanceSummaryPayload(body)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("HRM Attend returned no attendance summary rows")
	}
	return rows, nil
}

func parseHrmAttendanceSummaryPayload(body []byte) ([]hrmAttendanceSummaryRow, error) {
	var envelope struct {
		Data    []map[string]any `json:"data"`
		Records []map[string]any `json:"records"`
		Rows    []map[string]any `json:"rows"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		return nil, fmt.Errorf("invalid JSON from HRM Attend: %w", err)
	}

	rawRows := envelope.Data
	if len(rawRows) == 0 {
		rawRows = envelope.Records
	}
	if len(rawRows) == 0 {
		rawRows = envelope.Rows
	}
	if len(rawRows) == 0 {
		var flat []map[string]any
		if err := json.Unmarshal(body, &flat); err == nil && len(flat) > 0 {
			rawRows = flat
		}
	}
	if len(rawRows) == 0 {
		return nil, fmt.Errorf("no attendance rows in HRM response")
	}

	out := make([]hrmAttendanceSummaryRow, 0, len(rawRows))
	for _, item := range rawRows {
		row := mapToHrmSummaryRow(item)
		if row.IhrisPID == "" && row.CardNumber == "" && row.Nin == "" && row.StaffID == 0 {
			continue
		}
		out = append(out, row)
	}
	return out, nil
}

func mapToHrmSummaryRow(item map[string]any) hrmAttendanceSummaryRow {
	row := hrmAttendanceSummaryRow{
		IhrisPID:           firstString(item, "ihris_pid", "ihrisPid", "pid", "employee_pid"),
		CardNumber:         firstString(item, "card_number", "cardNumber", "card_no", "cardNo"),
		Nin:                firstString(item, "nin", "national_id", "nationalId"),
		YearMonth:          normalizeYearMonth(firstString(item, "year_month", "yearMonth", "period")),
		ExternalRef:        firstString(item, "id", "summary_id", "summaryId", "ref"),
		DutyStationPercent: firstFloat(item, "duty_station_percent", "dutyStationPercent", "attendance_percent", "attendancePercent", "percent", "summary_percent"),
	}
	if row.YearMonth == "" {
		year := firstString(item, "year")
		month := firstString(item, "month")
		if year != "" && month != "" {
			row.YearMonth = normalizeYearMonth(year + "-" + month)
		} else if monthLabel := firstString(item, "month_label", "monthLabel", "month_name", "monthName"); monthLabel != "" {
			if t, err := time.Parse("January 2006", monthLabel); err == nil {
				row.YearMonth = t.Format("2006-01")
			} else if t, err := time.Parse("Jan 2006", monthLabel); err == nil {
				row.YearMonth = t.Format("2006-01")
			}
		}
	}
	if staffID := firstUint(item, "staff_id", "staffId", "pms_staff_id"); staffID > 0 {
		row.StaffID = staffID
	}
	if daysPresent := firstIntPtr(item, "days_present", "daysPresent", "present_days", "presentDays"); daysPresent != nil {
		row.DaysPresent = daysPresent
	}
	if daysExpected := firstIntPtr(item, "days_expected", "daysExpected", "expected_days", "expectedDays", "working_days"); daysExpected != nil {
		row.DaysExpected = daysExpected
	}
	if row.DutyStationPercent == 0 {
		if present, expected := row.DaysPresent, row.DaysExpected; present != nil && expected != nil && *expected > 0 {
			row.DutyStationPercent = math.Round(float64(*present)/float64(*expected)*1000) / 10
		}
	}
	return row
}

type staffLookupMaps struct {
	byIhrisPID   map[string]uint
	byCardNumber map[string]uint
	byNin        map[string]uint
	byStaffID    map[uint]uint
}

func (s *HrmAttendService) buildStaffLookup() staffLookupMaps {
	lookup := staffLookupMaps{
		byIhrisPID:   map[string]uint{},
		byCardNumber: map[string]uint{},
		byNin:        map[string]uint{},
		byStaffID:    map[uint]uint{},
	}
	var staff []models.Staff
	_ = facades.Orm().Query().Get(&staff)
	for _, person := range staff {
		lookup.byStaffID[person.ID] = person.ID
		if pid := strings.TrimSpace(person.IhrisPID); pid != "" {
			lookup.byIhrisPID[strings.ToLower(pid)] = person.ID
		}
		if person.CardNumber != nil {
			if card := strings.TrimSpace(*person.CardNumber); card != "" {
				lookup.byCardNumber[strings.ToLower(card)] = person.ID
			}
		}
		if person.Nin != nil {
			if nin := strings.TrimSpace(*person.Nin); nin != "" {
				lookup.byNin[strings.ToLower(nin)] = person.ID
			}
		}
	}
	return lookup
}

func (l staffLookupMaps) match(row hrmAttendanceSummaryRow) (uint, bool) {
	if row.StaffID > 0 {
		if id, ok := l.byStaffID[row.StaffID]; ok {
			return id, true
		}
	}
	if pid := strings.ToLower(strings.TrimSpace(row.IhrisPID)); pid != "" {
		if id, ok := l.byIhrisPID[pid]; ok {
			return id, true
		}
	}
	if card := strings.ToLower(strings.TrimSpace(row.CardNumber)); card != "" {
		if id, ok := l.byCardNumber[card]; ok {
			return id, true
		}
	}
	if nin := strings.ToLower(strings.TrimSpace(row.Nin)); nin != "" {
		if id, ok := l.byNin[nin]; ok {
			return id, true
		}
	}
	return 0, false
}

func (s *HrmAttendService) StaffMonthlyPercent(staffID uint, yearMonth string) (float64, bool) {
	var row models.StaffAttendanceMonthlySummary
	err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("year_month", yearMonth).
		First(&row)
	if err != nil || row.ID == 0 {
		return 0, false
	}
	return row.DutyStationPercent, true
}

func (s *HrmAttendService) AggregatedMonthlySummaries(months int) []HrmAttendSummary {
	if months <= 0 {
		months = 4
	}
	var summaries []models.StaffAttendanceMonthlySummary
	since := time.Now().AddDate(0, -(months-1), 0).Format("2006-01")
	_ = facades.Orm().Query().
		Where("year_month >= ?", since).
		Order("year_month asc").
		Get(&summaries)
	if len(summaries) == 0 {
		return nil
	}

	type bucket struct {
		total float64
		count int
		staff map[uint]bool
	}
	byMonth := map[string]*bucket{}
	for _, row := range summaries {
		b, ok := byMonth[row.YearMonth]
		if !ok {
			b = &bucket{staff: map[uint]bool{}}
			byMonth[row.YearMonth] = b
		}
		b.total += row.DutyStationPercent
		b.count++
		b.staff[row.StaffID] = true
	}

	keys := make([]string, 0, len(byMonth))
	for k := range byMonth {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	out := make([]HrmAttendSummary, 0, len(keys))
	for _, ym := range keys {
		b := byMonth[ym]
		avg := 0.0
		if b.count > 0 {
			avg = math.Round((b.total/float64(b.count))*10) / 10
		}
		t, _ := time.Parse("2006-01", ym)
		label := ym
		if !t.IsZero() {
			label = t.Format("Jan 2006")
		}
		out = append(out, HrmAttendSummary{
			Month:              label,
			DutyStationPercent: avg,
			StaffCount:         len(b.staff),
			Source:             "hrm_attend",
		})
	}
	return out
}

func normalizeYearMonth(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if t, err := time.Parse("2006-01", value); err == nil {
		return t.Format("2006-01")
	}
	if t, err := time.Parse("2006-1", value); err == nil {
		return t.Format("2006-01")
	}
	if t, err := time.Parse("01/2006", value); err == nil {
		return t.Format("2006-01")
	}
	return value
}

func firstString(item map[string]any, keys ...string) string {
	for _, key := range keys {
		if raw, ok := item[key]; ok && raw != nil {
			switch v := raw.(type) {
			case string:
				return strings.TrimSpace(v)
			case float64:
				return strings.TrimSpace(strconv.FormatInt(int64(v), 10))
			case json.Number:
				return strings.TrimSpace(v.String())
			}
		}
	}
	return ""
}

func firstFloat(item map[string]any, keys ...string) float64 {
	for _, key := range keys {
		if raw, ok := item[key]; ok && raw != nil {
			switch v := raw.(type) {
			case float64:
				return v
			case string:
				if f, err := strconv.ParseFloat(strings.TrimSpace(v), 64); err == nil {
					return f
				}
			case json.Number:
				if f, err := v.Float64(); err == nil {
					return f
				}
			}
		}
	}
	return 0
}

func firstUint(item map[string]any, keys ...string) uint {
	for _, key := range keys {
		if raw, ok := item[key]; ok && raw != nil {
			switch v := raw.(type) {
			case float64:
				return uint(v)
			case string:
				if n, err := strconv.ParseUint(strings.TrimSpace(v), 10, 64); err == nil {
					return uint(n)
				}
			case json.Number:
				if n, err := v.Int64(); err == nil && n > 0 {
					return uint(n)
				}
			}
		}
	}
	return 0
}

func firstIntPtr(item map[string]any, keys ...string) *int {
	for _, key := range keys {
		if raw, ok := item[key]; ok && raw != nil {
			switch v := raw.(type) {
			case float64:
				n := int(v)
				return &n
			case string:
				if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil {
					return &n
				}
			case json.Number:
				if n, err := v.Int64(); err == nil {
					i := int(n)
					return &i
				}
			}
		}
	}
	return nil
}

func truncateBody(body []byte, max int) string {
	text := strings.TrimSpace(string(body))
	if len(text) <= max {
		return text
	}
	return text[:max] + "…"
}
