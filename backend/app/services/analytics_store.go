package services

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"goravel/app/facades"
)

// AnalyticsStore is an optional Apache Doris connection (MySQL protocol) for OLAP reads.
// When disabled or unreachable, callers fall back to MySQL via Goravel ORM.
// Unreachable hosts fail fast (short dial timeout) and are cached briefly so
// dashboards do not hang when Doris is not running.
type AnalyticsStore struct {
	mu               sync.Mutex
	db               *sql.DB
	unavailableUntil time.Time
	lastError        string
}

var (
	analyticsStore     *AnalyticsStore
	analyticsStoreOnce sync.Once
)

const (
	analyticsDialTimeout  = 2 * time.Second
	analyticsPingTimeout  = 2 * time.Second
	analyticsReadTimeout  = 5 * time.Second
	analyticsWriteTimeout = 5 * time.Second
	analyticsFailBackoff  = 60 * time.Second
)

func NewAnalyticsStore() *AnalyticsStore {
	analyticsStoreOnce.Do(func() {
		analyticsStore = &AnalyticsStore{}
	})
	return analyticsStore
}

func AnalyticsEnabled() bool {
	return facades.Config().GetBool("pms.analytics.enabled", true)
}

func (s *AnalyticsStore) Status() map[string]any {
	status := map[string]any{
		"enabled":   AnalyticsEnabled(),
		"connected": false,
		"engine":    "apache_doris",
		"database":  facades.Config().GetString("pms.analytics.database", "moh_pms_analytics"),
	}
	if !AnalyticsEnabled() {
		status["message"] = "Analytics OLAP is disabled (set ANALYTICS_DB_ENABLED=true to enable; enabled by default)"
		return status
	}

	s.mu.Lock()
	if time.Now().Before(s.unavailableUntil) {
		msg := s.lastError
		s.mu.Unlock()
		if msg == "" {
			msg = "Doris temporarily marked unreachable (retry shortly)"
		}
		status["message"] = msg
		return status
	}
	s.mu.Unlock()

	db, err := s.DB()
	if err != nil {
		status["message"] = err.Error()
		return status
	}
	ctx, cancel := context.WithTimeout(context.Background(), analyticsPingTimeout)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		s.markUnavailable(err)
		status["message"] = err.Error()
		return status
	}
	status["connected"] = true
	status["message"] = "Apache Doris analytics store is reachable"
	if syncedAt := NewSettingsService().GetString("analytics.last_sync_at", ""); syncedAt != "" {
		status["last_sync_at"] = syncedAt
	}
	return status
}

func (s *AnalyticsStore) Available() bool {
	if !AnalyticsEnabled() {
		return false
	}
	s.mu.Lock()
	if time.Now().Before(s.unavailableUntil) {
		s.mu.Unlock()
		return false
	}
	s.mu.Unlock()

	db, err := s.DB()
	if err != nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), analyticsPingTimeout)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		s.markUnavailable(err)
		return false
	}
	return true
}

func (s *AnalyticsStore) DB() (*sql.DB, error) {
	if !AnalyticsEnabled() {
		return nil, fmt.Errorf("analytics store is disabled")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if time.Now().Before(s.unavailableUntil) {
		if s.lastError != "" {
			return nil, fmt.Errorf("%s", s.lastError)
		}
		return nil, fmt.Errorf("doris temporarily marked unreachable")
	}

	if s.db != nil {
		return s.db, nil
	}

	host := analyticsHost()
	port := analyticsPort()
	database := facades.Config().GetString("pms.analytics.database", "moh_pms_analytics")
	user := analyticsUser()
	pass := analyticsPassword()

	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?parseTime=true&interpolateParams=true&timeout=%s&readTimeout=%s&writeTimeout=%s",
		user,
		pass,
		host,
		port,
		database,
		formatDuration(analyticsDialTimeout),
		formatDuration(analyticsReadTimeout),
		formatDuration(analyticsWriteTimeout),
	)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		s.recordUnavailableLocked(err)
		return nil, err
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(15 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), analyticsPingTimeout)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		s.recordUnavailableLocked(err)
		return nil, fmt.Errorf("doris ping failed: %w", err)
	}

	s.db = db
	s.unavailableUntil = time.Time{}
	s.lastError = ""
	return s.db, nil
}

func (s *AnalyticsStore) Exec(query string, args ...any) error {
	db, err := s.DB()
	if err != nil {
		return err
	}
	_, err = db.Exec(query, args...)
	return err
}

func (s *AnalyticsStore) Query(query string, args ...any) (*sql.Rows, error) {
	db, err := s.DB()
	if err != nil {
		return nil, err
	}
	return db.Query(query, args...)
}

func (s *AnalyticsStore) QueryRow(query string, args ...any) *sql.Row {
	db, err := s.DB()
	if err != nil {
		return nil
	}
	return db.QueryRow(query, args...)
}

func (s *AnalyticsStore) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.db != nil {
		_ = s.db.Close()
		s.db = nil
	}
}

func (s *AnalyticsStore) markUnavailable(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.recordUnavailableLocked(err)
}

func (s *AnalyticsStore) recordUnavailableLocked(err error) {
	if s.db != nil {
		_ = s.db.Close()
		s.db = nil
	}
	s.unavailableUntil = time.Now().Add(analyticsFailBackoff)
	if err != nil {
		s.lastError = fmt.Sprintf(
			"Doris unreachable at %s:%s (%v); using MySQL until %s",
			analyticsHost(),
			analyticsPort(),
			err,
			s.unavailableUntil.Format(time.RFC3339),
		)
	} else {
		s.lastError = "Doris temporarily marked unreachable"
	}
}

func analyticsHost() string {
	return facades.Config().GetString("pms.analytics.host", "127.0.0.1")
}

func analyticsPort() string {
	return facades.Config().GetString("pms.analytics.port", "9030")
}

func analyticsUser() string {
	return facades.Config().GetString("pms.analytics.username", "root")
}

func analyticsPassword() string {
	return facades.Config().GetString("pms.analytics.password", "")
}

func adminDSN(database string) string {
	return fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?parseTime=true&timeout=%s&readTimeout=%s&writeTimeout=%s",
		analyticsUser(),
		analyticsPassword(),
		analyticsHost(),
		analyticsPort(),
		database,
		formatDuration(analyticsDialTimeout),
		formatDuration(analyticsReadTimeout),
		formatDuration(analyticsWriteTimeout),
	)
}

func openDorisAdmin(dsn string) (*sql.DB, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), analyticsPingTimeout)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

func formatDuration(d time.Duration) string {
	if d < time.Second {
		return fmt.Sprintf("%dms", d.Milliseconds())
	}
	return fmt.Sprintf("%ds", int(d.Seconds()))
}
