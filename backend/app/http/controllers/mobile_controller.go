package controllers

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/http/authctx"
	"goravel/app/services"
)

func jsonResponse(ctx http.Context, status int, obj any) http.Response {
	if status == http.StatusOK {
		return ctx.Response().Success().Json(obj)
	}
	payload, err := json.Marshal(obj)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Data(status, "application/json; charset=utf-8", payload)
}

type MobileController struct {
	leave       *services.LeaveService
	oos         *services.OutOfStationService
	attendance  *services.AttendanceService
	approval    *services.ApprovalService
	performance *services.PerformanceService
}

func NewMobileController() *MobileController {
	return &MobileController{
		leave:       services.NewLeaveService(),
		oos:         services.NewOutOfStationService(),
		attendance:  services.NewAttendanceService(),
		approval:    services.NewApprovalService(),
		performance: services.NewPerformanceService(),
	}
}

func staffIDFromContext(ctx http.Context) (uint, error) {
	if staffID, ok := authctx.StaffID(ctx); ok {
		return staffID, nil
	}
	return 0, nil
}

// ListLeaveTypes godoc
// @Summary      List active leave types
// @Description  Returns leave types from database configuration (not hardcoded)
// @Tags         mobile-leave
// @Produce      json
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/leave/types [get]
func (c *MobileController) ListLeaveTypes(ctx http.Context) http.Response {
	rows, err := c.leave.ListLeaveTypes()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

// LeaveConfig godoc
// @Summary      Full dynamic leave configuration
// @Description  Settings, types, entitlements, and approval stages loaded from database
// @Tags         mobile-leave
// @Produce      json
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/leave/config [get]
func (c *MobileController) LeaveConfig(ctx http.Context) http.Response {
	config, err := c.leave.PublicConfig()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(config)
}

// ListLeaveBalances godoc
// @Summary      Get leave balances
// @Tags         mobile-leave
// @Produce      json
// @Security     BearerAuth
// @Param        year query int false "Calendar year"
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/leave/balances [get]
func (c *MobileController) ListLeaveBalances(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	year := ctx.Request().QueryInt("year", time.Now().Year())
	rows, err := c.leave.BalanceRows(staffID, year)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

// ListLeaveRequests godoc
// @Summary      List my leave requests
// @Tags         mobile-leave
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/leave/requests [get]
func (c *MobileController) ListLeaveRequests(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	rows, err := c.leave.ListForStaff(staffID)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

type leaveRequestBody struct {
	LeaveTypeID      uint   `json:"leave_type_id"`
	StartDate        string `json:"start_date"`
	EndDate          string `json:"end_date"`
	Reason           string `json:"reason"`
	MedicalReportURL string `json:"medical_report_url"`
	Submit           bool   `json:"submit"`
}

// CreateLeaveRequest godoc
// @Summary      Create leave request (self-service)
// @Description  Per leave.md: submit at least 2 weeks in advance; sick leave >2 days needs medical report
// @Tags         mobile-leave
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body body leaveRequestBody true "Leave request"
// @Success      201 {object} map[string]any
// @Router       /api/v1/mobile/leave/requests [post]
func (c *MobileController) CreateLeaveRequest(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}

	var body leaveRequestBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}

	start, err1 := time.Parse("2006-01-02", body.StartDate)
	end, err2 := time.Parse("2006-01-02", body.EndDate)
	if err1 != nil || err2 != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "start_date and end_date must be YYYY-MM-DD"})
	}

	req, err := c.leave.CreateDraft(services.CreateLeaveInput{
		StaffID:          staffID,
		LeaveTypeID:      body.LeaveTypeID,
		StartDate:        start,
		EndDate:          end,
		Reason:           body.Reason,
		MedicalReportURL: body.MedicalReportURL,
	})
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}

	if body.Submit {
		if err := c.leave.Submit(req.ID, staffID); err != nil {
			return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
		}
	}

	return ctx.Response().Status(http.StatusCreated).Json(req)
}

