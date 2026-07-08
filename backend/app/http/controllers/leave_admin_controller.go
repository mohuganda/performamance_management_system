package controllers

import (
	"strconv"
	"time"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/models"
	"goravel/app/services"
)

type LeaveAdminController struct {
	config *services.LeaveConfigService
	admin  *services.LeaveAdminService
}

func NewLeaveAdminController() *LeaveAdminController {
	return &LeaveAdminController{
		config: services.NewLeaveConfigService(),
		admin:  services.NewLeaveAdminService(),
	}
}

// ShowSettings godoc
// @Summary      Get leave policy settings
// @Tags         admin-leave
// @Produce      json
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/leave/settings [get]
func (c *LeaveAdminController) ShowSettings(ctx http.Context) http.Response {
	settings, err := c.config.LoadSettings()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(settings)
}

type leaveSettingsBody struct {
	AdvanceNoticeDays  *int              `json:"advance_notice_days"`
	WorkHours          map[string]string `json:"work_hours"`
	CarryOverDeadline  *string           `json:"carry_over_deadline"`
	ClockWindowMorning *string           `json:"clock_window_morning"`
	AllowCarryOver     *bool             `json:"allow_carry_over"`
	VestingMonth       *int              `json:"vesting_month"`
	VestingDay         *int              `json:"vesting_day"`
}

// UpdateSettings godoc
// @Summary      Update leave policy settings
// @Tags         admin-leave
// @Accept       json
// @Produce      json
// @Param        body body leaveSettingsBody true "Leave settings"
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/leave/settings [put]
func (c *LeaveAdminController) UpdateSettings(ctx http.Context) http.Response {
	var body leaveSettingsBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}

	if body.AdvanceNoticeDays != nil {
		_ = c.config.SaveSetting("advance_notice_days", *body.AdvanceNoticeDays, "Minimum days before leave start", true)
	}
	if body.WorkHours != nil {
		_ = c.config.SaveSetting("work_hours", body.WorkHours, "Official work hours", true)
	}
	if body.CarryOverDeadline != nil {
		_ = c.config.SaveSetting("carry_over_deadline", *body.CarryOverDeadline, "Carry-over request deadline (MM-DD)", true)
	}
	if body.ClockWindowMorning != nil {
		_ = c.config.SaveSetting("clock_window_morning", *body.ClockWindowMorning, "Morning clock-in window", true)
	}
	if body.AllowCarryOver != nil {
		_ = c.config.SaveSetting("allow_carry_over", *body.AllowCarryOver, "Whether carry-over is permitted", true)
	}
	if body.VestingMonth != nil {
		_ = c.config.SaveSetting("vesting_month", *body.VestingMonth, "Month annual leave vests (1-12)", true)
	}
	if body.VestingDay != nil {
		_ = c.config.SaveSetting("vesting_day", *body.VestingDay, "Day annual leave vests", true)
	}

	settings, err := c.config.LoadSettings()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(settings)
}

// ListTypes godoc
// @Summary      List all leave types (admin)
// @Tags         admin-leave
// @Produce      json
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/leave/types [get]
func (c *LeaveAdminController) ListTypes(ctx http.Context) http.Response {
	rows, err := c.config.ListAllTypes()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

// CreateType godoc
// @Summary      Create leave type
// @Tags         admin-leave
// @Accept       json
// @Produce      json
// @Param        body body models.LeaveType true "Leave type"
// @Success      201 {object} map[string]any
// @Router       /api/v1/admin/leave/types [post]
func (c *LeaveAdminController) CreateType(ctx http.Context) http.Response {
	var body models.LeaveType
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	row, err := c.config.CreateType(body)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Status(http.StatusCreated).Json(row)
}

// UpdateType godoc
// @Summary      Update leave type
// @Tags         admin-leave
// @Accept       json
// @Produce      json
// @Param        id path int true "Leave type ID"
// @Param        body body models.LeaveType true "Leave type"
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/leave/types/{id} [put]
func (c *LeaveAdminController) UpdateType(ctx http.Context) http.Response {
	id, _ := strconv.ParseUint(ctx.Request().Route("id"), 10, 64)
	var body models.LeaveType
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	row, err := c.config.UpdateType(uint(id), body)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(row)
}

// DeactivateType godoc
// @Summary      Deactivate leave type
// @Tags         admin-leave
// @Produce      json
// @Param        id path int true "Leave type ID"
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/leave/types/{id} [delete]
func (c *LeaveAdminController) DeactivateType(ctx http.Context) http.Response {
	id, _ := strconv.ParseUint(ctx.Request().Route("id"), 10, 64)
	if err := c.config.DeactivateType(uint(id)); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "leave type deactivated"})
}

// ListEntitlements godoc
// @Summary      List leave entitlements
// @Tags         admin-leave
// @Produce      json
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/leave/entitlements [get]
func (c *LeaveAdminController) ListEntitlements(ctx http.Context) http.Response {
	rows, err := c.config.ListEntitlements()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

// CreateEntitlement godoc
// @Summary      Create leave entitlement
// @Tags         admin-leave
// @Accept       json
// @Produce      json
// @Param        body body models.LeaveEntitlement true "Entitlement"
// @Success      201 {object} map[string]any
// @Router       /api/v1/admin/leave/entitlements [post]
func (c *LeaveAdminController) CreateEntitlement(ctx http.Context) http.Response {
	var body models.LeaveEntitlement
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	row, err := c.config.CreateEntitlement(body)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Status(http.StatusCreated).Json(row)
}

// UpdateEntitlement godoc
// @Summary      Update leave entitlement
// @Tags         admin-leave
// @Accept       json
// @Produce      json
// @Param        id path int true "Entitlement ID"
// @Param        body body models.LeaveEntitlement true "Entitlement"
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/leave/entitlements/{id} [put]
func (c *LeaveAdminController) UpdateEntitlement(ctx http.Context) http.Response {
	id, _ := strconv.ParseUint(ctx.Request().Route("id"), 10, 64)
	var body models.LeaveEntitlement
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	row, err := c.config.UpdateEntitlement(uint(id), body)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(row)
}

// DeleteEntitlement godoc
// @Summary      Delete leave entitlement
// @Tags         admin-leave
// @Produce      json
// @Param        id path int true "Entitlement ID"
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/leave/entitlements/{id} [delete]
func (c *LeaveAdminController) DeleteEntitlement(ctx http.Context) http.Response {
	id, _ := strconv.ParseUint(ctx.Request().Route("id"), 10, 64)
	if err := c.config.DeleteEntitlement(uint(id)); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "entitlement deleted"})
}

