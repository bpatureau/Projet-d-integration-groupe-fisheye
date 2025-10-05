package api

import (
	"net/http"

	"fisheye/internal/calendar"
	"fisheye/internal/middleware"
	"fisheye/internal/utils"
	"fisheye/internal/websocket"
)

type CalendarHandler struct {
	calendarService *calendar.CalendarService
	logger          *utils.Logger
	wsHub           *websocket.Hub
}

func NewCalendarHandler(calendarService *calendar.CalendarService, logger *utils.Logger, wsHub *websocket.Hub) *CalendarHandler {
	return &CalendarHandler{
		calendarService: calendarService,
		logger:          logger,
		wsHub:           wsHub,
	}
}

// GET /api/calendar/status - Get calendar status
func (h *CalendarHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	isBusy := h.calendarService.IsBusy()
	currentEvent := h.calendarService.GetCurrentEvent()

	response := map[string]any{
		"enabled":   true,
		"available": !isBusy,
		"last_sync": h.calendarService.GetLastSyncTime(),
	}

	if currentEvent != nil {
		response["current_event"] = currentEvent
	}

	utils.WriteSuccess(w, http.StatusOK, response)
}

// GET /api/calendar/events - Get upcoming calendar events
func (h *CalendarHandler) GetEvents(w http.ResponseWriter, r *http.Request) {
	events := h.calendarService.GetCachedEvents()

	utils.WriteSuccess(w, http.StatusOK, map[string]any{
		"events":    events,
		"last_sync": h.calendarService.GetLastSyncTime(),
	})
}

// POST /api/calendar/sync - Force sync calendar (admin only)
func (h *CalendarHandler) ForceSync(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)

	if err := h.calendarService.SyncEvents(); err != nil {
		h.logger.Error("calendar", "Manual sync failed", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("calendar", "Calendar manually synced by admin: "+admin.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]any{
		"message":   "Calendar synced successfully",
		"last_sync": h.calendarService.GetLastSyncTime(),
	})
}