// ListOosReasons godoc
// @Summary      List out-of-station reasons
// @Tags         mobile-out-of-station
// @Produce      json
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/out-of-station/reasons [get]
func (c *MobileController) ListOosReasons(ctx http.Context) http.Response {
	rows, err := c.oos.ListReasons()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

// ListOosRequests godoc
// @Summary      List my out-of-station requests
// @Tags         mobile-out-of-station
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/out-of-station/requests [get]
func (c *MobileController) ListOosRequests(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	rows, err := c.oos.ListForStaff(staffID)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

type oosRequestBody struct {
	ReasonID             uint    `json:"reason_id"`
	StartDate            string  `json:"start_date"`
	EndDate              string  `json:"end_date"`
	Remarks              string  `json:"remarks"`
	ExpectedDeliverables string  `json:"expected_deliverables"`
	AttachmentURL        string  `json:"attachment_url"`
	DestinationName      string  `json:"destination_name"`
	DestinationAddress   string  `json:"destination_address"`
	DestinationLatitude  float64 `json:"destination_latitude"`
	DestinationLongitude float64 `json:"destination_longitude"`
	GeofenceRadiusMeters int     `json:"geofence_radius_meters"`
	Submit               bool    `json:"submit"`
}

// CreateOosRequest godoc
// @Summary      Create out-of-station request
// @Description  Mirrors attend/requests/newRequest with map-picked destination coordinates for GPS verification
// @Tags         mobile-out-of-station
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body body oosRequestBody true "Out of station request"
// @Success      201 {object} map[string]any
// @Router       /api/v1/mobile/out-of-station/requests [post]
func (c *MobileController) CreateOosRequest(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}

	var body oosRequestBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}

	start, err1 := time.Parse("2006-01-02", body.StartDate)
	end, err2 := time.Parse("2006-01-02", body.EndDate)
	if err1 != nil || err2 != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "start_date and end_date must be YYYY-MM-DD"})
	}

	req, err := c.oos.CreateDraft(services.CreateOutOfStationInput{
		StaffID:              staffID,
		ReasonID:             body.ReasonID,
		StartDate:            start,
		EndDate:              end,
		Remarks:              body.Remarks,
		ExpectedDeliverables: body.ExpectedDeliverables,
		AttachmentURL:        body.AttachmentURL,
		DestinationName:      body.DestinationName,
		DestinationAddress:   body.DestinationAddress,
		DestinationLatitude:  body.DestinationLatitude,
		DestinationLongitude: body.DestinationLongitude,
		GeofenceRadiusMeters: body.GeofenceRadiusMeters,
	})
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}

	if body.Submit {
		if err := c.oos.Submit(req.ID, staffID); err != nil {
			return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
		}
	}

	return ctx.Response().Status(http.StatusCreated).Json(req)
}

type clockBody struct {
	ClockType      string  `json:"clock_type"`
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	LocationLabel  string  `json:"location_label"`
}

// Clock godoc
// @Summary      Clock in or out with GPS
// @Description  Compares GPS position against approved out-of-station destination when applicable
// @Tags         mobile-attendance
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body body clockBody true "Clock event"
// @Success      201 {object} map[string]any
// @Router       /api/v1/mobile/attendance/clock [post]
func (c *MobileController) Clock(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}

	var body clockBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}

	clock, err := c.attendance.Clock(services.ClockInput{
		StaffID:        staffID,
		ClockType:      body.ClockType,
		Latitude:       body.Latitude,
		Longitude:      body.Longitude,
		AccuracyMeters: body.AccuracyMeters,
		LocationLabel:  body.LocationLabel,
		Source:         "mobile",
	})
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}

	return ctx.Response().Status(http.StatusCreated).Json(clock)
}

// ListAttendance godoc
// @Summary      List my attendance clocks
// @Tags         mobile-attendance
// @Produce      json
// @Security     BearerAuth
// @Param        from query string false "From date YYYY-MM-DD"
// @Param        to query string false "To date YYYY-MM-DD"
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/attendance/clocks [get]
func (c *MobileController) ListAttendance(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}

	now := time.Now()
	from, _ := time.Parse("2006-01-02", ctx.Request().Query("from", now.AddDate(0, 0, -30).Format("2006-01-02")))
	to, _ := time.Parse("2006-01-02", ctx.Request().Query("to", now.Format("2006-01-02")))

	rows, err := c.attendance.ListForStaff(staffID, from, to)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

type approvalBody struct {
	Approve  bool   `json:"approve"`
	Comments string `json:"comments"`
}

// ApproveLeave godoc
// @Summary      Supervisor approve/reject leave
// @Tags         mobile-supervisor
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id path int true "Leave approval ID"
// @Param        body body approvalBody true "Decision"
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/leave/approvals/{id} [post]
func (c *MobileController) ApproveLeave(ctx http.Context) http.Response {
	supervisorID, _ := staffIDFromContext(ctx)
	if supervisorID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	approvalID64, _ := strconv.ParseUint(ctx.Request().Route("id"), 10, 64)
	approvalID := uint(approvalID64)
	var body approvalBody
	_ = ctx.Request().Bind(&body)

	if err := c.approval.ActOnLeaveApproval(approvalID, supervisorID, body.Approve, body.Comments); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "approval recorded"})
}

// ApproveOos godoc
// @Summary      Supervisor approve/reject out-of-station request
// @Tags         mobile-supervisor
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id path int true "Out-of-station approval ID"
// @Param        body body approvalBody true "Decision"
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/out-of-station/approvals/{id} [post]
func (c *MobileController) ApproveOos(ctx http.Context) http.Response {
	supervisorID, _ := staffIDFromContext(ctx)
	if supervisorID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	approvalID64, _ := strconv.ParseUint(ctx.Request().Route("id"), 10, 64)
	approvalID := uint(approvalID64)
	var body approvalBody
	_ = ctx.Request().Bind(&body)

	if err := c.approval.ActOnOutOfStationApproval(approvalID, supervisorID, body.Approve, body.Comments); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "approval recorded"})
}

