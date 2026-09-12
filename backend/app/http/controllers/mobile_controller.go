package controllers

import (
	"encoding/json"
	"strconv"
	"strings"
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
	approvals   *services.ApprovalsInboxService
}

func NewMobileController() *MobileController {
	return &MobileController{
		leave:       services.NewLeaveService(),
		oos:         services.NewOutOfStationService(),
		attendance:  services.NewAttendanceService(),
		approval:    services.NewApprovalService(),
		performance: services.NewPerformanceService(),
		approvals:   services.NewApprovalsInboxService(),
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
	rows, err := c.leave.ListRowsForStaff(staffID)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

// ListOicCandidates godoc
// @Summary      List staff candidates for Officer in Charge
// @Tags         mobile-leave
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/leave/oic-candidates [get]
func (c *MobileController) ListOicCandidates(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	candidates, err := services.NewSupervisorService().ListSupervisorCandidates()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	out := make([]services.SupervisorCandidate, 0, len(candidates))
	for _, cnd := range candidates {
		if cnd.StaffID == staffID {
			continue
		}
		out = append(out, cnd)
	}
	return ctx.Response().Success().Json(out)
}

type leaveRequestBody struct {
	LeaveTypeID      uint   `json:"leave_type_id"`
	StartDate        string `json:"start_date"`
	EndDate          string `json:"end_date"`
	Reason           string `json:"reason"`
	Clarification    string `json:"clarification"`
	MedicalReportURL string `json:"medical_report_url"`
	OicStaffID       uint   `json:"oic_staff_id"`
	Submit           bool   `json:"submit"`
}

// CreateLeaveRequest godoc
// @Summary      Create leave request (self-service)
// @Description  Creates a leave request as draft (submit=false) or submits immediately (submit=true). Clarification is optional on create; required when resubmitting a rejected request.
// @Tags         mobile-leave
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body body leaveRequestBody true "Leave request (submit=false saves draft)"
// @Success      201 {object} map[string]any
// @Failure      422 {object} map[string]any
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
		Clarification:    body.Clarification,
		MedicalReportURL: body.MedicalReportURL,
		OicStaffID:       body.OicStaffID,
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

// UpdateLeaveRequest godoc
// @Summary      Update draft or rejected leave request
// @Description  Updates an owned leave request in draft or rejected status. Set submit=true to save and submit in one call. When status is rejected, clarification is required before submit (explains the revision to approvers).
// @Tags         mobile-leave
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id path int true "Request ID"
// @Param        body body leaveRequestBody true "Leave fields (clarification required on rejected resubmit)"
// @Success      200 {object} map[string]any
// @Failure      422 {object} map[string]any
// @Router       /api/v1/mobile/leave/requests/{id} [put]
func (c *MobileController) UpdateLeaveRequest(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	id, _ := strconv.Atoi(ctx.Request().Route("id"))
	if id <= 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request id"})
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

	req, err := c.leave.UpdateDraft(staffID, uint(id), services.CreateLeaveInput{
		StaffID:          staffID,
		LeaveTypeID:      body.LeaveTypeID,
		StartDate:        start,
		EndDate:          end,
		Reason:           body.Reason,
		Clarification:    body.Clarification,
		MedicalReportURL: body.MedicalReportURL,
		OicStaffID:       body.OicStaffID,
	})
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	if body.Submit {
		if err := c.leave.Submit(req.ID, staffID); err != nil {
			return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
		}
		owned, _ := c.leave.GetOwned(staffID, req.ID)
		if owned != nil {
			return ctx.Response().Success().Json(owned)
		}
	}
	return ctx.Response().Success().Json(req)
}

// SubmitLeaveRequest godoc
// @Summary      Submit draft or rejected leave request
// @Description  Moves an owned draft or rejected leave request to pending approval. Rejected resubmits require a non-empty clarification field on the request and clear prior approval rows.
// @Tags         mobile-leave
// @Produce      json
// @Security     BearerAuth
// @Param        id path int true "Request ID"
// @Success      200 {object} map[string]any
// @Failure      422 {object} map[string]any
// @Router       /api/v1/mobile/leave/requests/{id}/submit [post]
func (c *MobileController) SubmitLeaveRequest(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	id, _ := strconv.Atoi(ctx.Request().Route("id"))
	if id <= 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request id"})
	}
	if err := c.leave.Submit(uint(id), staffID); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "leave request submitted"})
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
	Clarification        string  `json:"clarification"`
	AttachmentURL        string  `json:"attachment_url"`
	DestinationName      string  `json:"destination_name"`
	DestinationAddress   string  `json:"destination_address"`
	DestinationLatitude  float64 `json:"destination_latitude"`
	DestinationLongitude float64 `json:"destination_longitude"`
	GeofenceRadiusMeters int     `json:"geofence_radius_meters"`
	CachedPlaceID        uint    `json:"cached_place_id"`
	Submit               bool    `json:"submit"`
}

