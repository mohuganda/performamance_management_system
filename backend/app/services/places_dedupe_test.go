package services

import "testing"

func TestNormalizePlaceName(t *testing.T) {
	got := NormalizePlaceName("  Mulago  Hospital ")
	if got != "mulago hospital" {
		t.Fatalf("got %q", got)
	}
}

func TestPlaceCoordsNear(t *testing.T) {
	if !PlaceCoordsNear(0.3476, 32.5825, 0.3476, 32.5825, 50) {
		t.Fatal("same point should be near")
	}
	// ~1km north
	if PlaceCoordsNear(0.3476, 32.5825, 0.3566, 32.5825, 50) {
		t.Fatal("1km apart should not be within 50m")
	}
}
