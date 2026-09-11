package services

import (
	"testing"
	"time"
)

func TestRequireRestoreConfirm(t *testing.T) {
	if err := RequireRestoreConfirm("RESTORE"); err != nil {
		t.Fatal(err)
	}
	if err := RequireRestoreConfirm("restore"); err == nil {
		t.Fatal("expected error")
	}
}

func TestCanProductionRestore(t *testing.T) {
	ok := true
	now := time.Date(2026, 9, 11, 12, 0, 0, 0, time.UTC)
	info := BackupFileInfo{
		Engine:   "postgres",
		TestOK:   &ok,
		TestedAt: now.Add(-time.Hour).Format(time.RFC3339),
	}
	if err := CanProductionRestore("postgres", info, now, 24*time.Hour); err != nil {
		t.Fatal(err)
	}
	if err := CanProductionRestore("mysql", info, now, 24*time.Hour); err == nil {
		t.Fatal("engine mismatch should fail")
	}
	stale := info
	stale.TestedAt = now.Add(-48 * time.Hour).Format(time.RFC3339)
	if err := CanProductionRestore("postgres", stale, now, 24*time.Hour); err == nil {
		t.Fatal("stale test should fail")
	}
}
