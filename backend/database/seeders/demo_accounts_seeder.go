package seeders

import (
	"fmt"
	"strings"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/services"
)

const demoPassword = "Demo@Moh2026!"

const demoFocusFacilityID = "facility|787"
const demoFocusFacilityName = "Ministry of Health"

// Demo personas mapped to legacy iHRIS rows. Contracts are pinned to MoH HQ for a cohesive demo.
var demoPersonas = []struct {
	Email    string
	Name     string
	Role     string
	IhrisPID string
}{
	{Email: "worker@moh.go.ug", Name: "Jennifer Kricitober", Role: "staff", IhrisPID: "00ce0cb37febd47e261a53b9595eb4c2"},
	{Email: "supervisor@moh.go.ug", Name: "Dr. Jesca Nakibuuka", Role: "supervisor", IhrisPID: "1fd9b48c100e286624b1b9259e92338a"},
	{Email: "depthead@moh.go.ug", Name: "Winnie Mbabazi Kyalituha", Role: "department_head", IhrisPID: "09b1b7df61431bd51d6332ff9e7287ca"},
	{Email: "hr@moh.go.ug", Name: "Zeridah Muyinda", Role: "hr_officer", IhrisPID: "12198b2d435900da84619d2dd5c7a940"},
	{Email: "director@moh.go.ug", Name: "Dr. Henry Mwebesa", Role: "director", IhrisPID: "person|1317210"},
	{Email: "ps@moh.go.ug", Name: "Dr. Diana Atwine", Role: "permanent_secretary", IhrisPID: "person|1320715"},
	{Email: "admin@moh.go.ug", Name: "PMS Administrator", Role: "admin", IhrisPID: ""},
}

// Operational demo personas are pinned to MoH HQ for a cohesive facility story.
var demoPinToMoHFacility = map[string]bool{
	"00ce0cb37febd47e261a53b9595eb4c2": true,
	"1fd9b48c100e286624b1b9259e92338a": true,
	"09b1b7df61431bd51d6332ff9e7287ca": true,
	"12198b2d435900da84619d2dd5c7a940": true,
}

type DemoAccountsSeeder struct{}

func (s *DemoAccountsSeeder) Signature() string {
	return "DemoAccountsSeeder"
}

func (s *DemoAccountsSeeder) Run() error {
	sync := services.NewIhrisSyncService()
	if _, err := sync.SyncFromDemoTable(); err != nil {
		_ = err
	}

	_, _ = facades.Orm().Query().Where("staff_contract_id", 0).Delete(&models.StaffSupervisor{})

	staffByPID, err := s.ensureCoreStaff()
	if err != nil {
		return err
	}
	for pid, id := range staffByPID {
		if id > 0 && demoPinToMoHFacility[pid] {
			if err := s.ensureActiveContract(id); err != nil {
				return err
			}
		}
	}
	if err := s.linkSupervision(staffByPID); err != nil {
		return err
	}

	auth := services.NewAuthService()
	rbac := services.NewRbacService()
	for _, persona := range demoPersonas {
		var staffID uint
		if persona.IhrisPID != "" {
			staffID = staffByPID[persona.IhrisPID]
		}
		if err := s.ensureDemoUser(auth, rbac, persona.Email, persona.Name, persona.Role, staffID); err != nil {
			return err
		}
		if err := s.applyDemoScope(persona.Email, persona.Role); err != nil {
			return err
		}
	}

	if err := s.seedLeaveBalances(staffByPID["00ce0cb37febd47e261a53b9595eb4c2"]); err != nil {
		return err
	}

	return nil
}

func (s *DemoAccountsSeeder) ensureCoreStaff() (map[string]uint, error) {
	out := map[string]uint{}
	for _, persona := range demoPersonas {
		if persona.IhrisPID == "" {
			continue
		}
		id, err := s.findOrCreateStaff(persona.IhrisPID, persona.Name)
		if err != nil {
			return nil, err
		}
		out[persona.IhrisPID] = id
	}
	return out, nil
}

