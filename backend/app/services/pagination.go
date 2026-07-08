package services

import (
	"math"
	"strconv"
)

type PaginatedResult[T any] struct {
	Data       []T `json:"data"`
	Total      int `json:"total"`
	Page       int `json:"page"`
	PerPage    int `json:"per_page"`
	TotalPages int `json:"total_pages"`
}

func DefaultAdminPageSize() int {
	settings := NewSettingsService()
	if v := settings.GetInt("ui.admin_page_size", 0); v > 0 {
		return v
	}
	group := settings.GroupSettings("ui")
	if raw, ok := group["admin_page_size"]; ok {
		switch n := raw.(type) {
		case float64:
			if int(n) > 0 {
				return int(n)
			}
		case int:
			if n > 0 {
				return n
			}
		}
	}
	return 20
}

func ResolvePage(page, perPage int) (int, int) {
	if page < 1 {
		page = 1
	}
	if perPage <= 0 {
		perPage = DefaultAdminPageSize()
	}
	if perPage > 200 {
		perPage = 200
	}
	return page, perPage
}

func OffsetFor(page, perPage int) int {
	return (page - 1) * perPage
}

func TotalPages(total, perPage int) int {
	if perPage <= 0 {
		return 1
	}
	pages := int(math.Ceil(float64(total) / float64(perPage)))
	if pages < 1 {
		return 1
	}
	return pages
}

func BuildPaginatedResult[T any](rows []T, total, page, perPage int) PaginatedResult[T] {
	if rows == nil {
		rows = []T{}
	}
	return PaginatedResult[T]{
		Data:       rows,
		Total:      total,
		Page:       page,
		PerPage:    perPage,
		TotalPages: TotalPages(total, perPage),
	}
}

func PaginateSlice[T any](items []T, page, perPage int) PaginatedResult[T] {
	page, perPage = ResolvePage(page, perPage)
	total := len(items)
	start := OffsetFor(page, perPage)
	if start >= total {
		return BuildPaginatedResult([]T{}, total, page, perPage)
	}
	end := start + perPage
	if end > total {
		end = total
	}
	return BuildPaginatedResult(items[start:end], total, page, perPage)
}

func (s *SettingsService) GetInt(key string, fallback int) int {
	raw := s.GetString(key, "")
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return n
}
