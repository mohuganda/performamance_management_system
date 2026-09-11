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

	if err := s.seedOrdinaryKpis(); err != nil {
		return err
	}
	return s.seedScoreCardKpis()
}

// seedOrdinaryKpis fills the Ordinary catalog. Prefer the MySQL legacy `kpi` table when
// present; otherwise use embedded ordinaryKpiDefaults so Postgres installs get the same catalog.
func (s *PmsSeeder) seedOrdinaryKpis() error {
	var ordinaryCategory models.KpiCategory
	if err := facades.Orm().Query().Where("category_name", "Ordinary").First(&ordinaryCategory); err != nil || !modelFound(ordinaryCategory.ID) {
		return err
	}

	if err := s.seedOrdinaryJobs(); err != nil {
		return err
	}

	if seeded, err := s.seedOrdinaryKpisFromLegacy(ordinaryCategory.ID); err != nil {
		return err
	} else if seeded {
		return nil
	}

	return s.seedOrdinaryKpisFromDefaults(ordinaryCategory.ID)
}

func (s *PmsSeeder) seedOrdinaryJobs() error {
	for _, def := range ordinaryJobDefaults {
		var job models.JobTitle
		if err := facades.Orm().Query().Where("external_job_id", def.ExternalJobID).FirstOr(&job, func() error {
			job = models.JobTitle{ExternalJobID: def.ExternalJobID, JobTitle: def.JobTitle}
			return facades.Orm().Query().Create(&job)
		}); err != nil {
			return err
		}
	}

	var legacyJobs []models.LegacyKpiJobCategory
	if err := facades.Orm().Query().Get(&legacyJobs); err != nil {
		return nil
	}
	for _, legacyJob := range legacyJobs {
		var job models.JobTitle
		if err := facades.Orm().Query().Where("external_job_id", legacyJob.JobID).FirstOr(&job, func() error {
			job = models.JobTitle{ExternalJobID: legacyJob.JobID, JobTitle: legacyJob.Job}
			return facades.Orm().Query().Create(&job)
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *PmsSeeder) seedOrdinaryKpisFromLegacy(ordinaryCategoryID uint) (bool, error) {
	var legacyKpis []models.LegacyKpi
	if err := facades.Orm().Query().Where("status", 1).Get(&legacyKpis); err != nil || len(legacyKpis) == 0 {
		return false, nil
	}

	for _, legacy := range legacyKpis {
		var kpi models.Kpi
		if err := facades.Orm().Query().Where("kpi_code", legacy.KpiID).FirstOr(&kpi, func() error {
			kpi = models.Kpi{
				CategoryID:          ordinaryCategoryID,
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
			return false, err
		}

		if err := s.ensureKpiJobMapping(kpi.ID, legacy.JobID); err != nil {
			return false, err
		}
	}

	return true, nil
}

func (s *PmsSeeder) seedOrdinaryKpisFromDefaults(ordinaryCategoryID uint) error {
	for _, def := range ordinaryKpiDefaults {
		var kpi models.Kpi
		if err := facades.Orm().Query().Where("kpi_code", def.Code).FirstOr(&kpi, func() error {
			kpi = models.Kpi{
				CategoryID:          ordinaryCategoryID,
				KpiCode:             def.Code,
				ShortName:           strPtr(def.ShortName),
				IndicatorStatement:  def.IndicatorStatement,
				Description:         strPtr(def.Description),
				Computation:         strPtr(def.Computation),
				Numerator:           strPtr(def.Numerator),
				Denominator:         strPtr(def.Denominator),
				Frequency:           def.Frequency,
				ComputationCategory: def.ComputationCategory,
				SubjectArea:         legacySubjectArea(def.SubjectArea),
				CurrentTarget:       def.CurrentTarget,
				IsCumulative:        def.IsCumulative,
				GaugeType:           def.GaugeType,
				Status:              true,
			}
			return facades.Orm().Query().Create(&kpi)
		}); err != nil {
			return err
		}
		if err := s.ensureKpiJobMapping(kpi.ID, def.LegacyJobID); err != nil {
			return err
		}
	}
	return nil
}

func (s *PmsSeeder) ensureKpiJobMapping(kpiID uint, legacyJobID string) error {
	if legacyJobID == "" {
		return nil
	}
	var job models.JobTitle
	if err := facades.Orm().Query().Where("external_job_id", legacyJobID).First(&job); err != nil || !modelFound(job.ID) {
		return nil
	}
	var mapping models.KpiJobMapping
	return facades.Orm().Query().Where("kpi_id", kpiID).Where("job_id", job.ID).FirstOr(&mapping, func() error {
		mapping = models.KpiJobMapping{KpiID: kpiID, JobID: job.ID}
		return facades.Orm().Query().Create(&mapping)
	})
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
