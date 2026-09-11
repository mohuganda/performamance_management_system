package services

import (
	"fmt"
	"strings"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/support/dbdialect"
)

type PlacesService struct {
	settings *SettingsService
}

func NewPlacesService() *PlacesService {
	return &PlacesService{settings: NewSettingsService()}
}

func (s *PlacesService) ResolveCountryCodes(override string) []string {
	raw := strings.TrimSpace(override)
	if raw == "" {
		raw = s.settings.GetString("google_maps.country_code", "ug")
	}
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == ' ' || r == ';'
	})
	out := make([]string, 0, len(parts))
	seen := map[string]bool{}
	for _, p := range parts {
		code := strings.ToLower(strings.TrimSpace(p))
		if len(code) != 2 || seen[code] {
			continue
		}
		seen[code] = true
		out = append(out, code)
	}
	if len(out) == 0 {
		return []string{"ug"}
	}
	return out
}

func (s *PlacesService) GetByID(id uint) (*models.CachedPlace, error) {
	var row models.CachedPlace
	if err := facades.Orm().Query().Where("id", id).First(&row); err != nil || row.ID == 0 {
		return nil, fmt.Errorf("place not found")
	}
	return &row, nil
}

func (s *PlacesService) findExisting(place models.CachedPlace) (*models.CachedPlace, error) {
	if place.GooglePlaceID != nil && strings.TrimSpace(*place.GooglePlaceID) != "" {
		var byID models.CachedPlace
		if err := facades.Orm().Query().Where("google_place_id", strings.TrimSpace(*place.GooglePlaceID)).First(&byID); err == nil && byID.ID > 0 {
			return &byID, nil
		}
	}
	norm := place.NormalizedName
	if norm == "" {
		norm = NormalizePlaceName(place.Name)
	}
	country := strings.ToLower(strings.TrimSpace(place.CountryCode))
	var candidates []models.CachedPlace
	q := facades.Orm().Query().Where("normalized_name", norm)
	if country != "" {
		q = q.Where("country_code", country)
	}
	if err := q.Limit(25).Get(&candidates); err != nil {
		return nil, err
	}
	for i := range candidates {
		c := candidates[i]
		if PlaceCoordsNear(place.Latitude, place.Longitude, c.Latitude, c.Longitude, 50) {
			return &c, nil
		}
	}
	return nil, nil
}

// InsertIfNew inserts an immutable place snapshot. Returns (row, inserted, err).
func (s *PlacesService) InsertIfNew(place models.CachedPlace) (models.CachedPlace, bool, error) {
	place.Name = strings.TrimSpace(place.Name)
	if place.Name == "" {
		return models.CachedPlace{}, false, fmt.Errorf("place name is required")
	}
	if !HasCoords(place.Latitude, place.Longitude) {
		return models.CachedPlace{}, false, fmt.Errorf("place coordinates are required")
	}
	place.CountryCode = strings.ToLower(strings.TrimSpace(place.CountryCode))
	if place.CountryCode == "" {
		place.CountryCode = "ug"
	}
	place.NormalizedName = NormalizePlaceName(place.Name)
	place.Source = strings.TrimSpace(place.Source)
	if place.Source == "" {
		place.Source = "google"
	}
	if place.GooglePlaceID != nil {
		id := strings.TrimSpace(*place.GooglePlaceID)
		if id == "" {
			place.GooglePlaceID = nil
		} else {
			place.GooglePlaceID = &id
		}
	}

	existing, err := s.findExisting(place)
	if err != nil {
		return models.CachedPlace{}, false, err
	}
	if existing != nil {
		return *existing, false, nil
	}

	if err := facades.Orm().Query().Create(&place); err != nil {
		// Race on unique google_place_id — re-read
		if existing2, err2 := s.findExisting(place); err2 == nil && existing2 != nil {
			return *existing2, false, nil
		}
		return models.CachedPlace{}, false, err
	}
	return place, true, nil
}

func (s *PlacesService) bumpHit(id uint) {
	var row models.CachedPlace
	if err := facades.Orm().Query().Where("id", id).First(&row); err != nil || row.ID == 0 {
		return
	}
	now := time.Now()
	row.HitCount = row.HitCount + 1
	row.LastHitAt = &now
	_ = facades.Orm().Query().Save(&row)
}

