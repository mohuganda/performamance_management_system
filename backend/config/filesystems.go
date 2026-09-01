package config

import (
	"os"
	"strings"

	"github.com/goravel/framework/support/path"

	"goravel/app/facades"
)

func init() {
	config := facades.Config()

	// Prefer an external media root (outside the application tree). Fall back to
	// storage/app/public for local development when FILE_STORAGE_ROOT is unset.
	mediaRoot := strings.TrimSpace(os.Getenv("FILE_STORAGE_ROOT"))
	if mediaRoot == "" {
		if v, ok := config.Env("FILE_STORAGE_ROOT", "").(string); ok {
			mediaRoot = strings.TrimSpace(v)
		}
	}
	if mediaRoot == "" {
		mediaRoot = path.Storage("app/public")
	}
	_ = os.MkdirAll(mediaRoot, 0o755)

	config.Add("filesystems", map[string]any{
		"default": "local",
		"disks": map[string]any{
			"local": map[string]any{
				"driver": "local",
				"root":   path.Storage("app"),
			},
			"public": map[string]any{
				"driver": "local",
				"root":   path.Storage("app/public"),
				"url":    config.Env("APP_URL", "").(string) + "/storage",
			},
			// User uploads (profiles, signatures, attachments) live on this disk.
			"media": map[string]any{
				"driver": "local",
				"root":   mediaRoot,
			},
		},
	})
}
