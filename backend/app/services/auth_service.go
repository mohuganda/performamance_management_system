package services

import (
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/http/authctx"
	"goravel/app/models"
)

type AuthService struct {
	rbac *RbacService
}

func NewAuthService() *AuthService {
	return &AuthService{rbac: NewRbacService()}
}

type LoginResult struct {
	Token              string       `json:"token,omitempty"`
	TokenType          string       `json:"token_type,omitempty"`
	ExpiresIn          int          `json:"expires_in_minutes,omitempty"`
	User               models.User  `json:"user,omitempty"`
	Roles              []string     `json:"roles,omitempty"`
	Permissions        []string     `json:"permissions,omitempty"`
	MustChangePassword bool         `json:"must_change_password"`
	RequiresTotp       bool         `json:"requires_totp"`
	LoginChallenge     string       `json:"login_challenge,omitempty"`
}

func (s *AuthService) Login(ctx http.Context, email, password string) (LoginResult, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || password == "" {
		return LoginResult{}, fmt.Errorf("email and password are required")
	}

	if err := s.checkLoginRateLimit(ctx, email); err != nil {
		return LoginResult{}, err
	}

	var user models.User
	if err := facades.Orm().Query().Where("email", email).First(&user); err != nil {
		s.recordFailedAttempt(ctx, email)
		return LoginResult{}, fmt.Errorf("invalid credentials")
	}

	if !user.IsActive {
		return LoginResult{}, fmt.Errorf("account is disabled")
	}

	if user.LockedUntil != nil && user.LockedUntil.After(time.Now()) {
		return LoginResult{}, fmt.Errorf("account temporarily locked; try again later")
	}

	if !facades.Hash().Check(password, user.Password) {
		s.registerFailedLogin(&user)
		s.recordFailedAttempt(ctx, email)
		return LoginResult{}, fmt.Errorf("invalid credentials")
	}

	if user.TotpEnabled {
		challenge, err := s.createLoginChallenge(user.ID)
		if err != nil {
			return LoginResult{}, err
		}
		user.Password = ""
		return LoginResult{
			RequiresTotp:   true,
			LoginChallenge: challenge,
			User:           user,
		}, nil
	}

	return s.issueLoginResult(ctx, &user)
}

func (s *AuthService) issueLoginResult(ctx http.Context, user *models.User) (LoginResult, error) {
	now := time.Now()
	user.FailedLoginAttempts = 0
	user.LockedUntil = nil
	user.LastLoginAt = &now
	_ = facades.Orm().Query().Save(user)

	token, err := facades.Auth(ctx).Login(user)
	if err != nil {
		return LoginResult{}, err
	}

	principal, err := s.rbac.LoadPrincipal(*user)
	if err != nil {
		return LoginResult{}, err
	}

	perms := make([]string, 0, len(principal.Permissions))
	for code := range principal.Permissions {
		perms = append(perms, code)
	}

	ttl := facades.Config().GetInt("jwt.ttl", 60)
	user.Password = ""

	return LoginResult{
		Token:              token,
		TokenType:          "Bearer",
		ExpiresIn:          ttl,
		User:               *user,
		Roles:              principal.Roles,
		Permissions:        perms,
		MustChangePassword: user.MustChangePassword,
	}, nil
}

func (s *AuthService) createLoginChallenge(userID uint) (string, error) {
	challenge, err := generateSecureToken(24)
	if err != nil {
		return "", err
	}
	key := fmt.Sprintf("auth:login_challenge:%s", challenge)
	if err := facades.Cache().Put(key, userID, 5*time.Minute); err != nil {
		return "", err
	}
	return challenge, nil
}

func (s *AuthService) CompleteTotpLogin(ctx http.Context, challenge, code string) (LoginResult, error) {
	challenge = strings.TrimSpace(challenge)
	code = strings.TrimSpace(code)
	if challenge == "" || code == "" {
		return LoginResult{}, fmt.Errorf("challenge and authenticator code are required")
	}
	key := fmt.Sprintf("auth:login_challenge:%s", challenge)
	raw := facades.Cache().Get(key, nil)
	userID := cacheUint(raw)
	if userID == 0 {
		return LoginResult{}, fmt.Errorf("login challenge expired; sign in again")
	}

	var user models.User
	if err := facades.Orm().Query().Where("id", userID).First(&user); err != nil {
		return LoginResult{}, fmt.Errorf("user not found")
	}
	if !user.IsActive {
		return LoginResult{}, fmt.Errorf("account is disabled")
	}
	if err := NewTotpService().Verify(user.ID, code); err != nil {
		return LoginResult{}, err
	}
	_ = facades.Cache().Forget(key)
	return s.issueLoginResult(ctx, &user)
}

func (s *AuthService) registerFailedLogin(user *models.User) {
	maxAttempts := facades.Config().GetInt("security.auth.max_login_attempts", 5)
	lockMinutes := facades.Config().GetInt("security.auth.lockout_minutes", 15)

	user.FailedLoginAttempts++
	if int(user.FailedLoginAttempts) >= maxAttempts {
		lockUntil := time.Now().Add(time.Duration(lockMinutes) * time.Minute)
		user.LockedUntil = &lockUntil
		user.FailedLoginAttempts = 0
	}
	_ = facades.Orm().Query().Save(user)
}

