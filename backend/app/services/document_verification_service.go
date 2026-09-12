package services

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	qrcode "github.com/skip2/go-qrcode"

	"goravel/app/facades"
	"goravel/app/models"
)

const (
	DocTypePPA             = "ppa"
	DocTypeQuarterlyReport = "quarterly_report"
	DocTypeAppraisal       = "appraisal"
	DocTypeLeaveRequest    = "leave_request"
	DocTypeOosRequest      = "oos_request"
)

type DocumentVerificationService struct {
	settings *SettingsService
}

func NewDocumentVerificationService() *DocumentVerificationService {
	return &DocumentVerificationService{settings: NewSettingsService()}
}

type DocumentEnsureInput struct {
	DocumentType string `json:"document_type"`
	RefID        uint   `json:"ref_id"`
}

type DocumentEnsureResult struct {
	Token         string `json:"token"`
	VerifyURL     string `json:"verify_url"`
	QRCodeDataURL string `json:"qr_code_data_url"`
	DocumentType  string `json:"document_type"`
	Title         string `json:"title"`
	PeriodLabel   string `json:"period_label"`
	StaffName     string `json:"staff_name"`
	Status        string `json:"status"`
}

type DocumentPublicVerify struct {
	Valid            bool   `json:"valid"`
	Message          string `json:"message"`
	OrganisationName string `json:"organisation_name,omitempty"`
	DocumentType     string `json:"document_type,omitempty"`
	DocumentLabel    string `json:"document_label,omitempty"`
	Title            string `json:"title,omitempty"`
	PeriodLabel      string `json:"period_label,omitempty"`
	StaffName        string `json:"staff_name,omitempty"`
	Status           string `json:"status,omitempty"`
	IssuedAt         string `json:"issued_at,omitempty"`
}

type documentMeta struct {
	StaffID     *uint
	StaffName   string
	Title       string
	PeriodLabel string
	Status      string
}

func (s *DocumentVerificationService) Ensure(issuedBy *uint, input DocumentEnsureInput) (DocumentEnsureResult, error) {
	docType := strings.TrimSpace(strings.ToLower(input.DocumentType))
	if input.RefID == 0 || docType == "" {
		return DocumentEnsureResult{}, fmt.Errorf("document_type and ref_id are required")
	}

	meta, err := s.resolveApprovedMeta(docType, input.RefID)
	if err != nil {
		return DocumentEnsureResult{}, err
	}

	var existing models.DocumentVerification
	err = facades.Orm().Query().
		Where("document_type", docType).
		Where("ref_id", input.RefID).
		Where("revoked_at is null").
		First(&existing)
	if err == nil && existing.ID > 0 {
		return s.toEnsureResult(existing)
	}

	token, err := randomToken(24)
	if err != nil {
		return DocumentEnsureResult{}, err
	}

	row := models.DocumentVerification{
		Token:        token,
		DocumentType: docType,
		RefID:        input.RefID,
		StaffID:      meta.StaffID,
		StaffName:    meta.StaffName,
		Title:        meta.Title,
		PeriodLabel:  meta.PeriodLabel,
		Status:       meta.Status,
		IssuedAt:     time.Now().UTC(),
		IssuedBy:     issuedBy,
	}
	if err := facades.Orm().Query().Create(&row); err != nil {
		return DocumentEnsureResult{}, err
	}
	return s.toEnsureResult(row)
}

func (s *DocumentVerificationService) LookupPublic(token string) DocumentPublicVerify {
	org := s.settings.GetString("letterhead.org_name", "Ministry of Health")
	token = strings.TrimSpace(token)
	if token == "" {
		return DocumentPublicVerify{Valid: false, Message: "Verification token is required", OrganisationName: org}
	}

	var row models.DocumentVerification
	if err := facades.Orm().Query().Where("token", token).First(&row); err != nil || row.ID == 0 {
		return DocumentPublicVerify{Valid: false, Message: "Document not found in MoH PMS", OrganisationName: org}
	}
	if row.RevokedAt != nil {
		return DocumentPublicVerify{
			Valid:            false,
			Message:          "This verification mark has been revoked",
			OrganisationName: org,
			DocumentType:     row.DocumentType,
			DocumentLabel:    documentTypeLabel(row.DocumentType),
			Title:            row.Title,
		}
	}

	return DocumentPublicVerify{
		Valid:            true,
		Message:          "This document is recorded as approved in the MoH Performance Management System",
		OrganisationName: org,
		DocumentType:     row.DocumentType,
		DocumentLabel:    documentTypeLabel(row.DocumentType),
		Title:            row.Title,
		PeriodLabel:      row.PeriodLabel,
		StaffName:        row.StaffName,
		Status:           row.Status,
		IssuedAt:         row.IssuedAt.UTC().Format(time.RFC3339),
	}
}

func (s *DocumentVerificationService) toEnsureResult(row models.DocumentVerification) (DocumentEnsureResult, error) {
	verifyURL := s.verifyURL(row.Token)
	qr, err := qrDataURL(verifyURL)
	if err != nil {
		return DocumentEnsureResult{}, err
	}
	return DocumentEnsureResult{
		Token:         row.Token,
		VerifyURL:     verifyURL,
		QRCodeDataURL: qr,
		DocumentType:  row.DocumentType,
		Title:         row.Title,
		PeriodLabel:   row.PeriodLabel,
		StaffName:     row.StaffName,
		Status:        row.Status,
	}, nil
}