func (s *DemoAccountsSeeder) findOrCreateStaff(ihrisPID, fullName string) (uint, error) {
	sync := services.NewIhrisSyncService()
	if staffID, err := sync.SyncStaffByIhrisPID(ihrisPID); err == nil && staffID > 0 {
		return staffID, nil
	}

	var staff models.Staff
	if err := facades.Orm().Query().Where("ihris_pid", ihrisPID).First(&staff); err == nil && staff.ID > 0 {
		return staff.ID, nil
	}

	parts := strings.Fields(fullName)
	surname := "Staff"
	first := "Demo"
	if len(parts) > 0 {
		surname = parts[len(parts)-1]
	}
	if len(parts) > 1 {
		first = strings.Join(parts[:len(parts)-1], " ")
	}

	email := strings.ToLower(strings.ReplaceAll(first, " ", ".")) + "@moh.go.ug"
	staff = models.Staff{
		IhrisPID:  ihrisPID,
		Surname:   surname,
		Firstname: first,
		Email:     strPtr(email),
	}
	if err := facades.Orm().Query().Create(&staff); err != nil {
		return 0, err
	}

	facilityID, jobID, deptID, err := s.ensureOrgUnits()
	if err != nil {
		return 0, err
	}

	now := time.Now()
	grade := "U4"
	contract := models.StaffContract{
		StaffID:        staff.ID,
		FacilityID:     facilityID,
		JobID:          jobID,
		DepartmentID:   &deptID,
		SalaryGrade:    &grade,
		DistrictID:     strPtr("KAMPALA"),
		DistrictName:   strPtr("KAMPALA"),
		ContractStatus: "active",
		StartedAt:      &now,
	}
	if err := facades.Orm().Query().Create(&contract); err != nil {
		return 0, err
	}

	return staff.ID, nil
}

func (s *DemoAccountsSeeder) ensureOrgUnits() (facilityID, jobID, deptID uint, err error) {
	var facility models.Facility
	if err = facades.Orm().Query().Where("ihris_facility_id", demoFocusFacilityID).First(&facility); err != nil {
		facility = models.Facility{
			IhrisFacilityID: demoFocusFacilityID,
			Name:            demoFocusFacilityName,
			DistrictID:      strPtr("KAMPALA"),
			DistrictName:    strPtr("KAMPALA"),
			IsActive:        true,
		}
		if err = facades.Orm().Query().Create(&facility); err != nil {
			return 0, 0, 0, err
		}
	}

	var dept models.Department
	if err = facades.Orm().Query().Where("external_system_id", "moh-clinical-services").First(&dept); err != nil {
		dept = models.Department{Name: "Clinical Services", ExternalSystemID: "moh-clinical-services"}
		if err = facades.Orm().Query().Create(&dept); err != nil {
			return 0, 0, 0, err
		}
	}

	var job models.JobTitle
	if err = facades.Orm().Query().Where("external_job_id", "job|22121003").First(&job); err != nil {
		job = models.JobTitle{ExternalJobID: "job|22121003", JobTitle: "Medical Officer Special Grade - Paediatrics"}
		if err = facades.Orm().Query().Create(&job); err != nil {
			return 0, 0, 0, err
		}
	}

	return facility.ID, job.ID, dept.ID, nil
}

func (s *DemoAccountsSeeder) ensureActiveContract(staffID uint) error {
	var contract models.StaffContract
	if err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("contract_status", "active").
		First(&contract); err == nil && contract.ID > 0 {
		facilityID, jobID, deptID, err := s.ensureOrgUnits()
		if err != nil {
			return err
		}
		contract.FacilityID = facilityID
		contract.JobID = jobID
		contract.DepartmentID = &deptID
		return facades.Orm().Query().Save(&contract)
	}

	facilityID, jobID, deptID, err := s.ensureOrgUnits()
	if err != nil {
		return err
	}
	now := time.Now()
	grade := "U4"
	return facades.Orm().Query().Create(&models.StaffContract{
		StaffID:        staffID,
		FacilityID:     facilityID,
		JobID:          jobID,
		DepartmentID:   &deptID,
		SalaryGrade:    &grade,
		DistrictID:     strPtr("KAMPALA"),
		DistrictName:   strPtr("KAMPALA"),
		ContractStatus: "active",
		StartedAt:      &now,
	})
}

