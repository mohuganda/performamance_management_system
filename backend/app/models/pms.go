package models

import (
	"time"

	"github.com/goravel/framework/database/orm"
)

type Facility struct {
	orm.Model
	IhrisFacilityID     string `gorm:"column:ihris_facility_id;uniqueIndex"`
	Nfrid               *string
	DhisFacilityID      *string
	Name                string
	FacilityTypeID      *string
	DistrictID          *string
	DistrictName        *string
	InstitutionTypeID   *string
	InstitutionTypeName *string
	IsActive            bool
}

type District struct {
	orm.Model
	Code      string  `gorm:"column:code;uniqueIndex"`
	Name      string  `gorm:"column:name"`
	Region    string  `gorm:"column:region"`
	Latitude  float64 `gorm:"column:latitude"`
	Longitude float64 `gorm:"column:longitude"`
	IsActive  bool    `gorm:"column:is_active"`
}

func (District) TableName() string {
	return "districts"
}

type Department struct {
	orm.Model
	Name             string `json:"name"`
	ExternalSystemID string `json:"external_system_id" gorm:"column:external_system_id;uniqueIndex"`
}

type JobTitle struct {
	orm.Model
	ExternalJobID string `json:"external_job_id" gorm:"column:external_job_id;uniqueIndex"`
	JobTitle      string `json:"job_title" gorm:"column:job_title"`
}

func (JobTitle) TableName() string {
	return "job_titles"
}

type Staff struct {
	orm.Model
	IhrisPID  string `gorm:"column:ihris_pid;uniqueIndex"`
	Nin       *string
	CardNumber *string `gorm:"column:card_number"`
	Ipps      *string
	Surname   string
	Firstname string
	Othername *string
	Gender    *string
	Mobile    *string
	Telephone *string
	Email            *string
	Cadre            *string
	Region           *string
	IhrisLastSyncAt  *time.Time `gorm:"column:ihris_last_sync_at"`
	Contracts        []StaffContract `gorm:"foreignKey:StaffID"`
	HrProfile        *StaffHrProfile `gorm:"foreignKey:StaffID"`
}

func (Staff) TableName() string {
	return "staff"
}

type StaffContract struct {
	orm.Model
	StaffID         uint
	FacilityID      uint
	JobID           uint
	DepartmentID    *uint
	EmploymentTerms *string
	SalaryGrade     *string
	Division        *string
	Section         *string
	Unit            *string
	DistrictID      *string
	DistrictName    *string
	ContractStatus  string `gorm:"default:active"`
	StartedAt       *time.Time
	EndedAt         *time.Time
	Staff           Staff            `gorm:"foreignKey:StaffID"`
	Facility        Facility         `gorm:"foreignKey:FacilityID"`
	Job             JobTitle         `gorm:"foreignKey:JobID"`
	Department      *Department      `gorm:"foreignKey:DepartmentID"`
	Supervisors     []StaffSupervisor `gorm:"foreignKey:StaffContractID"`
}

type StaffHrProfile struct {
	orm.Model
	StaffID          uint    `gorm:"uniqueIndex"`
	HrDepartmentID   *uint   `gorm:"column:hr_department_id"`
	HrEmail          *string `gorm:"column:hr_email"`
	HrMobile         *string `gorm:"column:hr_mobile"`
	LockedFields     *string `gorm:"column:locked_fields"`
	Notes            *string
	UpdatedByUserID  *uint `gorm:"column:updated_by_user_id"`
	Department       *Department `gorm:"foreignKey:HrDepartmentID"`
}

type IhrisSyncRun struct {
	orm.Model
	Status            string `gorm:"default:running"`
	CurrentPage       uint   `gorm:"column:current_page;default:1"`
	TotalPages        *uint  `gorm:"column:total_pages"`
	TotalRecords      *uint  `gorm:"column:total_records"`
	ProcessedRecords  uint   `gorm:"column:processed_records;default:0"`
	ImportedRecords   uint   `gorm:"column:imported_records;default:0"`
	SkippedRecords    uint   `gorm:"column:skipped_records;default:0"`
	FailedRecords     uint   `gorm:"column:failed_records;default:0"`
	LastError         *string `gorm:"column:last_error"`
	SummaryJSON       *string `gorm:"column:summary_json"`
	StartedAt         time.Time `gorm:"column:started_at"`
	FinishedAt        *time.Time `gorm:"column:finished_at"`
}