func (s *PlacesService) searchLocal(q string, countryCodes []string, limit int) ([]models.CachedPlace, error) {
	if limit <= 0 {
		limit = 15
	}
	needle := strings.TrimSpace(q)
	if needle == "" {
		return nil, nil
	}
	like := "%" + needle + "%"
	norm := NormalizePlaceName(needle)
	query := facades.Orm().Query().Order("hit_count desc").Order("name asc")
	if len(countryCodes) == 1 {
		query = query.Where("country_code", countryCodes[0])
	} else if len(countryCodes) > 1 {
		args := make([]any, len(countryCodes))
		for i, c := range countryCodes {
			args[i] = c
		}
		query = query.Where("country_code IN ?", args)
	}
	if dbdialect.IsPostgres() {
		query = query.Where("(name ILIKE ? OR COALESCE(address,'') ILIKE ? OR normalized_name LIKE ?)", like, like, "%"+norm+"%")
	} else {
		query = query.Where("(name LIKE ? OR IFNULL(address,'') LIKE ? OR normalized_name LIKE ?)", like, like, "%"+norm+"%")
	}
	var rows []models.CachedPlace
	if err := query.Limit(limit).Get(&rows); err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *PlacesService) Search(q string, countryOverride string, limit int) ([]models.CachedPlace, error) {
	q = strings.TrimSpace(q)
	if len(q) < 2 {
		return []models.CachedPlace{}, nil
	}
	countries := s.ResolveCountryCodes(countryOverride)
	local, err := s.searchLocal(q, countries, limit)
	if err != nil {
		return nil, err
	}
	if len(local) > 0 {
		for _, row := range local {
			s.bumpHit(row.ID)
		}
		return local, nil
	}

	apiKey := s.settings.GetString("google_maps.api_key", "")
	client := newGooglePlacesClient(apiKey)
	suggestions, err := client.Autocomplete(q, countries)
	if err != nil {
		return nil, err
	}
	primaryCountry := countries[0]
	out := make([]models.CachedPlace, 0, len(suggestions))
	for i, sug := range suggestions {
		if i >= 8 {
			break
		}
		details, err := client.Details(sug.PlaceID)
		if err != nil {
			continue
		}
		addr := details.Address
		placeID := details.PlaceID
		row, _, err := s.InsertIfNew(models.CachedPlace{
			Name:           details.Name,
			Address:        &addr,
			Latitude:       details.Latitude,
			Longitude:      details.Longitude,
			CountryCode:    primaryCountry,
			GooglePlaceID:  &placeID,
			Source:         "google",
			NormalizedName: NormalizePlaceName(details.Name),
		})
		if err != nil {
			continue
		}
		s.bumpHit(row.ID)
		out = append(out, row)
	}
	return out, nil
}

type PlacesListFilter struct {
	Search      string
	CountryCode string
	Source      string
	Page        int
	PerPage     int
}

func (s *PlacesService) ListAdmin(filter PlacesListFilter) (PaginatedResult[models.CachedPlace], error) {
	page, perPage := ResolvePage(filter.Page, filter.PerPage)
	query := facades.Orm().Query().Order("created_at desc")
	if filter.Search != "" {
		like := "%" + strings.TrimSpace(filter.Search) + "%"
		query = query.Where("(name LIKE ? OR address LIKE ? OR normalized_name LIKE ?)", like, like, like)
	}
	if filter.CountryCode != "" {
		query = query.Where("country_code", strings.ToLower(strings.TrimSpace(filter.CountryCode)))
	}
	if filter.Source != "" {
		query = query.Where("source", strings.TrimSpace(filter.Source))
	}
	var rows []models.CachedPlace
	if err := query.Get(&rows); err != nil {
		return PaginatedResult[models.CachedPlace]{}, err
	}
	return PaginateSlice(rows, page, perPage), nil
}

func (s *PlacesService) SeedFromFacilities() (inserted, skipped int, err error) {
	countries := s.ResolveCountryCodes("")
	primary := countries[0]
	var facilities []models.Facility
	if err := facades.Orm().Query().Get(&facilities); err != nil {
		return 0, 0, err
	}
	for _, f := range facilities {
		if f.Latitude == nil || f.Longitude == nil {
			continue
		}
		if !HasCoords(*f.Latitude, *f.Longitude) {
			continue
		}
		name := strings.TrimSpace(f.Name)
		if name == "" {
			continue
		}
		ref := fmt.Sprintf("facility:%d", f.ID)
		_, wasInserted, ierr := s.InsertIfNew(models.CachedPlace{
			Name:           name,
			Latitude:       *f.Latitude,
			Longitude:      *f.Longitude,
			CountryCode:    primary,
			Source:         "facility_seed",
			SourceRef:      &ref,
			NormalizedName: NormalizePlaceName(name),
		})
		if ierr != nil {
			continue
		}
		if wasInserted {
			inserted++
		} else {
			skipped++
		}
	}
	return inserted, skipped, nil
}
