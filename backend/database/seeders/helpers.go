package seeders

// modelFound reports whether a Goravel ORM model was loaded by First().
// Goravel returns nil error when no row exists, so ID must be checked.
func modelFound(id uint) bool {
	return id > 0
}
