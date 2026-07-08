package models

import (
	"time"

	"github.com/goravel/framework/database/orm"
)

type Role struct {
	orm.Model
	Code            string `gorm:"uniqueIndex" json:"code"`
	Name            string `json:"name"`
	Description     *string `json:"description,omitempty"`
	Category        string `gorm:"default:operational" json:"category"`
	HierarchyLevel  uint8  `gorm:"default:1" json:"hierarchy_level"`
	IsSystem        bool   `gorm:"default:false" json:"is_system"`
	IsActive        bool   `gorm:"default:true" json:"is_active"`
}

type Permission struct {
	orm.Model
	Code        string `gorm:"uniqueIndex"`
	Module      string
	Action      string
	Name        string
	Description *string
	Guard       string `gorm:"default:api"`
}

type RolePermission struct {
	orm.Model
	RoleID       uint
	PermissionID uint
}

type UserRole struct {
	orm.Model
	UserID uint
	RoleID uint
}

type RoleDataScope struct {
	orm.Model
	RoleID         uint
	ScopeField     string
	ScopeOperator  string
	ScopeValues    *string
	Description    *string
}

type AuditLog struct {
	orm.Model
	ActorUserID        *uint   `json:"actor_user_id,omitempty"`
	ActorName          string  `json:"actor_name"`
	ActorEmail         string  `json:"actor_email,omitempty"`
	Module             string  `json:"module"`
	Action             string  `json:"action"`
	EntityType         string  `json:"entity_type,omitempty"`
	EntityID           *uint   `json:"entity_id,omitempty"`
	Summary            string  `json:"summary"`
	Metadata           *string `json:"metadata,omitempty"`
	IsDangerous        bool    `json:"is_dangerous"`
	IsRecoverable      bool    `json:"is_recoverable"`
	IsRecovered        bool    `json:"is_recovered"`
	RecoveredAt        *time.Time `json:"recovered_at,omitempty"`
	RecoveredByUserID  *uint   `json:"recovered_by_user_id,omitempty"`
	IpAddress          *string `json:"ip_address,omitempty"`
}
