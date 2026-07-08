package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type IhrisAPIRecord struct {
	IhrisPID            string  `json:"ihris_pid"`
	DistrictID          *string `json:"district_id"`
	District            *string `json:"district"`
	DhisFacilityID      *string `json:"dhis_facility_id"`
	DhisDistrictID      *string `json:"dhis_district_id"`
	Nin                 *string `json:"nin"`
	CardNumber          *string `json:"card_number"`
	Ipps                *string `json:"ipps"`
	FacilityTypeID      *string `json:"facility_type_id"`
	FacilityID          *string `json:"facility_id"`
	Facility            *string `json:"facility"`
	DepartmentID        *string `json:"department_id"`
	Department          *string `json:"department"`
	JobID               *string `json:"job_id"`
	Job                 *string `json:"job"`
	EmploymentTerms     *string `json:"employment_terms"`
	SalaryGrade         *string `json:"salary_grade"`
	Surname             *string `json:"surname"`
	Firstname           *string `json:"firstname"`
	Othername           *string `json:"othername"`
	Mobile              *string `json:"mobile"`
	Telephone           *string `json:"telephone"`
	InstitutionTypeName string  `json:"institutiontype_name"`
	InstitutionTypeID   *string `json:"institution_type_id"`
	Gender              *string `json:"gender"`
	BirthDate           *string `json:"birth_date"`
	Cadre               *string `json:"cadre"`
	Email               *string `json:"email"`
	Region              *string `json:"region"`
}

type IhrisAPIPagination struct {
	CurrentPage  int  `json:"current_page"`
	PerPage      int  `json:"per_page"`
	TotalRecords int  `json:"total_records"`
	TotalPages   int  `json:"total_pages"`
	HasNextPage  bool `json:"has_next_page"`
	NextPage     *int `json:"next_page"`
}

type IhrisAPIResponse struct {
	Status     string             `json:"status"`
	Error      bool               `json:"error"`
	Data       []IhrisAPIRecord   `json:"data"`
	Pagination IhrisAPIPagination `json:"pagination"`
}

type IhrisAPIClient struct {
	httpClient *http.Client
}

func NewIhrisAPIClient() *IhrisAPIClient {
	return &IhrisAPIClient{httpClient: &http.Client{Timeout: 120 * time.Second}}
}

func (c *IhrisAPIClient) FetchPage(apiURL string, page int) (IhrisAPIResponse, error) {
	url := strings.TrimSpace(apiURL)
	if url == "" {
		return IhrisAPIResponse{}, fmt.Errorf("iHRIS API URL is not configured")
	}
	if page < 1 {
		page = 1
	}
	sep := "?"
	if strings.Contains(url, "?") {
		sep = "&"
	}
	reqURL := fmt.Sprintf("%s%spage=%d", url, sep, page)

	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return IhrisAPIResponse{}, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return IhrisAPIResponse{}, fmt.Errorf("iHRIS API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return IhrisAPIResponse{}, err
	}
	if resp.StatusCode >= 400 {
		snippet := string(body)
		if len(snippet) > 200 {
			snippet = snippet[:200]
		}
		return IhrisAPIResponse{}, fmt.Errorf("iHRIS API HTTP %d: %s", resp.StatusCode, snippet)
	}

	var payload IhrisAPIResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return IhrisAPIResponse{}, fmt.Errorf("parse iHRIS response: %w", err)
	}
	if payload.Error || !strings.EqualFold(payload.Status, "SUCCESS") {
		return IhrisAPIResponse{}, fmt.Errorf("iHRIS API returned error status")
	}
	return payload, nil
}

func (r IhrisAPIRecord) ToIhrisData() models.IhrisData {
	districtID := normalizeIhrisDistrictID(r.DistrictID)
	return models.IhrisData{
		IhrisPID:            r.IhrisPID,
		DistrictID:          districtID,
		District:            r.District,
		DhisDistrictID:      normalizeIhrisDistrictID(r.DhisDistrictID),
		DhisFacilityID:      r.DhisFacilityID,
		Nin:                 r.Nin,
		FacilityTypeID:      r.FacilityTypeID,
		FacilityID:          r.FacilityID,
		Facility:            r.Facility,
		DepartmentID:        r.DepartmentID,
		Department:          r.Department,
		JobID:               r.JobID,
		Job:                 r.Job,
		EmploymentTerms:     r.EmploymentTerms,
		SalaryGrade:         r.SalaryGrade,
		Surname:             r.Surname,
		Firstname:           r.Firstname,
		Othername:           r.Othername,
		Mobile:              r.Mobile,
		Telephone:           r.Telephone,
		InstitutionTypeID:   r.InstitutionTypeID,
		InstitutionTypeName: r.InstitutionTypeName,
		Gender:              r.Gender,
		Region:              r.Region,
	}
}

func normalizeIhrisDistrictID(id *string) *string {
	if id == nil {
		return nil
	}
	v := strings.ToUpper(strings.TrimSpace(*id))
	if v == "" || v == "DHIS_DISTRICT_ID" {
		return nil
	}
	return &v
}

func ihrisAPIURL() string {
	settings := NewSettingsService()
	if url := settings.GetString("ihris.api_url", ""); url != "" {
		return url
	}
	base := strings.TrimSpace(facades.Config().GetString("ihris.api_base_url", ""))
	token := strings.TrimSpace(facades.Config().GetString("ihris.api_token", ""))
	if base != "" && token != "" {
		return strings.TrimRight(base, "/") + "/" + token
	}
	return "https://hris.health.go.ug/apiv1/index.php/api/ihrisdatapaginated/92cfdef7-8f2c-433e-ba62-49fa7a243974"
}
