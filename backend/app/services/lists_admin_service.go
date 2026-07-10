package services

import (
	"fmt"
	"strings"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type ListsAdminService struct{}

func NewListsAdminService() *ListsAdminService {
	return &ListsAdminService{}
}

type ListsSummary struct {
	Regions      int `json:"regions"`
	Districts    int `json:"districts"`
	Facilities   int `json:"facilities"`
	Departments  int `json:"departments"`
	JobTitles    int `json:"job_titles"`
	OosReasons   int `json:"oos_reasons"`
}

type RegionListRow struct {
	ID               uint    `json:"id"`
	Code             string  `json:"code"`
	Name             string  `json:"name"`
	ExternalSystemID *string `json:"external_system_id"`
	ISOCode          *string `json:"iso_code"`
	IsActive         bool    `json:"is_active"`
	DistrictCount    int     `json:"district_count"`
}

type DistrictListRow struct {
	ID              uint    `json:"id"`
	Code            string  `json:"code"`
	Name            string  `json:"name"`
	Region          string  `json:"region"`
	RegionID        *uint   `json:"region_id"`
	RegionName      string  `json:"region_name"`
	IhrisDistrictID *string `json:"ihris_district_id"`
	ISOCode         string  `json:"iso_code"`
	IsActive        bool    `json:"is_active"`
	FacilityCount   int     `json:"facility_count"`
}

type FacilityListRow struct {
	ID              uint     `json:"id"`
	IhrisFacilityID string   `json:"ihris_facility_id"`
	Name            string   `json:"name"`
	DistrictRefID   *uint    `json:"district_ref_id"`
	DistrictName    string   `json:"district_name"`
	RegionID        *uint    `json:"region_id"`
	RegionName      string   `json:"region_name"`
	Latitude        *float64 `json:"latitude"`
	Longitude       *float64 `json:"longitude"`
	IsActive        bool     `json:"is_active"`
}

type DepartmentListRow struct {
	ID               uint   `json:"id"`
	Name             string `json:"name"`
	ExternalSystemID string `json:"external_system_id"`
	FacilityID       *uint  `json:"facility_id,omitempty"`
	FacilityName     string `json:"facility_name,omitempty"`
}

type JobTitleListRow struct {
	ID            uint   `json:"id"`
	ExternalJobID string `json:"external_job_id"`
	JobTitle      string `json:"job_title"`
}

type OosReasonListRow struct {
	ID       uint   `json:"id"`
	Reason   string `json:"reason"`
	IsActive bool   `json:"is_active"`
}

type ListFilter struct {
	Search     string
	RegionID   uint
	DistrictID uint
	FacilityID uint
	Page       int
	PerPage    int
}

func (s *ListsAdminService) Summary() (ListsSummary, error) {
	var summary ListsSummary
	if n, err := facades.Orm().Query().Model(&models.Region{}).Count(); err == nil {
		summary.Regions = int(n)
	}
	if n, err := facades.Orm().Query().Model(&models.District{}).Count(); err == nil {
		summary.Districts = int(n)
	}
	if n, err := facades.Orm().Query().Model(&models.Facility{}).Count(); err == nil {
		summary.Facilities = int(n)
	}
	if n, err := facades.Orm().Query().Model(&models.Department{}).Count(); err == nil {
		summary.Departments = int(n)
	}
	if n, err := facades.Orm().Query().Model(&models.JobTitle{}).Count(); err == nil {
		summary.JobTitles = int(n)
	}
	if n, err := facades.Orm().Query().Model(&models.OutOfStationReason{}).Count(); err == nil {
		summary.OosReasons = int(n)
	}
	return summary, nil
}

func (s *ListsAdminService) ListRegions(filter ListFilter) (PaginatedResult[RegionListRow], error) {
	page, perPage := ResolvePage(filter.Page, filter.PerPage)
	query := facades.Orm().Query().Order("name asc")
	if filter.Search != "" {
		like := "%" + strings.TrimSpace(filter.Search) + "%"
		query = query.Where("name LIKE ? OR code LIKE ?", like, like)
	}
	var rows []models.Region
	if err := query.Get(&rows); err != nil {
		return PaginatedResult[RegionListRow]{}, err
	}
	total := len(rows)
	start := OffsetFor(page, perPage)
	if start > total {
		start = total
	}
	end := start + perPage
	if end > total {
		end = total
	}
	pageRows := rows[start:end]

	out := make([]RegionListRow, 0, len(pageRows))
	for _, row := range pageRows {
		var districtCount int64
		if n, err := facades.Orm().Query().Model(&models.District{}).Where("region_id", row.ID).Count(); err == nil {
			districtCount = n
		}
		out = append(out, RegionListRow{
			ID:               row.ID,
			Code:             row.Code,
			Name:             row.Name,
			ExternalSystemID: row.ExternalSystemID,
			ISOCode:          row.ISOCode,
			IsActive:         row.IsActive,
			DistrictCount:    int(districtCount),
		})
	}
	return BuildPaginatedResult(out, total, page, perPage), nil
}

func (s *ListsAdminService) ListDistricts(filter ListFilter) (PaginatedResult[DistrictListRow], error) {
	page, perPage := ResolvePage(filter.Page, filter.PerPage)
	query := facades.Orm().Query().Order("name asc")
	if filter.Search != "" {
		like := "%" + strings.TrimSpace(filter.Search) + "%"
		query = query.Where("name LIKE ? OR code LIKE ? OR region LIKE ?", like, like, like)
	}
	if filter.RegionID > 0 {
		query = query.Where("region_id", filter.RegionID)
	}
	var rows []models.District
	if err := query.Get(&rows); err != nil {
		return PaginatedResult[DistrictListRow]{}, err
	}

	regionNames := s.regionNameMap()
	total := len(rows)
	start := OffsetFor(page, perPage)
	if start > total {
		start = total
	}
	end := start + perPage
	if end > total {
		end = total
	}
	pageRows := rows[start:end]

	out := make([]DistrictListRow, 0, len(pageRows))
	for _, row := range pageRows {
		regionName := strings.TrimSpace(row.Region)
		if row.RegionID != nil {
			if name := regionNames[*row.RegionID]; name != "" {
				regionName = name
			}
		}
		var facilityCount int64
		if n, err := facades.Orm().Query().Model(&models.Facility{}).Where("district_ref_id", row.ID).Count(); err == nil {
			facilityCount = n
		}
		out = append(out, DistrictListRow{
			ID:              row.ID,
			Code:            row.Code,
			Name:            row.Name,
			Region:          row.Region,
			RegionID:        row.RegionID,
			RegionName:      regionName,
			IhrisDistrictID: row.IhrisDistrictID,
			ISOCode:         row.ISOCode,
			IsActive:        row.IsActive,
			FacilityCount:   int(facilityCount),
		})
	}
	return BuildPaginatedResult(out, total, page, perPage), nil
}

func (s *ListsAdminService) ListFacilities(filter ListFilter) (PaginatedResult[FacilityListRow], error) {
	page, perPage := ResolvePage(filter.Page, filter.PerPage)
	query := facades.Orm().Query().Order("name asc")
	if filter.Search != "" {
		like := "%" + strings.TrimSpace(filter.Search) + "%"
		query = query.Where("name LIKE ? OR ihris_facility_id LIKE ? OR district_name LIKE ?", like, like, like)
	}
	if filter.DistrictID > 0 {
		query = query.Where("district_ref_id", filter.DistrictID)
	}
	if filter.RegionID > 0 {
		query = query.Where("region_id", filter.RegionID)
	}
	var rows []models.Facility
	if err := query.Get(&rows); err != nil {
		return PaginatedResult[FacilityListRow]{}, err
	}

	districtNames := s.districtNameMap()
	regionNames := s.regionNameMap()
	total := len(rows)
	start := OffsetFor(page, perPage)
	if start > total {
		start = total
	}
	end := start + perPage
	if end > total {
		end = total
	}
	pageRows := rows[start:end]

	out := make([]FacilityListRow, 0, len(pageRows))
	for _, row := range pageRows {
		districtName := deref(row.DistrictName)
		if row.DistrictRefID != nil {
			if name := districtNames[*row.DistrictRefID]; name != "" {
				districtName = name
			}
		}
		regionName := ""
		if row.RegionID != nil {
			regionName = regionNames[*row.RegionID]
		}
		out = append(out, FacilityListRow{
			ID:              row.ID,
			IhrisFacilityID: row.IhrisFacilityID,
			Name:            row.Name,
			DistrictRefID:   row.DistrictRefID,
			DistrictName:    districtName,
			RegionID:        row.RegionID,
			RegionName:      regionName,
			Latitude:        row.Latitude,
			Longitude:       row.Longitude,
			IsActive:        row.IsActive,
		})
	}
	return BuildPaginatedResult(out, total, page, perPage), nil
}

func (s *ListsAdminService) ListDepartments(filter ListFilter) (PaginatedResult[DepartmentListRow], error) {
	page, perPage := ResolvePage(filter.Page, filter.PerPage)
	query := facades.Orm().Query().Order("name asc")
	if filter.Search != "" {
		like := "%" + strings.TrimSpace(filter.Search) + "%"
		query = query.Where("name LIKE ? OR external_system_id LIKE ?", like, like)
	}
	if filter.FacilityID > 0 {
		query = query.Where("facility_id", filter.FacilityID)
	}
	var rows []models.Department
	if err := query.Get(&rows); err != nil {
		return PaginatedResult[DepartmentListRow]{}, err
	}
	total := len(rows)
	start := OffsetFor(page, perPage)
	if start > total {
		start = total
	}
	end := start + perPage
	if end > total {
		end = total
	}
	pageRows := rows[start:end]

	facilityIDs := make([]uint, 0, len(pageRows))
	for _, row := range pageRows {
		if row.FacilityID != nil && *row.FacilityID > 0 {
			facilityIDs = append(facilityIDs, *row.FacilityID)
		}
	}
	facilities := map[uint]models.Facility{}
	if len(facilityIDs) > 0 {
		var facilityRows []models.Facility
		_ = facades.Orm().Query().Where("id", facilityIDs).Get(&facilityRows)
		for _, facility := range facilityRows {
			facilities[facility.ID] = facility
		}
	}

	out := make([]DepartmentListRow, 0, len(pageRows))
	for _, row := range pageRows {
		item := DepartmentListRow{
			ID:               row.ID,
			Name:             row.Name,
			ExternalSystemID: row.ExternalSystemID,
			FacilityID:       row.FacilityID,
		}
		if row.FacilityID != nil {
			if facility, ok := facilities[*row.FacilityID]; ok {
				item.FacilityName = facility.Name
			}
		}
		out = append(out, item)
	}
	return BuildPaginatedResult(out, total, page, perPage), nil
}

func (s *ListsAdminService) ListJobTitles(filter ListFilter) (PaginatedResult[JobTitleListRow], error) {
	page, perPage := ResolvePage(filter.Page, filter.PerPage)
	query := facades.Orm().Query().Order("job_title asc")
	if filter.Search != "" {
		like := "%" + strings.TrimSpace(filter.Search) + "%"
		query = query.Where("job_title LIKE ? OR external_job_id LIKE ?", like, like)
	}
	var rows []models.JobTitle
	if err := query.Get(&rows); err != nil {
		return PaginatedResult[JobTitleListRow]{}, err
	}
	total := len(rows)
	start := OffsetFor(page, perPage)
	if start > total {
		start = total
	}
	end := start + perPage
	if end > total {
		end = total
	}
	pageRows := rows[start:end]

	out := make([]JobTitleListRow, 0, len(pageRows))
	for _, row := range pageRows {
		out = append(out, JobTitleListRow{
			ID:            row.ID,
			ExternalJobID: row.ExternalJobID,
			JobTitle:      row.JobTitle,
		})
	}
	return BuildPaginatedResult(out, total, page, perPage), nil
}

func (s *ListsAdminService) regionNameMap() map[uint]string {
	out := map[uint]string{}
	var rows []models.Region
	_ = facades.Orm().Query().Get(&rows)
	for _, row := range rows {
		out[row.ID] = row.Name
	}
	return out
}

func (s *ListsAdminService) districtNameMap() map[uint]string {
	out := map[uint]string{}
	var rows []models.District
	_ = facades.Orm().Query().Get(&rows)
	for _, row := range rows {
		out[row.ID] = row.Name
	}
	return out
}

func (s *ListsAdminService) ListRegionOptions() ([]models.Region, error) {
	var rows []models.Region
	err := facades.Orm().Query().Order("name asc").Get(&rows)
	return rows, err
}

func (s *ListsAdminService) ListDistrictOptions() ([]models.District, error) {
	var rows []models.District
	err := facades.Orm().Query().Order("name asc").Get(&rows)
	return rows, err
}

type UpdateRegionInput struct {
	Name             *string `json:"name"`
	Code             *string `json:"code"`
	ExternalSystemID *string `json:"external_system_id"`
	ISOCode          *string `json:"iso_code"`
	IsActive         *bool   `json:"is_active"`
}

type UpdateDistrictInput struct {
	Name            *string `json:"name"`
	Code            *string `json:"code"`
	RegionID        *uint   `json:"region_id"`
	IhrisDistrictID *string `json:"ihris_district_id"`
	ISOCode         *string `json:"iso_code"`
	IsActive        *bool   `json:"is_active"`
}

type UpdateFacilityInput struct {
	Name          *string  `json:"name"`
	DistrictRefID *uint    `json:"district_ref_id"`
	RegionID      *uint    `json:"region_id"`
	Latitude      *float64 `json:"latitude"`
	Longitude     *float64 `json:"longitude"`
	IsActive      *bool    `json:"is_active"`
}

type UpdateDepartmentInput struct {
	Name             *string `json:"name"`
	ExternalSystemID *string `json:"external_system_id"`
	FacilityID       *uint   `json:"facility_id"`
}

type UpdateJobTitleInput struct {
	JobTitle      *string `json:"job_title"`
	ExternalJobID *string `json:"external_job_id"`
}

type CreateDepartmentInput struct {
	Name             string `json:"name"`
	ExternalSystemID string `json:"external_system_id"`
	FacilityID       *uint  `json:"facility_id"`
}

type CreateJobTitleInput struct {
	JobTitle      string `json:"job_title"`
	ExternalJobID string `json:"external_job_id"`
}

func (s *ListsAdminService) UpdateRegion(id uint, input UpdateRegionInput) error {
	var row models.Region
	if err := facades.Orm().Query().Where("id", id).First(&row); err != nil || row.ID == 0 {
		return fmt.Errorf("region not found")
	}
	if input.Name != nil {
		row.Name = strings.TrimSpace(*input.Name)
	}
	if input.Code != nil {
		row.Code = strings.TrimSpace(*input.Code)
	}
	if input.ExternalSystemID != nil {
		row.ExternalSystemID = input.ExternalSystemID
	}
	if input.ISOCode != nil {
		row.ISOCode = input.ISOCode
	}
	if input.IsActive != nil {
		row.IsActive = *input.IsActive
	}
	return facades.Orm().Query().Save(&row)
}

func (s *ListsAdminService) UpdateDistrict(id uint, input UpdateDistrictInput) error {
	var row models.District
	if err := facades.Orm().Query().Where("id", id).First(&row); err != nil || row.ID == 0 {
		return fmt.Errorf("district not found")
	}
	if input.Name != nil {
		row.Name = strings.TrimSpace(*input.Name)
	}
	if input.Code != nil {
		row.Code = strings.TrimSpace(*input.Code)
	}
	if input.RegionID != nil {
		row.RegionID = input.RegionID
		var region models.Region
		if err := facades.Orm().Query().Where("id", *input.RegionID).First(&region); err == nil && region.ID > 0 {
			row.Region = region.Name
		}
	}
	if input.IhrisDistrictID != nil {
		row.IhrisDistrictID = input.IhrisDistrictID
	}
	if input.ISOCode != nil {
		row.ISOCode = strings.TrimSpace(*input.ISOCode)
	}
	if input.IsActive != nil {
		row.IsActive = *input.IsActive
	}
	return facades.Orm().Query().Save(&row)
}

func (s *ListsAdminService) UpdateFacility(id uint, input UpdateFacilityInput) error {
	var row models.Facility
	if err := facades.Orm().Query().Where("id", id).First(&row); err != nil || row.ID == 0 {
		return fmt.Errorf("facility not found")
	}
	if input.Name != nil {
		row.Name = strings.TrimSpace(*input.Name)
	}
	if input.DistrictRefID != nil {
		row.DistrictRefID = input.DistrictRefID
		var district models.District
		if err := facades.Orm().Query().Where("id", *input.DistrictRefID).First(&district); err == nil && district.ID > 0 {
			row.DistrictName = &district.Name
			if district.RegionID != nil {
				row.RegionID = district.RegionID
			}
		}
	}
	if input.RegionID != nil {
		row.RegionID = input.RegionID
	}
	if input.Latitude != nil {
		row.Latitude = input.Latitude
	}
	if input.Longitude != nil {
		row.Longitude = input.Longitude
	}
	if input.IsActive != nil {
		row.IsActive = *input.IsActive
	}
	return facades.Orm().Query().Save(&row)
}

func (s *ListsAdminService) UpdateDepartment(id uint, input UpdateDepartmentInput) error {
	var row models.Department
	if err := facades.Orm().Query().Where("id", id).First(&row); err != nil || row.ID == 0 {
		return fmt.Errorf("department not found")
	}
	if input.Name != nil {
		row.Name = strings.TrimSpace(*input.Name)
	}
	if input.ExternalSystemID != nil {
		row.ExternalSystemID = strings.TrimSpace(*input.ExternalSystemID)
	}
	if input.FacilityID != nil {
		if *input.FacilityID == 0 {
			row.FacilityID = nil
		} else {
			row.FacilityID = input.FacilityID
		}
	}
	return facades.Orm().Query().Save(&row)
}

func (s *ListsAdminService) UpdateJobTitle(id uint, input UpdateJobTitleInput) error {
	var row models.JobTitle
	if err := facades.Orm().Query().Where("id", id).First(&row); err != nil || row.ID == 0 {
		return fmt.Errorf("job title not found")
	}
	if input.JobTitle != nil {
		row.JobTitle = strings.TrimSpace(*input.JobTitle)
	}
	if input.ExternalJobID != nil {
		row.ExternalJobID = strings.TrimSpace(*input.ExternalJobID)
	}
	return facades.Orm().Query().Save(&row)
}

func (s *ListsAdminService) CreateDepartment(input CreateDepartmentInput) (models.Department, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return models.Department{}, fmt.Errorf("name is required")
	}
	extID := strings.TrimSpace(input.ExternalSystemID)
	if extID == "" {
		extID = fmt.Sprintf("manual-%d", time.Now().UnixNano())
	}
	row := models.Department{Name: name, ExternalSystemID: extID, FacilityID: input.FacilityID}
	if err := facades.Orm().Query().Create(&row); err != nil {
		return models.Department{}, err
	}
	return row, nil
}