type StaffSupervisor struct {
	orm.Model
	StaffContractID   uint
	SupervisorStaffID uint
	ApprovalSequence  uint8 `gorm:"column:approval_sequence"`
	IsCurrent         bool  `gorm:"default:true"`
}

type KpiCategory struct {
	orm.Model
	CategoryName string `json:"category_name" gorm:"column:category_name;uniqueIndex"`
}

type Kpi struct {
	orm.Model
	CategoryID           uint
	KpiCode              string `gorm:"column:kpi_code"`
	ShortName            *string
	IndicatorStatement   string `gorm:"column:indicator_statement"`
	Description          *string
	Computation          *string
	Numerator            *string
	Denominator          *string
	Frequency            string
	ComputationCategory  string `gorm:"default:Ratio"`
	SubjectArea          *uint8 `gorm:"column:subject_area"`
	CurrentTarget        *int
	IsCumulative         bool
	GaugeType            string `gorm:"default:ascending_scale"`
	Status               bool   `gorm:"default:true"`
	Category             KpiCategory `gorm:"foreignKey:CategoryID"`
}

type KpiJobMapping struct {
	orm.Model
	KpiID uint
	JobID uint
}

type FinancialYear struct {
	orm.Model
	YearLabel string `gorm:"column:year_label;uniqueIndex"`
	StartDate time.Time
	EndDate   time.Time
	IsCurrent bool
	Quarters  []Quarter `gorm:"foreignKey:FinancialYearID"`
}

type Quarter struct {
	orm.Model
	FinancialYearID uint
	QuarterNumber   uint8 `gorm:"column:quarter_number"`
	Label           string
	ReportType      string `gorm:"column:report_type"`
	StartDate       time.Time
	EndDate         time.Time
}

type Objective struct {
	orm.Model
	FacilityID      uint
	Name            string
	Description     *string
	FinancialYearID *uint
	IsActive        bool `gorm:"default:true"`
}

type KpiAssignment struct {
	orm.Model
	KpiID          uint
	AssignableType string `gorm:"column:assignable_type"`
	DepartmentID   *uint
	JobID          *uint
	StaffID        *uint
	ObjectiveID    *uint
	EffectiveFrom  *time.Time
	EffectiveTo    *time.Time
	IsActive       bool `gorm:"default:true"`
}

type Ppa struct {
	orm.Model
	StaffID         uint
	FinancialYearID uint
	Status          string  `gorm:"default:draft"`
	TotalWeight     float64 `gorm:"column:total_weight"`
	SubmittedAt     *time.Time
	ApprovedAt      *time.Time
	Kpis            []PpaKpi `gorm:"foreignKey:PpaID"`
}

type PpaKpi struct {
	orm.Model
	PpaID                  uint
	KpiID                  uint
	KpiAssignmentID        *uint
	WeightPercentage       float64
	TargetValue            *float64
	SupervisorAgreedTarget *float64
}

type PerformanceReport struct {
	orm.Model
	StaffID         uint
	FinancialYearID uint
	QuarterID       uint
	ReportType      string
	Status          string `gorm:"default:draft"`
	SubmittedAt     *time.Time
	ApprovedAt      *time.Time
}

type PerformanceReportEntry struct {
	orm.Model
	PerformanceReportID uint
	PpaKpiID            uint
	ActualValue         *float64
	Narrative           *string
	EvidenceURL         *string
}

