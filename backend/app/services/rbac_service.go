package services

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/http/authctx"
	"goravel/app/models"
)

type RbacService struct {
	scope *ScopeService
}

func NewRbacService() *RbacService {
	return &RbacService{scope: NewScopeService()}
}

type RbacUserRow struct {
	ID              uint       `json:"id"`
	Name            string     `json:"name"`
	Email           string     `json:"email"`
	IsActive        bool       `json:"is_active"`
	IsSuperAdmin    bool       `json:"is_super_admin"`
	StaffID         *uint      `json:"staff_id,omitempty"`
	PrimaryRole     string     `json:"primary_role"`
	Roles           []string   `json:"roles"`
	AccountCategory string     `json:"account_category"`
	LastLoginAt     *time.Time `json:"last_login_at,omitempty"`
	ScopeLevel      string     `json:"scope_level,omitempty"`
	ScopeDistrictID string     `json:"scope_district_id,omitempty"`
	ScopeFacilityID *uint      `json:"scope_facility_id,omitempty"`
	ScopeFacility   string     `json:"scope_facility_name,omitempty"`
	ScopeDistrict   string     `json:"scope_district_name,omitempty"`
}

type UserScopeInput struct {
	ScopeLevel      *string
	ScopeDistrictID *string
	ScopeFacilityID *uint
}

type ScopeOptionRow struct {
	Districts  []ScopeDistrictOption  `json:"districts"`
	Facilities []ScopeFacilityOption  `json:"facilities"`
	Levels     []ScopeLevelOption     `json:"levels"`
}

type ScopeDistrictOption struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ScopeFacilityOption struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
}

type ScopeLevelOption struct {
	Value       string `json:"value"`
	Label       string `json:"label"`
	Description string `json:"description"`
}

type UserListFilter struct {
	Search         string
	RoleCode       string
	Category       string
	IsActive       string
	ScopeDistrict  string
	Page           int
	PerPage        int
}

type RoleScope struct {
	Field    string
	Operator string
	Values   []string
}

func (s *RbacService) LoadPrincipal(user models.User) (authctx.Principal, error) {
	principal := authctx.Principal{
		User:         user,
		Roles:        []string{},
		Permissions:  map[string]bool{},
		IsSuperAdmin: user.IsSuperAdmin,
		StaffID:      user.StaffID,
	}

	if user.IsSuperAdmin {
		principal.Roles = append(principal.Roles, "super_admin")
		return principal, nil
	}

	cacheKey := fmt.Sprintf("rbac:user:%d:permissions", user.ID)
	if cached := facades.Cache().Get(cacheKey, nil); cached != nil {
		if payload, ok := cached.(string); ok && payload != "" {
			var cachedPrincipal authctx.Principal
			if json.Unmarshal([]byte(payload), &cachedPrincipal) == nil {
				cachedPrincipal.User = user
				return cachedPrincipal, nil
			}
		}
	}

	var userRoles []models.UserRole
	if err := facades.Orm().Query().Where("user_id", user.ID).Get(&userRoles); err != nil {
		return principal, err
	}
	if len(userRoles) == 0 && user.Role != "" {
		var role models.Role
		if err := facades.Orm().Query().Where("code", user.Role).First(&role); err == nil && role.ID > 0 {
			userRoles = append(userRoles, models.UserRole{UserID: user.ID, RoleID: role.ID})
		}
	}

	roleIDs := make([]uint, 0, len(userRoles))
	for _, ur := range userRoles {
		roleIDs = append(roleIDs, ur.RoleID)
	}
	if len(roleIDs) == 0 {
		return principal, nil
	}

	var roles []models.Role
	if err := facades.Orm().Query().Where("id", roleIDs).Where("is_active", true).Get(&roles); err != nil {
		return principal, err
	}

	for _, role := range roles {
		principal.Roles = append(principal.Roles, role.Code)
	}

	var rolePerms []models.RolePermission
	if err := facades.Orm().Query().Where("role_id", roleIDs).Get(&rolePerms); err != nil {
		return principal, err
	}
	if len(rolePerms) == 0 {
		return principal, nil
	}

	permIDs := make([]uint, 0, len(rolePerms))
	for _, rp := range rolePerms {
		permIDs = append(permIDs, rp.PermissionID)
	}

	var permissions []models.Permission
	if err := facades.Orm().Query().Where("id", permIDs).Get(&permissions); err != nil {
		return principal, err
	}
	for _, perm := range permissions {
		principal.Permissions[perm.Code] = true
	}

	ttl := facades.Config().GetInt("security.auth.permission_cache_ttl", 300)
	if encoded, err := json.Marshal(principal); err == nil {
		_ = facades.Cache().Put(cacheKey, string(encoded), time.Duration(ttl)*time.Second)
	}

	return principal, nil
}

