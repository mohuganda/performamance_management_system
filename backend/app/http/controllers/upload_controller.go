package controllers

import (
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/services"
)

type UploadController struct {
	upload *services.UploadService
}

func NewUploadController() *UploadController {
	return &UploadController{upload: services.NewUploadService()}
}

type uploadBody struct {
	DataURL  string `json:"data_url"`
	FileName string `json:"file_name"`
}

// UploadAttachment godoc
// @Summary      Upload a leave/travel attachment
// @Tags         uploads
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body body uploadBody true "Base64 data URL"
// @Success      201 {object} services.UploadedFile
// @Router       /api/v1/uploads [post]
func (c *UploadController) UploadAttachment(ctx http.Context) http.Response {
	var body uploadBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	file, err := c.upload.StoreDataURL(body.DataURL, body.FileName)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Status(http.StatusCreated).Json(file)
}

// ServeUploadedFile godoc
// @Summary      Download an uploaded attachment
// @Tags         uploads
// @Produce      octet-stream
// @Security     BearerAuth
// @Param        path path string true "Relative path under uploads/"
// @Router       /api/v1/files [get]
func (c *UploadController) ServeUploadedFile(ctx http.Context) http.Response {
	relative := ctx.Request().Query("path", "")
	if relative == "" {
		relative = strings.TrimPrefix(ctx.Request().Path(), "/api/v1/files/")
	}
	content, mime, err := c.upload.ReadPublic(relative)
	if err != nil {
		return ctx.Response().Status(http.StatusNotFound).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Data(http.StatusOK, mime, content)
}
