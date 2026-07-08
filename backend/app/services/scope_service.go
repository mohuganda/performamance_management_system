package services

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/http/authctx"
	"goravel/app/models"
)

type ScopeService struct{}

func NewScopeService() *ScopeService {
	return &ScopeService{}
}

type StaffScopeContext struct {
	StaffID      *uint
	DistrictID   *string
	FacilityID   *uint
	DepartmentID *uint
	JobID        *uint
	Division     *string
	Section      *string
	Unit         *string
	SalaryGrade  *string
}

func (s *ScopeService) LoadStaffScope(staffID uint) (*StaffScopeContext, error) {
	var contract models.StaffContract
	err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("contract_status", "active").
		First(&contract)
	if err != nil {
		return nil, err
	}
	return &StaffScopeContext{
		StaffID:      &staffID,
		DistrictID:   contract.DistrictID,
		FacilityID:   &contract.FacilityID,
		DepartmentID: contract.DepartmentID,
		JobID:        &contract.JobID,
		Division:     contract.Division,
		Section:      contract.Section,
		Unit:         contract.Unit,
		SalaryGrade:  contract.SalaryGrade,
	}, nil
}

func (s *ScopeService) LoadActorScope(principal authctx.Principal) (*StaffScopeContext, error) {
	ctx := &StaffScopeContext{}
	if principal.StaffID != nil && *principal.StaffID > 0 {
		loaded, err := s.LoadStaffScope(*principal.StaffID)
		if err == nil && loaded != nil {
			ctx = loaded
		}
	}
	s.applyUserScopeOverrides(&principal.User, ctx)
	return ctx, nil
}

func (s *ScopeService) applyUserScopeOverrides(user *models.User, ctx *StaffScopeContext) {
	if user.ScopeDistrictID != nil && strings.TrimSpace(*user.ScopeDistrictID) != "" {
		district := strings.TrimSpace(*user.ScopeDistrictID)
		ctx.DistrictID = &district
	}
	if user.ScopeFacilityID != nil && *user.ScopeFacilityID > 0 {
		ctx.FacilityID = user.ScopeFacilityID
	}
}

func (s *ScopeService) HasNationalScope(user models.User) bool {
	if user.ScopeLevel == nil {
		return false
	}
	level := strings.ToLower(strings.TrimSpace(*user.ScopeLevel))
	return level == "national" || level == "country"
}

func (s *ScopeService) CanAccessStaff(principal authctx.Principal, targetStaffID uint) bool {
	if principal.IsSuperAdmin {
		return true
	}
	if s.HasNationalScope(principal.User) {
		return true
	}

	actor, err := s.LoadActorScope(principal)
	if err != nil {
		return false
	}
	target, err := s.LoadStaffScope(targetStaffID)
	if err != nil {
		return false
	}

	rbac := NewRbacService()
	rules, err := rbac.RoleScopes(principal.Roles)
	if err != nil || len(rules) == 0 {
		return principal.StaffID != nil && *principal.StaffID == targetStaffID
	}

	for _, rule := range rules {
		if s.ruleMatches(rule, actor, target) {
			return true
		}
	}
	return false
}

func (s *ScopeService) ruleMatches(rule RoleScope, actor *StaffScopeContext, target *StaffScopeContext) bool {
	switch rule.Operator {
	case "all":
		return true
	case "self":
		return actor.StaffID != nil && target.StaffID != nil && *actor.StaffID == *target.StaffID
	case "supervised":
		if actor.StaffID == nil || target.StaffID == nil {
			return false
		}
		return s.isSupervisorOf(*actor.StaffID, *target.StaffID)
	case "eq":
		actorVal := s.fieldValue(rule.Field, actor)
		targetVal := s.fieldValue(rule.Field, target)
		if len(rule.Values) > 0 {
			for _, v := range rule.Values {
				if targetVal == v {
					return true
				}
			}
			return false
		}
		return actorVal != "" && actorVal == targetVal
	case "in":
		return s.fieldIn(rule.Field, rule.Values, target)
	default:
		return false
	}
}

func (s *ScopeService) fieldIn(field string, values []string, target *StaffScopeContext) bool {
	targetVal := s.fieldValue(field, target)
	if targetVal == "" {
		return false
	}
	for _, v := range values {
		if targetVal == v {
			return true
		}
	}
	return false
}

func (s *ScopeService) fieldValue(field string, scope *StaffScopeContext) string {
	switch field {
	case "staff_id":
		if scope.StaffID != nil {
			return strconv.FormatUint(uint64(*scope.StaffID), 10)
		}
	case "district_id":
		if scope.DistrictID != nil {
			return *scope.DistrictID
		}
	case "facility_id":
		if scope.FacilityID != nil {
			return strconv.FormatUint(uint64(*scope.FacilityID), 10)
		}
	case "department_id":
		if scope.DepartmentID != nil {
			return strconv.FormatUint(uint64(*scope.DepartmentID), 10)
		}
	case "job_id":
		if scope.JobID != nil {
			return strconv.FormatUint(uint64(*scope.JobID), 10)
		}
	case "division":
		if scope.Division != nil {
			return *scope.Division
		}
	case "section":
		if scope.Section != nil {
			return *scope.Section
		}
	case "unit":
		if scope.Unit != nil {
			return *scope.Unit
		}
	case "salary_grade":
		if scope.SalaryGrade != nil {
			return *scope.SalaryGrade
		}
	}
	return ""
}

func (s *ScopeService) isSupervisorOf(supervisorStaffID uint, targetStaffID uint) bool {
	var contract models.StaffContract
	if err := facades.Orm().Query().
		Where("staff_id", targetStaffID).
		Where("contract_status", "active").
		First(&contract); err != nil {
		return false
	}

	var supervisor models.StaffSupervisor
	err := facades.Orm().Query().
		Where("staff_contract_id", contract.ID).
		Where("supervisor_staff_id", supervisorStaffID).
		Where("is_current", true).
		First(&supervisor)
	return err == nil
}

func (s *ScopeService) SetRoleScope(roleID uint, field, operator string, values []string, description string) error {
	payload, _ := json.Marshal(values)
	val := string(payload)
	desc := description
	var existing models.RoleDataScope
	err := facades.Orm().Query().
		Where("role_id", roleID).
		Where("scope_field", field).
		Where("scope_operator", operator).
		First(&existing)
	if err != nil {
		return facades.Orm().Query().Create(&models.RoleDataScope{
			RoleID:        roleID,
			ScopeField:    field,
			ScopeOperator: operator,
			ScopeValues:   &val,
			Description:   &desc,
		})
	}
	existing.ScopeValues = &val
	existing.Description = &desc
	return facades.Orm().Query().Save(&existing)
}

func (s *ScopeService) AuthorizeStaffAccess(ctx http.Context, principal authctx.Principal, targetStaffID uint) error {
	if !s.CanAccessStaff(principal, targetStaffID) {
		return fmt.Errorf("forbidden: outside your data scope")
	}
	return nil
}
