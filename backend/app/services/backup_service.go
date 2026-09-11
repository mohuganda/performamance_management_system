package services

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	restoreTestDBName     = "moh_pms_restore_test"
	restoreTestWindow     = 24 * time.Hour
	backupStatusFileName  = ".backup-status.json"
	restoreStateFileName  = ".restore-state.json"
	backupLockFileName    = ".backup.lock"
)

type BackupFileInfo struct {
	Filename    string `json:"filename"`
	Engine      string `json:"engine"`
	Date        string `json:"date"`
	SizeBytes   int64  `json:"size_bytes"`
	TestedAt    string `json:"tested_at,omitempty"`
	TestOK      *bool  `json:"test_ok,omitempty"`
	TestMessage string `json:"test_message,omitempty"`
	CanRestore  bool   `json:"can_restore"`
}

type BackupStatus struct {
	Directory      string `json:"directory"`
	PrimaryEngine  string `json:"primary_engine"`
	DockerExec     bool   `json:"docker_exec"`
	LastRunAt      string `json:"last_run_at,omitempty"`
	LastRunMessage string `json:"last_run_message,omitempty"`
}

type restoreStateEntry struct {
	TestedAt string `json:"tested_at"`
	OK       bool   `json:"ok"`
	Message  string `json:"message"`
	Engine   string `json:"engine"`
}

type backupStatusFile struct {
	LastRunAt      string `json:"last_run_at"`
	LastRunMessage string `json:"last_run_message"`
}

type BackupService struct {
	mu sync.Mutex
}

func NewBackupService() *BackupService {
	return &BackupService{}
}

func (s *BackupService) Directory() string {
	dir := strings.TrimSpace(os.Getenv("DB_BACKUP_DIR"))
	if dir == "" {
		dir = "/var/lib/moh-pms/db-backups"
	}
	return dir
}

func (s *BackupService) PrimaryEngine() string {
	return loadBackupDBConfig().Engine
}

func RequireRestoreConfirm(confirm string) error {
	if strings.TrimSpace(confirm) != "RESTORE" {
		return fmt.Errorf(`confirmation must be exactly "RESTORE"`)
	}
	return nil
}

func CanProductionRestore(primaryEngine string, info BackupFileInfo, now time.Time, window time.Duration) error {
	if info.Engine != primaryEngine {
		return fmt.Errorf("backup engine %s does not match primary %s", info.Engine, primaryEngine)
	}
	if info.TestOK == nil || !*info.TestOK {
		return fmt.Errorf("backup has not passed a successful test restore")
	}
	if info.TestedAt == "" {
		return fmt.Errorf("backup test timestamp missing")
	}
	tested, err := time.Parse(time.RFC3339, info.TestedAt)
	if err != nil {
		return fmt.Errorf("invalid test timestamp")
	}
	if now.Sub(tested) > window || tested.After(now.Add(time.Minute)) {
		return fmt.Errorf("successful test restore must be within the last %s", window)
	}
	return nil
}

func (s *BackupService) ensureDir() error {
	return os.MkdirAll(s.Directory(), 0o755)
}

func (s *BackupService) Status() (BackupStatus, error) {
	_ = s.ensureDir()
	st := BackupStatus{
		Directory:     s.Directory(),
		PrimaryEngine: s.PrimaryEngine(),
		DockerExec:    backupUseDockerExec(),
	}
	raw, err := os.ReadFile(filepath.Join(s.Directory(), backupStatusFileName))
	if err == nil {
		var f backupStatusFile
		if json.Unmarshal(raw, &f) == nil {
			st.LastRunAt = f.LastRunAt
			st.LastRunMessage = f.LastRunMessage
		}
	}
	return st, nil
}

func (s *BackupService) writeStatus(msg string) {
	_ = s.ensureDir()
	payload, _ := json.MarshalIndent(backupStatusFile{
		LastRunAt:      time.Now().UTC().Format(time.RFC3339),
		LastRunMessage: msg,
	}, "", "  ")
	_ = os.WriteFile(filepath.Join(s.Directory(), backupStatusFileName), payload, 0o644)
}