func oosInputFromBody(staffID uint, body oosRequestBody, start, end time.Time) services.CreateOutOfStationInput {
	return services.CreateOutOfStationInput{
		StaffID:              staffID,
		ReasonID:             body.ReasonID,
		StartDate:            start,
		EndDate:              end,
		Remarks:              body.Remarks,
		ExpectedDeliverables: body.ExpectedDeliverables,
		Clarification:        body.Clarification,
		AttachmentURL:        body.AttachmentURL,
		DestinationName:      body.DestinationName,
		DestinationAddress:   body.DestinationAddress,
		DestinationLatitude:  body.DestinationLatitude,
		DestinationLongitude: body.DestinationLongitude,
		GeofenceRadiusMeters: body.GeofenceRadiusMeters,
		CachedPlaceID:        body.CachedPlaceID,
	}
}

// CreateOosRequest godoc
// @Summary      Create out-of-station request
// @Description  Creates a travel request as draft (submit=false) or submits immediately (submit=true). Destination coordinates are used for GPS verification. Optional cached_place_id copies snapshot destination fields.
// @Tags         mobile-out-of-station
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body body oosRequestBody true "Out of station request (submit=false saves draft)"
// @Success      201 {object} map[string]any
// @Failure      422 {object} map[string]any
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

	req, err := c.oos.CreateDraft(oosInputFromBody(staffID, body, start, end))
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

// GetOosRequest godoc
// @Summary      Get out-of-station request by id
// @Description  Owner or assigned approver
// @Tags         mobile-out-of-station
// @Produce      json
// @Security     BearerAuth
// @Param        id path int true "Request ID"
// @Success      200 {object} map[string]any
// @Failure      404 {object} map[string]any
// @Router       /api/v1/mobile/out-of-station/requests/{id} [get]
func (c *MobileController) GetOosRequest(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	id, _ := strconv.Atoi(ctx.Request().Route("id"))
	if id <= 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request id"})
	}
	req, err := c.oos.GetForViewer(staffID, uint(id))
	if err != nil {
		return ctx.Response().Status(http.StatusNotFound).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(req)
}

// UpdateOosRequest godoc
// @Summary      Update draft or rejected out-of-station request
// @Description  Updates an owned travel request in draft or rejected status. Set submit=true to save and submit in one call. When status is rejected, clarification is required before submit.
// @Tags         mobile-out-of-station
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id path int true "Request ID"
// @Param        body body oosRequestBody true "Draft fields (clarification required on rejected resubmit)"
// @Success      200 {object} map[string]any
// @Failure      422 {object} map[string]any
// @Router       /api/v1/mobile/out-of-station/requests/{id} [put]
func (c *MobileController) UpdateOosRequest(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	id, _ := strconv.Atoi(ctx.Request().Route("id"))
	if id <= 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request id"})
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

	req, err := c.oos.UpdateDraft(staffID, uint(id), oosInputFromBody(staffID, body, start, end))
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	if body.Submit {
		if err := c.oos.Submit(req.ID, staffID); err != nil {
			return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
		}
		owned, _ := c.oos.GetOwned(staffID, req.ID)
		if owned != nil {
			return ctx.Response().Success().Json(owned)
		}
	}
	return ctx.Response().Success().Json(req)
}

