package services

import (
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
	Token        string              `json:"token"`
	TokenType    string              `json:"token_type"`
	ExpiresIn    int                 `json:"expires_in_minutes"`
	User         models.User         `json:"user"`
	Roles        []string            `json:"roles"`
	Permissions  []string            `json:"permissions"`
	MustChangePassword bool          `json:"must_change_password"`
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

	now := time.Now()
	user.FailedLoginAttempts = 0
	user.LockedUntil = nil
	user.LastLoginAt = &now
	_ = facades.Orm().Query().Save(&user)

	token, err := facades.Auth(ctx).Login(&user)
	if err != nil {
		return LoginResult{}, err
	}

	principal, err := s.rbac.LoadPrincipal(user)
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
		User:               user,
		Roles:              principal.Roles,
		Permissions:        perms,
		MustChangePassword: user.MustChangePassword,
	}, nil
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

	if err := facades.Orm().Query().Create(&input); err != nil {
		return models.User{}, err
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

func (s *AuthService) UpdateProfile(userID uint, profilePhoto, signatureImage *string) (models.User, error) {
	var user models.User
	if err := facades.Orm().Query().Where("id", userID).First(&user); err != nil {
		return models.User{}, fmt.Errorf("user not found")
	}

	if profilePhoto != nil {
		if *profilePhoto == "" {
			user.ProfilePhoto = nil
		} else if err := validateDataURLImage(*profilePhoto, 600_000); err != nil {
			return models.User{}, err
		} else {
			user.ProfilePhoto = profilePhoto
		}
	}

	if signatureImage != nil {
		if *signatureImage == "" {
			user.SignatureImage = nil
			user.SignatureUpdatedAt = nil
		} else if err := validateDataURLImage(*signatureImage, 300_000); err != nil {
			return models.User{}, err
		} else {
			now := time.Now()
			user.SignatureImage = signatureImage
			user.SignatureUpdatedAt = &now
		}
	}

	if err := facades.Orm().Query().Save(&user); err != nil {
		return models.User{}, err
	}
	user.Password = ""
	return user, nil
}

func validateDataURLImage(dataURL string, maxBytes int) error {
	if !strings.HasPrefix(dataURL, "data:image/") {
		return fmt.Errorf("image must be a valid data URL")
	}
	parts := strings.SplitN(dataURL, ",", 2)
	if len(parts) != 2 {
		return fmt.Errorf("invalid image data")
	}
	if len(parts[1]) > maxBytes {
		return fmt.Errorf("image is too large")
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
