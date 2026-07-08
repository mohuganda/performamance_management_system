package authctx

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/http/contextkeys"
	"goravel/app/models"
)

type Principal struct {
	User         models.User
	Roles        []string
	Permissions  map[string]bool
	IsSuperAdmin bool
	StaffID      *uint
}

func SetPrincipal(ctx http.Context, principal Principal) {
	ctx.WithValue(contextkeys.AuthPrincipal, principal)
}

func PrincipalFrom(ctx http.Context) (Principal, bool) {
	raw := ctx.Value(contextkeys.AuthPrincipal)
	if raw == nil {
		return Principal{}, false
	}
	principal, ok := raw.(Principal)
	return principal, ok
}

func StaffID(ctx http.Context) (uint, bool) {
	principal, ok := PrincipalFrom(ctx)
	if !ok || principal.StaffID == nil || *principal.StaffID == 0 {
		return 0, false
	}
	return *principal.StaffID, true
}

func UserID(ctx http.Context) (uint, bool) {
	principal, ok := PrincipalFrom(ctx)
	if !ok || principal.User.ID == 0 {
		return 0, false
	}
	return principal.User.ID, true
}

func HasPermission(ctx http.Context, codes ...string) bool {
	principal, ok := PrincipalFrom(ctx)
	if !ok {
		return false
	}
	if principal.IsSuperAdmin {
		return true
	}
	for _, code := range codes {
		if principal.Permissions[code] {
			return true
		}
	}
	return false
}
