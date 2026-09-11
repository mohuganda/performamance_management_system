package services

import "testing"

func TestIhrisAPIRecordHasFacilityAndJob(t *testing.T) {
	facID := "facility|1"
	fac := "Mulago"
	jobID := "job|1"
	job := "Nurse"
	rec := IhrisAPIRecord{
		FacilityID: &facID,
		Facility:   &fac,
		JobID:      &jobID,
		Job:        &job,
	}
	if !rec.HasFacilityAndJob() {
		t.Fatal("expected true when all placement fields set")
	}
	rec.Facility = nil
	if rec.HasFacilityAndJob() {
		t.Fatal("expected false when facility name missing")
	}
}

func TestNormalizeFacilityDisplayName(t *testing.T) {
	got := normalizeFacilityDisplayName("TORORO GENERAL HOSPITAL HOSPITAL")
	if got != "TORORO GENERAL HOSPITAL" {
		t.Fatalf("got %q", got)
	}
	got = normalizeFacilityDisplayName("BUDADIRI Health Centre IV")
	if got != "BUDADIRI Health Centre IV" {
		t.Fatalf("unchanged got %q", got)
	}
}
