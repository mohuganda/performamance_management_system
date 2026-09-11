package services

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type OutOfStationService struct {
	approval *ApprovalService
}

func NewOutOfStationService() *OutOfStationService {
	return &OutOfStationService{approval: NewApprovalService()}
}

type CreateOutOfStationInput struct {
	StaffID              uint
	ReasonID             uint
	StartDate            time.Time
	EndDate              time.Time
	Remarks              string
	ExpectedDeliverables string
	AttachmentURL        string
	DestinationName      string
	DestinationAddress   string
	DestinationLatitude  float64
	DestinationLongitude float64
	GeofenceRadiusMeters int
	CachedPlaceID        uint // optional; copies immutable snapshot into destination fields
}

func (s *OutOfStationService) applyCachedPlace(input *CreateOutOfStationInput) error {
	if input == nil || input.CachedPlaceID == 0 {
		return nil
	}
	place, err := NewPlacesService().GetByID(input.CachedPlaceID)
	if err != nil || place == nil {
		return fmt.Errorf("cached place not found")
	}
	input.DestinationName = place.Name
	if place.Address != nil && *place.Address != "" {
		input.DestinationAddress = *place.Address
	}
	input.DestinationLatitude = place.Latitude
	input.DestinationLongitude = place.Longitude
	return nil
}

func (s *OutOfStationService) validateDraftInput(input CreateOutOfStationInput) error {
	if input.ExpectedDeliverables == "" {
		return fmt.Errorf("expected deliverables are required")
	}
	today := time.Now().Truncate(24 * time.Hour)
	if input.StartDate.Before(today) || input.EndDate.Before(today) {
		return fmt.Errorf("cannot create out-of-station request for past dates")
	}
	if input.EndDate.Before(input.StartDate) {
		return fmt.Errorf("end date must be on or after start date")
	}
	if input.DestinationLatitude == 0 && input.DestinationLongitude == 0 {
		return fmt.Errorf("destination coordinates are required")
	}
	return nil
}

func (s *OutOfStationService) CreateDraft(input CreateOutOfStationInput) (models.OutOfStationRequest, error) {
	if err := s.applyCachedPlace(&input); err != nil {
		return models.OutOfStationRequest{}, err
	}
	if err := s.validateDraftInput(input); err != nil {
		return models.OutOfStationRequest{}, err
	}

	radius := input.GeofenceRadiusMeters
	if radius <= 0 {
		radius = 500
	}

	entrySeed := fmt.Sprintf("%d-%s-%s-%d", input.StaffID, input.StartDate.Format("2006-01-02"), input.EndDate.Format("2006-01-02"), input.ReasonID)
	hash := md5.Sum([]byte(entrySeed))
	entryID := hex.EncodeToString(hash[:])

	existing, err := facades.Orm().Query().Model(&models.OutOfStationRequest{}).
		Where("entry_id", entryID).
		Where("status", "pending").
		Count()
	if err != nil {
		return models.OutOfStationRequest{}, err
	}
	if existing > 0 {
		return models.OutOfStationRequest{}, fmt.Errorf("pending request already exists for the same period")
	}

	req := models.OutOfStationRequest{
		EntryID:                 entryID,
		StaffID:                 input.StaffID,
		ReasonID:                input.ReasonID,
		StartDate:               input.StartDate,
		EndDate:                 input.EndDate,
		Remarks:                 strPtrIf(input.Remarks),
		ExpectedDeliverables:    strPtrIf(input.ExpectedDeliverables),
		DestinationName:         input.DestinationName,
		DestinationAddress:      strPtrIf(input.DestinationAddress),
		DestinationLatitude:     input.DestinationLatitude,
		DestinationLongitude:    input.DestinationLongitude,
		GeofenceRadiusMeters:    radius,
		Status:                  "draft",
		CurrentApprovalSequence: 1,
	}
	if input.AttachmentURL != "" {
		req.AttachmentURL = &input.AttachmentURL
	}

	if err := facades.Orm().Query().Create(&req); err != nil {
		return models.OutOfStationRequest{}, err
	}

	return req, nil
}

func (s *OutOfStationService) Submit(requestID uint, staffID uint) error {
	var req models.OutOfStationRequest
	if err := facades.Orm().Query().Where("id", requestID).Where("staff_id", staffID).First(&req); err != nil {
		return fmt.Errorf("out-of-station request not found")
	}
	if req.Status != "draft" {
		return fmt.Errorf("only draft requests can be submitted")
	}

	now := time.Now()
	req.Status = "pending"
	req.SubmittedAt = &now
	req.CurrentApprovalSequence = 1
	if err := facades.Orm().Query().Save(&req); err != nil {
		return err
	}

	return s.approval.SeedOutOfStationApprovals(req.ID, staffID)
}

// GetOwned returns a request owned by staffID.
func (s *OutOfStationService) GetOwned(staffID, id uint) (*models.OutOfStationRequest, error) {
	var req models.OutOfStationRequest
	if err := facades.Orm().Query().Where("id", id).Where("staff_id", staffID).First(&req); err != nil || req.ID == 0 {
		return nil, fmt.Errorf("out-of-station request not found")
	}
	return &req, nil
}

