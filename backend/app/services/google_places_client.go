package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type googlePlacesClient struct {
	apiKey string
	client *http.Client
}

type googlePlaceSuggestion struct {
	PlaceID     string
	Description string
	MainText    string
	Secondary   string
}

type googlePlaceDetails struct {
	PlaceID   string
	Name      string
	Address   string
	Latitude  float64
	Longitude float64
}

func newGooglePlacesClient(apiKey string) *googlePlacesClient {
	return &googlePlacesClient{
		apiKey: strings.TrimSpace(apiKey),
		client: &http.Client{Timeout: 12 * time.Second},
	}
}

func (c *googlePlacesClient) Autocomplete(input string, countryCodes []string) ([]googlePlaceSuggestion, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("Google Maps API key is not configured")
	}
	body := map[string]any{
		"input":        input,
		"languageCode": "en",
	}
	codes := make([]string, 0, len(countryCodes))
	for _, code := range countryCodes {
		code = strings.ToUpper(strings.TrimSpace(code))
		if len(code) == 2 {
			codes = append(codes, code)
		}
	}
	if len(codes) > 0 {
		body["includedRegionCodes"] = codes
	}
	payload, _ := json.Marshal(body)
	req, err := http.NewRequest(http.MethodPost, "https://places.googleapis.com/v1/places:autocomplete", strings.NewReader(string(payload)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Goog-Api-Key", c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("google places autocomplete failed (%d): %s", resp.StatusCode, truncate(string(raw), 200))
	}

	var parsed struct {
		Suggestions []struct {
			PlacePrediction *struct {
				PlaceID string `json:"placeId"`
				Place   string `json:"place"`
				Text    *struct {
					Text string `json:"text"`
				} `json:"text"`
				StructuredFormat *struct {
					MainText *struct {
						Text string `json:"text"`
					} `json:"mainText"`
					SecondaryText *struct {
						Text string `json:"text"`
					} `json:"secondaryText"`
				} `json:"structuredFormat"`
			} `json:"placePrediction"`
		} `json:"suggestions"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}

	out := make([]googlePlaceSuggestion, 0, len(parsed.Suggestions))
	for _, item := range parsed.Suggestions {
		p := item.PlacePrediction
		if p == nil {
			continue
		}
		placeID := strings.TrimSpace(p.PlaceID)
		if placeID == "" && strings.HasPrefix(p.Place, "places/") {
			placeID = strings.TrimPrefix(p.Place, "places/")
		}
		if placeID == "" {
			continue
		}
		main := ""
		secondary := ""
		if p.StructuredFormat != nil {
			if p.StructuredFormat.MainText != nil {
				main = strings.TrimSpace(p.StructuredFormat.MainText.Text)
			}
			if p.StructuredFormat.SecondaryText != nil {
				secondary = strings.TrimSpace(p.StructuredFormat.SecondaryText.Text)
			}
		}
		desc := ""
		if p.Text != nil {
			desc = strings.TrimSpace(p.Text.Text)
		}
		if desc == "" {
			desc = strings.TrimSpace(strings.Join([]string{main, secondary}, ", "))
		}
		if desc == "" {
			continue
		}
		out = append(out, googlePlaceSuggestion{
			PlaceID:     placeID,
			Description: desc,
			MainText:    main,
			Secondary:   secondary,
		})
	}
	return out, nil
}

func (c *googlePlacesClient) Details(placeID string) (*googlePlaceDetails, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("Google Maps API key is not configured")
	}
	id := strings.TrimPrefix(strings.TrimSpace(placeID), "places/")
	url := "https://places.googleapis.com/v1/places/" + id
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Goog-Api-Key", c.apiKey)
	req.Header.Set("X-Goog-FieldMask", "id,displayName,formattedAddress,location")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("google place details failed (%d): %s", resp.StatusCode, truncate(string(raw), 200))
	}

	var parsed struct {
		ID          string `json:"id"`
		DisplayName *struct {
			Text string `json:"text"`
		} `json:"displayName"`
		FormattedAddress string `json:"formattedAddress"`
		Location         *struct {
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
		} `json:"location"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	if parsed.Location == nil {
		return nil, fmt.Errorf("selected place is missing map coordinates")
	}
	name := ""
	if parsed.DisplayName != nil {
		name = strings.TrimSpace(parsed.DisplayName.Text)
	}
	address := strings.TrimSpace(parsed.FormattedAddress)
	if name == "" {
		name = address
	}
	if name == "" {
		name = "Selected place"
	}
	if address == "" {
		address = name
	}
	pid := strings.TrimPrefix(parsed.ID, "places/")
	if pid == "" {
		pid = id
	}
	return &googlePlaceDetails{
		PlaceID:   pid,
		Name:      name,
		Address:   address,
		Latitude:  parsed.Location.Latitude,
		Longitude: parsed.Location.Longitude,
	}, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
