package services

import (
	"fmt"
	"strings"

	"goravel/app/facades"
	"goravel/app/models"
)

type SupervisorService struct {
	cache *StaffCacheService
}

func NewSupervisorService() *SupervisorService {
	return &SupervisorService{cache: NewStaffCacheService()}
}

type SupervisorAssignment struct {
	Sequence          uint8  `json:"sequence"`
	SupervisorStaffID uint   `json:"supervisor_staff_id"`
	SupervisorName    string `json:"supervisor_name,omitempty"`
}

type SupervisorSlot struct {
	Sequence          uint8 `json:"sequence"`
	SupervisorStaffID uint  `json:"supervisor_staff_id"`
}

type StaffSupervisionRow struct {
	StaffID           uint                   `json:"staff_id"`
	StaffName         string                 `json:"staff_name"`
	JobTitle          string                 `json:"job_title"`
	FacilityName      string                 `json:"facility_name"`
	HasSupervisor     bool                   `json:"has_supervisor"`
	SupervisorStaffID *uint                  `json:"supervisor_staff_id,omitempty"`
	SupervisorName    string                 `json:"supervisor_name,omitempty"`
	Supervisors       []SupervisorAssignment `json:"supervisors,omitempty"`
}

type SupervisorCandidate struct {
	StaffID uint   `json:"staff_id"`
	Name    string `json:"name"`
	JobTitle string `json:"job_title"`
}

func (s *SupervisorService) activeContract(staffID uint) (models.StaffContract, error) {
	var contract models.StaffContract
	if err := facades.Orm().Query().
		Where("staff_id", staffID).
		Where("contract_status", "active").
		First(&contract); err != nil {
		return contract, fmt.Errorf("active contract not found for staff %d", staffID)
	}
	if contract.ID == 0 {
		return contract, fmt.Errorf("active contract not found for staff %d", staffID)
	}
	return contract, nil
}

func staffDisplayName(staff models.Staff) string {
	name := staff.Firstname
	if staff.Surname != "" {
		if name != "" {
			name += " "
		}
		name += staff.Surname
	}
	if name == "" {
		return fmt.Sprintf("Staff #%d", staff.ID)
	}
	return name
}

func (s *SupervisorService) SupervisionMapForStaffIDs(staffIDs []uint) (map[uint]StaffSupervisionRow, error) {
	out := map[uint]StaffSupervisionRow{}
	ids := idsByUint(staffIDs)
	if len(ids) == 0 {
		return out, nil
	}

	var contracts []models.StaffContract
	if err := facades.Orm().Query().
		Where("staff_id IN ?", ids).
		Where("contract_status", "active").
		Get(&contracts); err != nil {
		return nil, err
	}
	if len(contracts) == 0 {
		return out, nil
	}

	contractIDs := make([]uint, 0, len(contracts))
	jobIDs := make([]uint, 0, len(contracts))
	facilityIDs := make([]uint, 0, len(contracts))
	contractByStaff := map[uint]models.StaffContract{}
	for _, c := range contracts {
		contractByStaff[c.StaffID] = c
		contractIDs = append(contractIDs, c.ID)
		jobIDs = append(jobIDs, c.JobID)
		facilityIDs = append(facilityIDs, c.FacilityID)
	}

	staffMap := loadStaffByIDs(ids)
	jobs := loadJobsByIDs(jobIDs)
	facilities := loadFacilitiesByIDs(facilityIDs)

	var sups []models.StaffSupervisor
	_ = facades.Orm().Query().
		Where("staff_contract_id IN ?", contractIDs).
		Where("is_current", true).
		Order("approval_sequence asc").
		Get(&sups)

	supervisorIDs := make([]uint, 0, len(sups))
	supsByContract := map[uint][]models.StaffSupervisor{}
	for _, sup := range sups {
		supsByContract[sup.StaffContractID] = append(supsByContract[sup.StaffContractID], sup)
		supervisorIDs = append(supervisorIDs, sup.SupervisorStaffID)
	}
	supervisorMap := loadStaffByIDs(supervisorIDs)

	for _, staffID := range ids {
		contract, ok := contractByStaff[staffID]
		if !ok {
			continue
		}
		staff, ok := staffMap[staffID]
		if !ok {
			continue
		}
		row := StaffSupervisionRow{
			StaffID:      staffID,
			StaffName:    staffDisplayName(staff),
			JobTitle:     jobs[contract.JobID].JobTitle,
			FacilityName: facilities[contract.FacilityID].Name,
		}
		for _, sup := range supsByContract[contract.ID] {
			row.HasSupervisor = true
			assignment := SupervisorAssignment{
				Sequence:          sup.ApprovalSequence,
				SupervisorStaffID: sup.SupervisorStaffID,
			}
			if supervisor, ok := supervisorMap[sup.SupervisorStaffID]; ok {
				assignment.SupervisorName = staffDisplayName(supervisor)
			}
			row.Supervisors = append(row.Supervisors, assignment)
		}
		if len(row.Supervisors) > 0 {
			row.SupervisorStaffID = &row.Supervisors[0].SupervisorStaffID
			names := make([]string, 0, len(row.Supervisors))
			for _, a := range row.Supervisors {
				if a.SupervisorName != "" {
					names = append(names, a.SupervisorName)
				}
			}
			row.SupervisorName = strings.Join(names, ", ")
		}
		out[staffID] = row
	}
	return out, nil
}

