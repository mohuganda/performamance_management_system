package seeders

import (
	"goravel/app/facades"
	"goravel/app/models"
)

type PmsSeeder struct{}

func (s *PmsSeeder) Signature() string {
	return "PmsSeeder"
}

func (s *PmsSeeder) Run() error {
	categories := []models.KpiCategory{
		{CategoryName: "Ordinary"},
		{CategoryName: "Score card"},
	}
	for _, category := range categories {
		var existing models.KpiCategory
		if err := facades.Orm().Query().Where("category_name", category.CategoryName).FirstOr(&existing, func() error {
			return facades.Orm().Query().Create(&category)
		}); err != nil {
			return err
		}
	}

	// Migrate legacy label if an older database still has "Normal".
	_, _ = facades.Orm().Query().Model(&models.KpiCategory{}).
		Where("category_name", "Normal").
		Update("category_name", "Ordinary")

	var legacyNormal models.KpiCategory
	if err := facades.Orm().Query().Where("category_name", "Normal").First(&legacyNormal); err == nil && modelFound(legacyNormal.ID) {
		var ordinary models.KpiCategory
		if err := facades.Orm().Query().Where("category_name", "Ordinary").First(&ordinary); err != nil || !modelFound(ordinary.ID) {
			legacyNormal.CategoryName = "Ordinary"
			_ = facades.Orm().Query().Save(&legacyNormal)
		}
	}

	if err := s.seedKpisFromLegacy(); err != nil {
		return err
	}
	return s.seedScoreCardKpis()
}

func (s *PmsSeeder) seedKpisFromLegacy() error {
	var ordinaryCategory models.KpiCategory
	if err := facades.Orm().Query().Where("category_name", "Ordinary").First(&ordinaryCategory); err != nil || !modelFound(ordinaryCategory.ID) {
		return err
	}

	var legacyJobs []models.LegacyKpiJobCategory
	_ = facades.Orm().Query().Get(&legacyJobs)
	for _, legacyJob := range legacyJobs {
		var job models.JobTitle
		if err := facades.Orm().Query().Where("external_job_id", legacyJob.JobID).FirstOr(&job, func() error {
			job = models.JobTitle{ExternalJobID: legacyJob.JobID, JobTitle: legacyJob.Job}
			return facades.Orm().Query().Create(&job)
		}); err != nil {
			return err
		}
	}

	var legacyKpis []models.LegacyKpi
	if err := facades.Orm().Query().Where("status", 1).Get(&legacyKpis); err != nil {
		return nil
	}

	for _, legacy := range legacyKpis {
		var kpi models.Kpi
		if err := facades.Orm().Query().Where("kpi_code", legacy.KpiID).FirstOr(&kpi, func() error {
			kpi = models.Kpi{
				CategoryID:          ordinaryCategory.ID,
				KpiCode:             legacy.KpiID,
				ShortName:           legacy.ShortName,
				IndicatorStatement:  legacy.IndicatorStatement,
				Description:         legacy.Description,
				Computation:         legacy.Computation,
				Numerator:           strPtr(legacy.Numerator),
				Denominator:         strPtr(legacy.Denominator),
				Frequency:           legacy.Frequency,
				ComputationCategory: legacy.ComputationCategory,
				SubjectArea:         legacySubjectArea(legacy.SubjectArea),
				CurrentTarget:       legacy.CurrentTarget,
				IsCumulative:        legacy.IsCumulative == 1,
				GaugeType:           legacy.GaugeType,
				Status:              legacy.Status == 1,
			}
			return facades.Orm().Query().Create(&kpi)
		}); err != nil {
			return err
		}

		if legacy.JobID == "" {
			continue
		}

		var job models.JobTitle
		if err := facades.Orm().Query().Where("external_job_id", legacy.JobID).First(&job); err != nil || !modelFound(job.ID) {
			continue
		}

		var mapping models.KpiJobMapping
		if err := facades.Orm().Query().Where("kpi_id", kpi.ID).Where("job_id", job.ID).FirstOr(&mapping, func() error {
			mapping = models.KpiJobMapping{KpiID: kpi.ID, JobID: job.ID}
			return facades.Orm().Query().Create(&mapping)
		}); err != nil {
			return err
		}
	}

	return nil
}

func (s *PmsSeeder) seedScoreCardKpis() error {
	var scoreCard models.KpiCategory
	if err := facades.Orm().Query().Where("category_name", "Score card").First(&scoreCard); err != nil || !modelFound(scoreCard.ID) {
		return err
	}

	// Ministry-level strategic scorecard indicators (not in legacy npm_dashboard extract).
	leadership := uint8(4)
	hrArea := uint8(3)
	defs := []models.Kpi{
		{
			CategoryID:          scoreCard.ID,
			KpiCode:             "SC-001",
			ShortName:           strPtr("National health sector performance index"),
			IndicatorStatement:  "National health sector performance index achieved",
			Frequency:           "Annual",
			ComputationCategory: "Ratio",
			SubjectArea:         &leadership,
			CurrentTarget:       intPtr(85),
			GaugeType:           "ascending_scale",
			Status:              true,
		},
		{
			CategoryID:          scoreCard.ID,
			KpiCode:             "SC-002",
			ShortName:           strPtr("HMIS reporting compliance"),
			IndicatorStatement:  "Percentage of districts meeting HMIS reporting standards",
			Frequency:           "Quarterly",
			ComputationCategory: "Ratio",
			SubjectArea:         &leadership,
			CurrentTarget:       intPtr(95),
			GaugeType:           "ascending_scale",
			Status:              true,
		},
		{
			CategoryID:          scoreCard.ID,
			KpiCode:             "SC-003",
			ShortName:           strPtr("Essential medicines availability"),
			IndicatorStatement:  "Percentage of tracer medicines available at national level stores",
			Frequency:           "Quarterly",
			ComputationCategory: "Ratio",
			SubjectArea:         &leadership,
			CurrentTarget:       intPtr(90),
			GaugeType:           "ascending_scale",
			Status:              true,
		},
		{
			CategoryID:          scoreCard.ID,
			KpiCode:             "SC-004",
			ShortName:           strPtr("Staff establishment filled"),
			IndicatorStatement:  "Percentage of approved MoH positions filled",
			Frequency:           "Quarterly",
			ComputationCategory: "Ratio",
			SubjectArea:         &hrArea,
			CurrentTarget:       intPtr(80),
			GaugeType:           "ascending_scale",
			Status:              true,
		},
	}

	for _, def := range defs {
		var existing models.Kpi
		if err := facades.Orm().Query().Where("kpi_code", def.KpiCode).FirstOr(&existing, func() error {
			return facades.Orm().Query().Create(&def)
		}); err != nil {
			return err
		}
	}

	return nil
}

func intPtr(v int) *int {
	return &v
}

func strPtr(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}

func legacySubjectArea(v *int) *uint8 {
	if v == nil || *v == 0 {
		return nil
	}
	u := uint8(*v)
	return &u
}