type LeaveType struct {
	orm.Model
	Name                       string  `json:"name"`
	Code                       string  `json:"code" gorm:"uniqueIndex"`
	Description                *string `json:"description,omitempty"`
	IsActive                   bool    `json:"is_active" gorm:"default:true"`
	MaxDaysPerYear             *int    `json:"max_days_per_year,omitempty"`
	MaxDaysPerRequest          *int    `json:"max_days_per_request,omitempty"`
	AdvanceNoticeDays          *int    `json:"advance_notice_days,omitempty"`
	MedicalReportAfterDays     *int    `json:"medical_report_after_days,omitempty"`
	SortOrder                  int     `json:"sort_order" gorm:"default:0"`
	EligibilityNotes           *string `json:"eligibility_notes,omitempty"`
	RequiresSupervisorApproval bool    `json:"requires_supervisor_approval" gorm:"default:true"`
	RequiresHrApproval         bool    `json:"requires_hr_approval" gorm:"default:false"`
}

type LeaveApprovalStage struct {
	orm.Model
	Code          string `gorm:"uniqueIndex"`
	Name          string
	Sequence      uint8
	ApproverRole  string
	Description   *string
	IsActive      bool `gorm:"default:true"`
}

type LeaveRequest struct {
	orm.Model
	StaffID                 uint
	LeaveTypeID             uint
	StartDate               time.Time
	EndDate                 time.Time
	DaysRequested           int
	Reason                  *string
	Status                  string `gorm:"default:draft"`
	CurrentApprovalSequence uint8  `gorm:"default:1"`
	MedicalReportURL        *string
	SubmittedAt             *time.Time
	AdvanceNoticeMet        bool   `gorm:"default:false"`
	ApprovalStage           string `gorm:"default:supervisor"`
	CarryOverRequested      bool   `gorm:"default:false"`
}

type LeaveApproval struct {
	orm.Model
	LeaveRequestID    uint
	SupervisorStaffID uint
	Sequence          uint8 `gorm:"column:sequence"`
	Status            string
	Comments          *string
	ActedAt           *time.Time
}

type LeaveEntitlement struct {
	orm.Model
	SalaryGrade              string
	LeaveTypeID              uint
	DaysPerYear              int
	MedicalReportAfterDays   *int
	RequiresHrFinalization     bool
}

type LeaveBalance struct {
	orm.Model
	StaffID         uint
	LeaveTypeID     uint
	CalendarYear    int
	EntitledDays    int
	UsedDays        int
	CarriedOverDays int
}

type OutOfStationReason struct {
	orm.Model
	Reason   string
	IsActive bool `gorm:"default:true"`
}

type OutOfStationRequest struct {
	orm.Model
	EntryID                  string `gorm:"uniqueIndex"`
	StaffID                  uint
	ReasonID                 uint
	StartDate                time.Time
	EndDate                  time.Time
	Remarks                  *string
	AttachmentURL            *string
	DestinationName          string
	DestinationAddress       *string
	DestinationLatitude      float64
	DestinationLongitude     float64
	GeofenceRadiusMeters     int `gorm:"default:500"`
	Status                   string
	CurrentApprovalSequence  uint8 `gorm:"default:1"`
	SubmittedAt              *time.Time
}

type OutOfStationApproval struct {
	orm.Model
	OutOfStationRequestID uint
	SupervisorStaffID     uint
	Sequence              uint8
	Status                string
	Comments              *string
	ActedAt               *time.Time
}

type AttendanceClock struct {
	orm.Model
	EntryID                     string `gorm:"uniqueIndex"`
	StaffID                     uint
	ClockType                   string
	ClockDate                   time.Time `gorm:"type:date"`
	ClockedAt                   time.Time
	Latitude                    float64
	Longitude                   float64
	AccuracyMeters              *float64
	Source                      string `gorm:"default:mobile"`
	OutOfStationRequestID       *uint
	VerificationStatus          string `gorm:"default:pending"`
	DistanceFromDestinationMeters *float64
	LocationLabel               *string
}

type SystemConfig struct {
	orm.Model
	Key         string `gorm:"uniqueIndex"`
	Value       string
	GroupName   string `gorm:"column:group_name;default:general"`
	Description *string
	IsPublic    bool `gorm:"default:false"`
}