func (s *SupervisorService) ListStaffSupervision() ([]StaffSupervisionRow, error) {
	cacheKey := s.cache.key("supervision")
	var cached []StaffSupervisionRow
	if s.cache.Get(cacheKey, &cached) {
		return cached, nil
	}

	var contracts []models.StaffContract
	if err := facades.Orm().Query().
		Where("contract_status", "active").
		Order("staff_id asc").
		Get(&contracts); err != nil {
		return nil, err
	}

	rows := make([]StaffSupervisionRow, 0, len(contracts))
	for _, contract := range contracts {
		var staff models.Staff
		if err := facades.Orm().Query().Where("id", contract.StaffID).First(&staff); err != nil || staff.ID == 0 {
			continue
		}

		var job models.JobTitle
		_ = facades.Orm().Query().Where("id", contract.JobID).First(&job)

		var facility models.Facility
		_ = facades.Orm().Query().Where("id", contract.FacilityID).First(&facility)

		row := StaffSupervisionRow{
			StaffID:      staff.ID,
			StaffName:    staffDisplayName(staff),
			JobTitle:     job.JobTitle,
			FacilityName: facility.Name,
		}

		var sups []models.StaffSupervisor
		if err := facades.Orm().Query().
			Where("staff_contract_id", contract.ID).
			Where("is_current", true).
			Order("approval_sequence asc").
			Get(&sups); err == nil && len(sups) > 0 {
			row.HasSupervisor = true
			names := make([]string, 0, len(sups))
			for _, sup := range sups {
				assignment := SupervisorAssignment{
					Sequence:          sup.ApprovalSequence,
					SupervisorStaffID: sup.SupervisorStaffID,
				}
				var supervisor models.Staff
				if err := facades.Orm().Query().Where("id", sup.SupervisorStaffID).First(&supervisor); err == nil && supervisor.ID > 0 {
					assignment.SupervisorName = staffDisplayName(supervisor)
					names = append(names, assignment.SupervisorName)
				}
				row.Supervisors = append(row.Supervisors, assignment)
			}
			if len(row.Supervisors) > 0 {
				row.SupervisorStaffID = &row.Supervisors[0].SupervisorStaffID
			}
			row.SupervisorName = strings.Join(names, ", ")
		}

		rows = append(rows, row)
	}

	s.cache.Put(cacheKey, rows)
	return rows, nil
}

