package services

import (
	"fmt"
	"strings"
	"time"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/models"
)

const activationTokenTTL = 24 * time.Hour

type AccountActivationService struct {
	notify *NotificationService
	totp   *TotpService
	rbac   *RbacService
}

func NewAccountActivationService() *AccountActivationService {
	return &AccountActivationService{
		notify: NewNotificationService(),
		totp:   NewTotpService(),
		rbac:   NewRbacService(),
	}
}

type ActivationPreview struct {
	Email       string `json:"email"`
	StaffID     uint   `json:"staff_id"`
	StaffName   string `json:"staff_name"`
	HasAccount  bool   `json:"has_account"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// RequestActivation sends a 24-hour activation link when the email matches a staff record.
func (s *AccountActivationService) RequestActivation(email string) error {
	email = strings.TrimSpace(strings.ToLower(email))
	staffID, staff, err := FindStaffIDByEmail(email)
	if err != nil || staffID == nil || staff == nil {
		// Do not reveal whether the email exists.
		return nil
	}

	resolvedEmail := ResolveStaffEmail(*staff)
	if resolvedEmail == "" {
		resolvedEmail = email
	}

	token, err := generateSecureToken(32)
	if err != nil {
		return err
	}

	var existingUser models.User
	userErr := facades.Orm().Query().Where("email", resolvedEmail).First(&existingUser)
	var userID *uint
	if userErr == nil && existingUser.ID > 0 {
		userID = &existingUser.ID
	}

	// Invalidate previous unused tokens for this email.
	now := time.Now()
	_, _ = facades.Orm().Query().
		Model(&models.AccountActivationToken{}).
		Where("email = ? AND used_at IS NULL", resolvedEmail).
		Update("used_at", now)

	row := models.AccountActivationToken{
		Token:     token,
		Email:     resolvedEmail,
		StaffID:   *staffID,
		UserID:    userID,
		ExpiresAt: now.Add(activationTokenTTL),
	}
	if err := facades.Orm().Query().Create(&row); err != nil {
		return err
	}

	appURL := strings.TrimRight(castString(facades.Config().GetString("app.url", "")), "/")
	if appURL == "" {
		appURL = strings.TrimRight(castString(facades.Config().Env("APP_URL", "http://127.0.0.1:8081")), "/")
	}
	link := fmt.Sprintf("%s/activate?token=%s", appURL, token)
	subject := "Activate your MoH PMS account"
	body := fmt.Sprintf(
		"Hello %s,\n\n"+
			"You requested to activate your Ministry of Health Performance Management System account.\n\n"+
			"Open this link within 24 hours to set your password and complete your profile:\n%s\n\n"+
			"If you did not request this, you can ignore this email.\n\n"+
			"MoH PMS",
		StaffDisplayName(*staff),
		link,
	)
	return s.notify.sendTo(resolvedEmail, subject, body)
}

func (s *AccountActivationService) loadValidToken(token string) (models.AccountActivationToken, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return models.AccountActivationToken{}, fmt.Errorf("activation token is required")
	}
	var row models.AccountActivationToken
	if err := facades.Orm().Query().Where("token", token).First(&row); err != nil {
		return models.AccountActivationToken{}, fmt.Errorf("activation link is invalid or expired")
	}
	if row.UsedAt != nil {
		return models.AccountActivationToken{}, fmt.Errorf("activation link has already been used")
	}
	if row.ExpiresAt.Before(time.Now()) {
		return models.AccountActivationToken{}, fmt.Errorf("activation link has expired")
	}
	return row, nil
}

func (s *AccountActivationService) PreviewToken(token string) (ActivationPreview, error) {
	row, err := s.loadValidToken(token)
	if err != nil {
		return ActivationPreview{}, err
	}
	var staff models.Staff
	if err := facades.Orm().Query().Where("id", row.StaffID).First(&staff); err != nil {
		return ActivationPreview{}, fmt.Errorf("staff record not found")
	}
	var user models.User
	hasAccount := facades.Orm().Query().Where("email", row.Email).First(&user) == nil && user.ID > 0
	return ActivationPreview{
		Email:      row.Email,
		StaffID:    row.StaffID,
		StaffName:  StaffDisplayName(staff),
		HasAccount: hasAccount,
		ExpiresAt:  row.ExpiresAt,
	}, nil
}

type CompleteActivationInput struct {
	Token    string
	Password string
	Name     string
}

type CompleteActivationResult struct {
	Token              string   `json:"token"`
	TokenType          string   `json:"token_type"`
	ExpiresIn          int      `json:"expires_in_minutes"`
	User               models.User `json:"user"`
	Roles              []string `json:"roles"`
	Permissions        []string `json:"permissions"`
	MustChangePassword bool     `json:"must_change_password"`
	NeedsProfileSetup  bool     `json:"needs_profile_setup"`
}

func (s *AccountActivationService) CompleteActivation(ctx http.Context, input CompleteActivationInput) (CompleteActivationResult, error) {
	row, err := s.loadValidToken(input.Token)
	if err != nil {
		return CompleteActivationResult{}, err
	}
	password := strings.TrimSpace(input.Password)
	if len(password) < 10 {
		return CompleteActivationResult{}, fmt.Errorf("password must be at least 10 characters")
	}

	var staff models.Staff
	if err := facades.Orm().Query().Where("id", row.StaffID).First(&staff); err != nil {
		return CompleteActivationResult{}, fmt.Errorf("staff record not found")
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		name = StaffDisplayName(staff)
	}

	hashed, err := facades.Hash().Make(password)
	if err != nil {
		return CompleteActivationResult{}, err
	}

	now := time.Now()
	var user models.User
	userErr := facades.Orm().Query().Where("email", row.Email).First(&user)
	if userErr != nil || user.ID == 0 {
		user = models.User{
			Name:                  name,
			Email:                 row.Email,
			Password:              hashed,
			Role:                  "staff",
			IsActive:              true,
			StaffID:               &row.StaffID,
			PasswordChangedAt:     &now,
			ActivationCompletedAt: &now,
		}
		if err := facades.Orm().Query().Create(&user); err != nil {
			return CompleteActivationResult{}, err
		}
		_ = s.rbac.AssignRole(user.ID, "staff")
	} else {
		user.Name = name
		user.Password = hashed
		user.IsActive = true
		user.StaffID = &row.StaffID
		user.PasswordChangedAt = &now
		user.MustChangePassword = false
		user.ActivationCompletedAt = &now
		if err := facades.Orm().Query().Save(&user); err != nil {
			return CompleteActivationResult{}, err
		}
		_ = LinkUserToStaffByEmail(&user)
	}

	row.UsedAt = &now
	_ = facades.Orm().Query().Save(&row)

	jwt, err := facades.Auth(ctx).Login(&user)
	if err != nil {
		return CompleteActivationResult{}, err
	}
	principal, err := s.rbac.LoadPrincipal(user)
	if err != nil {
		return CompleteActivationResult{}, err
	}
	perms := make([]string, 0, len(principal.Permissions))
	for code := range principal.Permissions {
		perms = append(perms, code)
	}
	user.Password = ""
	ttl := facades.Config().GetInt("jwt.ttl", 60)

	return CompleteActivationResult{
		Token:              jwt,
		TokenType:          "Bearer",
		ExpiresIn:          ttl,
		User:               user,
		Roles:              principal.Roles,
		Permissions:        perms,
		MustChangePassword: false,
		NeedsProfileSetup:  true,
	}, nil
}

// SendActivationForStaff is used by admins to trigger activation for a staff member.
func (s *AccountActivationService) SendActivationForStaff(staffID uint) error {
	var staff models.Staff
	if err := facades.Orm().Query().Where("id", staffID).First(&staff); err != nil {
		return fmt.Errorf("staff not found")
	}
	email := ResolveStaffEmail(staff)
	if email == "" {
		return fmt.Errorf("staff does not have an email address on record")
	}
	return s.RequestActivation(email)
}

// RequestPasswordReset emails a 24-hour link to set a new password for an existing account.
func (s *AccountActivationService) RequestPasswordReset(email string) error {
	email = strings.TrimSpace(strings.ToLower(email))
	var user models.User
	if err := facades.Orm().Query().Where("email", email).First(&user); err != nil || user.ID == 0 {
		return nil
	}
	if !user.IsActive {
		return nil
	}

	var staffID uint
	if user.StaffID != nil && *user.StaffID > 0 {
		staffID = *user.StaffID
	} else {
		sid, _, err := FindStaffIDByEmail(email)
		if err != nil || sid == nil {
			return nil
		}
		staffID = *sid
	}

	var staff models.Staff
	if err := facades.Orm().Query().Where("id", staffID).First(&staff); err != nil {
		return nil
	}

	token, err := generateSecureToken(32)
	if err != nil {
		return err
	}

	now := time.Now()
	_, _ = facades.Orm().Query().
		Model(&models.AccountActivationToken{}).
		Where("email = ? AND used_at IS NULL", email).
		Update("used_at", now)

	userID := user.ID
	row := models.AccountActivationToken{
		Token:     token,
		Email:     email,
		StaffID:   staffID,
		UserID:    &userID,
		ExpiresAt: now.Add(activationTokenTTL),
	}
	if err := facades.Orm().Query().Create(&row); err != nil {
		return err
	}

	appURL := strings.TrimRight(castString(facades.Config().GetString("app.url", "")), "/")
	if appURL == "" {
		appURL = strings.TrimRight(castString(facades.Config().Env("APP_URL", "http://127.0.0.1:8081")), "/")
	}
	link := fmt.Sprintf("%s/activate?token=%s", appURL, token)
	subject := "Reset your MoH PMS password"
	body := fmt.Sprintf(
		"Hello %s,\n\n"+
			"You requested to reset your Ministry of Health Performance Management System password.\n\n"+
			"Open this link within 24 hours to set a new password:\n%s\n\n"+
			"If you did not request this, you can ignore this email.\n\n"+
			"MoH PMS",
		StaffDisplayName(staff),
		link,
	)
	return s.notify.sendTo(email, subject, body)
}
