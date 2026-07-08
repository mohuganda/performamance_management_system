package providers

import (
	"context"

	"github.com/goravel/framework/auth/access"
	contractsaccess "github.com/goravel/framework/contracts/auth/access"
	"github.com/goravel/framework/contracts/foundation"

	"goravel/app/facades"
	"goravel/app/http/authctx"
	"goravel/app/services"
)

type RbacServiceProvider struct{}

func (p *RbacServiceProvider) Register(app foundation.Application) {}

func (p *RbacServiceProvider) Boot(app foundation.Application) {
	_ = services.NewAuthService().EnsureSuperAdmin()
	p.registerGatePolicies()
}

func (p *RbacServiceProvider) registerGatePolicies() {
	gate := facades.Gate()

	gate.Before(func(ctx context.Context, ability string, arguments map[string]any) contractsaccess.Response {
		if principal, ok := arguments["principal"].(authctx.Principal); ok && principal.IsSuperAdmin {
			return access.NewAllowResponse()
		}
		return nil
	})

	scope := services.NewScopeService()
	rbac := services.NewRbacService()

	defineStaffAbility := func(ability string, permission string) {
		gate.Define(ability, func(ctx context.Context, arguments map[string]any) contractsaccess.Response {
			principal, ok := arguments["principal"].(authctx.Principal)
			if !ok {
				return access.NewDenyResponse("unauthenticated")
			}
			if !rbac.HasPermission(principal, permission) {
				return access.NewDenyResponse("missing permission: " + permission)
			}
			staffID, ok := uintArg(arguments, "staff_id")
			if !ok {
				return access.NewDenyResponse("staff_id required")
			}
			if scope.CanAccessStaff(principal, staffID) {
				return access.NewAllowResponse()
			}
			return access.NewDenyResponse("outside assigned data scope")
		})
	}

	defineStaffAbility("staff.view", "staff.view")
	defineStaffAbility("leave.request.view", "leave.requests.view")
	defineStaffAbility("leave.request.create", "leave.requests.create")
	defineStaffAbility("oos.request.view", "oos.requests.view")
	defineStaffAbility("attendance.view", "attendance.view")

	gate.Define("leave.request.approve", func(ctx context.Context, arguments map[string]any) contractsaccess.Response {
		principal, ok := arguments["principal"].(authctx.Principal)
		if !ok {
			return access.NewDenyResponse("unauthenticated")
		}
		if !rbac.HasPermission(principal, "leave.requests.approve") {
			return access.NewDenyResponse("missing permission")
		}
		staffID, ok := uintArg(arguments, "staff_id")
		if !ok || principal.StaffID == nil {
			return access.NewDenyResponse("invalid approval context")
		}
		if scope.CanAccessStaff(principal, staffID) || scope.CanAccessStaff(principal, *principal.StaffID) {
			return access.NewAllowResponse()
		}
		return access.NewDenyResponse("cannot approve outside scope")
	})
}

func uintArg(arguments map[string]any, key string) (uint, bool) {
	raw, ok := arguments[key]
	if !ok {
		return 0, false
	}
	switch v := raw.(type) {
	case uint:
		return v, true
	case int:
		if v < 0 {
			return 0, false
		}
		return uint(v), true
	case int64:
		if v < 0 {
			return 0, false
		}
		return uint(v), true
	case float64:
		if v < 0 {
			return 0, false
		}
		return uint(v), true
	default:
		return 0, false
	}
}
