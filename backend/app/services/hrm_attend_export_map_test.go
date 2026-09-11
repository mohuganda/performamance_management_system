package services

import (
	"testing"
	"time"

	"goravel/app/models"
)

func TestMapAttendanceClockPayloadSource(t *testing.T) {
	clock := models.AttendanceClock{
		EntryID:            "entry-1",
		StaffID:            7,
		ClockType:          "in",
		ClockedAt:          time.Date(2026, 9, 11, 10, 15, 0, 0, time.UTC),
		Latitude:           0.34,
		Longitude:          32.58,
		VerificationStatus: "verified_oos",
	}
	clock.ID = 99
	oosID := uint(12)
	clock.OutOfStationRequestID = &oosID

	staff := &models.Staff{IhrisPID: "person|99"}
	payload := MapAttendanceClockPayload(clock, staff)
	if payload.Source != "performance_system" {
		t.Fatalf("source=%q", payload.Source)
	}
	if payload.EntryID != "entry-1" {
		t.Fatalf("entry_id=%q", payload.EntryID)
	}
	if payload.ID != 99 {
		t.Fatalf("id=%d", payload.ID)
	}
	if payload.IhrisPID != "person|99" {
		t.Fatalf("ihris_pid=%q", payload.IhrisPID)
	}
	if payload.ClockStatus != "IN" {
		t.Fatalf("clock_status=%q", payload.ClockStatus)
	}
	if payload.OutOfStationRequestID == nil || *payload.OutOfStationRequestID != 12 {
		t.Fatalf("oos id mismatch")
	}
}

func TestClockStatusFromType(t *testing.T) {
	if clockStatusFromType("out") != "OUT" {
		t.Fatal("out")
	}
	if clockStatusFromType("IN") != "IN" {
		t.Fatal("in")
	}
}

func TestStaffEmployeeNumberPrefersCard(t *testing.T) {
	card := "C-100"
	ipps := "IPPS-9"
	staff := &models.Staff{IhrisPID: "pid-1", CardNumber: &card, Ipps: &ipps}
	if got := StaffEmployeeNumber(staff); got != "C-100" {
		t.Fatalf("got %q", got)
	}
}
