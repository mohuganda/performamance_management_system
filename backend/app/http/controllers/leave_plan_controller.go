package controllers

import (
	"fmt"
	"strconv"
	"time"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/services"
)

type LeavePlanController struct {
	plans *services.LeavePlanService
}

func NewLeavePlanController() *LeavePlanController {
	return &LeavePlanController{plans: services.NewLeavePlanService()}
}

type leavePlanBody struct {
	CalendarYear int    `json:"calendar_year"`
	StartDate    string `json:"start_date"`
	EndDate      string `json:"end_date"`
	Notes        string `json:"notes"`
}

func (c *LeavePlanController) ListMine(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	year, _ := strconv.Atoi(ctx.Request().Query("year", strconv.Itoa(time.Now().Year())))
	rows, err := c.plans.ListForStaff(staffID, year)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

func (c *LeavePlanController) ListTeam(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	year, _ := strconv.Atoi(ctx.Request().Query("year", strconv.Itoa(time.Now().Year())))
	rows, err := c.plans.ListTeam(staffID, year)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

func (c *LeavePlanController) Create(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	in, err := bindLeavePlanBody(ctx)
	if err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": err.Error()})
	}
	res, err := c.plans.Create(staffID, in)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Status(http.StatusCreated).Json(res)
}

func (c *LeavePlanController) Update(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	id, _ := strconv.Atoi(ctx.Request().Route("id"))
	in, err := bindLeavePlanBody(ctx)
	if err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": err.Error()})
	}
	res, err := c.plans.Update(staffID, uint(id), in)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(res)
}

func (c *LeavePlanController) Delete(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	id, _ := strconv.Atoi(ctx.Request().Route("id"))
	if err := c.plans.Delete(staffID, uint(id)); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"ok": true})
}

func bindLeavePlanBody(ctx http.Context) (services.LeavePlanInput, error) {
	var body leavePlanBody
	if err := ctx.Request().Bind(&body); err != nil {
		return services.LeavePlanInput{}, err
	}
	start, err1 := time.Parse("2006-01-02", body.StartDate)
	end, err2 := time.Parse("2006-01-02", body.EndDate)
	if err1 != nil || err2 != nil {
		return services.LeavePlanInput{}, fmt.Errorf("start_date and end_date must be YYYY-MM-DD")
	}
	year := body.CalendarYear
	if year <= 0 {
		year = start.Year()
	}
	return services.LeavePlanInput{
		CalendarYear: year,
		StartDate:    start,
		EndDate:      end,
		Notes:        body.Notes,
	}, nil
}
