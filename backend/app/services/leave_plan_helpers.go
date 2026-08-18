package services

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

func LeavePlanDayCount(start, end time.Time) int {
	s := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
	e := time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, time.UTC)
	if e.Before(s) {
		return 0
	}
	return int(e.Sub(s).Hours()/24) + 1
}

func LeavePlanDatesInYear(start, end time.Time, year int) error {
	if end.Before(start) {
		return fmt.Errorf("end date must be on or after start date")
	}
	if start.Year() != year || end.Year() != year {
		return fmt.Errorf("start and end dates must both fall in calendar year %d", year)
	}
	return nil
}

func LeavePlansOverlap(aStart, aEnd, bStart, bEnd time.Time) bool {
	a0 := time.Date(aStart.Year(), aStart.Month(), aStart.Day(), 0, 0, 0, 0, time.UTC)
	a1 := time.Date(aEnd.Year(), aEnd.Month(), aEnd.Day(), 0, 0, 0, 0, time.UTC)
	b0 := time.Date(bStart.Year(), bStart.Month(), bStart.Day(), 0, 0, 0, 0, time.UTC)
	b1 := time.Date(bEnd.Year(), bEnd.Month(), bEnd.Day(), 0, 0, 0, 0, time.UTC)
	return !a1.Before(b0) && !b1.Before(a0)
}

func ParseReminderDayOffsets(raw string) []int {
	seen := map[int]bool{}
	var out []int
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		n, err := strconv.Atoi(part)
		if err != nil || n < 0 || seen[n] {
			continue
		}
		seen[n] = true
		out = append(out, n)
	}
	return out
}
