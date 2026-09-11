package services

import "testing"

func TestHasCoords(t *testing.T) {
	if HasCoords(0, 0) {
		t.Fatal("expected false for 0,0")
	}
	if !HasCoords(0.3, 32.5) {
		t.Fatal("expected true for real coords")
	}
}

func TestPickEffectiveDutyStation(t *testing.T) {
	lat := 0.32
	lng := 32.58
	label := "My desk"
	radius := 200

	personal := PickEffectiveDutyStation(
		&lat, &lng, &label, &radius,
		0.31, 32.57, "Facility A",
		500,
	)
	if personal.Source != "personal" || personal.RadiusMeters != 200 || personal.Label != "My desk" {
		t.Fatalf("personal override failed: %+v", personal)
	}

	facility := PickEffectiveDutyStation(
		nil, nil, nil, nil,
		0.31, 32.57, "Facility A",
		500,
	)
	if facility.Source != "facility" || facility.Latitude != 0.31 || facility.RadiusMeters != 500 {
		t.Fatalf("facility fallback failed: %+v", facility)
	}

	none := PickEffectiveDutyStation(nil, nil, nil, nil, 0, 0, "Facility A", 500)
	if none.Source != "none" {
		t.Fatalf("expected none, got %+v", none)
	}
}
