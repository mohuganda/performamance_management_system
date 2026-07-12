package controllers

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/http/authctx"
	"goravel/app/services"
)

type ConfigController struct {
	configService *services.ConfigService
}

func NewConfigController() *ConfigController {
	return &ConfigController{configService: services.NewConfigService()}
}

func (c *ConfigController) Show(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(c.configService.PublicConfig())
}

type IhrisController struct {
	syncService *services.IhrisSyncService
}

func NewIhrisController() *IhrisController {
	return &IhrisController{syncService: services.NewIhrisSyncService()}
}

func (c *IhrisController) Sync(ctx http.Context) http.Response {
	var body struct {
		RunID         uint `json:"run_id"`
		StartPage     int  `json:"start_page"`
		PagesPerBatch int  `json:"pages_per_batch"`
	}
	_ = ctx.Request().Bind(&body)

	result, err := c.syncService.SyncFromAPI(services.SyncBatchOptions{
		RunID:         body.RunID,
		StartPage:     body.StartPage,
		PagesPerBatch: body.PagesPerBatch,
	})
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(result)
}

func (c *IhrisController) Status(ctx http.Context) http.Response {
	status, err := c.syncService.SyncStatus()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(status)
}

type HrmAttendController struct {
	hrm *services.HrmAttendService
}

func NewHrmAttendController() *HrmAttendController {
	return &HrmAttendController{hrm: services.NewHrmAttendService()}
}

func (c *HrmAttendController) Sync(ctx http.Context) http.Response {
	var body struct {
		YearMonth string `json:"year_month"`
	}
	_ = ctx.Request().Bind(&body)

	result, err := c.hrm.SyncMonthlySummaries(body.YearMonth)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{
			"message": err.Error(),
			"result":  result,
		})
	}
	return ctx.Response().Success().Json(result)
}

type AnalyticsController struct {
	store *services.AnalyticsStore
	sync  *services.DorisSyncService
}

func NewAnalyticsController() *AnalyticsController {
	return &AnalyticsController{
		store: services.NewAnalyticsStore(),
		sync:  services.NewDorisSyncService(),
	}
}

func (c *AnalyticsController) Status(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(c.store.Status())
}

func (c *AnalyticsController) Sync(ctx http.Context) http.Response {
	result, err := c.sync.SyncFromOLTP()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{
			"message": err.Error(),
		})
	}
	return ctx.Response().Success().Json(result)
}

type DashboardController struct {
	dashboardService *services.DashboardService
}

func NewDashboardController() *DashboardController {
	return &DashboardController{dashboardService: services.NewDashboardService()}
}

func (c *DashboardController) HealthWorker(ctx http.Context) http.Response {
	quarter := ctx.Request().Query("quarter", "Q1 (July - September 2026)")
	staffID := uint(ctx.Request().QueryInt("staff_id", 0))
	if staffID == 0 {
		if id, ok := authctx.StaffID(ctx); ok {
			staffID = id
		} else {
			staffID = 1
		}
	}
	return ctx.Response().Success().Json(c.dashboardService.HealthWorkerDashboard(staffID, quarter))
}

func (c *DashboardController) Supervisor(ctx http.Context) http.Response {
	quarter := ctx.Request().Query("quarter", "Q1 (July - September 2026)")
	team := ctx.Request().Query("team", "Ward A")
	return ctx.Response().Success().Json(c.dashboardService.SupervisorDashboard(team, quarter))
}

func (c *DashboardController) DepartmentHead(ctx http.Context) http.Response {
	quarter := ctx.Request().Query("quarter", "Q1 (July - September 2026)")
	staffID := uint(ctx.Request().QueryInt("staff_id", 0))
	if staffID == 0 {
		if id, ok := authctx.StaffID(ctx); ok {
			staffID = id
		}
	}
	return ctx.Response().Success().Json(c.dashboardService.DepartmentHeadDashboard(staffID, quarter))
}

func (c *DashboardController) HRManager(ctx http.Context) http.Response {
	quarter := ctx.Request().Query("quarter", "Q1 (July - September 2026)")
	staffID := uint(ctx.Request().QueryInt("staff_id", 0))
	if staffID == 0 {
		if id, ok := authctx.StaffID(ctx); ok {
			staffID = id
		}
	}
	return ctx.Response().Success().Json(c.dashboardService.HRManagerDashboard(staffID, quarter))
}

type HealthController struct{}

func NewHealthController() *HealthController {
	return &HealthController{}
}

func (c *HealthController) Check(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(http.Json{
		"status":  "ok",
		"service": "moh-pms-api",
		"version": "1.0.0",
	})
}
