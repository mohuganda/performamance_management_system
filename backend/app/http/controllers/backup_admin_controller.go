package controllers

import (
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/http/authctx"
	"goravel/app/services"
)

type BackupAdminController struct {
	backups *services.BackupService
}

func NewBackupAdminController() *BackupAdminController {
	return &BackupAdminController{backups: services.NewBackupService()}
}

func (c *BackupAdminController) Status(ctx http.Context) http.Response {
	st, err := c.backups.Status()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(st)
}

func (c *BackupAdminController) List(ctx http.Context) http.Response {
	rows, err := c.backups.List()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	if rows == nil {
		rows = []services.BackupFileInfo{}
	}
	return ctx.Response().Success().Json(http.Json{"data": rows})
}

func (c *BackupAdminController) Run(ctx http.Context) http.Response {
	info, err := c.backups.RunBackup()
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(info)
}

func (c *BackupAdminController) Delete(ctx http.Context) http.Response {
	filename := strings.TrimSpace(ctx.Request().Route("filename"))
	if err := c.backups.Delete(filename); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "deleted"})
}

func (c *BackupAdminController) TestRestore(ctx http.Context) http.Response {
	filename := strings.TrimSpace(ctx.Request().Route("filename"))
	info, err := c.backups.TestRestore(filename)
	if err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error(), "backup": info})
	}
	return ctx.Response().Success().Json(info)
}

type backupRestoreBody struct {
	Confirm string `json:"confirm"`
}

func (c *BackupAdminController) Restore(ctx http.Context) http.Response {
	filename := strings.TrimSpace(ctx.Request().Route("filename"))
	var body backupRestoreBody
	_ = ctx.Request().Bind(&body)

	var userID *uint
	name, email := "", ""
	if id, ok := authctx.UserID(ctx); ok {
		userID = &id
	}
	if p, ok := authctx.PrincipalFrom(ctx); ok {
		name = p.User.Name
		email = p.User.Email
	}
	if err := c.backups.RestoreProduction(filename, body.Confirm, userID, name, email, ctx.Request().Ip()); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "production restore completed"})
}
