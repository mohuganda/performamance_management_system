package controllers

import (
	"strconv"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/http/authctx"
	"goravel/app/models"
	"goravel/app/services"
)

type RbacAdminController struct {
	auth  *services.AuthService
	rbac  *services.RbacService
	scope *services.ScopeService
	audit *services.AuditService
}

func NewRbacAdminController() *RbacAdminController {
	return &RbacAdminController{
		auth:  services.NewAuthService(),
		rbac:  services.NewRbacService(),
		scope: services.NewScopeService(),
		audit: services.NewAuditService(),
	}
}

// ListRoles godoc
// @Summary      List roles
// @Tags         admin-rbac
// @Security     BearerAuth
// @Router       /api/v1/admin/rbac/roles [get]
func (c *RbacAdminController) ListRoles(ctx http.Context) http.Response {
	category := ctx.Request().Query("category", "")
	var (
		rows []models.Role
		err  error
	)
	if category != "" {
		rows, err = c.rbac.ListRolesByCategory(category)
	} else {
		rows, err = c.rbac.ListRoles()
	}
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

// ListPermissions godoc
// @Summary      List permissions
// @Tags         admin-rbac
// @Security     BearerAuth
// @Router       /api/v1/admin/rbac/permissions [get]
func (c *RbacAdminController) ListPermissions(ctx http.Context) http.Response {
	rows, err := c.rbac.ListPermissions()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(rows)
}

// ListUsers godoc
// @Summary      List application users
// @Tags         admin-rbac
// @Security     BearerAuth
// @Router       /api/v1/admin/rbac/users [get]
func (c *RbacAdminController) ListUsers(ctx http.Context) http.Response {
	page, _ := strconv.Atoi(ctx.Request().Query("page", "1"))
	perPage, _ := strconv.Atoi(ctx.Request().Query("per_page", "0"))
	result, err := c.rbac.ListUsersPaginated(services.UserListFilter{
		Search:   ctx.Request().Query("search", ""),
		RoleCode: ctx.Request().Query("role_code", ""),
		Category: ctx.Request().Query("category", ""),
		IsActive: ctx.Request().Query("is_active", ""),
		ScopeDistrict: ctx.Request().Query("scope_district", ""),
		Page:          page,
		PerPage:  perPage,
	})
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

type updateUserBody struct {
	Name            *string `json:"name"`
	IsActive        *bool   `json:"is_active"`
	ScopeLevel      *string `json:"scope_level"`
	ScopeDistrictID *string `json:"scope_district_id"`
	ScopeFacilityID *uint   `json:"scope_facility_id"`
}

// UpdateUser godoc
// @Summary      Update application user
// @Tags         admin-rbac
// @Security     BearerAuth
// @Router       /api/v1/admin/rbac/users/{id} [patch]
func (c *RbacAdminController) UpdateUser(ctx http.Context) http.Response {
	userID, _ := strconv.ParseUint(ctx.Request().Route("id"), 10, 64)
	var body updateUserBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if body.Name == nil && body.IsActive == nil && body.ScopeLevel == nil && body.ScopeDistrictID == nil && body.ScopeFacilityID == nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "no fields to update"})
	}

	scopeInput := &services.UserScopeInput{
		ScopeLevel:      body.ScopeLevel,
		ScopeDistrictID: body.ScopeDistrictID,
		ScopeFacilityID: body.ScopeFacilityID,
	}
	hasScope := body.ScopeLevel != nil || body.ScopeDistrictID != nil || body.ScopeFacilityID != nil
	var scopePtr *services.UserScopeInput
	if hasScope {
		scopePtr = scopeInput
	}

	user, err := c.rbac.UpdateUser(uint(userID), body.Name, body.IsActive, scopePtr)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}

	if body.IsActive != nil && !*body.IsActive {
		c.logAudit(ctx, services.AuditEntry{
			Module: "rbac", Action: "user.deactivated", EntityType: "user", EntityID: ptrUint(uint(userID)),
			Summary: "Deactivated user account " + user.Email,
			Metadata: map[string]any{
				"revert": map[string]any{"user_id": userID},
				"before": map[string]any{"is_active": true},
				"after":  map[string]any{"is_active": false},
			},
			IsDangerous: true, IsRecoverable: true,
		})
	}
	return ctx.Response().Success().Json(user)
}

type assignRoleBody struct {
	RoleCode string `json:"role_code"`
}