func (s *RbacService) InvalidateUserCache(userID uint) {
	_ = facades.Cache().Forget(fmt.Sprintf("rbac:user:%d:permissions", userID))
}

func (s *RbacService) HasPermission(principal authctx.Principal, codes ...string) bool {
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

func (s *RbacService) CanAccessStaff(principal authctx.Principal, targetStaffID uint) bool {
	if principal.IsSuperAdmin {
		return true
	}
	if principal.StaffID != nil && *principal.StaffID == targetStaffID {
		return true
	}
	return s.scope.CanAccessStaff(principal, targetStaffID)
}

func (s *RbacService) RoleScopes(roleCodes []string) ([]RoleScope, error) {
	if len(roleCodes) == 0 {
		return nil, nil
	}
	var roles []models.Role
	if err := facades.Orm().Query().Where("code", roleCodes).Get(&roles); err != nil {
		return nil, err
	}
	roleIDs := make([]uint, 0, len(roles))
	for _, role := range roles {
		roleIDs = append(roleIDs, role.ID)
	}
	var scopes []models.RoleDataScope
	if err := facades.Orm().Query().Where("role_id", roleIDs).Get(&scopes); err != nil {
		return nil, err
	}

	result := make([]RoleScope, 0, len(scopes))
	for _, scope := range scopes {
		rs := RoleScope{Field: scope.ScopeField, Operator: scope.ScopeOperator}
		if scope.ScopeValues != nil && *scope.ScopeValues != "" {
			_ = json.Unmarshal([]byte(*scope.ScopeValues), &rs.Values)
		}
		result = append(result, rs)
	}
	return result, nil
}

func (s *RbacService) AssignRole(userID uint, roleCode string) error {
	var role models.Role
	if err := facades.Orm().Query().Where("code", roleCode).First(&role); err != nil {
		return err
	}
	if role.ID == 0 {
		return fmt.Errorf("role not found")
	}
	if role.Code == "super_admin" {
		return fmt.Errorf("super_admin role cannot be assigned via API")
	}

	var existing models.UserRole
	if err := facades.Orm().Query().Where("user_id", userID).Where("role_id", role.ID).First(&existing); err == nil && existing.ID > 0 {
		return nil
	}

	if err := facades.Orm().Query().Create(&models.UserRole{UserID: userID, RoleID: role.ID}); err != nil {
		return err
	}
	s.InvalidateUserCache(userID)
	return nil
}

func (s *RbacService) RevokeRole(userID uint, roleCode string) error {
	var role models.Role
	if err := facades.Orm().Query().Where("code", roleCode).First(&role); err != nil {
		return err
	}
	if role.ID == 0 {
		return fmt.Errorf("role not found")
	}
	if role.Code == "super_admin" {
		return fmt.Errorf("super_admin role cannot be revoked via API")
	}
	_, err := facades.Orm().Query().
		Where("user_id", userID).
		Where("role_id", role.ID).
		Delete(&models.UserRole{})
	if err == nil {
		s.InvalidateUserCache(userID)
	}
	return err
}

func (s *RbacService) ListRoles() ([]models.Role, error) {
	var rows []models.Role
	err := facades.Orm().Query().Order("hierarchy_level asc").Get(&rows)
	return rows, err
}

func (s *RbacService) ListPermissions() ([]models.Permission, error) {
	var rows []models.Permission
	err := facades.Orm().Query().Order("module asc, action asc").Get(&rows)
	return rows, err
}

func (s *RbacService) GrantPermission(roleCode string, permissionCode string) error {
	var role models.Role
	if err := facades.Orm().Query().Where("code", roleCode).First(&role); err != nil {
		return err
	}
	if role.ID == 0 {
		return fmt.Errorf("role not found")
	}
	var permission models.Permission
	if err := facades.Orm().Query().Where("code", permissionCode).First(&permission); err != nil {
		return err
	}
	if permission.ID == 0 {
		return fmt.Errorf("permission not found")
	}
	var existing models.RolePermission
	if err := facades.Orm().Query().
		Where("role_id", role.ID).
		Where("permission_id", permission.ID).
		First(&existing); err == nil && existing.ID > 0 {
		return nil
	}
	return facades.Orm().Query().Create(&models.RolePermission{
		RoleID:       role.ID,
		PermissionID: permission.ID,
	})
}

func (s *RbacService) RevokePermission(roleCode string, permissionCode string) error {
	var role models.Role
	if err := facades.Orm().Query().Where("code", roleCode).First(&role); err != nil {
		return err
	}
	if role.ID == 0 {
		return fmt.Errorf("role not found")
	}
	var permission models.Permission
	if err := facades.Orm().Query().Where("code", permissionCode).First(&permission); err != nil {
		return err
	}
	if permission.ID == 0 {
		return fmt.Errorf("permission not found")
	}
	_, err := facades.Orm().Query().
		Where("role_id", role.ID).
		Where("permission_id", permission.ID).
		Delete(&models.RolePermission{})
	return err
}

func (s *RbacService) SetUserActive(userID uint, active bool) error {
	var user models.User
	if err := facades.Orm().Query().Where("id", userID).First(&user); err != nil || user.ID == 0 {
		return fmt.Errorf("user not found")
	}
	if user.IsSuperAdmin && !active {
		return fmt.Errorf("super admin account cannot be deactivated")
	}
	user.IsActive = active
	if err := facades.Orm().Query().Save(&user); err != nil {
		return err
	}
	s.InvalidateUserCache(userID)
	return nil
}

func (s *RbacService) UpdateUser(userID uint, name *string, isActive *bool, scope *UserScopeInput) (models.User, error) {
	var user models.User
	if err := facades.Orm().Query().Where("id", userID).First(&user); err != nil || user.ID == 0 {
		return models.User{}, fmt.Errorf("user not found")
	}
	if name != nil && strings.TrimSpace(*name) != "" {
		user.Name = strings.TrimSpace(*name)
	}
	if isActive != nil {
		if user.IsSuperAdmin && !*isActive {
			return models.User{}, fmt.Errorf("super admin account cannot be deactivated")
		}
		user.IsActive = *isActive
	}
	if scope != nil {
		if err := s.applyUserScope(&user, scope); err != nil {
			return models.User{}, err
		}
	}
	if err := facades.Orm().Query().Save(&user); err != nil {
		return models.User{}, err
	}
	s.InvalidateUserCache(userID)
	user.Password = ""
	return user, nil
}

func (s *RbacService) applyUserScope(user *models.User, scope *UserScopeInput) error {
	if scope.ScopeLevel != nil {
		level := strings.TrimSpace(strings.ToLower(*scope.ScopeLevel))
		if level == "" {
			user.ScopeLevel = nil
		} else {
			user.ScopeLevel = strPtr(level)
		}
	}
	if scope.ScopeDistrictID != nil {
		district := strings.TrimSpace(*scope.ScopeDistrictID)
		if district == "" {
			user.ScopeDistrictID = nil
		} else {
			user.ScopeDistrictID = strPtr(strings.ToUpper(district))
		}
	}
	if scope.ScopeFacilityID != nil {
		if *scope.ScopeFacilityID == 0 {
			user.ScopeFacilityID = nil
		} else {
			var facility models.Facility
			if err := facades.Orm().Query().Where("id", *scope.ScopeFacilityID).First(&facility); err != nil || facility.ID == 0 {
				return fmt.Errorf("facility not found")
			}
			user.ScopeFacilityID = scope.ScopeFacilityID
		}
	}
	if user.ScopeLevel != nil && s.scope.HasNationalScope(*user) {
		user.ScopeDistrictID = nil
		user.ScopeFacilityID = nil
	}
	return nil
}

func (s *ScopeService) ListScopeOptions() ScopeOptionRow {
	levels := []ScopeLevelOption{
		{Value: "staff", Label: "Staff-linked", Description: "Scope follows the linked iHRIS staff placement"},
		{Value: "facility", Label: "Facility", Description: "Access limited to one health facility"},
		{Value: "district", Label: "District", Description: "Access across all facilities in a district (HR, Directors)"},
		{Value: "national", Label: "National (MoH)", Description: "Organization-wide visibility for MoH overseers"},
	}

	var facilities []models.Facility
	_ = facades.Orm().Query().Where("is_active", true).Order("name asc").Limit(500).Get(&facilities)
	facilityOpts := make([]ScopeFacilityOption, 0, len(facilities))
	districtSet := map[string]string{}
	for _, f := range facilities {
		facilityOpts = append(facilityOpts, ScopeFacilityOption{ID: f.ID, Name: f.Name})
		if f.DistrictID != nil && strings.TrimSpace(*f.DistrictID) != "" {
			id := strings.ToUpper(strings.TrimSpace(*f.DistrictID))
			name := id
			if f.DistrictName != nil && strings.TrimSpace(*f.DistrictName) != "" {
				name = strings.TrimSpace(*f.DistrictName)
			}
			districtSet[id] = name
		}
	}

	districts := make([]ScopeDistrictOption, 0, len(districtSet))
	for id, name := range districtSet {
		districts = append(districts, ScopeDistrictOption{ID: id, Name: name})
	}

	return ScopeOptionRow{
		Districts:  districts,
		Facilities: facilityOpts,
		Levels:     levels,
	}
}

func (s *RbacService) buildUserRow(user models.User, roles []string, category string) RbacUserRow {
	row := RbacUserRow{
		ID:              user.ID,
		Name:            user.Name,
		Email:           user.Email,
		IsActive:        user.IsActive,
		IsSuperAdmin:    user.IsSuperAdmin,
		StaffID:         user.StaffID,
		PrimaryRole:     user.Role,
		Roles:           roles,
		AccountCategory: category,
		LastLoginAt:     user.LastLoginAt,
	}
	if user.ScopeLevel != nil {
		row.ScopeLevel = *user.ScopeLevel
	}
	if user.ScopeDistrictID != nil {
		row.ScopeDistrictID = *user.ScopeDistrictID
		row.ScopeDistrict = *user.ScopeDistrictID
	}
	if user.ScopeFacilityID != nil {
		row.ScopeFacilityID = user.ScopeFacilityID
		var facility models.Facility
		if err := facades.Orm().Query().Where("id", *user.ScopeFacilityID).First(&facility); err == nil && facility.ID > 0 {
			row.ScopeFacility = facility.Name
		}
	}
	return row
}

func (s *RbacService) ListUsersPaginated(filter UserListFilter) (PaginatedResult[RbacUserRow], error) {
	page, perPage := ResolvePage(filter.Page, filter.PerPage)
	query := facades.Orm().Query().Order("id desc")
	if search := strings.TrimSpace(filter.Search); search != "" {
		like := "%" + search + "%"
		query = query.Where("name LIKE ? OR email LIKE ?", like, like)
	}
	if filter.IsActive == "true" {
		query = query.Where("is_active", true)
	} else if filter.IsActive == "false" {
		query = query.Where("is_active", false)
	}

	var users []models.User
	if err := query.Get(&users); err != nil {
		return PaginatedResult[RbacUserRow]{}, err
	}

	roleByID := map[uint]models.Role{}
	var allRoles []models.Role
	_ = facades.Orm().Query().Get(&allRoles)
	for _, role := range allRoles {
		roleByID[role.ID] = role
	}

	userRolesMap := map[uint][]string{}
	var userRoles []models.UserRole
	_ = facades.Orm().Query().Get(&userRoles)
	for _, ur := range userRoles {
		if role, ok := roleByID[ur.RoleID]; ok {
			userRolesMap[ur.UserID] = append(userRolesMap[ur.UserID], role.Code)
		}
	}

	rows := make([]RbacUserRow, 0, len(users))
	for _, user := range users {
		roles := userRolesMap[user.ID]
		if len(roles) == 0 && user.Role != "" {
			roles = []string{user.Role}
		}
		if user.IsSuperAdmin {
			roles = appendUnique(roles, "super_admin")
		}
		category := accountCategoryForRoles(roles, roleByID)
		if filter.RoleCode != "" && !containsString(roles, filter.RoleCode) {
			continue
		}
		if filter.Category != "" && category != filter.Category {
			continue
		}
		if filter.ScopeDistrict != "" {
			district := strings.ToUpper(strings.TrimSpace(filter.ScopeDistrict))
			userDistrict := ""
			if user.ScopeDistrictID != nil {
				userDistrict = strings.ToUpper(strings.TrimSpace(*user.ScopeDistrictID))
			}
			if user.ScopeLevel != nil && *user.ScopeLevel == "national" {
				// national accounts visible in all district filters
			} else if userDistrict != district {
				continue
			}
		}
		rows = append(rows, s.buildUserRow(user, roles, category))
	}
	return PaginateSlice(rows, page, perPage), nil
}

func accountCategoryForRoles(roleCodes []string, roleByID map[uint]models.Role) string {
	codeToRole := map[string]models.Role{}
	for _, role := range roleByID {
		codeToRole[role.Code] = role
	}
	priority := map[string]int{
		"system":         4,
		"administrative": 3,
		"executive":      2,
		"operational":    1,
	}
	best := "operational"
	bestScore := 0
	for _, code := range roleCodes {
		role, ok := codeToRole[code]
		cat := "operational"
		if ok && role.Category != "" {
			cat = role.Category
		} else if code == "super_admin" {
			cat = "system"
		}
		if priority[cat] > bestScore {
			bestScore = priority[cat]
			best = cat
		}
	}
	return best
}

func containsString(values []string, target string) bool {
	for _, v := range values {
		if v == target {
			return true
		}
	}
	return false
}

func appendUnique(values []string, item string) []string {
	if containsString(values, item) {
		return values
	}
	return append(values, item)
}

func (s *RbacService) ListRolesByCategory(category string) ([]models.Role, error) {
	query := facades.Orm().Query().Order("hierarchy_level asc")
	if category != "" {
		query = query.Where("category", category)
	}
	var rows []models.Role
	err := query.Get(&rows)
	return rows, err
}

func ParseBearerToken(ctx http.Context) string {
	header := ctx.Request().Header("Authorization", "")
	if header == "" {
		return ""
	}
	if strings.HasPrefix(strings.ToLower(header), "bearer ") {
		return strings.TrimSpace(header[7:])
	}
	return strings.TrimSpace(header)
}
