package dbdialect

import "testing"

func TestNormalize(t *testing.T) {
	if got := normalize("POSTGRES"); got != "postgres" {
		t.Fatalf("got %q", got)
	}
	if got := normalize("MySQL"); got != "mysql" {
		t.Fatalf("got %q", got)
	}
	if got := normalize(""); got != "postgres" {
		t.Fatalf("empty should default postgres, got %q", got)
	}
	if got := normalize("postgresql"); got != "postgres" {
		t.Fatalf("got %q", got)
	}
	if got := normalize("pgsql"); got != "postgres" {
		t.Fatalf("got %q", got)
	}
}
