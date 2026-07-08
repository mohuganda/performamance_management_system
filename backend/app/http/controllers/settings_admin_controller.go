package controllers

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/services"
)

type SettingsAdminController struct {
	settings *services.SettingsService
}

func NewSettingsAdminController() *SettingsAdminController {
	return &SettingsAdminController{settings: services.NewSettingsService()}
}

func (c *SettingsAdminController) Show(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(c.settings.AdminSettings())
}

type updateSettingsBody struct {
	Group   string         `json:"group"`
	Payload map[string]any `json:"payload"`
}

func (c *SettingsAdminController) Update(ctx http.Context) http.Response {
	var body updateSettingsBody
	if err := ctx.Request().Bind(&body); err != nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "invalid request body"})
	}
	if body.Group == "" || body.Payload == nil {
		return ctx.Response().Status(http.StatusBadRequest).Json(http.Json{"message": "group and payload are required"})
	}
	if err := c.settings.UpdateGroup(body.Group, body.Payload); err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(c.settings.AdminSettings())
}

type NotificationsAdminController struct {
	notifications *services.NotificationService
}

func NewNotificationsAdminController() *NotificationsAdminController {
	return &NotificationsAdminController{notifications: services.NewNotificationService()}
}

func (c *NotificationsAdminController) SendReminders(ctx http.Context) http.Response {
	result, err := c.notifications.SendAllReminders()
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{
			"message": err.Error(),
			"result":  result,
		})
	}
	return ctx.Response().Success().Json(result)
}
