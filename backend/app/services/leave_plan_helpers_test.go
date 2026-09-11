package services

import (
	"testing"
	"time"
)

func TestLeavePlanDayCountInclusive(t *testing.T) {
	start := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 3, 3, 0, 0, 0, 0, time.UTC)
	if got := LeavePlanDayCount(start, end); got != 3 {
		t.Fatalf("got %d want 3", got)
	}
}

func TestLeavePlanDatesInYear(t *testing.T) {
	start := time.Date(2026, 12, 20, 0, 0, 0, 0, time.UTC)
	end := time.Date(2027, 1, 5, 0, 0, 0, 0, time.UTC)
	if err := LeavePlanDatesInYear(start, end, 2026); err == nil {
		t.Fatal("expected year bound error")
	}
	okStart := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	okEnd := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)
	if err := LeavePlanDatesInYear(okStart, okEnd, 2026); err != nil {
		t.Fatalf("unexpected: %v", err)
	}
}

func TestLeavePlansOverlap(t *testing.T) {
	a0 := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	a1 := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)
	b0 := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)
	b1 := time.Date(2026, 5, 15, 0, 0, 0, 0, time.UTC)
	if !LeavePlansOverlap(a0, a1, b0, b1) {
		t.Fatal("touching inclusive ranges should overlap")
	}
	c0 := time.Date(2026, 5, 11, 0, 0, 0, 0, time.UTC)
	c1 := time.Date(2026, 5, 15, 0, 0, 0, 0, time.UTC)
	if LeavePlansOverlap(a0, a1, c0, c1) {
		t.Fatal("adjacent exclusive should not overlap")
	}
}

func TestParseReminderDayOffsets(t *testing.T) {
	got := ParseReminderDayOffsets("7,1")
	if len(got) != 2 || got[0] != 7 || got[1] != 1 {
		t.Fatalf("got %#v", got)
	}
	got = ParseReminderDayOffsets(" 7, 1, 7, -2, x ")
	if len(got) != 2 || got[0] != 7 || got[1] != 1 {
		t.Fatalf("dedupe/filter failed: %#v", got)
	}
}
