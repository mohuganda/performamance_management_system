package middleware

import (
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/http/authctx"
	"goravel/app/models"
	"goravel/app/services"
)

type Authenticate struct{}

func (m *Authenticate) Signature() string {
	return "authenticate"
}

func (m *Authenticate) Handle(ctx http.Context) {
	token := services.ParseBearerToken(ctx)
	if token == "" {
		ctx.Request().AbortWithStatusJson(http.StatusUnauthorized, http.Json{
			"message": "authentication required",
		})
		return
	}

	if _, err := facades.Auth(ctx).Parse(token); err != nil {
		ctx.Request().AbortWithStatusJson(http.StatusUnauthorized, http.Json{
			"message": "invalid or expired token",
		})
		return
	}

	var user models.User
	if err := facades.Auth(ctx).User(&user); err != nil {
		ctx.Request().AbortWithStatusJson(http.StatusUnauthorized, http.Json{
			"message": "user not found",
		})
		return
	}
	if !user.IsActive {
		ctx.Request().AbortWithStatusJson(http.StatusForbidden, http.Json{
			"message": "account is disabled",
		})
		return
	}

	principal, err := services.NewRbacService().LoadPrincipal(user)
	if err != nil {
		ctx.Request().AbortWithStatusJson(http.StatusInternalServerError, http.Json{
			"message": "failed to load permissions",
		})
		return
	}

	authctx.SetPrincipal(ctx, principal)
	ctx.Request().Next()
}

type RequirePermission struct {
	Codes []string
}

func Permission(codes ...string) *RequirePermission {
	return &RequirePermission{Codes: codes}
}

func (m *RequirePermission) Signature() string {
	return "permission:" + strings.Join(m.Codes, ",")
}

func (m *RequirePermission) Handle(ctx http.Context) {
	principal, ok := authctx.PrincipalFrom(ctx)
	if !ok {
		ctx.Request().AbortWithStatusJson(http.StatusUnauthorized, http.Json{
			"message": "authentication required",
		})
		return
	}

	if principal.IsSuperAdmin {
		ctx.Request().Next()
		return
	}

	for _, code := range m.Codes {
		if principal.Permissions[code] {
			ctx.Request().Next()
			return
		}
	}

	ctx.Request().AbortWithStatusJson(http.StatusForbidden, http.Json{
		"message": "insufficient permissions",
		"required": m.Codes,
	})
}
