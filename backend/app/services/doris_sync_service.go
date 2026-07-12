package services

import (
	"fmt"
	"strings"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type DorisSyncService struct {
	store *AnalyticsStore
}

func NewDorisSyncService() *DorisSyncService {
	return &DorisSyncService{store: NewAnalyticsStore()}
}

type DorisSyncResult struct {
	Tables    map[string]int `json:"tables"`
	StartedAt time.Time      `json:"started_at"`
	FinishedAt time.Time     `json:"finished_at"`
	Message   string         `json:"message"`
}

func (s *DorisSyncService) SyncFromOLTP() (DorisSyncResult, error) {
	result := DorisSyncResult{
		Tables:    map[string]int{},
		StartedAt: time.Now(),
	}
	if !AnalyticsEnabled() {
		return result, fmt.Errorf("analytics store is disabled")
	}
	if err := s.EnsureSchema(); err != nil {
		return result, err
	}

	tables := []struct {
		name string
		fn   func() (int, error)
	}{
		{"attendance_clocks", s.syncAttendanceClocks},
		{"staff_attendance_monthly_summaries", s.syncAttendanceSummaries},
		{"staff_contracts", s.syncStaffContracts},
		{"staff", s.syncStaff},
		{"leave_requests", s.syncLeaveRequests},
		{"leave_balances", s.syncLeaveBalances},
	}

	for _, table := range tables {
		count, err := table.fn()
		if err != nil {
			return result, fmt.Errorf("sync %s: %w", table.name, err)
		}
		result.Tables[table.name] = count
	}

	result.FinishedAt = time.Now()
	result.Message = "OLTP data replicated to Apache Doris"
	_ = NewSettingsService().Set("analytics.last_sync_at", "analytics", result.FinishedAt.Format(time.RFC3339), false)
	return result, nil
}

func (s *DorisSyncService) EnsureSchema() error {
	dbName := facades.Config().GetString("pms.analytics.database", "moh_pms_analytics")
	rootDSN := adminDSN("")
	adminDB, err := openDorisAdmin(rootDSN)
	if err != nil {
		return err
	}
	defer adminDB.Close()
	if _, err := adminDB.Exec(fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s`", dbName)); err != nil {
		return fmt.Errorf("create analytics database: %w", err)
	}

	ddl := []string{
		`CREATE TABLE IF NOT EXISTS attendance_clocks (
			id BIGINT,
			staff_id BIGINT,
			clock_date DATE,
			clocked_at DATETIME,
			verification_status VARCHAR(64),
			synced_at DATETIME
		) DUPLICATE KEY(id)
		DISTRIBUTED BY HASH(staff_id) BUCKETS 8
		PROPERTIES("replication_num" = "1")`,
		`CREATE TABLE IF NOT EXISTS staff_attendance_monthly_summaries (
			id BIGINT,
			staff_id BIGINT,
			year_month VARCHAR(16),
			duty_station_percent DOUBLE,
			days_present INT,
			days_expected INT,
			source VARCHAR(64),
			synced_at DATETIME
		) DUPLICATE KEY(id)
		DISTRIBUTED BY HASH(staff_id) BUCKETS 8
		PROPERTIES("replication_num" = "1")`,
		`CREATE TABLE IF NOT EXISTS staff_contracts (
			id BIGINT,
			staff_id BIGINT,
			facility_id BIGINT,
			department_id BIGINT,
			district_id VARCHAR(64),
			district_name VARCHAR(255),
			contract_status VARCHAR(32),
			synced_at DATETIME
		) DUPLICATE KEY(id)
		DISTRIBUTED BY HASH(staff_id) BUCKETS 8
		PROPERTIES("replication_num" = "1")`,
		`CREATE TABLE IF NOT EXISTS staff (
			id BIGINT,
			ihris_pid VARCHAR(128),
			surname VARCHAR(255),
			firstname VARCHAR(255),
			email VARCHAR(255),
			cadre VARCHAR(255),
			region VARCHAR(255),
			synced_at DATETIME
		) DUPLICATE KEY(id)
		DISTRIBUTED BY HASH(id) BUCKETS 8
		PROPERTIES("replication_num" = "1")`,
		`CREATE TABLE IF NOT EXISTS leave_requests (
			id BIGINT,
			staff_id BIGINT,
			leave_type_id BIGINT,
			start_date DATE,
			end_date DATE,
			days_requested INT,
			status VARCHAR(32),
			approval_stage VARCHAR(64),
			synced_at DATETIME
		) DUPLICATE KEY(id)
		DISTRIBUTED BY HASH(staff_id) BUCKETS 8
		PROPERTIES("replication_num" = "1")`,
		`CREATE TABLE IF NOT EXISTS leave_balances (
			id BIGINT,
			staff_id BIGINT,
			leave_type_id BIGINT,
			calendar_year INT,
			entitled_days INT,
			used_days INT,
			carried_over_days INT,
			synced_at DATETIME
		) DUPLICATE KEY(id)
		DISTRIBUTED BY HASH(staff_id) BUCKETS 8
		PROPERTIES("replication_num" = "1")`,
	}

	for _, stmt := range ddl {
		if err := s.store.Exec(stmt); err != nil {
			return fmt.Errorf("doris ddl: %w", err)
		}
	}
	return nil
}

func (s *DorisSyncService) syncAttendanceClocks() (int, error) {
	if err := s.store.Exec("TRUNCATE TABLE attendance_clocks"); err != nil {
		return 0, err
	}
	var rows []models.AttendanceClock
	if err := facades.Orm().Query().Order("id asc").Get(&rows); err != nil {
		return 0, err
	}
	now := time.Now()
	for _, chunk := range chunkSlice(rows, 500) {
		if err := s.bulkInsertAttendanceClocks(chunk, now); err != nil {
			return 0, err
		}
	}
	return len(rows), nil
}

func (s *DorisSyncService) bulkInsertAttendanceClocks(rows []models.AttendanceClock, syncedAt time.Time) error {
	if len(rows) == 0 {
		return nil
	}
	var b strings.Builder
	b.WriteString("INSERT INTO attendance_clocks (id, staff_id, clock_date, clocked_at, verification_status, synced_at) VALUES ")
	args := make([]any, 0, len(rows)*6)
	for i, row := range rows {
		if i > 0 {
			b.WriteString(",")
		}
		b.WriteString("(?,?,?,?,?,?)")
		args = append(args, row.ID, row.StaffID, row.ClockDate, row.ClockedAt, row.VerificationStatus, syncedAt)
	}
	return s.store.Exec(b.String(), args...)
}

func (s *DorisSyncService) syncAttendanceSummaries() (int, error) {
	if err := s.store.Exec("TRUNCATE TABLE staff_attendance_monthly_summaries"); err != nil {
		return 0, err
	}
	var rows []models.StaffAttendanceMonthlySummary
	if err := facades.Orm().Query().Order("id asc").Get(&rows); err != nil {
		return 0, err
	}
	now := time.Now()
	for _, chunk := range chunkSlice(rows, 500) {
		if err := s.bulkInsertSummaries(chunk, now); err != nil {
			return 0, err
		}
	}
	return len(rows), nil
}

func (s *DorisSyncService) bulkInsertSummaries(rows []models.StaffAttendanceMonthlySummary, syncedAt time.Time) error {
	if len(rows) == 0 {
		return nil
	}
	var b strings.Builder
	b.WriteString("INSERT INTO staff_attendance_monthly_summaries (id, staff_id, year_month, duty_station_percent, days_present, days_expected, source, synced_at) VALUES ")
	args := make([]any, 0, len(rows)*8)
	for i, row := range rows {
		if i > 0 {
			b.WriteString(",")
		}
		b.WriteString("(?,?,?,?,?,?,?,?)")
		args = append(args, row.ID, row.StaffID, row.YearMonth, row.DutyStationPercent, derefInt(row.DaysPresent), derefInt(row.DaysExpected), row.Source, syncedAt)
	}
	return s.store.Exec(b.String(), args...)
}

func (s *DorisSyncService) syncStaffContracts() (int, error) {
	if err := s.store.Exec("TRUNCATE TABLE staff_contracts"); err != nil {
		return 0, err
	}
	var rows []models.StaffContract
	if err := facades.Orm().Query().Order("id asc").Get(&rows); err != nil {
		return 0, err
	}
	now := time.Now()
	for _, chunk := range chunkSlice(rows, 500) {
		if err := s.bulkInsertContracts(chunk, now); err != nil {
			return 0, err
		}
	}
	return len(rows), nil
}

func (s *DorisSyncService) bulkInsertContracts(rows []models.StaffContract, syncedAt time.Time) error {
	if len(rows) == 0 {
		return nil
	}
	var b strings.Builder
	b.WriteString("INSERT INTO staff_contracts (id, staff_id, facility_id, department_id, district_id, district_name, contract_status, synced_at) VALUES ")
	args := make([]any, 0, len(rows)*8)
	for i, row := range rows {
		if i > 0 {
			b.WriteString(",")
		}
		b.WriteString("(?,?,?,?,?,?,?,?)")
		args = append(args, row.ID, row.StaffID, row.FacilityID, derefUint64(row.DepartmentID), deref(row.DistrictID), deref(row.DistrictName), row.ContractStatus, syncedAt)
	}
	return s.store.Exec(b.String(), args...)
}

func (s *DorisSyncService) syncStaff() (int, error) {
	if err := s.store.Exec("TRUNCATE TABLE staff"); err != nil {
		return 0, err
	}
	var rows []models.Staff
	if err := facades.Orm().Query().Order("id asc").Get(&rows); err != nil {
		return 0, err
	}
	now := time.Now()
	for _, chunk := range chunkSlice(rows, 500) {
		if err := s.bulkInsertStaff(chunk, now); err != nil {
			return 0, err
		}
	}
	return len(rows), nil
}

func (s *DorisSyncService) bulkInsertStaff(rows []models.Staff, syncedAt time.Time) error {
	if len(rows) == 0 {
		return nil
	}
	var b strings.Builder
	b.WriteString("INSERT INTO staff (id, ihris_pid, surname, firstname, email, cadre, region, synced_at) VALUES ")
	args := make([]any, 0, len(rows)*8)
	for i, row := range rows {
		if i > 0 {
			b.WriteString(",")
		}
		b.WriteString("(?,?,?,?,?,?,?,?)")
		args = append(args, row.ID, row.IhrisPID, row.Surname, row.Firstname, deref(row.Email), deref(row.Cadre), deref(row.Region), syncedAt)
	}
	return s.store.Exec(b.String(), args...)
}

func (s *DorisSyncService) syncLeaveRequests() (int, error) {
	if err := s.store.Exec("TRUNCATE TABLE leave_requests"); err != nil {
		return 0, err
	}
	var rows []models.LeaveRequest
	if err := facades.Orm().Query().Order("id asc").Get(&rows); err != nil {
		return 0, err
	}
	now := time.Now()
	for _, chunk := range chunkSlice(rows, 500) {
		if err := s.bulkInsertLeaveRequests(chunk, now); err != nil {
			return 0, err
		}
	}
	return len(rows), nil
}

func (s *DorisSyncService) bulkInsertLeaveRequests(rows []models.LeaveRequest, syncedAt time.Time) error {
	if len(rows) == 0 {
		return nil
	}
	var b strings.Builder
	b.WriteString("INSERT INTO leave_requests (id, staff_id, leave_type_id, start_date, end_date, days_requested, status, approval_stage, synced_at) VALUES ")
	args := make([]any, 0, len(rows)*9)
	for i, row := range rows {
		if i > 0 {
			b.WriteString(",")
		}
		b.WriteString("(?,?,?,?,?,?,?,?,?)")
		args = append(args, row.ID, row.StaffID, row.LeaveTypeID, row.StartDate, row.EndDate, row.DaysRequested, row.Status, row.ApprovalStage, syncedAt)
	}
	return s.store.Exec(b.String(), args...)
}

func (s *DorisSyncService) syncLeaveBalances() (int, error) {
	if err := s.store.Exec("TRUNCATE TABLE leave_balances"); err != nil {
		return 0, err
	}
	var rows []models.LeaveBalance
	if err := facades.Orm().Query().Order("id asc").Get(&rows); err != nil {
		return 0, err
	}
	now := time.Now()
	for _, chunk := range chunkSlice(rows, 500) {
		if err := s.bulkInsertLeaveBalances(chunk, now); err != nil {
			return 0, err
		}
	}
	return len(rows), nil
}

func (s *DorisSyncService) bulkInsertLeaveBalances(rows []models.LeaveBalance, syncedAt time.Time) error {
	if len(rows) == 0 {
		return nil
	}
	var b strings.Builder
	b.WriteString("INSERT INTO leave_balances (id, staff_id, leave_type_id, calendar_year, entitled_days, used_days, carried_over_days, synced_at) VALUES ")
	args := make([]any, 0, len(rows)*8)
	for i, row := range rows {
		if i > 0 {
			b.WriteString(",")
		}
		b.WriteString("(?,?,?,?,?,?,?,?)")
		args = append(args, row.ID, row.StaffID, row.LeaveTypeID, row.CalendarYear, row.EntitledDays, row.UsedDays, row.CarriedOverDays, syncedAt)
	}
	return s.store.Exec(b.String(), args...)
}

func chunkSlice[T any](items []T, size int) [][]T {
	if size <= 0 {
		size = 500
	}
	var chunks [][]T
	for i := 0; i < len(items); i += size {
		end := i + size
		if end > len(items) {
			end = len(items)
		}
		chunks = append(chunks, items[i:end])
	}
	return chunks
}

func derefUint64(v *uint) uint64 {
	if v == nil {
		return 0
	}
	return uint64(*v)
}

func derefInt(v *int) int {
	if v == nil {
		return 0
	}
	return *v
}