// GetForViewer returns a request if the staff is the owner or an assigned approver.
func (s *OutOfStationService) GetForViewer(staffID, id uint) (*models.OutOfStationRequest, error) {
	if owned, err := s.GetOwned(staffID, id); err == nil {
		return owned, nil
	}
	var req models.OutOfStationRequest
	if err := facades.Orm().Query().Where("id", id).First(&req); err != nil || req.ID == 0 {
		return nil, fmt.Errorf("out-of-station request not found")
	}
	count, err := facades.Orm().Query().Model(&models.OutOfStationApproval{}).
		Where("out_of_station_request_id", id).
		Where("supervisor_staff_id", staffID).
		Count()
	if err != nil || count == 0 {
		return nil, fmt.Errorf("out-of-station request not found")
	}
	return &req, nil
}

func (s *OutOfStationService) UpdateDraft(staffID, id uint, input CreateOutOfStationInput) (models.OutOfStationRequest, error) {
	req, err := s.GetOwned(staffID, id)
	if err != nil {
		return models.OutOfStationRequest{}, err
	}
	if req.Status != "draft" {
		return models.OutOfStationRequest{}, fmt.Errorf("only draft requests can be updated")
	}

	input.StaffID = staffID
	if err := s.applyCachedPlace(&input); err != nil {
		return models.OutOfStationRequest{}, err
	}
	if err := s.validateDraftInput(input); err != nil {
		return models.OutOfStationRequest{}, err
	}

	radius := input.GeofenceRadiusMeters
	if radius <= 0 {
		radius = 500
	}

	entrySeed := fmt.Sprintf("%d-%s-%s-%d", staffID, input.StartDate.Format("2006-01-02"), input.EndDate.Format("2006-01-02"), input.ReasonID)
	hash := md5.Sum([]byte(entrySeed))
	entryID := hex.EncodeToString(hash[:])

	req.EntryID = entryID
	req.ReasonID = input.ReasonID
	req.StartDate = input.StartDate
	req.EndDate = input.EndDate
	req.Remarks = strPtrIf(input.Remarks)
	req.ExpectedDeliverables = strPtrIf(input.ExpectedDeliverables)
	req.DestinationName = input.DestinationName
	req.DestinationAddress = strPtrIf(input.DestinationAddress)
	req.DestinationLatitude = input.DestinationLatitude
	req.DestinationLongitude = input.DestinationLongitude
	req.GeofenceRadiusMeters = radius
	if input.AttachmentURL != "" {
		req.AttachmentURL = &input.AttachmentURL
	} else {
		req.AttachmentURL = nil
	}

	if err := facades.Orm().Query().Save(req); err != nil {
		return models.OutOfStationRequest{}, err
	}
	return *req, nil
}

func (s *OutOfStationService) Cancel(staffID, id uint) error {
	req, err := s.GetOwned(staffID, id)
	if err != nil {
		return err
	}
	prevStatus := req.Status
	switch prevStatus {
	case "draft", "pending":
		// ok
	default:
		return fmt.Errorf("only draft or pending requests can be cancelled")
	}

	req.Status = "cancelled"
	if err := facades.Orm().Query().Save(req); err != nil {
		return err
	}

	if prevStatus == "pending" {
		_, _ = facades.Orm().Query().Model(&models.OutOfStationApproval{}).
			Where("out_of_station_request_id", id).
			Where("status", "pending").
			Update("status", "cancelled")
	}
	return nil
}

func (s *OutOfStationService) ListForStaff(staffID uint) ([]models.OutOfStationRequest, error) {
	var rows []models.OutOfStationRequest
	err := facades.Orm().Query().Where("staff_id", staffID).Order("created_at desc").Get(&rows)
	return rows, err
}

func (s *OutOfStationService) ListReasons() ([]models.OutOfStationReason, error) {
	var rows []models.OutOfStationReason
	err := facades.Orm().Query().Where("is_active", true).Get(&rows)
	return rows, err
}

func (s *OutOfStationService) ActiveApprovedForDate(staffID uint, date time.Time) (*models.OutOfStationRequest, error) {
	day := date.Format("2006-01-02")
	var req models.OutOfStationRequest
	err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("status", "approved").
		Where("start_date <= ?", day).
		Where("end_date >= ?", day).
		First(&req)
	if err != nil {
		return nil, err
	}
	return &req, nil
}

// GetApprovedOwnedForDate returns a specific approved OOS request owned by staff covering date.
func (s *OutOfStationService) GetApprovedOwnedForDate(staffID, requestID uint, date time.Time) (*models.OutOfStationRequest, error) {
	day := date.Format("2006-01-02")
	var req models.OutOfStationRequest
	err := facades.Orm().Query().
		Where("id", requestID).
		Where("staff_id", staffID).
		Where("status", "approved").
		Where("start_date <= ?", day).
		Where("end_date >= ?", day).
		First(&req)
	if err != nil || req.ID == 0 {
		return nil, fmt.Errorf("approved out-of-station request not found for today")
	}
	return &req, nil
}
