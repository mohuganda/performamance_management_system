package services

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"goravel/app/facades"
)

// StaffCacheService caches staff directory and reporting payloads in Redis.
type StaffCacheService struct{}

func NewStaffCacheService() *StaffCacheService {
	return &StaffCacheService{}
}

func staffCacheTTL() time.Duration {
	secs := facades.Config().GetInt("pms.staff.cache_ttl_seconds", 300)
	if secs <= 0 {
		secs = 300
	}
	return time.Duration(secs) * time.Second
}

func (c *StaffCacheService) version() uint64 {
	raw := facades.Cache().Get("pms:staff:cache_version", nil)
	switch v := raw.(type) {
	case int:
		return uint64(v)
	case int64:
		return uint64(v)
	case float64:
		return uint64(v)
	case string:
		n, _ := strconv.ParseUint(v, 10, 64)
		return n
	default:
		return 0
	}
}

func (c *StaffCacheService) key(parts ...string) string {
	return fmt.Sprintf("pms:staff:v%d:%s", c.version(), strings.Join(parts, ":"))
}

func (c *StaffCacheService) Get(key string, dest any) bool {
	raw := facades.Cache().Get(key, nil)
	if raw == nil {
		return false
	}
	payload, ok := raw.(string)
	if !ok || payload == "" {
		return false
	}
	return json.Unmarshal([]byte(payload), dest) == nil
}

func (c *StaffCacheService) Put(key string, value any) {
	encoded, err := json.Marshal(value)
	if err != nil {
		return
	}
	_ = facades.Cache().Put(key, string(encoded), staffCacheTTL())
}

// Invalidate bumps the cache generation so prior staff list keys are ignored.
func (c *StaffCacheService) Invalidate() {
	_ = facades.Cache().Put("pms:staff:cache_version", c.version()+1, 24*time.Hour)
}

func normalizeStaffSearch(search string) string {
	return strings.ToLower(strings.TrimSpace(search))
}
