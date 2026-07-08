package seeders

import (
	"strings"

	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/services"
)

type RbacSeeder struct{}

func (s *RbacSeeder) Signature() string {
	return "RbacSeeder"
}

func (s *RbacSeeder) Run() error {
	if err := s.seedPermissions(); err != nil {
		return err
	}
	if err := s.seedRoles(); err != nil {
		return err
	}
	if err := s.seedRolePermissions(); err != nil {
		return err
	}
	if err := s.seedRoleScopes(); err != nil {
		return err
	}
	return s.seedDefaultAdmin()
}

func (s *RbacSeeder) seedPermissions() error {
	permissions := []models.Permission{
		{Code: "auth.users.manage", Module: "auth", Action: "manage", Name: "Manage users"},
		{Code: "auth.roles.manage", Module: "auth", Action: "manage", Name: "Manage roles and permissions"},
		{Code: "auth.audit.view", Module: "auth", Action: "view", Name: "View security audit logs"},
		{Code: "staff.view", Module: "staff", Action: "view", Name: "View staff within scope"},
		{Code: "leave.requests.create", Module: "leave", Action: "create", Name: "Create leave requests"},
		{Code: "leave.requests.view", Module: "leave", Action: "view", Name: "View leave requests"},
		{Code: "leave.requests.approve", Module: "leave", Action: "approve", Name: "Approve leave requests"},
		{Code: "leave.config.manage", Module: "leave", Action: "manage", Name: "Manage leave configuration"},
		{Code: "oos.requests.create", Module: "oos", Action: "create", Name: "Create out-of-station requests"},
		{Code: "oos.requests.view", Module: "oos", Action: "view", Name: "View out-of-station requests"},
		{Code: "oos.requests.approve", Module: "oos", Action: "approve", Name: "Approve out-of-station requests"},
		{Code: "attendance.clock", Module: "attendance", Action: "clock", Name: "Clock attendance"},
		{Code: "attendance.view", Module: "attendance", Action: "view", Name: "View attendance"},
		{Code: "dashboard.staff", Module: "dashboard", Action: "view", Name: "Staff dashboard"},
		{Code: "dashboard.supervisor", Module: "dashboard", Action: "view", Name: "Supervisor dashboard"},
		{Code: "dashboard.department_head", Module: "dashboard", Action: "view", Name: "Department head dashboard"},
		{Code: "dashboard.hr", Module: "dashboard", Action: "view", Name: "HR dashboard"},
		{Code: "dashboard.director", Module: "dashboard", Action: "view", Name: "Director dashboard"},
		{Code: "dashboard.executive", Module: "dashboard", Action: "view", Name: "Executive dashboard"},
		{Code: "ihris.sync", Module: "ihris", Action: "sync", Name: "Sync iHRIS data"},
		{Code: "settings.manage", Module: "settings", Action: "manage", Name: "Manage system settings"},
		{Code: "performance.view", Module: "performance", Action: "view", Name: "View performance plans and KPIs"},
		{Code: "performance.manage", Module: "performance", Action: "manage", Name: "Manage performance plans and KPIs"},
		{Code: "kpi.catalog.view", Module: "kpi", Action: "view", Name: "View KPI catalog"},
		{Code: "kpi.catalog.manage", Module: "kpi", Action: "manage", Name: "Manage KPI catalog"},
		{Code: "kpi.assignments.view", Module: "kpi", Action: "view", Name: "View KPI assignments"},
		{Code: "kpi.assignments.manage", Module: "kpi", Action: "manage", Name: "Manage KPI assignments"},
	}
	for _, perm := range permissions {
		var existing models.Permission
		if err := facades.Orm().Query().Where("code", perm.Code).FirstOr(&existing, func() error {
			return facades.Orm().Query().Create(&perm)
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *RbacSeeder) seedRoles() error {
	roles := []models.Role{
		{Code: "staff", Name: "Staff", Category: "operational", HierarchyLevel: 1, IsSystem: true},
		{Code: "supervisor", Name: "Supervisor", Category: "operational", HierarchyLevel: 2, IsSystem: true},
		{Code: "department_head", Name: "Department Head", Category: "executive", HierarchyLevel: 3, IsSystem: true},
		{Code: "hr_officer", Name: "Human Resource Officer", Category: "administrative", HierarchyLevel: 4, IsSystem: true},
		{Code: "director", Name: "Director", Category: "executive", HierarchyLevel: 5, IsSystem: true},
		{Code: "permanent_secretary", Name: "Permanent Secretary", Category: "executive", HierarchyLevel: 6, IsSystem: true},
		{Code: "executive_office", Name: "Executive Office", Category: "executive", HierarchyLevel: 6, IsSystem: true},
		{Code: "admin", Name: "Administrator", Category: "administrative", HierarchyLevel: 7, IsSystem: true},
		{Code: "super_admin", Name: "Super Administrator", Category: "system", HierarchyLevel: 99, IsSystem: true, IsActive: true},
	}
	for _, role := range roles {
		var existing models.Role
		if err := facades.Orm().Query().Where("code", role.Code).FirstOr(&existing, func() error {
			return facades.Orm().Query().Create(&role)
		}); err != nil {
			return err
		}
		if existing.ID > 0 {
			existing.Name = role.Name
			existing.Category = role.Category
			existing.HierarchyLevel = role.HierarchyLevel
			existing.IsSystem = role.IsSystem
			if err := facades.Orm().Query().Save(&existing); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *RbacSeeder) seedRolePermissions() error {
	matrix := map[string][]string{
		"staff": {
			"leave.requests.create", "leave.requests.view",
			"oos.requests.create", "oos.requests.view",
			"attendance.clock", "attendance.view",
			"dashboard.staff", "performance.view",
		},
		"supervisor": {
			"staff.view", "leave.requests.approve", "oos.requests.approve",
			"leave.requests.view", "oos.requests.view", "attendance.view",
			"dashboard.supervisor", "performance.view",
		},
		"department_head": {
			"staff.view", "leave.requests.view", "leave.requests.approve",
			"oos.requests.view", "oos.requests.approve", "attendance.view",
			"dashboard.department_head", "performance.view",
		},
		"hr_officer": {
			"staff.view", "leave.requests.view", "leave.requests.approve",
			"leave.config.manage", "oos.requests.view", "attendance.view",
			"dashboard.hr", "auth.users.manage", "performance.view", "performance.manage",
			"ihris.sync", "settings.manage",
			"kpi.catalog.view", "kpi.catalog.manage", "kpi.assignments.view", "kpi.assignments.manage",
		},
		"director": {
			"staff.view", "leave.requests.view", "leave.requests.approve",
			"oos.requests.view", "oos.requests.approve", "attendance.view",
			"dashboard.director", "performance.view",
		},
		"permanent_secretary": {
			"staff.view", "leave.requests.view", "leave.requests.approve",
			"oos.requests.view", "oos.requests.approve", "attendance.view",
			"dashboard.executive", "performance.view",
		},
		"executive_office": {
			"staff.view", "leave.requests.view", "oos.requests.view",
			"attendance.view", "dashboard.executive", "performance.view",
		},
		"admin": {
			"auth.users.manage", "auth.roles.manage", "auth.audit.view", "leave.config.manage",
			"staff.view", "leave.requests.view", "oos.requests.view",
			"attendance.view", "ihris.sync", "dashboard.hr",
			"performance.view", "performance.manage", "settings.manage",
			"kpi.catalog.view", "kpi.catalog.manage", "kpi.assignments.view", "kpi.assignments.manage",
		},
	}

	rbac := services.NewRbacService()
	for roleCode, perms := range matrix {
		for _, perm := range perms {
			if err := rbac.GrantPermission(roleCode, perm); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *RbacSeeder) seedRoleScopes() error {
	scope := services.NewScopeService()
	type scopeDef struct {
		role     string
		field    string
		operator string
		values   []string
		desc     string
	}
	defs := []scopeDef{
		{"staff", "staff_id", "self", nil, "Own records only"},
		{"supervisor", "staff_id", "supervised", nil, "Supervised staff"},
		{"department_head", "department_id", "eq", nil, "Same department"},
		{"hr_officer", "district_id", "eq", nil, "Same district"},
		{"director", "district_id", "eq", nil, "District-wide visibility"},
		{"permanent_secretary", "staff_id", "all", nil, "Organization-wide executive access"},
		{"executive_office", "staff_id", "all", nil, "Organization-wide"},
		{"admin", "staff_id", "all", nil, "Full data access"},
	}
	for _, def := range defs {
		var role models.Role
		if err := facades.Orm().Query().Where("code", def.role).First(&role); err != nil || !modelFound(role.ID) {
			continue
		}
		if err := scope.SetRoleScope(role.ID, def.field, def.operator, def.values, def.desc); err != nil {
			return err
		}
	}
	return nil
}

func (s *RbacSeeder) seedDefaultAdmin() error {
	email := strings.TrimSpace(strings.ToLower(seedEnv("ADMIN_EMAIL", "admin@moh.go.ug")))
	password := seedEnv("ADMIN_PASSWORD", "")
	name := seedEnv("ADMIN_NAME", "PMS Administrator")
	if email == "" || password == "" {
		return nil
	}

	var existing models.User
	if err := facades.Orm().Query().Where("email", email).First(&existing); err == nil && modelFound(existing.ID) {
		return services.NewRbacService().AssignRole(existing.ID, "admin")
	}

	_, err := services.NewAuthService().CreateUser(models.User{
		Name:     name,
		Email:    email,
		Role:     "admin",
		IsActive: true,
	}, []string{"admin"}, password)
	return err
}

func seedEnv(key string, fallback string) string {
	if s := facades.Config().GetString(key); s != "" {
		return s
	}
	v := facades.Config().Env(key, fallback)
	if s, ok := v.(string); ok && s != "" {
		return s
	}
	return fallback
}
