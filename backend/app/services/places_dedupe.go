package services

import (
	"strings"
	"unicode"
)

// NormalizePlaceName lowercases and collapses whitespace for dedupe matching.
func NormalizePlaceName(name string) string {
	fields := strings.Fields(strings.ToLower(strings.TrimSpace(name)))
	if len(fields) == 0 {
		return ""
	}
	var b strings.Builder
	for i, f := range fields {
		if i > 0 {
			b.WriteByte(' ')
		}
		for _, r := range f {
			if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' || r == '\'' {
				b.WriteRune(r)
			}
		}
	}
	return strings.TrimSpace(b.String())
}

// PlaceCoordsNear reports whether two points are within meters (haversine).
func PlaceCoordsNear(lat1, lng1, lat2, lng2, meters float64) bool {
	if meters <= 0 {
		meters = 50
	}
	return haversineMeters(lat1, lng1, lat2, lng2) <= meters
}