// PerformanceSummary godoc
// @Summary      PPA and KPI summary for current staff
// @Tags         mobile-performance
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/performance/summary [get]
func (c *MobileController) PerformanceSummary(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	summary, err := c.performance.SummaryForStaff(staffID)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, summary)
}

func (c *MobileController) PerformanceWindows(ctx http.Context) http.Response {
	fy, err := c.performance.CurrentFinancialYear()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	config := services.NewPerformanceConfigService()
	payload, err := config.PublicConfig(fy)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, payload)
}

func (c *MobileController) ListPendingLeaveApprovals(ctx http.Context) http.Response {
	supervisorID, _ := staffIDFromContext(ctx)
	if supervisorID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	rows, err := c.approval.ListPendingLeaveApprovals(supervisorID)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

func (c *MobileController) ListPendingOosApprovals(ctx http.Context) http.Response {
	supervisorID, _ := staffIDFromContext(ctx)
	if supervisorID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	rows, err := c.approval.ListPendingOosApprovals(supervisorID)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

func (c *MobileController) ListPerformanceKpis(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	rows, err := c.performance.ListAvailableKpis(staffID)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	if rows == nil {
		rows = []services.AvailableKpi{}
	}
	return jsonResponse(ctx, http.StatusOK, rows)
}

func (c *MobileController) ListPerformanceKpisGrouped(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	rows, err := c.performance.ListAvailableKpisGrouped(staffID)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	if rows == nil {
		rows = []services.SubjectAreaAvailableGroup{}
	}
	return jsonResponse(ctx, http.StatusOK, rows)
}

func (c *MobileController) PerformanceReportForm(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	reportType := ctx.Request().Query("report_type", "q1")
	form, err := c.performance.GetReportForm(staffID, reportType)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, form)
}

type performancePlanBody struct {
	Kpis []services.PpaKpiInput `json:"kpis"`
}

func (c *MobileController) SavePerformancePlan(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	var body performancePlanBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	ppa, err := c.performance.SavePpaPlan(staffID, body.Kpis)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(ppa)
}

func (c *MobileController) SubmitPerformancePlan(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	if err := c.performance.SubmitPpa(staffID); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "performance plan submitted for supervisor review"})
}

type performanceReportBody struct {
	ReportType string                      `json:"report_type"`
	Entries    []services.ReportEntryInput `json:"entries"`
}

func (c *MobileController) SubmitPerformanceReport(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	var body performanceReportBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if body.ReportType == "" {
		body.ReportType = "q1"
	}
	if err := c.performance.SubmitReport(staffID, body.ReportType, body.Entries); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "performance report submitted"})
}

func (c *MobileController) SavePerformanceAppraisal(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	var body services.AppraisalSaveInput
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if body.ReportType == "" {
		body.ReportType = "endterm"
	}
	bundle, err := c.performance.SaveAppraisalDraft(staffID, body)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, bundle)
}

func (c *MobileController) GetPerformanceAppraisal(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	reportIDStr := ctx.Request().Query("report_id", "0")
	reportID, _ := strconv.ParseUint(reportIDStr, 10, 64)
	if reportID == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "report_id is required"})
	}
	bundle, err := c.performance.GetAppraisalForReview(staffID, uint(reportID))
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, bundle)
}

func (c *MobileController) ListPendingAppraisalReviews(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	rows, err := c.performance.ListPendingAppraisalReviews(staffID)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	if rows == nil {
		rows = []services.PendingAppraisalReview{}
	}
	return jsonResponse(ctx, http.StatusOK, rows)
}

func (c *MobileController) ReviewPerformanceAppraisal(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	var body services.AppraisalReviewInput
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	bundle, err := c.performance.ReviewAppraisal(staffID, body)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, bundle)
}

// PerformanceStatusReport godoc
// @Summary      Scoped PPA + quarterly submission/approval status with scores
// @Tags         mobile-performance
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/performance/status-report [get]
func (c *MobileController) PerformanceStatusReport(ctx http.Context) http.Response {
	principal, ok := authctx.PrincipalFrom(ctx)
	if !ok {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": "unauthenticated"})
	}
	report, err := c.performance.StatusReport(principal)
	if err != nil {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, report)
}

// PerformanceOverallRating godoc
// @Summary      Overall performance rating for the authenticated staff member
// @Tags         mobile-performance
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/performance/overall-rating [get]
func (c *MobileController) PerformanceOverallRating(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	rating, err := c.performance.OverallRatingForStaff(staffID)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, rating)
}