func (s *SupervisorService) ListStaffSupervisionPaginated(
	search, hasSupervisor string,
	page, perPage int,
) (PaginatedResult[StaffSupervisionRow], error) {
	rows, err := s.ListStaffSupervision()
	if err != nil {
		return PaginatedResult[StaffSupervisionRow]{}, err
	}

	filtered := make([]StaffSupervisionRow, 0, len(rows))
	needle := strings.ToLower(strings.TrimSpace(search))
	for _, row := range rows {
		if hasSupervisor == "true" && !row.HasSupervisor {
			continue
		}
		if hasSupervisor == "false" && row.HasSupervisor {
			continue
		}
		if needle != "" {
			haystack := strings.ToLower(row.StaffName + " " + row.JobTitle + " " + row.FacilityName + " " + row.SupervisorName)
			if !strings.Contains(haystack, needle) {
				continue
			}
		}
		filtered = append(filtered, row)
	}
	return PaginateSlice(filtered, page, perPage), nil
}

func (s *SupervisorService) ListSupervisorCandidates() ([]SupervisorCandidate, error) {
	cacheKey := s.cache.key("supervisor-candidates")
	var cached []SupervisorCandidate
	if s.cache.Get(cacheKey, &cached) {
		return cached, nil
	}

	var contracts []models.StaffContract
	if err := facades.Orm().Query().
		Where("contract_status", "active").
		Order("staff_id asc").
		Get(&contracts); err != nil {
		return nil, err
	}

	seen := map[uint]bool{}
	staffIDs := make([]uint, 0, len(contracts))
	staffJobID := map[uint]uint{}
	for _, contract := range contracts {
		if seen[contract.StaffID] {
			continue
		}
		seen[contract.StaffID] = true
		staffIDs = append(staffIDs, contract.StaffID)
		staffJobID[contract.StaffID] = contract.JobID
	}

	staffMap := loadStaffByIDs(staffIDs)
	jobIDs := make([]uint, 0, len(staffJobID))
	for _, jobID := range staffJobID {
		jobIDs = append(jobIDs, jobID)
	}
	jobs := loadJobsByIDs(jobIDs)

	rows := make([]SupervisorCandidate, 0, len(staffIDs))
	for _, staffID := range staffIDs {
		staff, ok := staffMap[staffID]
		if !ok {
			continue
		}
		rows = append(rows, SupervisorCandidate{
			StaffID:  staff.ID,
			Name:     staffDisplayName(staff),
			JobTitle: jobs[staffJobID[staffID]].JobTitle,
		})
	}

	s.cache.Put(cacheKey, rows)
	return rows, nil
}

func (s *SupervisorService) GetStaffSupervisors(staffID uint) ([]SupervisorAssignment, error) {
	contract, err := s.activeContract(staffID)
	if err != nil {
		return nil, err
	}

	var sups []models.StaffSupervisor
	if err := facades.Orm().Query().
		Where("staff_contract_id", contract.ID).
		Where("is_current", true).
		Order("approval_sequence asc").
		Get(&sups); err != nil {
		return nil, err
	}

	assignments := make([]SupervisorAssignment, 0, len(sups))
	for _, sup := range sups {
		assignment := SupervisorAssignment{
			Sequence:          sup.ApprovalSequence,
			SupervisorStaffID: sup.SupervisorStaffID,
		}
		var supervisor models.Staff
		if err := facades.Orm().Query().Where("id", sup.SupervisorStaffID).First(&supervisor); err == nil && supervisor.ID > 0 {
			assignment.SupervisorName = staffDisplayName(supervisor)
		}
		assignments = append(assignments, assignment)
	}
	return assignments, nil
}