func (s *DemoAccountsSeeder) linkSupervision(staffByPID map[string]uint) error {
	workerPID := "00ce0cb37febd47e261a53b9595eb4c2"
	supervisorPID := "1fd9b48c100e286624b1b9259e92338a"
	workerID := staffByPID[workerPID]
	supervisorID := staffByPID[supervisorPID]
	if workerID == 0 || supervisorID == 0 {
		return nil
	}

	var contract models.StaffContract
	if err := facades.Orm().Query().
		Where("staff_id", workerID).
		Where("contract_status", "active").
		First(&contract); err != nil || contract.ID == 0 {
		return nil
	}

	var existing models.StaffSupervisor
	if err := facades.Orm().Query().
		Where("staff_contract_id", contract.ID).
		Where("approval_sequence", 1).
		First(&existing); err == nil {
		existing.SupervisorStaffID = supervisorID
		existing.IsCurrent = true
		return facades.Orm().Query().Save(&existing)
	}

	return facades.Orm().Query().Create(&models.StaffSupervisor{
		StaffContractID:   contract.ID,
		SupervisorStaffID: supervisorID,
		ApprovalSequence:  1,
		IsCurrent:         true,
	})
}

func (s *DemoAccountsSeeder) ensureDemoUser(auth *services.AuthService, rbac *services.RbacService, email, name, roleCode string, staffID uint) error {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return fmt.Errorf("demo user email is required")
	}

	var user models.User
	if err := facades.Orm().Query().Where("email", email).First(&user); err != nil {
		return err
	}
	if !modelFound(user.ID) {
		if staffID > 0 {
			if findErr := facades.Orm().Query().Where("staff_id", staffID).First(&user); findErr != nil {
				return findErr
			}
		}
	}
	if !modelFound(user.ID) {
		payload := models.User{
			Name:     name,
			Email:    email,
			Role:     roleCode,
			IsActive: true,
		}
		if staffID > 0 {
			payload.StaffID = &staffID
		}
		_, createErr := auth.CreateUser(payload, []string{roleCode}, demoPassword)
		return createErr
	}

	if staffID > 0 {
		user.StaffID = &staffID
	}
	user.Name = name
	user.Email = email
	user.Role = roleCode
	user.IsActive = true
	hashed, hashErr := facades.Hash().Make(demoPassword)
	if hashErr != nil {
		return hashErr
	}
	user.Password = hashed
	if saveErr := facades.Orm().Query().Save(&user); saveErr != nil {
		return saveErr
	}
	return rbac.AssignRole(user.ID, roleCode)
}

func (s *DemoAccountsSeeder) applyDemoScope(email, roleCode string) error {
	var user models.User
	if err := facades.Orm().Query().Where("email", strings.ToLower(email)).First(&user); err != nil || user.ID == 0 {
		return nil
	}
	rbac := services.NewRbacService()
	kampala := "KAMPALA"
	switch roleCode {
	case "permanent_secretary", "admin":
		national := "national"
		_, err := rbac.UpdateUser(user.ID, nil, nil, &services.UserScopeInput{ScopeLevel: &national})
		return err
	case "hr_officer", "director":
		district := "district"
		_, err := rbac.UpdateUser(user.ID, nil, nil, &services.UserScopeInput{
			ScopeLevel:      &district,
			ScopeDistrictID: &kampala,
		})
		return err
	case "department_head":
		facility := "facility"
		_, err := rbac.UpdateUser(user.ID, nil, nil, &services.UserScopeInput{
			ScopeLevel: &facility,
			ScopeDistrictID: &kampala,
		})
		return err
	default:
		staffLinked := "staff"
		_, err := rbac.UpdateUser(user.ID, nil, nil, &services.UserScopeInput{ScopeLevel: &staffLinked})
		return err
	}
}

func (s *DemoAccountsSeeder) seedLeaveBalances(workerStaffID uint) error {
	if workerStaffID == 0 {
		return nil
	}
	var annual models.LeaveType
	if err := facades.Orm().Query().Where("code", "annual").First(&annual); err != nil || !modelFound(annual.ID) {
		return nil
	}
	year := time.Now().Year()
	var bal models.LeaveBalance
	if err := facades.Orm().Query().
		Where("staff_id", workerStaffID).
		Where("leave_type_id", annual.ID).
		Where("calendar_year", year).
		FirstOr(&bal, func() error {
			return facades.Orm().Query().Create(&models.LeaveBalance{
				StaffID:         workerStaffID,
				LeaveTypeID:     annual.ID,
				CalendarYear:    year,
				EntitledDays:    30,
				UsedDays:        4,
				CarriedOverDays: 2,
			})
		}); err != nil {
		return err
	}
	return nil
}
