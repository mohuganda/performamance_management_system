package services

import (
	"strings"
	"time"
)

// DorisAnalyticsService runs OLAP-friendly SQL on Apache Doris when available.
type DorisAnalyticsService struct {
	store *AnalyticsStore
}

func NewDorisAnalyticsService() *DorisAnalyticsService {
	return &DorisAnalyticsService{store: NewAnalyticsStore()}
}

func (s *DorisAnalyticsService) Available() bool {
	if !AnalyticsEnabled() {
		return false
	}
	status := s.store.Status()
	connected, _ := status["connected"].(bool)
	return connected
}

// OosRatesByDistrict returns verified clock-in rates grouped by district (last N months).
func (s *DorisAnalyticsService) OosRatesByDistrict(since time.Time) (map[string]float64, error) {
	rows, err := s.store.Query(`
		SELECT UPPER(TRIM(sc.district_name)) AS district,
		       COUNT(*) AS total,
		       SUM(CASE WHEN ac.verification_status IN ('verified_oos', 'at_duty_station') THEN 1 ELSE 0 END) AS verified
		FROM attendance_clocks ac
		INNER JOIN staff_contracts sc ON sc.staff_id = ac.staff_id AND sc.contract_status = 'active'
		WHERE ac.clocked_at >= ?
		  AND sc.district_name IS NOT NULL
		  AND TRIM(sc.district_name) <> ''
		GROUP BY UPPER(TRIM(sc.district_name))
	`, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]float64{}
	for rows.Next() {
		var district string
		var total, verified int64
		if err := rows.Scan(&district, &total, &verified); err != nil {
			return nil, err
		}
		if total == 0 {
			continue
		}
		out[strings.ToUpper(strings.TrimSpace(district))] = float64(verified) / float64(total) * 100
	}
	return out, rows.Err()
}

// NationalOosRate returns verified rate for clocks since the given time.
func (s *DorisAnalyticsService) NationalOosRate(since time.Time) (float64, int64, error) {
	var total, verified int64
	err := s.store.QueryRow(`
		SELECT COUNT(*) AS total,
		       SUM(CASE WHEN verification_status IN ('verified_oos', 'at_duty_station') THEN 1 ELSE 0 END) AS verified
		FROM attendance_clocks
		WHERE clocked_at >= ?
	`, since).Scan(&total, &verified)
	if err != nil {
		return 0, 0, err
	}
	if total == 0 {
		return 0, 0, nil
	}
	return float64(verified) / float64(total) * 100, total, nil
}

// AttendanceMonthlyTrends aggregates HRM monthly summaries from Doris.
func (s *DorisAnalyticsService) AttendanceMonthlyTrends(months int) ([]HrmAttendSummary, error) {
	if months <= 0 {
		months = 4
	}
	rows, err := s.store.Query(`
		SELECT year_month,
		       ROUND(AVG(duty_station_percent), 1) AS duty_station_percent,
		       COUNT(*) AS staff_count
		FROM staff_attendance_monthly_summaries
		GROUP BY year_month
		ORDER BY year_month DESC
		LIMIT ?
	`, months)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]HrmAttendSummary, 0, months)
	for rows.Next() {
		var row HrmAttendSummary
		if err := rows.Scan(&row.Month, &row.DutyStationPercent, &row.StaffCount); err != nil {
			return nil, err
		}
		row.Source = "doris"
		out = append(out, row)
	}
	// Doris returns DESC; reverse to chronological ASC for charts
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out, rows.Err()
}

// MonthlyOosRates returns verified clock-in rates grouped by YYYY-MM month.
func (s *DorisAnalyticsService) MonthlyOosRates(months int) (map[string]float64, error) {
	if months <= 0 {
		months = 4
	}
	rows, err := s.store.Query(`
		SELECT DATE_FORMAT(clocked_at, '%Y-%m') AS ym,
		       SUM(CASE WHEN verification_status IN ('verified_oos', 'at_duty_station') THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS rate
		FROM attendance_clocks
		GROUP BY DATE_FORMAT(clocked_at, '%Y-%m')
		ORDER BY ym DESC
		LIMIT ?
	`, months)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]float64{}
	for rows.Next() {
		var month string
		var rate float64
		if err := rows.Scan(&month, &rate); err != nil {
			return nil, err
		}
		out[strings.TrimSpace(month)] = rate
	}
	return out, rows.Err()
}
