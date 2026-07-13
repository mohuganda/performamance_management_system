package services

import (
	"database/sql"
	"fmt"
	"sync"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"goravel/app/facades"
)

// AnalyticsStore is an optional Apache Doris connection (MySQL protocol) for OLAP reads.
// When disabled or unreachable, callers fall back to MySQL via Goravel ORM.
type AnalyticsStore struct {
	mu sync.Mutex
	db *sql.DB
}

var (
	analyticsStore     *AnalyticsStore
	analyticsStoreOnce sync.Once
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
	db, err := s.DB()
	if err != nil {
		status["message"] = err.Error()
		return status
	}
	if err := db.Ping(); err != nil {
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

func (s *AnalyticsStore) DB() (*sql.DB, error) {
	if !AnalyticsEnabled() {
		return nil, fmt.Errorf("analytics store is disabled")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.db != nil {
		return s.db, nil
	}

	host := analyticsHost()
	port := analyticsPort()
	database := facades.Config().GetString("pms.analytics.database", "moh_pms_analytics")
	user := analyticsUser()
	pass := analyticsPassword()

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&interpolateParams=true",
		user, pass, host, port, database,
	)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("doris ping failed: %w", err)
	}

	s.db = db
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
		return &sql.Row{}
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
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true",
		analyticsUser(), analyticsPassword(), analyticsHost(), analyticsPort(), database,
	)
}

func openDorisAdmin(dsn string) (*sql.DB, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}
