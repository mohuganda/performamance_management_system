package services

import (
	"fmt"
	"time"

	"github.com/goravel/framework/contracts/database/orm"
	"goravel/app/facades"
	"goravel/app/models"
)

// idsByUint collects unique non-zero IDs from a slice.
func idsByUint(ids []uint) []uint {
	seen := map[uint]bool{}
	out := make([]uint, 0, len(ids))
	for _, id := range ids {
		if id == 0 || seen[id] {
			continue
		}
		seen[id] = true
		out = append(out, id)
	}
	return out
}

func loadStaffByIDs(ids []uint) map[uint]models.Staff {
	out := map[uint]models.Staff{}
	ids = idsByUint(ids)
	if len(ids) == 0 {
		return out
	}
	var rows []models.Staff
	_ = facades.Orm().Query().Where("id IN ?", ids).Get(&rows)
	for _, row := range rows {
		out[row.ID] = row
	}
	return out
}

func loadJobsByIDs(ids []uint) map[uint]models.JobTitle {
	out := map[uint]models.JobTitle{}
	ids = idsByUint(ids)
	if len(ids) == 0 {
		return out
	}
	var rows []models.JobTitle
	_ = facades.Orm().Query().Where("id IN ?", ids).Get(&rows)
	for _, row := range rows {
		out[row.ID] = row
	}
	return out
}

func loadFacilitiesByIDs(ids []uint) map[uint]models.Facility {
	out := map[uint]models.Facility{}
	ids = idsByUint(ids)
	if len(ids) == 0 {
		return out
	}
	var rows []models.Facility
	_ = facades.Orm().Query().Where("id IN ?", ids).Get(&rows)
	for _, row := range rows {
		out[row.ID] = row
	}
	return out
}

func loadDepartmentsByIDs(ids []uint) map[uint]models.Department {
	out := map[uint]models.Department{}
	ids = idsByUint(ids)
	if len(ids) == 0 {
		return out
	}
	var rows []models.Department
	_ = facades.Orm().Query().Where("id IN ?", ids).Get(&rows)
	for _, row := range rows {
		out[row.ID] = row
	}
	return out
}

func staffWithSupervisorSubquery(has bool) string {
	inner := `SELECT sc.staff_id FROM staff_contracts sc
		INNER JOIN staff_supervisors ss ON ss.staff_contract_id = sc.id AND ss.is_current = true
		WHERE sc.contract_status = 'active'`
	if has {
		return fmt.Sprintf("id IN (%s)", inner)
	}
	return fmt.Sprintf("id NOT IN (%s)", inner)
}

func staffListQuery(filter StaffListFilter) orm.Query {
	query := facades.Orm().Query().Model(&models.Staff{}).Order("id desc")
	if filter.Search != "" {
		like := "%" + filter.Search + "%"
		query = query.Where(
			"surname LIKE ? OR firstname LIKE ? OR email LIKE ? OR ihris_pid LIKE ?",
			like, like, like, like,
		)
	}
	if filter.DepartmentID > 0 {
		query = query.Where(
			"id IN (SELECT staff_id FROM staff_contracts WHERE contract_status = ? AND department_id = ?)",
			"active", filter.DepartmentID,
		)
	}
	if filter.HasSupervisor == "true" {
		query = query.Where(staffWithSupervisorSubquery(true))
	} else if filter.HasSupervisor == "false" {
		query = query.Where(staffWithSupervisorSubquery(false))
	}
	return query
}

func (s *StaffAdminService) buildStaffListRowsBatch(
	staffRows []models.Staff,
	supervisionMap map[uint]StaffSupervisionRow,
) []StaffListRow {
	if len(staffRows) == 0 {
		return []StaffListRow{}
	}

	staffIDs := make([]uint, 0, len(staffRows))
	for _, st := range staffRows {
		staffIDs = append(staffIDs, st.ID)
	}

	contractsByStaff := map[uint]models.StaffContract{}
	var contracts []models.StaffContract
	_ = facades.Orm().Query().
		Where("staff_id IN ?", staffIDs).
		Where("contract_status", "active").
		Get(&contracts)
	jobIDs := make([]uint, 0, len(contracts))
	facilityIDs := make([]uint, 0, len(contracts))
	deptIDs := make([]uint, 0, len(contracts))
	for _, c := range contracts {
		contractsByStaff[c.StaffID] = c
		jobIDs = append(jobIDs, c.JobID)
		facilityIDs = append(facilityIDs, c.FacilityID)
		if c.DepartmentID != nil {
			deptIDs = append(deptIDs, *c.DepartmentID)
		}
	}

	profilesByStaff := map[uint]models.StaffHrProfile{}
	var profiles []models.StaffHrProfile
	_ = facades.Orm().Query().Where("staff_id IN ?", staffIDs).Get(&profiles)
	for _, p := range profiles {
		profilesByStaff[p.StaffID] = p
		if p.HrDepartmentID != nil {
			deptIDs = append(deptIDs, *p.HrDepartmentID)
		}
	}

	jobs := loadJobsByIDs(jobIDs)
	facilities := loadFacilitiesByIDs(facilityIDs)
	departments := loadDepartmentsByIDs(deptIDs)

	out := make([]StaffListRow, 0, len(staffRows))
	for _, st := range staffRows {
		row := StaffListRow{
			StaffID:  st.ID,
			IhrisPID: st.IhrisPID,
			Name:     staffDisplayName(st),
			Email:    deref(st.Email),
			Mobile:   deref(st.Mobile),
			Cadre:    deref(st.Cadre),
			Region:   deref(st.Region),
		}
		if st.IhrisLastSyncAt != nil {
			row.IhrisLastSyncAt = st.IhrisLastSyncAt.Format(time.RFC3339)
		}

		if contract, ok := contractsByStaff[st.ID]; ok {
			if job, ok := jobs[contract.JobID]; ok {
				row.JobTitle = job.JobTitle
			}
			if facility, ok := facilities[contract.FacilityID]; ok {
				row.FacilityName = facility.Name
			}
			if contract.DepartmentID != nil {
				if dept, ok := departments[*contract.DepartmentID]; ok {
					row.DepartmentName = dept.Name
				}
			}
		}

		if profile, ok := profilesByStaff[st.ID]; ok {
			row.HrDepartmentID = profile.HrDepartmentID
			if profile.HrDepartmentID != nil {
				if dept, ok := departments[*profile.HrDepartmentID]; ok {
					row.HrDepartment = dept.Name
				}
			}
			if profile.HrEmail != nil && *profile.HrEmail != "" {
				row.Email = *profile.HrEmail
			}
			row.IsLeaveManager = profile.IsLeaveManager
		}

		if sup, ok := supervisionMap[st.ID]; ok {
			row.HasSupervisor = sup.HasSupervisor
			row.SupervisorName = sup.SupervisorName
			row.Supervisors = sup.Supervisors
		}
		out = append(out, row)
	}
	return out
}