func (s *BackupService) loadRestoreState() map[string]restoreStateEntry {
	out := map[string]restoreStateEntry{}
	raw, err := os.ReadFile(filepath.Join(s.Directory(), restoreStateFileName))
	if err != nil {
		return out
	}
	_ = json.Unmarshal(raw, &out)
	return out
}

func (s *BackupService) saveRestoreState(state map[string]restoreStateEntry) error {
	_ = s.ensureDir()
	payload, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.Directory(), restoreStateFileName), payload, 0o644)
}

func (s *BackupService) infoFromFile(name string, size int64, state map[string]restoreStateEntry, now time.Time) (BackupFileInfo, error) {
	parsed, err := ParseBackupFilename(name)
	if err != nil {
		return BackupFileInfo{}, err
	}
	info := BackupFileInfo{
		Filename:  parsed.Filename,
		Engine:    parsed.Engine,
		Date:      parsed.Date.Format("2006-01-02"),
		SizeBytes: size,
	}
	if entry, ok := state[parsed.Filename]; ok {
		info.TestedAt = entry.TestedAt
		ok := entry.OK
		info.TestOK = &ok
		info.TestMessage = entry.Message
	}
	info.CanRestore = CanProductionRestore(s.PrimaryEngine(), info, now, restoreTestWindow) == nil
	return info, nil
}

func (s *BackupService) List() ([]BackupFileInfo, error) {
	if err := s.ensureDir(); err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(s.Directory())
	if err != nil {
		return nil, err
	}
	state := s.loadRestoreState()
	now := time.Now().UTC()
	var rows []BackupFileInfo
	for _, e := range entries {
		if e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		fi, err := e.Info()
		if err != nil {
			continue
		}
		info, err := s.infoFromFile(e.Name(), fi.Size(), state, now)
		if err != nil {
			continue
		}
		rows = append(rows, info)
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Date == rows[j].Date {
			return rows[i].Filename > rows[j].Filename
		}
		return rows[i].Date > rows[j].Date
	})
	return rows, nil
}