func (s *SupervisorService) assignSupervisorToSequence(contractID uint, sequence uint8, supervisorStaffID uint) error {
	_, _ = facades.Orm().Query().
		Model(&models.StaffSupervisor{}).
		Where("staff_contract_id", contractID).
		Where("approval_sequence", sequence).
		Where("is_current", true).
		Update("is_current", false)

	var existing models.StaffSupervisor
	if err := facades.Orm().Query().
		Where("staff_contract_id", contractID).
		Where("supervisor_staff_id", supervisorStaffID).
		Where("approval_sequence", sequence).
		First(&existing); err == nil && existing.ID > 0 {
		existing.IsCurrent = true
		return facades.Orm().Query().Save(&existing)
	}

	return facades.Orm().Query().Create(&models.StaffSupervisor{
		StaffContractID:   contractID,
		SupervisorStaffID: supervisorStaffID,
		ApprovalSequence:  sequence,
		IsCurrent:         true,
	})
}

func (s *SupervisorService) clearSupervisorSequence(contractID uint, sequence uint8) error {
	_, err := facades.Orm().Query().
		Model(&models.StaffSupervisor{}).
		Where("staff_contract_id", contractID).
		Where("approval_sequence", sequence).
		Where("is_current", true).
		Update("is_current", false)
	return err
}

func (s *SupervisorService) SetSupervisors(staffID uint, slots []SupervisorSlot) error {
	if staffID == 0 {
		return fmt.Errorf("staff_id is required")
	}

	bySequence := map[uint8]uint{}
	seen := map[uint]bool{}
	for _, slot := range slots {
		if slot.Sequence < 1 || slot.Sequence > 3 {
			return fmt.Errorf("supervisor sequence must be 1, 2, or 3")
		}
		if slot.SupervisorStaffID == 0 {
			continue
		}
		if slot.SupervisorStaffID == staffID {
			return fmt.Errorf("staff cannot supervise themselves")
		}
		if seen[slot.SupervisorStaffID] {
			return fmt.Errorf("the same person cannot be assigned to multiple supervisor slots")
		}
		seen[slot.SupervisorStaffID] = true
		bySequence[slot.Sequence] = slot.SupervisorStaffID
	}

	if _, ok := bySequence[1]; !ok {
		return fmt.Errorf("supervisor 1 is required")
	}
	if _, ok := bySequence[3]; ok {
		if _, ok2 := bySequence[2]; !ok2 {
			return fmt.Errorf("assign supervisor 2 before supervisor 3")
		}
	}

	contract, err := s.activeContract(staffID)
	if err != nil {
		return err
	}

	for sequence := uint8(1); sequence <= 3; sequence++ {
		supervisorStaffID, ok := bySequence[sequence]
		if !ok {
			if err := s.clearSupervisorSequence(contract.ID, sequence); err != nil {
				return err
			}
			continue
		}

		var supervisor models.Staff
		if err := facades.Orm().Query().Where("id", supervisorStaffID).First(&supervisor); err != nil || supervisor.ID == 0 {
			return fmt.Errorf("supervisor staff record not found for supervisor %d", sequence)
		}
		if err := s.assignSupervisorToSequence(contract.ID, sequence, supervisorStaffID); err != nil {
			return err
		}
	}

	s.cache.Invalidate()
	return nil
}

func (s *SupervisorService) AssignSupervisor(staffID, supervisorStaffID uint) error {
	if staffID == 0 || supervisorStaffID == 0 {
		return fmt.Errorf("staff_id and supervisor_staff_id are required")
	}

	slots := []SupervisorSlot{{Sequence: 1, SupervisorStaffID: supervisorStaffID}}
	if existing, err := s.GetStaffSupervisors(staffID); err == nil {
		for _, sup := range existing {
			if sup.Sequence == 1 {
				continue
			}
			slots = append(slots, SupervisorSlot{
				Sequence:          sup.Sequence,
				SupervisorStaffID: sup.SupervisorStaffID,
			})
		}
	}
	return s.SetSupervisors(staffID, slots)
}

func (s *SupervisorService) RemoveSupervisor(staffID uint) error {
	contract, err := s.activeContract(staffID)
	if err != nil {
		return err
	}
	for sequence := uint8(1); sequence <= 3; sequence++ {
		if err := s.clearSupervisorSequence(contract.ID, sequence); err != nil {
			return err
		}
	}
	s.cache.Invalidate()
	return nil
}