type User struct {
	orm.Model
	StaffID              *uint
	Name                 string
	Email                string `gorm:"uniqueIndex"`
	Password             string
	Role                 string `gorm:"default:staff"`
	IsActive             bool   `gorm:"default:true"`
	IsSuperAdmin         bool   `gorm:"default:false"`
	MustChangePassword   bool   `gorm:"default:false"`
	FailedLoginAttempts  uint8  `gorm:"default:0"`
	LockedUntil          *time.Time
	LastLoginAt          *time.Time
	PasswordChangedAt    *time.Time
	ProfilePhoto         *string    `json:"ProfilePhoto,omitempty"`
	SignatureImage       *string    `json:"SignatureImage,omitempty"`
	SignatureUpdatedAt   *time.Time `json:"SignatureUpdatedAt,omitempty"`
	ScopeLevel           *string    `json:"scope_level,omitempty" gorm:"column:scope_level"`
	ScopeDistrictID      *string    `json:"scope_district_id,omitempty" gorm:"column:scope_district_id"`
	ScopeFacilityID      *uint      `json:"scope_facility_id,omitempty" gorm:"column:scope_facility_id"`
}

type UserNotification struct {
	orm.Model
	UserID    uint       `gorm:"column:user_id;index"`
	Type      string     `gorm:"default:info"`
	Category  string     `gorm:"default:system"`
	Title     string
	Message   string
	ActionURL *string    `gorm:"column:action_url"`
	DedupeKey *string    `gorm:"column:dedupe_key"`
	ReadAt    *time.Time `gorm:"column:read_at"`
	EmailedAt *time.Time `gorm:"column:emailed_at"`
}

func (UserNotification) TableName() string {
	return "user_notifications"
}

// IhrisData mirrors the legacy demo table used before live iHRIS API integration.
type IhrisData struct {
	ID                  uint   `gorm:"primaryKey"`
	IhrisPID            string `gorm:"column:ihris_pid"`
	DistrictID          *string
	District            *string
	DhisFacilityID      *string `gorm:"column:dhis_facility_id"`
	Nin                 *string
	FacilityTypeID      *string `gorm:"column:facility_type_id"`
	FacilityID          *string `gorm:"column:facility_id"`
	Facility            *string
	DepartmentID        *string `gorm:"column:department_id"`
	Department          *string
	Division            *string
	Section             *string
	Unit                *string
	JobID               *string `gorm:"column:job_id"`
	Job                 *string
	EmploymentTerms     *string `gorm:"column:employment_terms"`
	SalaryGrade         *string `gorm:"column:salary_grade"`
	Surname             *string
	Firstname           *string
	Othername           *string
	Mobile              *string
	Telephone           *string
	InstitutionTypeID   *string `gorm:"column:institution_type_id"`
	InstitutionTypeName string  `gorm:"column:institutiontype_name"`
	Gender              *string
}

func (IhrisData) TableName() string {
	return "ihrisdata"
}

// LegacyKpi mirrors npm_dashboard.kpi for seed migration.
type LegacyKpi struct {
	ID                  uint    `gorm:"primaryKey"`
	KpiID               string  `gorm:"column:kpi_id"`
	ShortName           *string
	IndicatorStatement  string  `gorm:"column:indicator_statement"`
	Description         *string
	Computation         *string
	Numerator           string
	Denominator         string
	Frequency           string
	ComputationCategory string  `gorm:"column:computation_category"`
	SubjectArea         *int    `gorm:"column:subject_area"`
	CurrentTarget       *int
	IsCumulative        int
	GaugeType           string  `gorm:"column:gauge_type"`
	JobID               string  `gorm:"column:job_id"`
	Status              int
}

func (LegacyKpi) TableName() string {
	return "kpi"
}

type LegacyKpiJobCategory struct {
	ID    uint   `gorm:"primaryKey"`
	JobID string `gorm:"column:job_id"`
	Job   string
}

func (LegacyKpiJobCategory) TableName() string {
	return "kpi_job_category"
}
