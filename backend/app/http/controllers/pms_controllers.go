package controllers

import (
	"strings"

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
	// Legacy batch endpoint kept for compatibility; prefer /ihris/sync/start.
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

func (c *IhrisController) Start(ctx http.Context) http.Response {
	var body struct {
		RunID uint `json:"run_id"`
	}
	_ = ctx.Request().Bind(&body)
	status, err := c.syncService.StartBackgroundIhrisSync(body.RunID)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(status)
}

func (c *IhrisController) Resume(ctx http.Context) http.Response {
	var body struct {
		RunID uint `json:"run_id"`
	}
	_ = ctx.Request().Bind(&body)
	status, err := c.syncService.ResumeBackgroundIhrisSync(body.RunID)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(status)
}

func (c *IhrisController) Cancel(ctx http.Context) http.Response {
	var body struct {
		RunID uint `json:"run_id"`
	}
	_ = ctx.Request().Bind(&body)
	status, err := c.syncService.CancelIhrisSync(body.RunID)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(status)
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
	// Alias: start background inbound sync (previous month by default).
	var body struct {
		YearMonth string `json:"year_month"`
		RunID     uint   `json:"run_id"`
	}
	_ = ctx.Request().Bind(&body)
	status, err := c.hrm.StartBackgroundHrmSync(body.YearMonth, body.RunID)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(status)
}

func (c *HrmAttendController) Start(ctx http.Context) http.Response {
	return c.Sync(ctx)
}

func (c *HrmAttendController) Resume(ctx http.Context) http.Response {
	var body struct {
		RunID uint `json:"run_id"`
	}
	_ = ctx.Request().Bind(&body)
	status, err := c.hrm.ResumeBackgroundHrmSync(body.RunID)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(status)
}

func (c *HrmAttendController) Cancel(ctx http.Context) http.Response {
	var body struct {
		RunID uint `json:"run_id"`
	}
	_ = ctx.Request().Bind(&body)
	status, err := c.hrm.CancelHrmSync(body.RunID)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(status)
}

func (c *HrmAttendController) Status(ctx http.Context) http.Response {
	status, err := c.hrm.SyncStatus()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(status)
}

func (c *HrmAttendController) PushExport(ctx http.Context) http.Response {
	limit := ctx.Request().QueryInt("limit", 100)
	result, err := c.hrm.PushPendingClocks(limit)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{
			"message": err.Error(),
			"result":  result,
		})
	}
	return ctx.Response().Success().Json(result)
}

func (c *HrmAttendController) ExportStatus(ctx http.Context) http.Response {
	pending, _ := c.hrm.CountPendingExportClocks()
	settings := services.NewSettingsService()
	return ctx.Response().Success().Json(http.Json{
		"pending":             pending,
		"export_push_enabled": settings.GetBool("hrm_attend.export_push_enabled", false),
		"last_push_at":        settings.GetString("hrm_attend.export_last_push_at", ""),
		"last_push_status":    settings.GetString("hrm_attend.export_last_push_status", ""),
	})
}

func (c *HrmAttendController) ListAttendanceClocks(ctx http.Context) http.Response {
	token := strings.TrimSpace(ctx.Request().Header("X-Hrm-Attend-Token", ""))
	if token == "" {
		auth := strings.TrimSpace(ctx.Request().Header("Authorization", ""))
		if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
			token = strings.TrimSpace(auth[7:])
		}
	}
	if !c.hrm.ValidateExportPullToken(token) {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": "invalid or missing export pull token"})
	}

	from := ctx.Request().Query("from", "")
	to := ctx.Request().Query("to", "")
	sinceID := uint(ctx.Request().QueryInt("since_id", 0))
	limit := ctx.Request().QueryInt("limit", 200)
	markExported := strings.EqualFold(ctx.Request().Query("mark_exported", "false"), "true")

	rows, err := c.hrm.ListClocksForPull(from, to, sinceID, limit)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	if markExported {
		ids := make([]uint, 0, len(rows))
		for _, r := range rows {
			ids = append(ids, r.ID)
		}
		_ = c.hrm.MarkClocksExported(ids)
	}
	return ctx.Response().Success().Json(http.Json{
		"data":  rows,
		"count": len(rows),
	})
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
	team := ctx.Request().Query("team", "My team")
	staffID := uint(ctx.Request().QueryInt("staff_id", 0))
	if staffID == 0 {
		if id, ok := authctx.StaffID(ctx); ok {
			staffID = id
		}
	}
	return ctx.Response().Success().Json(c.dashboardService.SupervisorDashboard(staffID, team, quarter))
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