func (s *DocumentVerificationService) verifyURL(token string) string {
	base := strings.TrimRight(s.settings.GetString("app.public_url", "http://127.0.0.1:5173"), "/")
	return base + "/verify/" + token
}

func (s *DocumentVerificationService) resolveApprovedMeta(docType string, refID uint) (documentMeta, error) {
	switch docType {
	case DocTypeLeaveRequest:
		var req models.LeaveRequest
		if err := facades.Orm().Query().Where("id", refID).First(&req); err != nil || req.ID == 0 {
			return documentMeta{}, fmt.Errorf("leave request not found")
		}
		if !isApprovedStatus(req.Status) {
			return documentMeta{}, fmt.Errorf("leave request is not approved")
		}
		return documentMeta{
			StaffID:     uintPtr(req.StaffID),
			StaffName:   staffNameByID(req.StaffID),
			Title:       "Leave approval",
			PeriodLabel: fmt.Sprintf("%s – %s", req.StartDate.Format("02 Jan 2006"), req.EndDate.Format("02 Jan 2006")),
			Status:      req.Status,
		}, nil
	case DocTypeOosRequest:
		var req models.OutOfStationRequest
		if err := facades.Orm().Query().Where("id", refID).First(&req); err != nil || req.ID == 0 {
			return documentMeta{}, fmt.Errorf("out of station request not found")
		}
		if !isApprovedStatus(req.Status) {
			return documentMeta{}, fmt.Errorf("out of station request is not approved")
		}
		return documentMeta{
			StaffID:     uintPtr(req.StaffID),
			StaffName:   staffNameByID(req.StaffID),
			Title:       "Out of station approval",
			PeriodLabel: fmt.Sprintf("%s – %s · %s", req.StartDate.Format("02 Jan 2006"), req.EndDate.Format("02 Jan 2006"), req.DestinationName),
			Status:      req.Status,
		}, nil
	case DocTypePPA:
		var ppa models.Ppa
		if err := facades.Orm().Query().Where("id", refID).First(&ppa); err != nil || ppa.ID == 0 {
			return documentMeta{}, fmt.Errorf("performance plan not found")
		}
		if !isApprovedStatus(ppa.Status) {
			return documentMeta{}, fmt.Errorf("performance plan is not approved")
		}
		return documentMeta{
			StaffID:     uintPtr(ppa.StaffID),
			StaffName:   staffNameByID(ppa.StaffID),
			Title:       "Performance plan (PPA)",
			PeriodLabel: financialYearLabel(ppa.FinancialYearID),
			Status:      ppa.Status,
		}, nil
	case DocTypeQuarterlyReport, DocTypeAppraisal:
		var report models.PerformanceReport
		if err := facades.Orm().Query().Where("id", refID).First(&report); err != nil || report.ID == 0 {
			return documentMeta{}, fmt.Errorf("performance report not found")
		}
		if !isApprovedStatus(report.Status) {
			return documentMeta{}, fmt.Errorf("performance report is not approved")
		}
		title := "Performance report"
		if docType == DocTypeAppraisal || strings.EqualFold(report.ReportType, "endterm") {
			title = "Final appraisal"
		} else {
			title = "Performance report — " + strings.ToUpper(report.ReportType)
		}
		return documentMeta{
			StaffID:     uintPtr(report.StaffID),
			StaffName:   staffNameByID(report.StaffID),
			Title:       title,
			PeriodLabel: financialYearLabel(report.FinancialYearID) + " · " + strings.ToUpper(report.ReportType),
			Status:      report.Status,
		}, nil
	default:
		return documentMeta{}, fmt.Errorf("unsupported document_type")
	}
}

func isApprovedStatus(status string) bool {
	return strings.EqualFold(strings.TrimSpace(status), "approved")
}

func staffNameByID(staffID uint) string {
	var staff models.Staff
	if err := facades.Orm().Query().Where("id", staffID).First(&staff); err != nil || staff.ID == 0 {
		return "Staff member"
	}
	parts := []string{strings.TrimSpace(staff.Firstname), strings.TrimSpace(staff.Surname)}
	if staff.Othername != nil && strings.TrimSpace(*staff.Othername) != "" {
		parts = []string{strings.TrimSpace(staff.Firstname), strings.TrimSpace(*staff.Othername), strings.TrimSpace(staff.Surname)}
	}
	name := strings.TrimSpace(strings.Join(parts, " "))
	if name == "" {
		return "Staff member"
	}
	return name
}

func financialYearLabel(fyID uint) string {
	var fy models.FinancialYear
	if err := facades.Orm().Query().Where("id", fyID).First(&fy); err != nil || fy.ID == 0 {
		return "Financial year"
	}
	if strings.TrimSpace(fy.YearLabel) != "" {
		return fy.YearLabel
	}
	return "Financial year"
}

func documentTypeLabel(docType string) string {
	switch docType {
	case DocTypePPA:
		return "Performance plan"
	case DocTypeQuarterlyReport:
		return "Quarterly / midterm report"
	case DocTypeAppraisal:
		return "Final appraisal"
	case DocTypeLeaveRequest:
		return "Leave request"
	case DocTypeOosRequest:
		return "Out of station request"
	default:
		return docType
	}
}

func uintPtr(v uint) *uint { return &v }

func randomToken(nbytes int) (string, error) {
	b := make([]byte, nbytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func qrDataURL(content string) (string, error) {
	png, err := qrcode.Encode(content, qrcode.Medium, 180)
	if err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(png), nil
}