// SubmitOosRequest godoc
// @Summary      Submit draft or rejected out-of-station request
// @Description  Moves an owned draft or rejected travel request to pending approval. Rejected resubmits require clarification and clear prior approval rows.
// @Tags         mobile-out-of-station
// @Produce      json
// @Security     BearerAuth
// @Param        id path int true "Request ID"
// @Success      200 {object} map[string]any
// @Failure      422 {object} map[string]any
// @Router       /api/v1/mobile/out-of-station/requests/{id}/submit [post]
func (c *MobileController) SubmitOosRequest(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	id, _ := strconv.Atoi(ctx.Request().Route("id"))
	if id <= 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request id"})
	}
	if err := c.oos.Submit(uint(id), staffID); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	req, err := c.oos.GetOwned(staffID, uint(id))
	if err != nil {
		return ctx.Response().Success().Json(http.Json{"message": "submitted"})
	}
	return ctx.Response().Success().Json(req)
}

// CancelOosRequest godoc
// @Summary      Cancel draft or pending out-of-station request
// @Tags         mobile-out-of-station
// @Produce      json
// @Security     BearerAuth
// @Param        id path int true "Request ID"
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/out-of-station/requests/{id}/cancel [post]
func (c *MobileController) CancelOosRequest(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	id, _ := strconv.Atoi(ctx.Request().Route("id"))
	if id <= 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request id"})
	}
	if err := c.oos.Cancel(staffID, uint(id)); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	req, err := c.oos.GetOwned(staffID, uint(id))
	if err != nil {
		return ctx.Response().Success().Json(http.Json{"message": "cancelled"})
	}
	return ctx.Response().Success().Json(req)
}

// RecallOosRequest godoc
// @Summary      Recall pending out-of-station request to draft
// @Tags         mobile-out-of-station
// @Produce      json
// @Security     BearerAuth
// @Param        id path int true "Request ID"
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/out-of-station/requests/{id}/recall [post]
func (c *MobileController) RecallOosRequest(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	id, _ := strconv.Atoi(ctx.Request().Route("id"))
	if id <= 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request id"})
	}
	if err := c.oos.Recall(staffID, uint(id)); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	req, err := c.oos.GetOwned(staffID, uint(id))
	if err != nil {
		return ctx.Response().Success().Json(http.Json{"message": "recalled"})
	}
	return ctx.Response().Success().Json(req)
}

// DeleteOosRequest godoc
// @Summary      Delete draft, pending, or rejected out-of-station request
// @Tags         mobile-out-of-station
// @Produce      json
// @Security     BearerAuth
// @Param        id path int true "Request ID"
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/out-of-station/requests/{id} [delete]
func (c *MobileController) DeleteOosRequest(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	id, _ := strconv.Atoi(ctx.Request().Route("id"))
	if id <= 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request id"})
	}
	if err := c.oos.Delete(staffID, uint(id)); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "deleted"})
}

// RecallLeaveRequest godoc
// @Summary      Recall pending leave request to draft
// @Tags         mobile-leave
// @Produce      json
// @Security     BearerAuth
// @Param        id path int true "Request ID"
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/leave/requests/{id}/recall [post]
func (c *MobileController) RecallLeaveRequest(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	id, _ := strconv.Atoi(ctx.Request().Route("id"))
	if id <= 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request id"})
	}
	if err := c.leave.Recall(staffID, uint(id)); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	req, err := c.leave.GetOwned(staffID, uint(id))
	if err != nil {
		return ctx.Response().Success().Json(http.Json{"message": "recalled"})
	}
	return ctx.Response().Success().Json(req)
}

