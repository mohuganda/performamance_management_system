package main

import (
	_ "goravel/docs"

	"goravel/bootstrap"
)

// @title           MoH Uganda PMS API
// @version         1.0
// @description     Performance Management System API for Ministry of Health Uganda. Mobile self-service endpoints for leave, out-of-station, and GPS attendance clocking.
// @host            localhost:3030
// @BasePath        /
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description JWT Bearer token. Format: Bearer {token}
func main() {
	app := bootstrap.Boot()

	app.Start()
}
