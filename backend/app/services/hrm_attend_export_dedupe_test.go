package services

import "testing"

func TestShouldExportClock(t *testing.T) {
	if ShouldExportClock(0, false) {
		t.Fatal("zero clock id should not export")
	}
	if !ShouldExportClock(42, false) {
		t.Fatal("clock without success log should export")
	}
	if ShouldExportClock(42, true) {
		t.Fatal("clock with success log must not export again")
	}
}