func (s *BackupService) withLock(fn func() error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.ensureDir(); err != nil {
		return err
	}
	lockPath := filepath.Join(s.Directory(), backupLockFileName)
	f, err := os.OpenFile(lockPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
	if err != nil {
		if os.IsExist(err) {
			return fmt.Errorf("another backup or restore operation is in progress")
		}
		return err
	}
	_, _ = f.WriteString(time.Now().UTC().Format(time.RFC3339))
	_ = f.Close()
	defer func() { _ = os.Remove(lockPath) }()
	return fn()
}

func (s *BackupService) applyRetentionDeletes() error {
	entries, err := os.ReadDir(s.Directory())
	if err != nil {
		return err
	}
	var parsed []ParsedBackupName
	for _, e := range entries {
		if e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		p, err := ParseBackupFilename(e.Name())
		if err != nil {
			continue
		}
		parsed = append(parsed, p)
	}
	_, drop := ApplyRetention(parsed, time.Now().UTC())
	for _, name := range drop {
		_ = os.Remove(filepath.Join(s.Directory(), name))
	}
	return nil
}

func (s *BackupService) RunBackup() (BackupFileInfo, error) {
	var info BackupFileInfo
	err := s.withLock(func() error {
		engine := s.PrimaryEngine()
		name := BuildBackupFilename(engine, time.Now().UTC())
		dest := filepath.Join(s.Directory(), name)
		if err := dumpPrimaryToGzipFile(dest); err != nil {
			s.writeStatus("backup failed: " + err.Error())
			return err
		}
		if err := s.applyRetentionDeletes(); err != nil {
			s.writeStatus("backup ok; retention error: " + err.Error())
		} else {
			s.writeStatus("backup ok: " + name)
		}
		fi, err := os.Stat(dest)
		if err != nil {
			return err
		}
		state := s.loadRestoreState()
		info, err = s.infoFromFile(name, fi.Size(), state, time.Now().UTC())
		return err
	})
	return info, err
}

func (s *BackupService) Delete(filename string) error {
	if err := ValidateBackupBasename(filename); err != nil {
		return err
	}
	path := filepath.Join(s.Directory(), filename)
	if err := os.Remove(path); err != nil {
		return err
	}
	state := s.loadRestoreState()
	delete(state, filename)
	_ = s.saveRestoreState(state)
	return nil
}

func (s *BackupService) TestRestore(filename string) (BackupFileInfo, error) {
	var info BackupFileInfo
	err := s.withLock(func() error {
		if err := ValidateBackupBasename(filename); err != nil {
			return err
		}
		parsed, err := ParseBackupFilename(filename)
		if err != nil {
			return err
		}
		if parsed.Engine != s.PrimaryEngine() {
			return fmt.Errorf("cannot test restore: backup engine %s is not the primary (%s)", parsed.Engine, s.PrimaryEngine())
		}
		src := filepath.Join(s.Directory(), filename)
		if _, err := os.Stat(src); err != nil {
			return fmt.Errorf("backup file not found")
		}
		_ = dropDatabase(restoreTestDBName)
		if err := createDatabase(restoreTestDBName); err != nil {
			return fmt.Errorf("create test database: %w", err)
		}
		restoreErr := restoreGzipFileToDatabase(src, restoreTestDBName)
		var checkErr error
		if restoreErr == nil {
			checkErr = healthCheckDatabase(restoreTestDBName)
		}
		_ = dropDatabase(restoreTestDBName)

		state := s.loadRestoreState()
		ok := restoreErr == nil && checkErr == nil
		msg := "test restore succeeded"
		if restoreErr != nil {
			msg = restoreErr.Error()
		} else if checkErr != nil {
			msg = checkErr.Error()
		}
		state[filename] = restoreStateEntry{
			TestedAt: time.Now().UTC().Format(time.RFC3339),
			OK:       ok,
			Message:  msg,
			Engine:   parsed.Engine,
		}
		if err := s.saveRestoreState(state); err != nil {
			return err
		}
		fi, _ := os.Stat(src)
		var size int64
		if fi != nil {
			size = fi.Size()
		}
		info, err = s.infoFromFile(filename, size, state, time.Now().UTC())
		if err != nil {
			return err
		}
		if !ok {
			return fmt.Errorf("%s", msg)
		}
		return nil
	})
	return info, err
}

func (s *BackupService) RestoreProduction(filename, confirm string, actorUserID *uint, actorName, actorEmail, ip string) error {
	if err := RequireRestoreConfirm(confirm); err != nil {
		return err
	}
	return s.withLock(func() error {
		if err := ValidateBackupBasename(filename); err != nil {
			return err
		}
		list, err := s.List()
		if err != nil {
			return err
		}
		var info *BackupFileInfo
		for i := range list {
			if list[i].Filename == filename {
				info = &list[i]
				break
			}
		}
		if info == nil {
			return fmt.Errorf("backup file not found")
		}
		if err := CanProductionRestore(s.PrimaryEngine(), *info, time.Now().UTC(), restoreTestWindow); err != nil {
			return err
		}

		// Best-effort fresh dump before overwrite.
		engine := s.PrimaryEngine()
		preName := BuildBackupFilename(engine, time.Now().UTC())
		_ = dumpPrimaryToGzipFile(filepath.Join(s.Directory(), preName))

		cfg := loadBackupDBConfig()
		live := cfg.Database
		src := filepath.Join(s.Directory(), filename)

		if err := recreateLiveDatabase(); err != nil {
			return fmt.Errorf("recreate live database: %w", err)
		}
		if err := restoreGzipFileToDatabase(src, live); err != nil {
			return fmt.Errorf("production restore failed: %w", err)
		}
		if err := healthCheckDatabase(live); err != nil {
			return fmt.Errorf("production restore health check failed: %w", err)
		}

		state := s.loadRestoreState()
		delete(state, filename)
		_ = s.saveRestoreState(state)
		_ = s.applyRetentionDeletes()
		s.writeStatus("production restore applied: " + filename)

		_, _ = NewAuditService().Log(AuditEntry{
			ActorUserID:   actorUserID,
			ActorName:     actorName,
			ActorEmail:    actorEmail,
			Module:        "backups",
			Action:        "restore",
			EntityType:    "backup_file",
			Summary:       "Production database restored from " + filename,
			Metadata:      map[string]any{"filename": filename, "engine": engine},
			IsDangerous:   true,
			IsRecoverable: false,
			IpAddress:     ip,
		})
		return nil
	})
}

func recreateLiveDatabase() error {
	cfg := loadBackupDBConfig()
	name := cfg.Database
	if name == "" || name == restoreTestDBName {
		return fmt.Errorf("invalid live database name")
	}
	if backupUseDockerExec() {
		container := dockerDBContainer(cfg.Engine)
		if cfg.Engine == "mysql" {
			inner := fmt.Sprintf(
				`mysql -u%q -p%q -e %q`,
				cfg.Username, cfg.Password,
				"DROP DATABASE IF EXISTS `"+name+"`; CREATE DATABASE `"+name+"`",
			)
			cmd := exec.Command("docker", "exec", container, "sh", "-c", inner)
			out, err := cmd.CombinedOutput()
			if err != nil {
				return fmt.Errorf("recreate mysql: %w (%s)", err, strings.TrimSpace(string(out)))
			}
			return nil
		}
		inner := fmt.Sprintf(
			`PGPASSWORD=%q psql -U %q -d postgres -v ON_ERROR_STOP=1 -c %q`,
			cfg.Password, cfg.Username,
			"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '"+name+"' AND pid <> pg_backend_pid(); DROP DATABASE IF EXISTS "+name+"; CREATE DATABASE "+name,
		)
		cmd := exec.Command("docker", "exec", container, "sh", "-c", inner)
		out, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("recreate postgres: %w (%s)", err, strings.TrimSpace(string(out)))
		}
		return nil
	}
	if cfg.Engine == "mysql" {
		cmd := exec.Command("mysql", "-h", cfg.Host, "-P", cfg.Port, "-u", cfg.Username, "-e",
			"DROP DATABASE IF EXISTS `"+name+"`; CREATE DATABASE `"+name+"`")
		cmd.Env = append(os.Environ(), "MYSQL_PWD="+cfg.Password)
		out, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("recreate mysql: %w (%s)", err, strings.TrimSpace(string(out)))
		}
		return nil
	}
	term := exec.Command("psql", "-h", cfg.Host, "-p", cfg.Port, "-U", cfg.Username, "-d", "postgres", "-c",
		"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '"+name+"' AND pid <> pg_backend_pid()")
	term.Env = append(os.Environ(), "PGPASSWORD="+cfg.Password)
	_ = term.Run()
	drop := exec.Command("psql", "-h", cfg.Host, "-p", cfg.Port, "-U", cfg.Username, "-d", "postgres", "-c",
		"DROP DATABASE IF EXISTS "+name)
	drop.Env = append(os.Environ(), "PGPASSWORD="+cfg.Password)
	if out, err := drop.CombinedOutput(); err != nil {
		return fmt.Errorf("drop live db: %w (%s)", err, strings.TrimSpace(string(out)))
	}
	create := exec.Command("psql", "-h", cfg.Host, "-p", cfg.Port, "-U", cfg.Username, "-d", "postgres", "-c",
		"CREATE DATABASE "+name)
	create.Env = append(os.Environ(), "PGPASSWORD="+cfg.Password)
	if out, err := create.CombinedOutput(); err != nil {
		return fmt.Errorf("create live db: %w (%s)", err, strings.TrimSpace(string(out)))
	}
	return nil
}
