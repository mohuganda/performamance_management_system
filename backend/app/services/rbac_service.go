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
	ScopeAssignments []UserScopeAssignmentRow `json:"scope_assignments,omitempty"`
}

type UserScopeAssignmentRow struct {
	ScopeType string  `json:"scope_type"`
	RefID     *uint   `json:"ref_id,omitempty"`
	RefCode   *string `json:"ref_code,omitempty"`
	Label     *string `json:"label,omitempty"`
}

type UserScopeAssignmentInput struct {
	ScopeType string  `json:"scope_type"`
	RefID     *uint   `json:"ref_id"`
	RefCode   *string `json:"ref_code"`
	Label     *string `json:"label"`
}

type UserScopeInput struct {
	ScopeLevel       *string
	ScopeDistrictID  *string
	ScopeFacilityID  *uint
	ScopeAssignments *[]UserScopeAssignmentInput
}

type ScopeOptionRow struct {
	Regions    []ScopeRegionOption    `json:"regions"`
	Districts  []ScopeDistrictOption  `json:"districts"`
	Facilities []ScopeFacilityOption  `json:"facilities"`
	Levels     []ScopeLevelOption     `json:"levels"`
}

type ScopeRegionOption struct {
	ID   uint   `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

type ScopeDistrictOption struct {
	ID       string `json:"id"`
	RefID    uint   `json:"ref_id"`
	Code     string `json:"code"`
	Name     string `json:"name"`
	RegionID *uint  `json:"region_id,omitempty"`
}

type ScopeFacilityOption struct {
	ID            uint   `json:"id"`
	Name          string `json:"name"`
	DistrictRefID *uint  `json:"district_ref_id,omitempty"`
	DistrictName  string `json:"district_name,omitempty"`
	DistrictID    string `json:"district_id,omitempty"`
	RegionID      *uint  `json:"region_id,omitempty"`
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

	var userPerms []models.UserPermission
	if err := facades.Orm().Query().Where("user_id", user.ID).Get(&userPerms); err == nil && len(userPerms) > 0 {
		directIDs := make([]uint, 0, len(userPerms))
		for _, up := range userPerms {
			directIDs = append(directIDs, up.PermissionID)
		}
		var directPerms []models.Permission
		if err := facades.Orm().Query().Where("id", directIDs).Get(&directPerms); err == nil {
			for _, perm := range directPerms {
				principal.Permissions[perm.Code] = true
			}
		}
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
	if err := facades.Orm().Query().WhereIn("code", stringSliceToAny(roleCodes)).Get(&roles); err != nil {
		return nil, err
	}
	roleIDs := make([]uint, 0, len(roles))
	for _, role := range roles {
		roleIDs = append(roleIDs, role.ID)
	}
	var scopes []models.RoleDataScope
	if err := facades.Orm().Query().WhereIn("role_id", toAnySlice(roleIDs)).Get(&scopes); err != nil {
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

func (s *RbacService) ListRolePermissionCodes(roleCode string) ([]string, error) {
	var role models.Role
	if err := facades.Orm().Query().Where("code", roleCode).First(&role); err != nil || role.ID == 0 {
		return nil, fmt.Errorf("role not found")
	}
	var rolePerms []models.RolePermission
	if err := facades.Orm().Query().Where("role_id", role.ID).Get(&rolePerms); err != nil {
		return nil, err
	}
	if len(rolePerms) == 0 {
		return []string{}, nil
	}
	permIDs := make([]uint, 0, len(rolePerms))
	for _, rp := range rolePerms {
		permIDs = append(permIDs, rp.PermissionID)
	}
	var permissions []models.Permission
	if err := facades.Orm().Query().Where("id", permIDs).Order("module asc, code asc").Get(&permissions); err != nil {
		return nil, err
	}
	codes := make([]string, 0, len(permissions))
	for _, perm := range permissions {
		codes = append(codes, perm.Code)
	}
	return codes, nil
}

func (s *RbacService) ListUserPermissionCodes(userID uint) ([]string, error) {
	var userPerms []models.UserPermission
	if err := facades.Orm().Query().Where("user_id", userID).Get(&userPerms); err != nil {
		return nil, err
	}
	if len(userPerms) == 0 {
		return []string{}, nil
	}
	permIDs := make([]uint, 0, len(userPerms))
	for _, up := range userPerms {
		permIDs = append(permIDs, up.PermissionID)
	}
	var permissions []models.Permission
	if err := facades.Orm().Query().Where("id", permIDs).Order("module asc, code asc").Get(&permissions); err != nil {
		return nil, err
	}
	codes := make([]string, 0, len(permissions))
	for _, perm := range permissions {
		codes = append(codes, perm.Code)
	}
	return codes, nil
}

func (s *RbacService) GrantUserPermission(userID uint, permissionCode string) error {
	var permission models.Permission
	if err := facades.Orm().Query().Where("code", permissionCode).First(&permission); err != nil || permission.ID == 0 {
		return fmt.Errorf("permission not found")
	}
	var existing models.UserPermission
	if err := facades.Orm().Query().
		Where("user_id", userID).
		Where("permission_id", permission.ID).
		First(&existing); err == nil && existing.ID > 0 {
		return nil
	}
	if err := facades.Orm().Query().Create(&models.UserPermission{
		UserID:       userID,
		PermissionID: permission.ID,
	}); err != nil {
		return err
	}
	s.InvalidateUserCache(userID)
	return nil
}

func (s *RbacService) RevokeUserPermission(userID uint, permissionCode string) error {
	var permission models.Permission
	if err := facades.Orm().Query().Where("code", permissionCode).First(&permission); err != nil || permission.ID == 0 {
		return fmt.Errorf("permission not found")
	}
	_, err := facades.Orm().Query().
		Where("user_id", userID).
		Where("permission_id", permission.ID).
		Delete(&models.UserPermission{})
	if err != nil {
		return err
	}
	s.InvalidateUserCache(userID)
	return nil
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
	if err := facades.Orm().Query().Create(&models.RolePermission{
		RoleID:       role.ID,
		PermissionID: permission.ID,
	}); err != nil {
		return err
	}
	s.invalidateRoleUsers(role.ID)
	return nil
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
	if err != nil {
		return err
	}
	s.invalidateRoleUsers(role.ID)
	return nil
}

func (s *RbacService) invalidateRoleUsers(roleID uint) {
	var userRoles []models.UserRole
	if err := facades.Orm().Query().Where("role_id", roleID).Get(&userRoles); err != nil {
		return
	}
	for _, ur := range userRoles {
		s.InvalidateUserCache(ur.UserID)
	}
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
		if scope.ScopeAssignments != nil {
			if err := s.replaceUserScopeAssignments(user.ID, *scope.ScopeAssignments); err != nil {
				return models.User{}, err
			}
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

func (s *RbacService) replaceUserScopeAssignments(userID uint, assignments []UserScopeAssignmentInput) error {
	_, _ = facades.Orm().Query().Where("user_id", userID).Delete(&models.UserScopeAssignment{})
	for _, item := range assignments {
		scopeType := strings.ToLower(strings.TrimSpace(item.ScopeType))
		if scopeType == "" {
			continue
		}
		row := models.UserScopeAssignment{
			UserID:    userID,
			ScopeType: scopeType,
			RefID:     item.RefID,
			RefCode:   item.RefCode,
			Label:     item.Label,
		}
		if err := facades.Orm().Query().Create(&row); err != nil {
			return err
		}
	}

	// Keep legacy single-value columns aligned with the first assignment of each type.
	var user models.User
	if err := facades.Orm().Query().Where("id", userID).First(&user); err != nil || user.ID == 0 {
		return nil
	}
	updated := false
	for _, item := range assignments {
		switch strings.ToLower(strings.TrimSpace(item.ScopeType)) {
		case "district":
			if item.RefID != nil && *item.RefID > 0 {
				var district models.District
				if err := facades.Orm().Query().Where("id", *item.RefID).First(&district); err == nil && district.ID > 0 {
					user.ScopeDistrictID = &district.Code
					updated = true
				}
			}
		case "facility":
			if item.RefID != nil && *item.RefID > 0 {
				user.ScopeFacilityID = item.RefID
				updated = true
			}
		}
	}
	if updated {
		_ = facades.Orm().Query().Save(&user)
	}
	return nil
}

func (s *RbacService) ListUserScopeAssignments(userID uint) []UserScopeAssignmentRow {
	var rows []models.UserScopeAssignment
	_ = facades.Orm().Query().Where("user_id", userID).Order("id asc").Get(&rows)
	out := make([]UserScopeAssignmentRow, 0, len(rows))
	for _, row := range rows {
		out = append(out, UserScopeAssignmentRow{
			ScopeType: row.ScopeType,
			RefID:     row.RefID,
			RefCode:   row.RefCode,
			Label:     row.Label,
		})
	}
	return out
}

func (s *ScopeService) ListScopeOptions() ScopeOptionRow {
	levels := []ScopeLevelOption{
		{Value: "staff", Label: "Staff-linked", Description: "Scope follows the linked iHRIS staff placement"},
		{Value: "facility", Label: "Facility", Description: "Access limited to one or more health facilities"},
		{Value: "district", Label: "District", Description: "Access across facilities in assigned district(s)"},
		{Value: "region", Label: "Region", Description: "Access across all districts in an assigned region(s)"},
		{Value: "national", Label: "National (MoH)", Description: "Organization-wide visibility for MoH overseers"},
	}

	var regions []models.Region
	_ = facades.Orm().Query().Where("is_active", true).Order("name asc").Get(&regions)
	regionOpts := make([]ScopeRegionOption, 0, len(regions))
	for _, r := range regions {
		regionOpts = append(regionOpts, ScopeRegionOption{ID: r.ID, Code: r.Code, Name: r.Name})
	}

	var districts []models.District
	_ = facades.Orm().Query().Where("is_active", true).Order("name asc").Get(&districts)
	districtOpts := make([]ScopeDistrictOption, 0, len(districts))
	for _, d := range districts {
		ihrisID := d.Code
		if d.IhrisDistrictID != nil && strings.TrimSpace(*d.IhrisDistrictID) != "" {
			ihrisID = strings.ToUpper(strings.TrimSpace(*d.IhrisDistrictID))
		}
		districtOpts = append(districtOpts, ScopeDistrictOption{
			ID:       ihrisID,
			RefID:    d.ID,
			Code:     d.Code,
			Name:     d.Name,
			RegionID: d.RegionID,
		})
	}

	var facilities []models.Facility
	_ = facades.Orm().Query().Where("is_active", true).Order("name asc").Limit(2000).Get(&facilities)
	districtNameByID := map[uint]string{}
	for _, d := range districts {
		districtNameByID[d.ID] = d.Name
	}
	facilityOpts := make([]ScopeFacilityOption, 0, len(facilities))
	for _, f := range facilities {
		opt := ScopeFacilityOption{
			ID:            f.ID,
			Name:          f.Name,
			DistrictRefID: f.DistrictRefID,
			RegionID:      f.RegionID,
		}
		if f.DistrictID != nil {
			opt.DistrictID = strings.ToUpper(strings.TrimSpace(*f.DistrictID))
		}
		if f.DistrictRefID != nil {
			opt.DistrictName = districtNameByID[*f.DistrictRefID]
		}
		if opt.DistrictName == "" && f.DistrictName != nil {
			opt.DistrictName = strings.TrimSpace(*f.DistrictName)
		}
		facilityOpts = append(facilityOpts, opt)
	}

	return ScopeOptionRow{
		Regions:    regionOpts,
		Districts:  districtOpts,
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
	row.ScopeAssignments = s.ListUserScopeAssignments(user.ID)
	return row
}

func (s *RbacService) ListUsersPaginated(filter UserListFilter) (PaginatedResult[RbacUserRow], error) {
	page, perPage := ResolvePage(filter.Page, filter.PerPage)
	query := facades.Orm().Query().Model(&models.User{}).Order("id desc")
	if search := strings.TrimSpace(filter.Search); search != "" {
		like := "%" + search + "%"
		query = query.Where("name LIKE ? OR email LIKE ?", like, like)
	}
	if filter.IsActive == "true" {
		query = query.Where("is_active", true)
	} else if filter.IsActive == "false" {
		query = query.Where("is_active", false)
	}
	if filter.ScopeDistrict != "" {
		district := strings.ToUpper(strings.TrimSpace(filter.ScopeDistrict))
		query = query.Where(
			"(scope_district_id = ? OR scope_level = ?)",
			district, "national",
		)
	}
	if filter.RoleCode != "" {
		query = query.Where(
			`id IN (
				SELECT ur.user_id FROM user_roles ur
				INNER JOIN roles r ON r.id = ur.role_id
				WHERE r.code = ?
			) OR role = ? OR (is_super_admin = ? AND ? = 'super_admin')`,
			filter.RoleCode, filter.RoleCode, true, filter.RoleCode,
		)
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

	// Category filter still needs in-memory pass — load matching users then filter
	if filter.Category != "" {
		var users []models.User
		if err := query.Get(&users); err != nil {
			return PaginatedResult[RbacUserRow]{}, err
		}
		filtered := make([]models.User, 0, len(users))
		for _, user := range users {
			roles := userRolesMap[user.ID]
			if len(roles) == 0 && user.Role != "" {
				roles = []string{user.Role}
			}
			if user.IsSuperAdmin {
				roles = appendUnique(roles, "super_admin")
			}
			if accountCategoryForRoles(roles, roleByID) == filter.Category {
				filtered = append(filtered, user)
			}
		}
		return s.paginateUserRows(filtered, userRolesMap, roleByID, page, perPage), nil
	}

	total, err := query.Count()
	if err != nil {
		return PaginatedResult[RbacUserRow]{}, err
	}

	var users []models.User
	if err := query.Offset(OffsetFor(page, perPage)).Limit(perPage).Get(&users); err != nil {
		return PaginatedResult[RbacUserRow]{}, err
	}

	rows := s.buildUserRows(users, userRolesMap, roleByID)
	return BuildPaginatedResult(rows, int(total), page, perPage), nil
}

func (s *RbacService) paginateUserRows(
	users []models.User,
	userRolesMap map[uint][]string,
	roleByID map[uint]models.Role,
	page, perPage int,
) PaginatedResult[RbacUserRow] {
	page, perPage = ResolvePage(page, perPage)
	total := len(users)
	start := OffsetFor(page, perPage)
	if start >= total {
		return BuildPaginatedResult([]RbacUserRow{}, total, page, perPage)
	}
	end := start + perPage
	if end > total {
		end = total
	}
	rows := s.buildUserRows(users[start:end], userRolesMap, roleByID)
	return BuildPaginatedResult(rows, total, page, perPage)
}

func (s *RbacService) buildUserRows(
	users []models.User,
	userRolesMap map[uint][]string,
	roleByID map[uint]models.Role,
) []RbacUserRow {
	facilityIDs := make([]uint, 0)
	for _, user := range users {
		if user.ScopeFacilityID != nil {
			facilityIDs = append(facilityIDs, *user.ScopeFacilityID)
		}
	}
	facilities := loadFacilitiesByIDs(facilityIDs)

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
			if facility, ok := facilities[*user.ScopeFacilityID]; ok {
				row.ScopeFacility = facility.Name
			}
		}
		rows = append(rows, row)
	}
	return rows
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

func stringSliceToAny(values []string) []any {
	out := make([]any, len(values))
	for i, v := range values {
		out[i] = v
	}
	return out
}
