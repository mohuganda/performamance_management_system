package controllers

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/http/authctx"
	"goravel/app/models"
	"goravel/app/services"
)

type AuthController struct {
	auth       *services.AuthService
	activation *services.AccountActivationService
	totp       *services.TotpService
}

func NewAuthController() *AuthController {
	return &AuthController{
		auth:       services.NewAuthService(),
		activation: services.NewAccountActivationService(),
		totp:       services.NewTotpService(),
	}
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

type requestActivationBody struct {
	Email string `json:"email"`
}

// RequestActivation godoc
// @Summary      Request account activation email for staff
// @Tags         auth
// @Router       /api/v1/auth/request-activation [post]
func (c *AuthController) RequestActivation(ctx http.Context) http.Response {
	var body requestActivationBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if err := c.activation.RequestActivation(body.Email); err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{
		"message": "If your email is registered with MoH staff records, you will receive an activation link within a few minutes.",
	})
}

// PreviewActivation godoc
// @Summary      Preview activation token
// @Tags         auth
// @Router       /api/v1/auth/activation/{token} [get]
func (c *AuthController) PreviewActivation(ctx http.Context) http.Response {
	token := ctx.Request().Route("token")
	preview, err := c.activation.PreviewToken(token)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(preview)
}

type completeActivationBody struct {
	Token    string `json:"token"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

// CompleteActivation godoc
// @Summary      Complete account activation
// @Tags         auth
// @Router       /api/v1/auth/activation/complete [post]
func (c *AuthController) CompleteActivation(ctx http.Context) http.Response {
	var body completeActivationBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	result, err := c.activation.CompleteActivation(ctx, services.CompleteActivationInput{
		Token:    body.Token,
		Password: body.Password,
		Name:     body.Name,
	})
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

type totpLoginBody struct {
	LoginChallenge string `json:"login_challenge"`
	Code           string `json:"code"`
}

// LoginTotp godoc
// @Summary      Complete login with authenticator code
// @Tags         auth
// @Router       /api/v1/auth/login/totp [post]
func (c *AuthController) LoginTotp(ctx http.Context) http.Response {
	var body totpLoginBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	result, err := c.auth.CompleteTotpLogin(ctx, body.LoginChallenge, body.Code)
	if err != nil {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

type totpCodeBody struct {
	Code string `json:"code"`
}

// TotpStatus godoc
// @Summary      Authenticator status
// @Tags         auth
// @Security     BearerAuth
// @Router       /api/v1/auth/totp/status [get]
func (c *AuthController) TotpStatus(ctx http.Context) http.Response {
	userID, ok := authctx.UserID(ctx)
	if !ok {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": "unauthenticated"})
	}
	var user models.User
	if err := facades.Orm().Query().Where("id", userID).First(&user); err != nil {
		return ctx.Response().Status(http.StatusNotFound).Json(http.Json{"message": "user not found"})
	}
	return ctx.Response().Success().Json(c.totp.Status(user))
}

// TotpEnroll godoc
// @Summary      Start authenticator enrollment
// @Tags         auth
// @Security     BearerAuth
// @Router       /api/v1/auth/totp/enroll [post]
func (c *AuthController) TotpEnroll(ctx http.Context) http.Response {
	userID, ok := authctx.UserID(ctx)
	if !ok {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": "unauthenticated"})
	}
	var user models.User
	if err := facades.Orm().Query().Where("id", userID).First(&user); err != nil {
		return ctx.Response().Status(http.StatusNotFound).Json(http.Json{"message": "user not found"})
	}
	result, err := c.totp.Enroll(&user)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

// TotpConfirm godoc
// @Summary      Confirm authenticator enrollment
// @Tags         auth
// @Security     BearerAuth
// @Router       /api/v1/auth/totp/confirm [post]
func (c *AuthController) TotpConfirm(ctx http.Context) http.Response {
	userID, ok := authctx.UserID(ctx)
	if !ok {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": "unauthenticated"})
	}
	var body totpCodeBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if err := c.totp.Confirm(userID, body.Code); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "authenticator enabled"})
}

// TotpDisable godoc
// @Summary      Disable authenticator
// @Tags         auth
// @Security     BearerAuth
// @Router       /api/v1/auth/totp/disable [post]
func (c *AuthController) TotpDisable(ctx http.Context) http.Response {
	userID, ok := authctx.UserID(ctx)
	if !ok {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": "unauthenticated"})
	}
	var body totpCodeBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if err := c.totp.Disable(userID, body.Code); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "authenticator disabled"})
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
			"is_active":               principal.User.IsActive,
			"must_change_password":    principal.User.MustChangePassword,
			"last_login_at":           principal.User.LastLoginAt,
			"password_changed_at":     principal.User.PasswordChangedAt,
			"totp_enabled":            principal.User.TotpEnabled,
			"activation_completed_at": principal.User.ActivationCompletedAt,
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
	if principal.IsSuperAdmin {
		var permissions []models.Permission
		if err := facades.Orm().Query().Get(&permissions); err == nil {
			list := make([]string, 0, len(permissions))
			for _, perm := range permissions {
				list = append(list, perm.Code)
			}
			return list
		}
	}
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
		"TotpEnabled":          user.TotpEnabled,
	}
}