func (s *AuthService) checkLoginRateLimit(ctx http.Context, email string) error {
	limit := facades.Config().GetInt("security.auth.login_rate_limit", 10)
	window := facades.Config().GetInt("security.auth.login_rate_limit_window", 60)
	key := fmt.Sprintf("auth:login:%s:%s", ctx.Request().Ip(), email)

	var count int
	if raw := facades.Cache().Get(key, 0); raw != nil {
		if v, ok := raw.(int); ok {
			count = v
		}
	}
	if count >= limit {
		return fmt.Errorf("too many login attempts; please wait")
	}
	_ = facades.Cache().Put(key, count+1, time.Duration(window)*time.Second)
	return nil
}

func (s *AuthService) recordFailedAttempt(ctx http.Context, email string) {
	_ = s.checkLoginRateLimit(ctx, email)
}

func (s *AuthService) Me(ctx http.Context) (authctx.Principal, error) {
	var user models.User
	if err := facades.Auth(ctx).User(&user); err != nil {
		return authctx.Principal{}, fmt.Errorf("unauthenticated")
	}
	return s.rbac.LoadPrincipal(user)
}

func (s *AuthService) Logout(ctx http.Context) error {
	return facades.Auth(ctx).Logout()
}

func (s *AuthService) Refresh(ctx http.Context) (string, error) {
	token := ParseBearerToken(ctx)
	if token == "" {
		return "", fmt.Errorf("missing bearer token")
	}
	if _, err := facades.Auth(ctx).Parse(token); err != nil {
		return "", err
	}
	return facades.Auth(ctx).Refresh()
}

func (s *AuthService) EnsureSuperAdmin() error {
	email := strings.TrimSpace(strings.ToLower(castString(facades.Config().Env("SUPER_ADMIN_EMAIL", ""))))
	password := castString(facades.Config().Env("SUPER_ADMIN_PASSWORD", ""))
	name := castString(facades.Config().Env("SUPER_ADMIN_NAME", "System Super Admin"))

	if email == "" || password == "" {
		return nil
	}
	if len(password) < 12 {
		return fmt.Errorf("SUPER_ADMIN_PASSWORD must be at least 12 characters")
	}

	var user models.User
	err := facades.Orm().Query().Where("email", email).First(&user)
	hashed, hashErr := facades.Hash().Make(password)
	if hashErr != nil {
		return hashErr
	}

	now := time.Now()
	if err != nil {
		user = models.User{
			Name:              name,
			Email:             email,
			Password:          hashed,
			Role:              "super_admin",
			IsActive:          true,
			IsSuperAdmin:      true,
			PasswordChangedAt: &now,
		}
		return facades.Orm().Query().Create(&user)
	}

	user.Name = name
	user.Email = email
	user.Password = hashed
	user.IsActive = true
	user.IsSuperAdmin = true
	user.Role = "super_admin"
	user.PasswordChangedAt = &now
	return facades.Orm().Query().Save(&user)
}

func (s *AuthService) CreateUser(input models.User, roleCodes []string, plainPassword string) (models.User, error) {
	if plainPassword == "" {
		return models.User{}, fmt.Errorf("password is required")
	}
	if len(plainPassword) < 10 {
		return models.User{}, fmt.Errorf("password must be at least 10 characters")
	}

	hashed, err := facades.Hash().Make(plainPassword)
	if err != nil {
		return models.User{}, err
	}

	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	input.Password = hashed
	input.IsSuperAdmin = false
	now := time.Now()
	input.PasswordChangedAt = &now
	input.ActivationCompletedAt = &now

	if err := facades.Orm().Query().Create(&input); err != nil {
		return models.User{}, err
	}

	_ = LinkUserToStaffByEmail(&input)
	if input.StaffID == nil {
		var refreshed models.User
		if err := facades.Orm().Query().Where("id", input.ID).First(&refreshed); err == nil {
			input.StaffID = refreshed.StaffID
		}
	}

	for _, code := range roleCodes {
		if err := s.rbac.AssignRole(input.ID, code); err != nil {
			return models.User{}, err
		}
	}
	if len(roleCodes) > 0 {
		input.Role = roleCodes[0]
		_ = facades.Orm().Query().Save(&input)
	}

	input.Password = ""
	return input, nil
}

