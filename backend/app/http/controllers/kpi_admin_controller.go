package controllers

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/services"
)

type KpiAdminController struct {
	kpi *services.KpiAdminService
}

func NewKpiAdminController() *KpiAdminController {
	return &KpiAdminController{kpi: services.NewKpiAdminService()}
}

func (c *KpiAdminController) PermissionCatalog(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(c.kpi.PermissionCatalog())
}

func (c *KpiAdminController) ListSubjectAreas(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(c.kpi.ListSubjectAreas())
}

func (c *KpiAdminController) ListCategories(ctx http.Context) http.Response {
	rows, err := c.kpi.ListCategories()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, rows)
}

func (c *KpiAdminController) NextKpiCode(ctx http.Context) http.Response {
	categoryID := uint(ctx.Request().QueryInt("category_id", 0))
	if categoryID == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "category_id is required"})
	}
	code, err := c.kpi.NextKpiCode(categoryID)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"kpi_code": code})
}

func (c *KpiAdminController) ListKpis(ctx http.Context) http.Response {
	search := ctx.Request().Query("search", "")
	subjectArea := uint8(ctx.Request().QueryInt("subject_area", 0))
	categoryID := uint(ctx.Request().QueryInt("category_id", 0))
	activeOnly := ctx.Request().QueryBool("active_only", false)
	page := ctx.Request().QueryInt("page", 1)
	perPage := ctx.Request().QueryInt("per_page", 0)
	if perPage == 0 {
		perPage = ctx.Request().QueryInt("limit", 0)
	}

	result, err := c.kpi.ListKpisPaginated(search, subjectArea, categoryID, activeOnly, page, perPage)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, result)
}

func (c *KpiAdminController) ShowKpi(ctx http.Context) http.Response {
	id := uint(ctx.Request().RouteInt("id"))
	kpi, err := c.kpi.GetKpi(id)
	if err != nil {
		return ctx.Response().Status(http.StatusNotFound).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(kpi)
}

type kpiBody struct {
	CategoryID          uint   `json:"category_id"`
	KpiCode             string `json:"kpi_code"`
	ShortName           string `json:"short_name"`
	IndicatorStatement  string `json:"indicator_statement"`
	Description         string `json:"description"`
	Computation         string `json:"computation"`
	Numerator           string `json:"numerator"`
	Denominator         string `json:"denominator"`
	Frequency           string `json:"frequency"`
	ComputationCategory string `json:"computation_category"`
	SubjectArea         *uint8 `json:"subject_area"`
	CurrentTarget       *int   `json:"current_target"`
	IsCumulative        bool   `json:"is_cumulative"`
	GaugeType           string `json:"gauge_type"`
	Status              bool   `json:"status"`
}

func (c *KpiAdminController) bodyToInput(body kpiBody) services.KpiInput {
	return services.KpiInput{
		CategoryID:          body.CategoryID,
		KpiCode:             body.KpiCode,
		ShortName:           body.ShortName,
		IndicatorStatement:  body.IndicatorStatement,
		Description:         body.Description,
		Computation:         body.Computation,
		Numerator:           body.Numerator,
		Denominator:         body.Denominator,
		Frequency:           body.Frequency,
		ComputationCategory: body.ComputationCategory,
		SubjectArea:         body.SubjectArea,
		CurrentTarget:       body.CurrentTarget,
		IsCumulative:        body.IsCumulative,
		GaugeType:           body.GaugeType,
		Status:              body.Status,
	}
}

func (c *KpiAdminController) CreateKpi(ctx http.Context) http.Response {
	var body kpiBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	body.Status = true
	kpi, err := c.kpi.CreateKpi(c.bodyToInput(body))
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(kpi)
}

func (c *KpiAdminController) UpdateKpi(ctx http.Context) http.Response {
	id := uint(ctx.Request().RouteInt("id"))
	var body kpiBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	kpi, err := c.kpi.UpdateKpi(id, c.bodyToInput(body))
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(kpi)
}

func (c *KpiAdminController) DeactivateKpi(ctx http.Context) http.Response {
	id := uint(ctx.Request().RouteInt("id"))
	if err := c.kpi.DeactivateKpi(id); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "kpi deactivated"})
}

func (c *KpiAdminController) ListAssignments(ctx http.Context) http.Response {
	assignableType := ctx.Request().Query("assignable_type", "")
	kpiID := uint(ctx.Request().QueryInt("kpi_id", 0))
	search := ctx.Request().Query("search", "")
	page := ctx.Request().QueryInt("page", 1)
	perPage := ctx.Request().QueryInt("per_page", 0)

	result, err := c.kpi.ListAssignmentsPaginated(assignableType, kpiID, search, page, perPage)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, result)
}

type kpiAssignmentBody struct {
	KpiID          uint   `json:"kpi_id"`
	KpiIDs         []uint `json:"kpi_ids"`
	AssignableType string `json:"assignable_type"`
	JobID          *uint  `json:"job_id"`
	DepartmentID   *uint  `json:"department_id"`
	StaffID        *uint  `json:"staff_id"`
}

func (c *KpiAdminController) CreateAssignment(ctx http.Context) http.Response {
	var body kpiAssignmentBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if len(body.KpiIDs) > 0 {
		result, err := c.kpi.CreateAssignmentsBulk(services.KpiAssignmentInput{
			KpiIDs:         body.KpiIDs,
			AssignableType: body.AssignableType,
			JobID:          body.JobID,
			DepartmentID:   body.DepartmentID,
			StaffID:        body.StaffID,
		})
		if err != nil {
			return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{
				"message": err.Error(),
				"result":  result,
			})
		}
		return ctx.Response().Success().Json(result)
	}
	row, err := c.kpi.CreateAssignment(services.KpiAssignmentInput{
		KpiID:          body.KpiID,
		AssignableType: body.AssignableType,
		JobID:          body.JobID,
		DepartmentID:   body.DepartmentID,
		StaffID:        body.StaffID,
	})
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(row)
}

func (c *KpiAdminController) DeactivateAssignment(ctx http.Context) http.Response {
	id := uint(ctx.Request().RouteInt("id"))
	if id == 0 {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "assignment id required"})
	}
	if err := c.kpi.DeactivateAssignment(id); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "assignment removed"})
}

func (c *KpiAdminController) ListJobs(ctx http.Context) http.Response {
	rows, err := c.kpi.ListJobs()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, rows)
}

func (c *KpiAdminController) ListDepartments(ctx http.Context) http.Response {
	rows, err := c.kpi.ListDepartments()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, rows)
}

func (c *KpiAdminController) SearchStaff(ctx http.Context) http.Response {
	search := ctx.Request().Query("search", "")
	rows, err := c.kpi.SearchStaff(search, 30)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return jsonResponse(ctx, http.StatusOK, rows)
}
