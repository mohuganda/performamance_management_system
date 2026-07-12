package services

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image/png"
	"strings"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"

	"goravel/app/facades"
	"goravel/app/models"
)

type TotpService struct{}

func NewTotpService() *TotpService {
	return &TotpService{}
}

type TotpEnrollResult struct {
	Secret    string `json:"secret"`
	OtpAuthURL string `json:"otpauth_url"`
	QRCodeDataURL string `json:"qr_code_data_url"`
}

func (s *TotpService) Enroll(user *models.User) (TotpEnrollResult, error) {
	if user == nil || user.ID == 0 {
		return TotpEnrollResult{}, fmt.Errorf("user not found")
	}
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "MoH PMS",
		AccountName: user.Email,
		Period:      30,
		Digits:      otp.DigitsSix,
		Algorithm:   otp.AlgorithmSHA1,
	})
	if err != nil {
		return TotpEnrollResult{}, err
	}

	secret := key.Secret()
	user.TotpSecret = &secret
	user.TotpEnabled = false
	user.TotpConfirmedAt = nil
	if err := facades.Orm().Query().Save(user); err != nil {
		return TotpEnrollResult{}, err
	}

	var buf bytes.Buffer
	img, err := key.Image(220, 220)
	if err != nil {
		return TotpEnrollResult{}, err
	}
	if err := png.Encode(&buf, img); err != nil {
		return TotpEnrollResult{}, err
	}
	qr := "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())

	return TotpEnrollResult{
		Secret:        secret,
		OtpAuthURL:    key.URL(),
		QRCodeDataURL: qr,
	}, nil
}

func (s *TotpService) Confirm(userID uint, code string) error {
	code = strings.TrimSpace(code)
	if code == "" {
		return fmt.Errorf("authenticator code is required")
	}
	var user models.User
	if err := facades.Orm().Query().Where("id", userID).First(&user); err != nil {
		return fmt.Errorf("user not found")
	}
	if user.TotpSecret == nil || strings.TrimSpace(*user.TotpSecret) == "" {
		return fmt.Errorf("authenticator enrollment not started")
	}
	if !totp.Validate(code, *user.TotpSecret) {
		return fmt.Errorf("invalid authenticator code")
	}
	now := time.Now()
	user.TotpEnabled = true
	user.TotpConfirmedAt = &now
	return facades.Orm().Query().Save(&user)
}

func (s *TotpService) Disable(userID uint, code string) error {
	if err := s.Verify(userID, code); err != nil {
		return err
	}
	var user models.User
	if err := facades.Orm().Query().Where("id", userID).First(&user); err != nil {
		return fmt.Errorf("user not found")
	}
	user.TotpEnabled = false
	user.TotpSecret = nil
	user.TotpConfirmedAt = nil
	return facades.Orm().Query().Save(&user)
}

func (s *TotpService) Verify(userID uint, code string) error {
	code = strings.TrimSpace(code)
	if code == "" {
		return fmt.Errorf("authenticator code is required")
	}
	var user models.User
	if err := facades.Orm().Query().Where("id", userID).First(&user); err != nil {
		return fmt.Errorf("user not found")
	}
	if !user.TotpEnabled || user.TotpSecret == nil {
		return fmt.Errorf("authenticator is not enabled")
	}
	if !totp.Validate(code, *user.TotpSecret) {
		return fmt.Errorf("invalid authenticator code")
	}
	return nil
}

func (s *TotpService) AdminReset(userID uint) error {
	var user models.User
	if err := facades.Orm().Query().Where("id", userID).First(&user); err != nil {
		return fmt.Errorf("user not found")
	}
	user.TotpEnabled = false
	user.TotpSecret = nil
	user.TotpConfirmedAt = nil
	return facades.Orm().Query().Save(&user)
}

func (s *TotpService) Status(user models.User) map[string]any {
	return map[string]any{
		"enabled":      user.TotpEnabled,
		"confirmed_at": user.TotpConfirmedAt,
	}
}