// AssignUserRole godoc
// @Summary      Assign role to user
// @Tags         admin-rbac
// @Security     BearerAuth
// @Router       /api/v1/admin/rbac/users/{id}/roles [post]
func (c *RbacAdminController) AssignUserRole(ctx http.Context) http.Response {
	userID, _ := strconv.ParseUint(ctx.Request().Route("id"), 10, 64)
	var body assignRoleBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if err := c.rbac.AssignRole(uint(userID), body.RoleCode); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}

	sensitive := services.IsSensitiveRolePublic(body.RoleCode)
	c.logAudit(ctx, services.AuditEntry{
		Module: "rbac", Action: "role.assigned", EntityType: "user", EntityID: ptrUint(uint(userID)),
		Summary: "Assigned role " + body.RoleCode + " to user #" + strconv.FormatUint(userID, 10),
		Metadata: map[string]any{
			"revert": map[string]any{"user_id": userID, "role_code": body.RoleCode},
		},
		IsDangerous: sensitive, IsRecoverable: true,
	})
	return ctx.Response().Success().Json(http.Json{"message": "role assigned"})
}

// RevokeUserRole godoc
// @Summary      Revoke role from user
// @Tags         admin-rbac
// @Security     BearerAuth
// @Router       /api/v1/admin/rbac/users/{id}/roles [delete]
func (c *RbacAdminController) RevokeUserRole(ctx http.Context) http.Response {
	userID, _ := strconv.ParseUint(ctx.Request().Route("id"), 10, 64)
	roleCode := ctx.Request().Query("role_code", "")
	if roleCode == "" {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "role_code query required"})
	}
	if err := c.rbac.RevokeRole(uint(userID), roleCode); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}

	c.logAudit(ctx, services.AuditEntry{
		Module: "rbac", Action: "role.revoked", EntityType: "user", EntityID: ptrUint(uint(userID)),
		Summary: "Revoked role " + roleCode + " from user #" + strconv.FormatUint(userID, 10),
		Metadata: map[string]any{
			"revert": map[string]any{"user_id": userID, "role_code": roleCode},
		},
		IsDangerous: true, IsRecoverable: true,
	})
	return ctx.Response().Success().Json(http.Json{"message": "role revoked"})
}

type createUserBody struct {
	Name            string   `json:"name"`
	Email           string   `json:"email"`
	Password        string   `json:"password"`
	StaffID         *uint    `json:"staff_id"`
	RoleCodes       []string `json:"role_codes"`
	ScopeLevel      *string  `json:"scope_level"`
	ScopeDistrictID *string  `json:"scope_district_id"`
	ScopeFacilityID *uint    `json:"scope_facility_id"`
}

// CreateUser godoc
// @Summary      Create application user (database admin)
// @Tags         admin-rbac
// @Security     BearerAuth
// @Router       /api/v1/admin/rbac/users [post]
func (c *RbacAdminController) CreateUser(ctx http.Context) http.Response {
	var body createUserBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	user, err := c.auth.CreateUser(models.User{
		Name:     body.Name,
		Email:    body.Email,
		StaffID:  body.StaffID,
		Role:     firstOrEmpty(body.RoleCodes),
		IsActive: true,
	}, body.RoleCodes, body.Password)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}

	if body.ScopeLevel != nil || body.ScopeDistrictID != nil || body.ScopeFacilityID != nil {
		user, err = c.rbac.UpdateUser(user.ID, nil, nil, &services.UserScopeInput{
			ScopeLevel:      body.ScopeLevel,
			ScopeDistrictID: body.ScopeDistrictID,
			ScopeFacilityID: body.ScopeFacilityID,
		})
		if err != nil {
			return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
		}
	}

	c.logAudit(ctx, services.AuditEntry{
		Module: "rbac", Action: "user.created", EntityType: "user", EntityID: ptrUint(user.ID),
		Summary: "Created user account " + user.Email,
		Metadata: map[string]any{
			"roles": body.RoleCodes,
			"email": user.Email,
		},
		IsDangerous: false, IsRecoverable: false,
	})
	return ctx.Response().Status(http.StatusCreated).Json(user)
}

// ListScopeOptions godoc
// @Summary      District and facility options for user data scope
// @Tags         admin-rbac
// @Security     BearerAuth
// @Router       /api/v1/admin/rbac/scope-options [get]
func (c *RbacAdminController) ListScopeOptions(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(c.scope.ListScopeOptions())
}

type roleScopeBody struct {
	ScopeField    string   `json:"scope_field"`
	ScopeOperator string   `json:"scope_operator"`
	ScopeValues   []string `json:"scope_values"`
	Description   string   `json:"description"`
}