// ListApprovalStages godoc
// @Summary      List leave approval stages
// @Tags         admin-leave
// @Produce      json
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/leave/approval-stages [get]
func (c *LeaveAdminController) ListApprovalStages(ctx http.Context) http.Response {
	rows, err := c.config.ListAllApprovalStages()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

// CreateApprovalStage godoc
// @Summary      Create leave approval stage
// @Tags         admin-leave
// @Accept       json
// @Produce      json
// @Param        body body models.LeaveApprovalStage true "Approval stage"
// @Success      201 {object} map[string]any
// @Router       /api/v1/admin/leave/approval-stages [post]
func (c *LeaveAdminController) CreateApprovalStage(ctx http.Context) http.Response {
	var body models.LeaveApprovalStage
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	row, err := c.config.CreateApprovalStage(body)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Status(http.StatusCreated).Json(row)
}

// UpdateApprovalStage godoc
// @Summary      Update leave approval stage
// @Tags         admin-leave
// @Accept       json
// @Produce      json
// @Param        id path int true "Stage ID"
// @Param        body body models.LeaveApprovalStage true "Approval stage"
// @Success      200 {object} map[string]any
// @Router       /api/v1/admin/leave/approval-stages/{id} [put]
func (c *LeaveAdminController) UpdateApprovalStage(ctx http.Context) http.Response {
	id, _ := strconv.ParseUint(ctx.Request().Route("id"), 10, 64)
	var body models.LeaveApprovalStage
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	row, err := c.config.UpdateApprovalStage(uint(id), body)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(row)
}

func (c *LeaveAdminController) Overview(ctx http.Context) http.Response {
	year := ctx.Request().QueryInt("year", time.Now().Year())
	stats, err := c.admin.OverviewStats(year)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(stats)
}

func (c *LeaveAdminController) ListBalances(ctx http.Context) http.Response {
	result, err := c.admin.ListStaffBalances(services.StaffLeaveListFilter{
		Search:       ctx.Request().Query("search", ""),
		DepartmentID: uint(ctx.Request().QueryInt("department_id", 0)),
		Year:         ctx.Request().QueryInt("year", time.Now().Year()),
		Page:         ctx.Request().QueryInt("page", 1),
		PerPage:      ctx.Request().QueryInt("per_page", 0),
	})
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

func (c *LeaveAdminController) ListRequests(ctx http.Context) http.Response {
	result, err := c.admin.ListRequests(services.LeaveRequestListFilter{
		Search:       ctx.Request().Query("search", ""),
		Status:       ctx.Request().Query("status", ""),
		AwaitingHr:   ctx.Request().Query("awaiting_hr", ""),
		LeaveTypeID:  uint(ctx.Request().QueryInt("leave_type_id", 0)),
		DepartmentID: uint(ctx.Request().QueryInt("department_id", 0)),
		Page:         ctx.Request().QueryInt("page", 1),
		PerPage:      ctx.Request().QueryInt("per_page", 0),
	})
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

func (c *LeaveAdminController) StaffStatement(ctx http.Context) http.Response {
	staffID := ctx.Request().RouteInt("staffId")
	if staffID == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "staff id required"})
	}
	year := ctx.Request().QueryInt("year", time.Now().Year())
	stmt, err := c.admin.StaffStatement(uint(staffID), year)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(stmt)
}

func (c *LeaveAdminController) FinalizeRequest(ctx http.Context) http.Response {
	requestID := ctx.Request().RouteInt("id")
	if requestID == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "request id required"})
	}
	if err := c.admin.FinalizeRequest(uint(requestID)); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "leave recorded and balance updated"})
}

type adjustBalanceBody struct {
	EntitledDays    *int `json:"entitled_days"`
	UsedDays        *int `json:"used_days"`
	CarriedOverDays *int `json:"carried_over_days"`
}

func (c *LeaveAdminController) AdjustBalance(ctx http.Context) http.Response {
	staffID := ctx.Request().RouteInt("staffId")
	if staffID == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "staff id required"})
	}
	leaveTypeID := uint(ctx.Request().QueryInt("leave_type_id", 0))
	if leaveTypeID == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "leave_type_id required"})
	}
	year := ctx.Request().QueryInt("year", time.Now().Year())

	var body adjustBalanceBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}

	row, err := c.admin.AdjustBalance(uint(staffID), leaveTypeID, year, services.BalanceAdjustInput{
		EntitledDays:    body.EntitledDays,
		UsedDays:        body.UsedDays,
		CarriedOverDays: body.CarriedOverDays,
	})
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(row)
}

func (c *LeaveAdminController) InitializeYearBalances(ctx http.Context) http.Response {
	year := ctx.Request().QueryInt("year", time.Now().Year())
	result, err := c.admin.InitializeYearBalances(year)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

func (c *LeaveAdminController) ListDepartments(ctx http.Context) http.Response {
	rows, err := services.NewStaffAdminService().ListDepartments()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}
