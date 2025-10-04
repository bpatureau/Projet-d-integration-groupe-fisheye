package api

import (
	"net/http"

	"fisheye/internal/calendar"
	"fisheye/internal/middleware"
	"fisheye/internal/utils"
)

type CalendarHandler struct {
	calendarService *calendar.CalendarService
	logger          *utils.Logger
}

func NewCalendarHandler(calendarService *calendar.CalendarService, logger *utils.Logger) *CalendarHandler {
	return &CalendarHandler{
		calendarService: calendarService,
		logger:          logger,
	}
}

// GET /api/calendar/status - Get calendar status
func (h *CalendarHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	if h.calendarService == nil {
		utils.WriteSuccess(w, http.StatusOK, map[string]any{
			"enabled":   false,
			"available": false,
			"message":   "Calendar not configured",
		})
		return
	}

	available := h.calendarService.IsAvailable()
	currentEvent := h.calendarService.GetCurrentEvent()

	response := map[string]any{
		"enabled":   true,
		"available": available,
		"last_sync": h.calendarService.GetLastSyncTime(),
	}

	if currentEvent != nil {
		response["current_event"] = currentEvent
	}

	utils.WriteSuccess(w, http.StatusOK, response)
}

// GET /api/calendar/events - Get upcoming calendar events
func (h *CalendarHandler) GetEvents(w http.ResponseWriter, r *http.Request) {
	if h.calendarService == nil {
		utils.WriteError(w, http.StatusServiceUnavailable, "CALENDAR_NOT_CONFIGURED", "Calendar service not configured")
		return
	}

	events := h.calendarService.GetCachedEvents()

	utils.WriteSuccess(w, http.StatusOK, map[string]any{
		"events":    events,
		"last_sync": h.calendarService.GetLastSyncTime(),
	})
}

// POST /api/calendar/sync - Force sync calendar (admin only)
func (h *CalendarHandler) ForceSync(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)

	if h.calendarService == nil {
		utils.WriteError(w, http.StatusServiceUnavailable, "CALENDAR_NOT_CONFIGURED", "Calendar service not configured")
		return
	}

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