// SetRoleScope godoc
// @Summary      Configure data scope for a role
// @Tags         admin-rbac
// @Security     BearerAuth
// @Router       /api/v1/admin/rbac/roles/{id}/scopes [post]
func (c *RbacAdminController) SetRoleScope(ctx http.Context) http.Response {
	roleID, _ := strconv.ParseUint(ctx.Request().Route("id"), 10, 64)
	var body roleScopeBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if err := c.scope.SetRoleScope(uint(roleID), body.ScopeField, body.ScopeOperator, body.ScopeValues, body.Description); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	c.logAudit(ctx, services.AuditEntry{
		Module: "rbac", Action: "role.scope.updated", EntityType: "role", EntityID: ptrUint(uint(roleID)),
		Summary: "Updated data scope for role #" + strconv.FormatUint(roleID, 10),
		Metadata: map[string]any{
			"scope_field": body.ScopeField, "scope_operator": body.ScopeOperator,
		},
		IsDangerous: true, IsRecoverable: false,
	})
	return ctx.Response().Success().Json(http.Json{"message": "scope saved"})
}

type grantPermissionBody struct {
	RoleCode       string `json:"role_code"`
	PermissionCode string `json:"permission_code"`
}

// GrantRolePermission godoc
// @Summary      Grant permission to role
// @Tags         admin-rbac
// @Security     BearerAuth
// @Router       /api/v1/admin/rbac/grant-permission [post]
func (c *RbacAdminController) GrantRolePermission(ctx http.Context) http.Response {
	var body grantPermissionBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if body.RoleCode == "" || body.PermissionCode == "" {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "role_code and permission_code required"})
	}
	if err := c.rbac.GrantPermission(body.RoleCode, body.PermissionCode); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}

	c.logAudit(ctx, services.AuditEntry{
		Module: "rbac", Action: "permission.granted", EntityType: "role",
		Summary: "Granted " + body.PermissionCode + " to role " + body.RoleCode,
		Metadata: map[string]any{
			"revert": map[string]any{
				"role_code": body.RoleCode, "permission_code": body.PermissionCode,
			},
		},
		IsDangerous: true, IsRecoverable: true,
	})
	return ctx.Response().Success().Json(http.Json{"message": "permission granted"})
}

// ListAuditLogs godoc
// @Summary      List RBAC audit logs
// @Tags         admin-rbac
// @Security     BearerAuth
// @Router       /api/v1/admin/rbac/audit-logs [get]
func (c *RbacAdminController) ListAuditLogs(ctx http.Context) http.Response {
	page, _ := strconv.Atoi(ctx.Request().Query("page", "1"))
	perPage, _ := strconv.Atoi(ctx.Request().Query("per_page", "0"))
	result, err := c.audit.ListPaginated(services.AuditListFilter{
		Module:      ctx.Request().Query("module", ""),
		Action:      ctx.Request().Query("action", ""),
		Dangerous:   ctx.Request().Query("dangerous", ""),
		Recoverable: ctx.Request().Query("recoverable", ""),
		Recovered:   ctx.Request().Query("recovered", ""),
		Search:      ctx.Request().Query("search", ""),
		Page:        page,
		PerPage:     perPage,
	})
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

// RecoverAuditLog godoc
// @Summary      Recover a dangerous RBAC action
// @Tags         admin-rbac
// @Security     BearerAuth
// @Router       /api/v1/admin/rbac/audit-logs/{id}/recover [post]
func (c *RbacAdminController) RecoverAuditLog(ctx http.Context) http.Response {
	logID, _ := strconv.ParseUint(ctx.Request().Route("id"), 10, 64)
	actorID, ok := authctx.UserID(ctx)
	if !ok {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": "unauthorized"})
	}
	if err := c.audit.Recover(uint(logID), actorID); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	c.logAudit(ctx, services.AuditEntry{
		Module: "rbac", Action: "audit.recovered", EntityType: "audit_log", EntityID: ptrUint(uint(logID)),
		Summary: "Recovered dangerous action from audit log #" + strconv.FormatUint(logID, 10),
		IsDangerous: false, IsRecoverable: false,
	})
	return ctx.Response().Success().Json(http.Json{"message": "action recovered"})
}

func (c *RbacAdminController) logAudit(ctx http.Context, entry services.AuditEntry) {
	if principal, ok := authctx.PrincipalFrom(ctx); ok {
		id := principal.User.ID
		entry.ActorUserID = &id
		entry.ActorName = principal.User.Name
		entry.ActorEmail = principal.User.Email
	}
	entry.IpAddress = ctx.Request().Ip()
	_, _ = c.audit.Log(entry)
}

func firstOrEmpty(values []string) string {
	if len(values) == 0 {
		return "staff"
	}
	return values[0]
}

func ptrUint(v uint) *uint {
	return &v
}
