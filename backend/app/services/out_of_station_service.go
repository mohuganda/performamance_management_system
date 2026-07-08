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
	AttachmentURL        string
	DestinationName      string
	DestinationAddress   string
	DestinationLatitude  float64
	DestinationLongitude float64
	GeofenceRadiusMeters int
}

func (s *OutOfStationService) CreateDraft(input CreateOutOfStationInput) (models.OutOfStationRequest, error) {
	today := time.Now().Truncate(24 * time.Hour)
	if input.StartDate.Before(today) || input.EndDate.Before(today) {
		return models.OutOfStationRequest{}, fmt.Errorf("cannot create out-of-station request for past dates")
	}
	if input.EndDate.Before(input.StartDate) {
		return models.OutOfStationRequest{}, fmt.Errorf("end date must be on or after start date")
	}
	if input.DestinationLatitude == 0 && input.DestinationLongitude == 0 {
		return models.OutOfStationRequest{}, fmt.Errorf("destination coordinates are required")
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
