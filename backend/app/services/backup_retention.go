package services

import (
	"fmt"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

const BackupFilenamePattern = `^moh_pms_(postgres|mysql)_(\d{4}-\d{2}-\d{2})\.sql\.gz$`

var backupFilenameRE = regexp.MustCompile(BackupFilenamePattern)

type ParsedBackupName struct {
	Filename string
	Engine   string // postgres | mysql
	Date     time.Time
}

func ParseBackupFilename(name string) (ParsedBackupName, error) {
	base := filepath.Base(name)
	if err := ValidateBackupBasename(base); err != nil {
		return ParsedBackupName{}, err
	}
	m := backupFilenameRE.FindStringSubmatch(base)
	if m == nil {
		return ParsedBackupName{}, fmt.Errorf("invalid backup filename")
	}
	day, err := time.ParseInLocation("2006-01-02", m[2], time.UTC)
	if err != nil {
		return ParsedBackupName{}, fmt.Errorf("invalid backup date")
	}
	return ParsedBackupName{
		Filename: base,
		Engine:   m[1],
		Date:     day,
	}, nil
}

func ValidateBackupBasename(name string) error {
	if name == "" || name != filepath.Base(name) {
		return fmt.Errorf("invalid backup path")
	}
	if strings.Contains(name, "..") || strings.ContainsAny(name, `/\`) {
		return fmt.Errorf("invalid backup path")
	}
	if !backupFilenameRE.MatchString(name) {
		return fmt.Errorf("invalid backup filename")
	}
	return nil
}

func BuildBackupFilename(engine string, day time.Time) string {
	engine = strings.ToLower(strings.TrimSpace(engine))
	if engine != "postgres" && engine != "mysql" {
		engine = "postgres"
	}
	return fmt.Sprintf("moh_pms_%s_%s.sql.gz", engine, day.UTC().Format("2006-01-02"))
}

// ApplyRetention keeps all files in the current calendar month and only the
// latest-dated file for each past month.
func ApplyRetention(files []ParsedBackupName, now time.Time) (keep []string, drop []string) {
	now = now.UTC()
	curYear, curMonth, _ := now.Date()

	byMonth := map[string][]ParsedBackupName{}
	for _, f := range files {
		key := f.Date.UTC().Format("2006-01")
		byMonth[key] = append(byMonth[key], f)
	}

	keepSet := map[string]struct{}{}
	for monthKey, group := range byMonth {
		sort.Slice(group, func(i, j int) bool {
			if !group[i].Date.Equal(group[j].Date) {
				return group[i].Date.Before(group[j].Date)
			}
			return group[i].Filename < group[j].Filename
		})
		y := group[0].Date.UTC().Year()
		m := group[0].Date.UTC().Month()
		if y == curYear && m == curMonth {
			for _, f := range group {
				keepSet[f.Filename] = struct{}{}
			}
			continue
		}
		latest := group[len(group)-1]
		keepSet[latest.Filename] = struct{}{}
		_ = monthKey
	}

	for _, f := range files {
		if _, ok := keepSet[f.Filename]; ok {
			keep = append(keep, f.Filename)
		} else {
			drop = append(drop, f.Filename)
		}
	}
	sort.Strings(keep)
	sort.Strings(drop)
	return keep, drop
}