func (s *AuthService) UpdateProfile(userID uint, profilePhoto, signatureImage *string, duty *DutyStationUpdate) (models.User, error) {
	var user models.User
	if err := facades.Orm().Query().Where("id", userID).First(&user); err != nil {
		return models.User{}, fmt.Errorf("user not found")
	}

	uploads := NewUploadService()

	if profilePhoto != nil {
		if *profilePhoto == "" {
			uploads.DeleteByURLOrPath(derefStr(user.ProfilePhoto))
			user.ProfilePhoto = nil
		} else if strings.HasPrefix(*profilePhoto, "data:image/") {
			if err := validateDataURLImage(*profilePhoto, 1_500_000); err != nil {
				return models.User{}, err
			}
			stored, err := uploads.StoreProfilePhoto(*profilePhoto, userID)
			if err != nil {
				return models.User{}, err
			}
			uploads.DeleteByURLOrPath(derefStr(user.ProfilePhoto))
			url := stored.URL
			user.ProfilePhoto = &url
		} else if isStoredMediaURL(*profilePhoto) {
			url := strings.TrimSpace(*profilePhoto)
			user.ProfilePhoto = &url
		} else {
			return models.User{}, fmt.Errorf("unsupported profile photo payload")
		}
	}

	if signatureImage != nil {
		if *signatureImage == "" {
			uploads.DeleteByURLOrPath(derefStr(user.SignatureImage))
			user.SignatureImage = nil
			user.SignatureUpdatedAt = nil
		} else if strings.HasPrefix(*signatureImage, "data:image/") {
			if err := validateDataURLImage(*signatureImage, 300_000); err != nil {
				return models.User{}, err
			}
			stored, err := uploads.StoreSignature(*signatureImage, userID)
			if err != nil {
				return models.User{}, err
			}
			uploads.DeleteByURLOrPath(derefStr(user.SignatureImage))
			now := time.Now()
			url := stored.URL
			user.SignatureImage = &url
			user.SignatureUpdatedAt = &now
		} else if isStoredMediaURL(*signatureImage) {
			url := strings.TrimSpace(*signatureImage)
			user.SignatureImage = &url
			now := time.Now()
			user.SignatureUpdatedAt = &now
		} else {
			return models.User{}, fmt.Errorf("unsupported signature payload")
		}
	}

	if duty != nil && (duty.Clear || duty.Latitude != nil || duty.Longitude != nil) {
		if user.StaffID == nil || *user.StaffID == 0 {
			return models.User{}, fmt.Errorf("staff linkage required to set duty station")
		}
		uid := userID
		if err := UpsertStaffDutyStation(*user.StaffID, &uid, *duty); err != nil {
			return models.User{}, err
		}
	}

	if err := facades.Orm().Query().Save(&user); err != nil {
		return models.User{}, err
	}
	user.Password = ""
	return user, nil
}

func isStoredMediaURL(value string) bool {
	value = strings.TrimSpace(value)
	return strings.HasPrefix(value, "/api/v1/files?") ||
		strings.HasPrefix(value, "profiles/") ||
		strings.HasPrefix(value, "signatures/") ||
		strings.HasPrefix(value, "attachments/") ||
		strings.HasPrefix(value, "uploads/")
}

func validateDataURLImage(dataURL string, maxBytes int) error {
	if !strings.HasPrefix(dataURL, "data:image/") {
		return fmt.Errorf("image must be a valid data URL")
	}
	parts := strings.SplitN(dataURL, ",", 2)
	if len(parts) != 2 || strings.TrimSpace(parts[1]) == "" {
		return fmt.Errorf("invalid image data")
	}
	payload := parts[1]
	// Strip whitespace that some browsers insert into large data URLs.
	payload = strings.Map(func(r rune) rune {
		if r == '\n' || r == '\r' || r == ' ' || r == '\t' {
			return -1
		}
		return r
	}, payload)

	decoded, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		decoded, err = base64.RawStdEncoding.DecodeString(payload)
		if err != nil {
			return fmt.Errorf("invalid image encoding")
		}
	}
	if len(decoded) == 0 {
		return fmt.Errorf("image is empty")
	}
	if len(decoded) > maxBytes {
		return fmt.Errorf("image is too large (max %d KB)", maxBytes/1024)
	}
	return nil
}

func (s *AuthService) ChangePassword(userID uint, currentPassword, newPassword string) error {
	if len(newPassword) < 10 {
		return fmt.Errorf("new password must be at least 10 characters")
	}

	var user models.User
	if err := facades.Orm().Query().Where("id", userID).First(&user); err != nil {
		return fmt.Errorf("user not found")
	}
	if user.IsSuperAdmin {
		return fmt.Errorf("super admin password must be changed via SUPER_ADMIN_PASSWORD env")
	}
	if !facades.Hash().Check(currentPassword, user.Password) {
		return fmt.Errorf("current password is incorrect")
	}

	hashed, err := facades.Hash().Make(newPassword)
	if err != nil {
		return err
	}
	now := time.Now()
	user.Password = hashed
	user.PasswordChangedAt = &now
	user.MustChangePassword = false
	return facades.Orm().Query().Save(&user)
}

func castString(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func cacheUint(raw any) uint {
	switch v := raw.(type) {
	case uint:
		return v
	case int:
		if v > 0 {
			return uint(v)
		}
	case int64:
		if v > 0 {
			return uint(v)
		}
	case float64:
		if v > 0 {
			return uint(v)
		}
	case string:
		var parsed uint64
		if _, err := fmt.Sscanf(v, "%d", &parsed); err == nil {
			return uint(parsed)
		}
	}
	return 0
}
