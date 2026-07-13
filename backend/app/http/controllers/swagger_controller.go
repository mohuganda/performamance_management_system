package controllers

import (
	"github.com/goravel/framework/contracts/http"
	httpSwagger "github.com/swaggo/http-swagger/v2"

	_ "goravel/docs"
)

type SwaggerController struct{}

func NewSwaggerController() *SwaggerController {
	return &SwaggerController{}
}

// Index serves Swagger UI
// @Summary Swagger API documentation
// @Description Interactive OpenAPI documentation for the MoH Uganda Performance Management System.
// @Tags documentation
// @Router /swagger/{any} [get]
func (r *SwaggerController) Index(ctx http.Context) http.Response {
	handler := httpSwagger.Handler(
		httpSwagger.DeepLinking(true),
		httpSwagger.DocExpansion("list"),
		httpSwagger.DefaultModelsExpandDepth(-1),
		httpSwagger.PersistAuthorization(true),
		httpSwagger.UIConfig(map[string]string{
			"defaultModelsExpandDepth": "-1",
			"docExpansion":             "list",
			"filter":                   "true",
			"tryItOutEnabled":          "true",
		}),
	)
	handler(ctx.Response().Writer(), ctx.Request().Origin())
	return nil
}
