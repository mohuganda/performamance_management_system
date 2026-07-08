package controllers

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/services"
)

type PerformanceAdminController struct {
	config *services.PerformanceConfigService
}

func NewPerformanceAdminController() *PerformanceAdminController {
	return &PerformanceAdminController{config: services.NewPerformanceConfigService()}
}

func (c *PerformanceAdminController) ShowSettings(ctx http.Context) http.Response {
	fy, err := services.NewPerformanceService().CurrentFinancialYear()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	payload, err := c.config.AdminConfig(fy)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(payload)
}

type performanceSettingsBody struct {
	EnforceWindows  *bool `json:"enforce_windows"`
	TestOverride    *bool `json:"test_override"`
	WindowWeeks     *int  `json:"window_weeks"`
	WindowShiftDays *int  `json:"window_shift_days"`
}

func (c *PerformanceAdminController) UpdateSettings(ctx http.Context) http.Response {
	var body performanceSettingsBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}

	if body.EnforceWindows != nil {
		_ = c.config.SaveSetting("enforce_windows", *body.EnforceWindows, "Enforce performance reporting submission windows", true)
	}
	if body.TestOverride != nil {
		_ = c.config.SaveSetting("test_override", *body.TestOverride, "Open all reporting windows for testing", true)
	}
	if body.WindowWeeks != nil && *body.WindowWeeks > 0 {
		_ = c.config.SaveSetting("window_weeks", *body.WindowWeeks, "Weeks each report window stays open", true)
	}
	if body.WindowShiftDays != nil {
		_ = c.config.SaveSetting("window_shift_days", *body.WindowShiftDays, "Shift all windows by N days", true)
	}

	fy, err := services.NewPerformanceService().CurrentFinancialYear()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	payload, err := c.config.AdminConfig(fy)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(payload)
}
