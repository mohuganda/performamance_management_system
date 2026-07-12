package services

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"strings"

	"goravel/app/facades"
	"goravel/app/models"
)

// FindStaffIDByEmail resolves a staff row by primary or HR email (case-insensitive).
func FindStaffIDByEmail(email string) (*uint, *models.Staff, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || !strings.Contains(email, "@") {
		return nil, nil, fmt.Errorf("invalid email")
	}

	var staff models.Staff
	if err := facades.Orm().Query().
		Where("LOWER(email) = ?", email).
		First(&staff); err == nil && staff.ID > 0 {
		return &staff.ID, &staff, nil
	}

	var profile models.StaffHrProfile
	if err := facades.Orm().Query().
		Where("LOWER(hr_email) = ?", email).
		First(&profile); err == nil && profile.StaffID > 0 {
		if err := facades.Orm().Query().Where("id", profile.StaffID).First(&staff); err == nil && staff.ID > 0 {
			return &staff.ID, &staff, nil
		}
	}

	return nil, nil, fmt.Errorf("staff record not found for this email")
}

// ResolveStaffEmail returns the best email address for a staff member.
func ResolveStaffEmail(staff models.Staff) string {
	var profile models.StaffHrProfile
	if err := facades.Orm().Query().Where("staff_id", staff.ID).First(&profile); err == nil {
		if profile.HrEmail != nil && strings.TrimSpace(*profile.HrEmail) != "" {
			return strings.TrimSpace(strings.ToLower(*profile.HrEmail))
		}
	}
	if staff.Email != nil && strings.TrimSpace(*staff.Email) != "" {
		return strings.TrimSpace(strings.ToLower(*staff.Email))
	}
	return ""
}

// StaffDisplayName builds a readable name from staff fields.
func StaffDisplayName(staff models.Staff) string {
	other := ""
	if staff.Othername != nil {
		other = strings.TrimSpace(*staff.Othername)
	}
	parts := []string{
		strings.TrimSpace(staff.Firstname),
		other,
		strings.TrimSpace(staff.Surname),
	}
	name := strings.TrimSpace(strings.Join(parts, " "))
	if name != "" {
		return name
	}
	if staff.Email != nil {
		return *staff.Email
	}
	return "MoH Staff"
}

// LinkUserToStaffByEmail sets users.staff_id when the email matches a staff record.
func LinkUserToStaffByEmail(user *models.User) error {
	if user == nil || user.ID == 0 {
		return nil
	}
	if user.StaffID != nil && *user.StaffID > 0 {
		return nil
	}
	staffID, staff, err := FindStaffIDByEmail(user.Email)
	if err != nil || staffID == nil || staff == nil {
		return nil
	}
	user.StaffID = staffID
	if strings.TrimSpace(user.Name) == "" || user.Name == user.Email {
		user.Name = StaffDisplayName(*staff)
	}
	return facades.Orm().Query().Save(user)
}

// FindUserIDByStaffID returns the application user linked to a staff record.
func FindUserIDByStaffID(staffID uint) (uint, error) {
	var user models.User
	if err := facades.Orm().Query().Where("staff_id", staffID).First(&user); err != nil || user.ID == 0 {
		return 0, fmt.Errorf("no user account linked to this staff member")
	}
	return user.ID, nil
}

func generateSecureToken(nBytes int) (string, error) {
	buf := make([]byte, nBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
