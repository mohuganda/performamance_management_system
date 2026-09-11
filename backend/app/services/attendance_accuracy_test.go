package services

import "testing"

func TestLocationAccuracyPercent(t *testing.T) {
	if got := LocationAccuracyPercent(0, 500); got != 100 {
		t.Fatalf("at center: got %v want 100", got)
	}
	if got := LocationAccuracyPercent(250, 500); got != 50 {
		t.Fatalf("halfway: got %v want 50", got)
	}
	if got := LocationAccuracyPercent(600, 500); got != 0 {
		t.Fatalf("outside: got %v want 0", got)
	}
	if got := LocationAccuracyPercent(100, 0); got != 0 {
		t.Fatalf("zero radius: got %v want 0", got)
	}
}
