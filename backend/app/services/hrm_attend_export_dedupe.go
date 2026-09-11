package services

// ShouldExportClock reports whether an attendance clock should be pushed/marked for export.
// Returns false when a successful export log already exists for the clock.
func ShouldExportClock(clockID uint, hasSuccessfulExport bool) bool {
	if clockID == 0 {
		return false
	}
	return !hasSuccessfulExport
}
