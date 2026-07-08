package services

// Subject area labels from legacy npm_dashboard subject_areas table.
var SubjectAreaLabels = map[uint8]string{
	1: "Clinical Care",
	2: "Research",
	3: "Human Resource",
	4: "Leadership & Governance",
	5: "Pharmaceutical",
	6: "Health Infrastructure",
	7: "Public Health",
	8: "Environmental Health",
	9: "Community Health",
}

func SubjectAreaName(id uint8) string {
	if id == 0 {
		return "General"
	}
	if name, ok := SubjectAreaLabels[id]; ok {
		return name
	}
	return "Other"
}

func SubjectAreaNamePtr(id *uint8) string {
	if id == nil || *id == 0 {
		return "General"
	}
	return SubjectAreaName(*id)
}

func SubjectAreaSortKey(id *uint8) uint8 {
	if id == nil {
		return 99
	}
	return *id
}
