package seeders

import "testing"

func TestOrdinaryKpiDefaultsPopulated(t *testing.T) {
	if len(ordinaryKpiDefaults) < 80 {
		t.Fatalf("expected embedded ordinary KPI catalog, got %d", len(ordinaryKpiDefaults))
	}
	if len(ordinaryJobDefaults) == 0 {
		t.Fatal("expected ordinary job defaults")
	}
	seen := map[string]struct{}{}
	for _, def := range ordinaryKpiDefaults {
		if def.Code == "" || def.IndicatorStatement == "" {
			t.Fatalf("invalid ordinary KPI default: %+v", def)
		}
		if _, ok := seen[def.Code]; ok {
			t.Fatalf("duplicate ordinary KPI code %q", def.Code)
		}
		seen[def.Code] = struct{}{}
	}
}
