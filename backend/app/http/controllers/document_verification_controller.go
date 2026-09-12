package controllers

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/http/authctx"
	"goravel/app/services"
)

type DocumentVerificationController struct {
	docs *services.DocumentVerificationService
}

func NewDocumentVerificationController() *DocumentVerificationController {
	return &DocumentVerificationController{docs: services.NewDocumentVerificationService()}
}

func (c *DocumentVerificationController) Ensure(ctx http.Context) http.Response {
	var body services.DocumentEnsureInput
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	var issuedBy *uint
	if uid, ok := authctx.UserID(ctx); ok && uid > 0 {
		issuedBy = &uid
	}
	result, err := c.docs.Ensure(issuedBy, body)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

func (c *DocumentVerificationController) PublicShow(ctx http.Context) http.Response {
	token := ctx.Request().Route("token")
	return ctx.Response().Success().Json(c.docs.LookupPublic(token))
}
