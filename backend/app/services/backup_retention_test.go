package services

import (
	"testing"
	"time"
)

func TestParseBackupFilename(t *testing.T) {
	p, err := ParseBackupFilename("moh_pms_postgres_2026-09-11.sql.gz")
	if err != nil {
		t.Fatal(err)
	}
	if p.Engine != "postgres" {
		t.Fatalf("engine=%s", p.Engine)
	}
	if p.Date.Format("2006-01-02") != "2026-09-11" {
		t.Fatalf("date=%s", p.Date)
	}

	if _, err := ParseBackupFilename("../etc/passwd"); err == nil {
		t.Fatal("expected error for path traversal")
	}
	if _, err := ParseBackupFilename("moh_pms_sqlite_2026-09-11.sql.gz"); err == nil {
		t.Fatal("expected error for bad engine")
	}
}

func TestApplyRetention(t *testing.T) {
	now := time.Date(2026, 9, 15, 12, 0, 0, 0, time.UTC)
	names := []string{
		"moh_pms_postgres_2026-09-01.sql.gz",
		"moh_pms_postgres_2026-09-02.sql.gz",
		"moh_pms_postgres_2026-09-15.sql.gz",
		"moh_pms_postgres_2026-08-10.sql.gz",
		"moh_pms_postgres_2026-08-31.sql.gz",
		"moh_pms_postgres_2026-07-01.sql.gz",
	}
	var files []ParsedBackupName
	for _, n := range names {
		p, err := ParseBackupFilename(n)
		if err != nil {
			t.Fatal(err)
		}
		files = append(files, p)
	}
	keep, drop := ApplyRetention(files, now)
	keepSet := map[string]bool{}
	for _, k := range keep {
		keepSet[k] = true
	}
	dropSet := map[string]bool{}
	for _, d := range drop {
		dropSet[d] = true
	}

	for _, n := range []string{
		"moh_pms_postgres_2026-09-01.sql.gz",
		"moh_pms_postgres_2026-09-02.sql.gz",
		"moh_pms_postgres_2026-09-15.sql.gz",
		"moh_pms_postgres_2026-08-31.sql.gz",
		"moh_pms_postgres_2026-07-01.sql.gz",
	} {
		if !keepSet[n] {
			t.Fatalf("expected keep %s; keep=%v drop=%v", n, keep, drop)
		}
	}
	if !dropSet["moh_pms_postgres_2026-08-10.sql.gz"] {
		t.Fatalf("expected drop Aug 10; keep=%v drop=%v", keep, drop)
	}
}

func TestBuildBackupFilename(t *testing.T) {
	got := BuildBackupFilename("postgres", time.Date(2026, 9, 11, 0, 0, 0, 0, time.UTC))
	if got != "moh_pms_postgres_2026-09-11.sql.gz" {
		t.Fatalf("got %s", got)
	}
}
