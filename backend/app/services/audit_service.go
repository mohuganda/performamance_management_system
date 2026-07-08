package services

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type AuditService struct{}

func NewAuditService() *AuditService {
	return &AuditService{}
}

type AuditEntry struct {
	ActorUserID   *uint
	ActorName     string
	ActorEmail    string
	Module        string
	Action        string
	EntityType    string
	EntityID      *uint
	Summary       string
	Metadata      map[string]any
	IsDangerous   bool
	IsRecoverable bool
	IpAddress     string
}

type AuditListFilter struct {
	Module      string
	Action      string
	Dangerous   string
	Recoverable string
	Recovered   string
	Search      string
	Page        int
	PerPage     int
}

func (s *AuditService) Log(entry AuditEntry) (models.AuditLog, error) {
	row := models.AuditLog{
		ActorUserID:   entry.ActorUserID,
		ActorName:     entry.ActorName,
		ActorEmail:    entry.ActorEmail,
		Module:        entry.Module,
		Action:        entry.Action,
		EntityType:    entry.EntityType,
		EntityID:      entry.EntityID,
		Summary:       entry.Summary,
		IsDangerous:   entry.IsDangerous,
		IsRecoverable: entry.IsRecoverable,
	}
	if entry.IpAddress != "" {
		row.IpAddress = &entry.IpAddress
	}
	if len(entry.Metadata) > 0 {
		if encoded, err := json.Marshal(entry.Metadata); err == nil {
			payload := string(encoded)
			row.Metadata = &payload
		}
	}
	if err := facades.Orm().Query().Create(&row); err != nil {
		return models.AuditLog{}, err
	}
	return row, nil
}

func (s *AuditService) ListPaginated(filter AuditListFilter) (PaginatedResult[models.AuditLog], error) {
	page, perPage := ResolvePage(filter.Page, filter.PerPage)
	query := facades.Orm().Query().Order("id desc")

	if filter.Module != "" {
		query = query.Where("module", filter.Module)
	}
	if filter.Action != "" {
		query = query.Where("action", filter.Action)
	}
	if filter.Dangerous == "true" {
		query = query.Where("is_dangerous", true)
	}
	if filter.Recoverable == "true" {
		query = query.Where("is_recoverable", true)
	}
	if filter.Recovered == "true" {
		query = query.Where("is_recovered", true)
	} else if filter.Recovered == "false" {
		query = query.Where("is_recovered", false)
	}
	if search := strings.TrimSpace(filter.Search); search != "" {
		like := "%" + search + "%"
		query = query.Where("summary LIKE ? OR actor_name LIKE ? OR actor_email LIKE ?", like, like, like)
	}

	var rows []models.AuditLog
	if err := query.Get(&rows); err != nil {
		return PaginatedResult[models.AuditLog]{}, err
	}
	return PaginateSlice(rows, page, perPage), nil
}

func (s *AuditService) Recover(logID uint, actorUserID uint) error {
	var row models.AuditLog
	if err := facades.Orm().Query().Where("id", logID).First(&row); err != nil || row.ID == 0 {
		return fmt.Errorf("audit log not found")
	}
	if !row.IsRecoverable {
		return fmt.Errorf("this action is not recoverable")
	}
	if row.IsRecovered {
		return fmt.Errorf("action already recovered")
	}

	meta := map[string]any{}
	if row.Metadata != nil && *row.Metadata != "" {
		_ = json.Unmarshal([]byte(*row.Metadata), &meta)
	}
	revert, _ := meta["revert"].(map[string]any)

	rbac := NewRbacService()
	switch row.Action {
	case "role.revoked":
		userID := uintFromAny(revert["user_id"])
		roleCode := stringFromAny(revert["role_code"])
		if userID == 0 || roleCode == "" {
			return fmt.Errorf("invalid recovery payload")
		}
		if err := rbac.AssignRole(userID, roleCode); err != nil {
			return err
		}
	case "role.assigned":
		userID := uintFromAny(revert["user_id"])
		roleCode := stringFromAny(revert["role_code"])
		if userID == 0 || roleCode == "" {
			return fmt.Errorf("invalid recovery payload")
		}
		if err := rbac.RevokeRole(userID, roleCode); err != nil {
			return err
		}
	case "user.deactivated":
		userID := uintFromAny(revert["user_id"])
		if userID == 0 {
			return fmt.Errorf("invalid recovery payload")
		}
		if err := rbac.SetUserActive(userID, true); err != nil {
			return err
		}
	case "permission.granted":
		roleCode := stringFromAny(revert["role_code"])
		permCode := stringFromAny(revert["permission_code"])
		if roleCode == "" || permCode == "" {
			return fmt.Errorf("invalid recovery payload")
		}
		if err := rbac.RevokePermission(roleCode, permCode); err != nil {
			return err
		}
	default:
		return fmt.Errorf("recovery not supported for action %s", row.Action)
	}

	now := time.Now()
	row.IsRecovered = true
	row.RecoveredAt = &now
	row.RecoveredByUserID = &actorUserID
	return facades.Orm().Query().Save(&row)
}

func uintFromAny(v any) uint {
	switch n := v.(type) {
	case float64:
		return uint(n)
	case int:
		return uint(n)
	case uint:
		return n
	default:
		return 0
	}
}

func stringFromAny(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func isSensitiveRole(roleCode string) bool {
	sensitive := map[string]bool{
		"admin": true, "hr_officer": true, "director": true,
		"permanent_secretary": true, "executive_office": true, "department_head": true,
	}
	return sensitive[roleCode]
}

func IsSensitiveRolePublic(roleCode string) bool {
	return isSensitiveRole(roleCode)
}
