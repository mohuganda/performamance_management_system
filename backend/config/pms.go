package config

import "goravel/app/facades"

func init() {
	config := facades.Config()
	config.Add("pms", map[string]any{
		"name":    "Performance Management System",
		"acronym": "PMS - iHRIS",
		"organization": map[string]any{
			"name":    "Ministry of Health Uganda",
			"tagline": "Saving Lives Livelihoods",
			"co_branding": []string{"Africa CDC", "ASLM"},
		},
		"branding": map[string]any{
			"primary":    "#2E7D32",
			"secondary":  "#66BB6A",
			"accent":     "#F9A825",
			"success":    "#4CAF50",
			"warning":    "#FF9800",
			"error":      "#D32F2F",
			"background": "#F8FAF5",
			"card":       "#FFFFFF",
			"national": map[string]any{
				"black":  "#000000",
				"yellow": "#FCDC04",
				"red":    "#D90000",
			},
		},
		"performance": map[string]any{
			"attendance_target":       95,
			"on_track_threshold":      80,
			"at_risk_threshold":       60,
			"max_missed_tasks_off_track": 2,
			"ppa_weight_total":        100,
			"reporting_phases": []map[string]any{
				{"key": "ppa", "label": "Planning & Performance Agreement"},
				{"key": "q1", "label": "Quarter 1 Reporting"},
				{"key": "midterm", "label": "Midterm (Q2) Reporting"},
				{"key": "q3", "label": "Quarter 3 Reporting"},
				{"key": "endterm", "label": "Endterm (Q4) Reporting"},
			},
		},
		"ihris": map[string]any{
			"source":        "ihrisdata",
			"sync_enabled":  true,
			"api_base_url":  config.Env("IHRIS_API_BASE_URL", ""),
			"api_token":     config.Env("IHRIS_API_TOKEN", ""),
			"use_demo_data": config.Env("IHRIS_USE_DEMO_DATA", false),
		},
		"roles": []string{
			"staff",
			"supervisor",
			"department_head",
			"hr_officer",
			"director",
			"executive_office",
			"admin",
			"super_admin",
		},
		"out_of_station": map[string]any{
			"default_geofence_radius_meters": 500,
			"requires_supervisor_approval":   true,
			"map_provider":                   "google",
		},
		"attendance": map[string]any{
			"verify_gps_on_oos": true,
		},
		"hrm_attend": map[string]any{
			"api_base_url": config.Env("HRM_ATTEND_API_URL", "http://localhost/attend"),
			"enabled":      true,
		},
		"analytics": map[string]any{
			"enabled":  config.Env("ANALYTICS_DB_ENABLED", true),
			"host":     config.Env("ANALYTICS_DB_HOST", "127.0.0.1"),
			"port":     config.Env("ANALYTICS_DB_PORT", "9030"),
			"database": config.Env("ANALYTICS_DB_DATABASE", "moh_pms_analytics"),
			"username": config.Env("ANALYTICS_DB_USERNAME", "root"),
			"password": config.Env("ANALYTICS_DB_PASSWORD", ""),
		},
		"dashboard": map[string]any{
			"export_formats": []string{"excel", "pdf", "ppt", "print"},
			"cache_ttl_seconds": 300,
		},
		"staff": map[string]any{
			"cache_ttl_seconds": 300,
		},
		"demo": map[string]any{
			"focus_facility_id":   "facility|787",
			"focus_facility_name": "Ministry of Health",
			"sync_demo_on_seed":   true,
		},
	})
}
