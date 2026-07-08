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
// @Router /swagger/{any} [get]
func (r *SwaggerController) Index(ctx http.Context) http.Response {
	handler := httpSwagger.Handler()
	handler(ctx.Response().Writer(), ctx.Request().Origin())
	return nil
}
