package controllers

import (
	"strconv"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/http/authctx"
	"goravel/app/services"
)

type NotificationController struct {
	notifications *services.InAppNotificationService
}

func NewNotificationController() *NotificationController {
	return &NotificationController{
		notifications: services.NewInAppNotificationService(),
	}
}

// UnreadCount godoc
// @Summary      Unread in-app notification count
// @Tags         notifications
// @Security     BearerAuth
// @Router       /api/v1/notifications/unread-count [get]
func (c *NotificationController) UnreadCount(ctx http.Context) http.Response {
	userID, ok := authctx.UserID(ctx)
	if !ok {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": "unauthenticated"})
	}
	if principal, ok := authctx.PrincipalFrom(ctx); ok {
		_ = c.notifications.SyncForPrincipal(principal)
	}
	count, err := c.notifications.UnreadCount(userID)
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"unread_count": count})
}

// List godoc
// @Summary      List in-app notifications
// @Tags         notifications
// @Security     BearerAuth
// @Router       /api/v1/notifications [get]
func (c *NotificationController) List(ctx http.Context) http.Response {
	userID, ok := authctx.UserID(ctx)
	if !ok {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": "unauthenticated"})
	}
	if principal, ok := authctx.PrincipalFrom(ctx); ok {
		_ = c.notifications.SyncForPrincipal(principal)
	}
	page, _ := strconv.Atoi(ctx.Request().Query("page", "1"))
	perPage, _ := strconv.Atoi(ctx.Request().Query("per_page", "0"))
	unreadOnly := ctx.Request().Query("unread_only", "") == "true"
	result, err := c.notifications.List(userID, services.NotificationListFilter{
		UnreadOnly: unreadOnly,
		Page:       page,
		PerPage:    perPage,
	})
	if err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(result)
}

// MarkRead godoc
// @Summary      Mark notification as read
// @Tags         notifications
// @Security     BearerAuth
// @Router       /api/v1/notifications/{id}/read [post]
func (c *NotificationController) MarkRead(ctx http.Context) http.Response {
	userID, ok := authctx.UserID(ctx)
	if !ok {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": "unauthenticated"})
	}
	notificationID, _ := strconv.ParseUint(ctx.Request().Route("id"), 10, 64)
	if err := c.notifications.MarkRead(userID, uint(notificationID)); err != nil {
		return ctx.Response().Status(http.StatusUnprocessableEntity).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "marked as read"})
}

// MarkAllRead godoc
// @Summary      Mark all notifications as read
// @Tags         notifications
// @Security     BearerAuth
// @Router       /api/v1/notifications/read-all [post]
func (c *NotificationController) MarkAllRead(ctx http.Context) http.Response {
	userID, ok := authctx.UserID(ctx)
	if !ok {
		return ctx.Response().Status(http.StatusUnauthorized).Json(http.Json{"message": "unauthenticated"})
	}
	if err := c.notifications.MarkAllRead(userID); err != nil {
		return ctx.Response().Status(http.StatusInternalServerError).Json(http.Json{"message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"message": "all notifications marked as read"})
}
