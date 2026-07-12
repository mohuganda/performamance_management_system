package controllers

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/http/authctx"
	"goravel/app/services"
)

type StaffAdminController struct {
	supervisors *services.SupervisorService
	staffAdmin  *services.StaffAdminService
	activation  *services.AccountActivationService
	totp        *services.TotpService
}

func NewStaffAdminController() *StaffAdminController {
	return &StaffAdminController{
		supervisors: services.NewSupervisorService(),
		staffAdmin:  services.NewStaffAdminService(),
		activation:  services.NewAccountActivationService(),
		totp:        services.NewTotpService(),
	}
}

func (c *StaffAdminController) ListSupervisorCandidates(ctx http.Context) http.Response {
	rows, err := c.supervisors.ListSupervisorCandidates()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

type assignSupervisorBody struct {
	StaffID           uint `json:"staff_id"`
	SupervisorStaffID uint `json:"supervisor_staff_id"`
}

func (c *StaffAdminController) AssignSupervisor(ctx http.Context) http.Response {
	var body assignSupervisorBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if err := c.supervisors.AssignSupervisor(body.StaffID, body.SupervisorStaffID); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "supervisor assigned"})
}

func (c *StaffAdminController) RemoveSupervisor(ctx http.Context) http.Response {
	staffID := ctx.Request().RouteInt("staffId")
	if staffID == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "staff id required"})
	}
	if err := c.supervisors.RemoveSupervisor(uint(staffID)); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "supervisor removed"})
}

func (c *StaffAdminController) GetStaffSupervisors(ctx http.Context) http.Response {
	staffID := ctx.Request().RouteInt("id")
	if staffID == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "staff id required"})
	}
	rows, err := c.supervisors.GetStaffSupervisors(uint(staffID))
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

type setSupervisorsBody struct {
	Supervisors []services.SupervisorSlot `json:"supervisors"`
}

func (c *StaffAdminController) SetStaffSupervisors(ctx http.Context) http.Response {
	staffID := ctx.Request().RouteInt("id")
	if staffID == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "staff id required"})
	}
	var body setSupervisorsBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if err := c.supervisors.SetSupervisors(uint(staffID), body.Supervisors); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "supervisors updated"})
}

func (c *StaffAdminController) ListStaff(ctx http.Context) http.Response {
	search := ctx.Request().Query("search", "")
	departmentID := uint(ctx.Request().QueryInt("department_id", 0))
	hasSupervisor := ctx.Request().Query("has_supervisor", "")
	page := ctx.Request().QueryInt("page", 1)
	perPage := ctx.Request().QueryInt("per_page", 0)
	if perPage == 0 {
		perPage = ctx.Request().QueryInt("limit", 0)
	}

	result, err := c.staffAdmin.ListStaffPaginated(services.StaffListFilter{
		Search:        search,
		DepartmentID:  departmentID,
		HasSupervisor: hasSupervisor,
		Page:          page,
		PerPage:       perPage,
	})
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

func (c *StaffAdminController) ListSupervision(ctx http.Context) http.Response {
	search := ctx.Request().Query("search", "")
	hasSupervisor := ctx.Request().Query("has_supervisor", "")
	page := ctx.Request().QueryInt("page", 1)
	perPage := ctx.Request().QueryInt("per_page", 0)

	result, err := c.supervisors.ListStaffSupervisionPaginated(search, hasSupervisor, page, perPage)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

func (c *StaffAdminController) ListDepartments(ctx http.Context) http.Response {
	rows, err := c.staffAdmin.ListDepartments()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

type updateHrProfileBody struct {
	HrDepartmentID *uint  `json:"hr_department_id"`
	HrEmail        string `json:"hr_email"`
	HrMobile       string `json:"hr_mobile"`
	Notes          string `json:"notes"`
	IsLeaveManager *bool  `json:"is_leave_manager"`
	LockEmail      bool   `json:"lock_email"`
	LockDepartment bool   `json:"lock_department"`
	LockMobile     bool   `json:"lock_mobile"`
}

func (c *StaffAdminController) UpdateHrProfile(ctx http.Context) http.Response {
	staffID := ctx.Request().RouteInt("id")
	if staffID == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "staff id required"})
	}
	var body updateHrProfileBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	userID, _ := authctx.UserID(ctx)
	if err := c.staffAdmin.UpdateHrProfile(uint(staffID), userID, services.StaffHrProfileInput{
		HrDepartmentID: body.HrDepartmentID,
		HrEmail:        body.HrEmail,
		HrMobile:       body.HrMobile,
		Notes:          body.Notes,
		IsLeaveManager: body.IsLeaveManager,
		LockEmail:      body.LockEmail,
		LockDepartment: body.LockDepartment,
		LockMobile:     body.LockMobile,
	}); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "HR profile updated"})
}

func (c *StaffAdminController) SendActivation(ctx http.Context) http.Response {
	staffID := ctx.Request().RouteInt("id")
	if staffID == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "staff id required"})
	}
	if err := c.activation.SendActivationForStaff(uint(staffID)); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "activation email sent"})
}

func (c *StaffAdminController) ResetStaffAuthenticator(ctx http.Context) http.Response {
	staffID := ctx.Request().RouteInt("id")
	if staffID == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "staff id required"})
	}
	userID, err := services.FindUserIDByStaffID(uint(staffID))
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	if err := c.totp.AdminReset(userID); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "authenticator reset"})
}
