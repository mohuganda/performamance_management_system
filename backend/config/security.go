package config

import "goravel/app/facades"

func init() {
	config := facades.Config()
	config.Add("security", map[string]any{
		"super_admin": map[string]any{
			"email":    config.Env("SUPER_ADMIN_EMAIL", ""),
			"password": config.Env("SUPER_ADMIN_PASSWORD", ""),
			"name":     config.Env("SUPER_ADMIN_NAME", "System Super Admin"),
		},
		"admin": map[string]any{
			"email":    config.Env("ADMIN_EMAIL", "admin@moh.go.ug"),
			"password": config.Env("ADMIN_PASSWORD", ""),
			"name":     config.Env("ADMIN_NAME", "PMS Administrator"),
		},
		"auth": map[string]any{
			"max_login_attempts":      config.Env("AUTH_MAX_LOGIN_ATTEMPTS", 5),
			"lockout_minutes":         config.Env("AUTH_LOCKOUT_MINUTES", 15),
			"login_rate_limit":        config.Env("AUTH_LOGIN_RATE_LIMIT", 10),
			"login_rate_limit_window": config.Env("AUTH_LOGIN_RATE_LIMIT_WINDOW", 60),
			"permission_cache_ttl":    config.Env("RBAC_PERMISSION_CACHE_TTL", 300),
		},
	})
}