// DeleteLeaveRequest godoc
// @Summary      Delete draft, pending, or rejected leave request
// @Tags         mobile-leave
// @Produce      json
// @Security     BearerAuth
// @Param        id path int true "Request ID"
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/leave/requests/{id} [delete]
func (c *MobileController) DeleteLeaveRequest(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	id, _ := strconv.Atoi(ctx.Request().Route("id"))
	if id <= 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request id"})
	}
	if err := c.leave.Delete(staffID, uint(id)); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "deleted"})
}

// CancelLeaveRequest godoc
// @Summary      Cancel draft or pending leave request
// @Tags         mobile-leave
// @Produce      json
// @Security     BearerAuth
// @Param        id path int true "Request ID"
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/leave/requests/{id}/cancel [post]
func (c *MobileController) CancelLeaveRequest(ctx http.Context) http.Response {
	staffID, err := staffIDFromContext(ctx)
	if err != nil || staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	id, _ := strconv.Atoi(ctx.Request().Route("id"))
	if id <= 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request id"})
	}
	if err := c.leave.Cancel(staffID, uint(id)); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	req, err := c.leave.GetOwned(staffID, uint(id))
	if err != nil {
		return ctx.Response().Success().Json(http.Json{"message": "cancelled"})
	}
	return ctx.Response().Success().Json(req)
}

type clockBody struct {
	ClockType               string  `json:"clock_type"`
	Latitude                float64 `json:"latitude"`
	Longitude               float64 `json:"longitude"`
	AccuracyMeters          float64 `json:"accuracy_meters"`
	LocationLabel           string  `json:"location_label"`
	OutOfStationRequestID   *uint   `json:"out_of_station_request_id"`
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
		StaffID:               staffID,
		ClockType:             body.ClockType,
		Latitude:              body.Latitude,
		Longitude:             body.Longitude,
		AccuracyMeters:        body.AccuracyMeters,
		LocationLabel:         body.LocationLabel,
		Source:                "mobile",
		OutOfStationRequestID: body.OutOfStationRequestID,
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

func (c *MobileController) GetPpaReviewDetail(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	ppaID, _ := strconv.ParseUint(ctx.Request().Query("ppa_id", "0"), 10, 64)
	if ppaID == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "ppa_id is required"})
	}
	detail, err := c.performance.GetPpaReviewDetail(staffID, uint(ppaID))
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, detail)
}

func (c *MobileController) GetReportReviewDetail(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	reportID, _ := strconv.ParseUint(ctx.Request().Query("report_id", "0"), 10, 64)
	if reportID == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "report_id is required"})
	}
	detail, err := c.performance.GetReportReviewDetail(staffID, uint(reportID))
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, detail)
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

// ApprovalsInbox godoc
// @Summary      Unified approvals inbox
// @Description  Pending and recent approval items across leave, OOS, and performance
// @Tags         mobile-approvals
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/approvals/inbox [get]
func (c *MobileController) ApprovalsInbox(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	payload, err := c.approvals.Inbox(staffID)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, payload)
}

// ApprovalDetail godoc
// @Summary      Approval detail with trail
// @Description  module = leave | out_of_station | ppa | report (etc.); id = request/report id
// @Tags         mobile-approvals
// @Produce      json
// @Security     BearerAuth
// @Param        module query string true "Module key"
// @Param        id query int true "Record id"
// @Success      200 {object} map[string]any
// @Router       /api/v1/mobile/approvals/detail [get]
func (c *MobileController) ApprovalDetail(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	module := strings.TrimSpace(ctx.Request().Query("module", ""))
	refID, _ := strconv.ParseUint(ctx.Request().Query("id", "0"), 10, 64)
	if module == "" || refID == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "module and id are required"})
	}
	detail, err := c.approvals.Detail(staffID, module, uint(refID))
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, detail)
}

func (c *MobileController) ReviewPerformancePpa(ctx http.Context) http.Response {
	staffID, _ := staffIDFromContext(ctx)
	if staffID == 0 {
		return ctx.Response().Status(http.StatusForbidden).Json(http.Json{"message": "authenticated user is not linked to a staff record"})
	}
	var body services.PpaReviewInput
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	ppa, err := c.performance.ReviewPpa(staffID, body)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, ppa)
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
