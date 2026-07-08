package controllers

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/http/authctx"
	"goravel/app/models"
	"goravel/app/services"
)

type AuthController struct {
	auth *services.AuthService
}

func NewAuthController() *AuthController {
	return &AuthController{auth: services.NewAuthService()}
}

type loginBody struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Login godoc
// @Summary      Authenticate and receive JWT
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body body loginBody true "Credentials"
// @Success      200 {object} map[string]any
// @Router       /api/v1/auth/login [post]
func (c *AuthController) Login(ctx http.Context) http.Response {
	var body loginBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}

	result, err := c.auth.Login(ctx, body.Email, body.Password)
	if err != nil {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

// Me godoc
// @Summary      Current user profile with roles and permissions
// @Tags         auth
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/auth/me [get]
func (c *AuthController) Me(ctx http.Context) http.Response {
	principal, err := c.auth.Me(ctx)
	if err != nil {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": err.Error()})
	}

	var staff any
	if principal.StaffID != nil && *principal.StaffID > 0 {
		if profile, profileErr := services.NewStaffAdminService().GetStaffProfile(*principal.StaffID); profileErr == nil {
			staff = profile
		}
	}

	return ctx.Response().Success().Json(http.Json{
		"user":        meUserResponse(principal.User),
		"roles":       principal.Roles,
		"permissions": permissionList(principal),
		"staff_id":    principal.StaffID,
		"staff":       staff,
		"account": map[string]any{
			"is_active":             principal.User.IsActive,
			"must_change_password":  principal.User.MustChangePassword,
			"last_login_at":         principal.User.LastLoginAt,
			"password_changed_at":   principal.User.PasswordChangedAt,
		},
	})
}

// Logout godoc
// @Summary      Invalidate JWT
// @Tags         auth
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/auth/logout [post]
func (c *AuthController) Logout(ctx http.Context) http.Response {
	if err := c.auth.Logout(ctx); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "logged out"})
}

// Refresh godoc
// @Summary      Refresh JWT
// @Tags         auth
// @Security     BearerAuth
// @Success      200 {object} map[string]any
// @Router       /api/v1/auth/refresh [post]
func (c *AuthController) Refresh(ctx http.Context) http.Response {
	token, err := c.auth.Refresh(ctx)
	if err != nil {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"token": token, "token_type": "Bearer"})
}

type changePasswordBody struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// ChangePassword godoc
// @Summary      Change own password
// @Tags         auth
// @Accept       json
// @Security     BearerAuth
// @Router       /api/v1/auth/change-password [post]
func (c *AuthController) ChangePassword(ctx http.Context) http.Response {
	userID, ok := authctx.UserID(ctx)
	if !ok {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": "unauthenticated"})
	}
	var body changePasswordBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if err := c.auth.ChangePassword(userID, body.CurrentPassword, body.NewPassword); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "password updated"})
}

type updateProfileBody struct {
	ProfilePhoto   *string `json:"profile_photo"`
	SignatureImage *string `json:"signature_image"`
}

// UpdateProfile godoc
// @Summary      Update profile photo and/or signature
// @Tags         auth
// @Accept       json
// @Security     BearerAuth
// @Router       /api/v1/auth/profile [put]
func (c *AuthController) UpdateProfile(ctx http.Context) http.Response {
	userID, ok := authctx.UserID(ctx)
	if !ok {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": "unauthenticated"})
	}
	var body updateProfileBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if body.ProfilePhoto == nil && body.SignatureImage == nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "nothing to update"})
	}
	user, err := c.auth.UpdateProfile(userID, body.ProfilePhoto, body.SignatureImage)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{
		"message": "profile updated",
		"user":    user,
	})
}

func permissionList(principal authctx.Principal) []string {
	list := make([]string, 0, len(principal.Permissions))
	for code := range principal.Permissions {
		list = append(list, code)
	}
	return list
}

func meUserResponse(user models.User) map[string]any {
	return map[string]any{
		"id":                   user.ID,
		"Name":                 user.Name,
		"Email":                user.Email,
		"Role":                 user.Role,
		"IsActive":             user.IsActive,
		"MustChangePassword":   user.MustChangePassword,
		"ProfilePhoto":         user.ProfilePhoto,
		"SignatureImage":       user.SignatureImage,
		"SignatureUpdatedAt":   user.SignatureUpdatedAt,
		"LastLoginAt":          user.LastLoginAt,
		"PasswordChangedAt":    user.PasswordChangedAt,
	}
}
