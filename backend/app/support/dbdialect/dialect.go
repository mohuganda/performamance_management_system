package dbdialect

import (
	"strings"

	"goravel/app/facades"
)

func normalize(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "mysql":
		return "mysql"
	case "postgres", "postgresql", "pgsql":
		return "postgres"
	case "":
		return "postgres"
	default:
		return strings.ToLower(strings.TrimSpace(raw))
	}
}

// Name returns the active OLTP driver name (mysql|postgres).
func Name() string {
	return normalize(facades.Config().GetString("database.default"))
}

func IsPostgres() bool { return Name() == "postgres" }

func IsMysql() bool { return Name() == "mysql" }
