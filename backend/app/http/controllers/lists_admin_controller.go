package controllers

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/services"
)

type ListsAdminController struct {
	lists *services.ListsAdminService
}

func NewListsAdminController() *ListsAdminController {
	return &ListsAdminController{lists: services.NewListsAdminService()}
}

func (c *ListsAdminController) Summary(ctx http.Context) http.Response {
	summary, err := c.lists.Summary()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(summary)
}

func listFilterFromRequest(ctx http.Context) services.ListFilter {
	return services.ListFilter{
		Search:     ctx.Request().Query("search", ""),
		RegionID:   uint(ctx.Request().QueryInt("region_id", 0)),
		DistrictID: uint(ctx.Request().QueryInt("district_id", 0)),
		FacilityID: uint(ctx.Request().QueryInt("facility_id", 0)),
		Page:       ctx.Request().QueryInt("page", 1),
		PerPage:    ctx.Request().QueryInt("per_page", 0),
	}
}

func (c *ListsAdminController) ListRegions(ctx http.Context) http.Response {
	result, err := c.lists.ListRegions(listFilterFromRequest(ctx))
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

func (c *ListsAdminController) ListDistricts(ctx http.Context) http.Response {
	result, err := c.lists.ListDistricts(listFilterFromRequest(ctx))
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

func (c *ListsAdminController) ListFacilities(ctx http.Context) http.Response {
	result, err := c.lists.ListFacilities(listFilterFromRequest(ctx))
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

func (c *ListsAdminController) ListDepartments(ctx http.Context) http.Response {
	result, err := c.lists.ListDepartments(listFilterFromRequest(ctx))
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

func (c *ListsAdminController) ListJobTitles(ctx http.Context) http.Response {
	result, err := c.lists.ListJobTitles(listFilterFromRequest(ctx))
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

func (c *ListsAdminController) RegionOptions(ctx http.Context) http.Response {
	rows, err := c.lists.ListRegionOptions()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

func (c *ListsAdminController) DistrictOptions(ctx http.Context) http.Response {
	rows, err := c.lists.ListDistrictOptions()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

func (c *ListsAdminController) UpdateRegion(ctx http.Context) http.Response {
	id := uint(ctx.Request().RouteInt("id"))
	if id == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "id required"})
	}
	var body services.UpdateRegionInput
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if err := c.lists.UpdateRegion(id, body); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "region updated"})
}

func (c *ListsAdminController) UpdateDistrict(ctx http.Context) http.Response {
	id := uint(ctx.Request().RouteInt("id"))
	if id == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "id required"})
	}
	var body services.UpdateDistrictInput
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if err := c.lists.UpdateDistrict(id, body); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "district updated"})
}

func (c *ListsAdminController) UpdateFacility(ctx http.Context) http.Response {
	id := uint(ctx.Request().RouteInt("id"))
	if id == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "id required"})
	}
	var body services.UpdateFacilityInput
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if err := c.lists.UpdateFacility(id, body); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "facility updated"})
}

func (c *ListsAdminController) UpdateDepartment(ctx http.Context) http.Response {
	id := uint(ctx.Request().RouteInt("id"))
	if id == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "id required"})
	}
	var body services.UpdateDepartmentInput
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if err := c.lists.UpdateDepartment(id, body); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "department updated"})
}

func (c *ListsAdminController) UpdateJobTitle(ctx http.Context) http.Response {
	id := uint(ctx.Request().RouteInt("id"))
	if id == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "id required"})
	}
	var body services.UpdateJobTitleInput
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if err := c.lists.UpdateJobTitle(id, body); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "job title updated"})
}

func (c *ListsAdminController) CreateDepartment(ctx http.Context) http.Response {
	var body services.CreateDepartmentInput
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	row, err := c.lists.CreateDepartment(body)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(row)
}

func (c *ListsAdminController) CreateJobTitle(ctx http.Context) http.Response {
	var body services.CreateJobTitleInput
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	row, err := c.lists.CreateJobTitle(body)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(row)
}

func (c *ListsAdminController) ListOosReasons(ctx http.Context) http.Response {
	result, err := c.lists.ListOosReasons(listFilterFromRequest(ctx))
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

func (c *ListsAdminController) UpdateOosReason(ctx http.Context) http.Response {
	id := uint(ctx.Request().RouteInt("id"))
	if id == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "id required"})
	}
	var body services.UpdateOosReasonInput
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if err := c.lists.UpdateOosReason(id, body); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "out-of-station reason updated"})
}

func (c *ListsAdminController) CreateOosReason(ctx http.Context) http.Response {
	var body services.CreateOosReasonInput
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	row, err := c.lists.CreateOosReason(body)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(row)
}