func (s *ListsAdminService) CreateJobTitle(input CreateJobTitleInput) (models.JobTitle, error) {
	title := strings.TrimSpace(input.JobTitle)
	if title == "" {
		return models.JobTitle{}, fmt.Errorf("job title is required")
	}
	extID := strings.TrimSpace(input.ExternalJobID)
	if extID == "" {
		extID = fmt.Sprintf("manual-%d", time.Now().UnixNano())
	}
	row := models.JobTitle{JobTitle: title, ExternalJobID: extID}
	if err := facades.Orm().Query().Create(&row); err != nil {
		return models.JobTitle{}, err
	}
	return row, nil
}

func (s *ListsAdminService) ListOosReasons(filter ListFilter) (PaginatedResult[OosReasonListRow], error) {
	page, perPage := ResolvePage(filter.Page, filter.PerPage)
	query := facades.Orm().Query().Order("reason asc")
	if filter.Search != "" {
		like := "%" + strings.TrimSpace(filter.Search) + "%"
		query = query.Where("reason LIKE ?", like)
	}
	var rows []models.OutOfStationReason
	if err := query.Get(&rows); err != nil {
		return PaginatedResult[OosReasonListRow]{}, err
	}
	total := len(rows)
	start := OffsetFor(page, perPage)
	if start > total {
		start = total
	}
	end := start + perPage
	if end > total {
		end = total
	}
	pageRows := rows[start:end]

	out := make([]OosReasonListRow, 0, len(pageRows))
	for _, row := range pageRows {
		out = append(out, OosReasonListRow{
			ID:       row.ID,
			Reason:   row.Reason,
			IsActive: row.IsActive,
		})
	}
	return BuildPaginatedResult(out, total, page, perPage), nil
}

type UpdateOosReasonInput struct {
	Reason   *string `json:"reason"`
	IsActive *bool   `json:"is_active"`
}

type CreateOosReasonInput struct {
	Reason string `json:"reason"`
}

func (s *ListsAdminService) UpdateOosReason(id uint, input UpdateOosReasonInput) error {
	var row models.OutOfStationReason
	if err := facades.Orm().Query().Where("id", id).First(&row); err != nil || row.ID == 0 {
		return fmt.Errorf("out-of-station reason not found")
	}
	if input.Reason != nil {
		reason := strings.TrimSpace(*input.Reason)
		if reason == "" {
			return fmt.Errorf("reason is required")
		}
		row.Reason = reason
	}
	if input.IsActive != nil {
		row.IsActive = *input.IsActive
	}
	return facades.Orm().Query().Save(&row)
}

func (s *ListsAdminService) CreateOosReason(input CreateOosReasonInput) (models.OutOfStationReason, error) {
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return models.OutOfStationReason{}, fmt.Errorf("reason is required")
	}
	row := models.OutOfStationReason{Reason: reason, IsActive: true}
	if err := facades.Orm().Query().Create(&row); err != nil {
		return models.OutOfStationReason{}, err
	}
	return row, nil
}
