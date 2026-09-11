package controllers

import (
	"strconv"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/services"
)

type PlacesController struct {
	places *services.PlacesService
}

func NewPlacesController() *PlacesController {
	return &PlacesController{places: services.NewPlacesService()}
}

// SearchPlaces godoc
// @Summary      Search cached places (local-first, Google fallback)
// @Tags         places
// @Security     BearerAuth
// @Param        q query string true "Search text"
// @Param        country query string false "ISO country override (e.g. ug)"
// @Success      200 {array} map[string]any
// @Router       /api/v1/places/search [get]
func (c *PlacesController) Search(ctx http.Context) http.Response {
	q := ctx.Request().Query("q", "")
	country := ctx.Request().Query("country", "")
	rows, err := c.places.Search(q, country, 15)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

// GetPlace godoc
// @Summary      Get cached place by id
// @Tags         places
// @Security     BearerAuth
// @Param        id path int true "Place ID"
// @Success      200 {object} map[string]any
// @Router       /api/v1/places/{id} [get]
func (c *PlacesController) Show(ctx http.Context) http.Response {
	id, _ := strconv.Atoi(ctx.Request().Route("id"))
	if id <= 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid place id"})
	}
	row, err := c.places.GetByID(uint(id))
	if err != nil {
		return ctx.Response().Status(http.StatusNotFound).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(row)
}

// ListCachedPlaces godoc
// @Summary      Admin list cached places (view-only)
// @Tags         admin-lists
// @Security     BearerAuth
// @Router       /api/v1/admin/lists/cached-places [get]
func (c *PlacesController) AdminList(ctx http.Context) http.Response {
	result, err := c.places.ListAdmin(services.PlacesListFilter{
		Search:      ctx.Request().Query("search", ""),
		CountryCode: ctx.Request().Query("country_code", ""),
		Source:      ctx.Request().Query("source", ""),
		Page:        ctx.Request().QueryInt("page", 1),
		PerPage:     ctx.Request().QueryInt("per_page", 0),
	})
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

// SeedCachedPlaces godoc
// @Summary      Seed cached places from facilities (immutable snapshots)
// @Tags         admin-lists
// @Security     BearerAuth
// @Router       /api/v1/admin/lists/cached-places/seed [post]
func (c *PlacesController) AdminSeed(ctx http.Context) http.Response {
	inserted, skipped, err := c.places.SeedFromFacilities()
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{
		"message":  "facility places seeded",
		"inserted": inserted,
		"skipped":  skipped,
	})
}
