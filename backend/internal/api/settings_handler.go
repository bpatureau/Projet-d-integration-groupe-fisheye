package api

import (
	"encoding/json"
	"net/http"
	"time"

	"fisheye/internal/middleware"
	"fisheye/internal/sse"
	"fisheye/internal/store"
	"fisheye/internal/utils"
)

type SettingsHandler struct {
	settingsStore store.SettingsStore
	broadcaster   *sse.Broadcaster
	logger        *utils.Logger
}

func NewSettingsHandler(settingsStore store.SettingsStore, broadcaster *sse.Broadcaster, logger *utils.Logger) *SettingsHandler {
	return &SettingsHandler{
		settingsStore: settingsStore,
		broadcaster:   broadcaster,
		logger:        logger,
	}
}

// GET /api/settings
func (h *SettingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	settings, err := h.settingsStore.Get(ctx)
	if err != nil {
		h.logger.Error("settings", "Failed to get settings", err)
		utils.WriteInternalError(w)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, settings)
}

// PUT /api/settings
func (h *SettingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	admin := middleware.GetUser(r)

	var settings store.Settings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	// Get current settings to preserve ID
	current, err := h.settingsStore.Get(ctx)
	if err != nil {
		h.logger.Error("settings", "Failed to get current settings", err)
		utils.WriteInternalError(w)
		return
	}

	settings.ID = current.ID
	settings.CreatedAt = current.CreatedAt

	// Validate
	if err := h.validateSettings(&settings); err != nil {
		utils.WriteValidationError(w, err.Error())
		return
	}

	if err := h.settingsStore.Update(ctx, &settings); err != nil {
		h.logger.Error("settings", "Failed to update settings", err)
		utils.WriteInternalError(w)
		return
	}

	deviceSettings := map[string]any{
		"device_name":      settings.DeviceName,
		"do_not_disturb":   settings.DoNotDisturb,
		"welcome_messages": settings.WelcomeMessages,
		"rotation_seconds": settings.MessageRotationSeconds,
		"schedule":         h.getCurrentSchedule(settings.Schedule),
	}

	h.broadcaster.BroadcastToDevices(sse.Event{
		Type: "settings_update",
		Data: deviceSettings,
	})

	h.logger.Info("settings", "Settings updated by admin: "+admin.Username)
	utils.WriteSuccess(w, http.StatusOK, settings)
}

func (h *SettingsHandler) getCurrentSchedule(schedule map[string]store.DaySchedule) *store.DaySchedule {
	days := []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"}
	today := days[time.Now().Weekday()]

	if daySchedule, ok := schedule[today]; ok {
		return &daySchedule
	}

	return &store.DaySchedule{Enabled: false}
}

func (h *SettingsHandler) validateSettings(settings *store.Settings) error {
	if settings.DeviceName == "" {
		return utils.NewValidationError("device_name cannot be empty")
	}

	if len(settings.DeviceName) > 100 {
		return utils.NewValidationError("device_name cannot exceed 100 characters")
	}

	if len(settings.WelcomeMessages) == 0 {
		return utils.NewValidationError("at least one welcome message is required")
	}

	for _, msg := range settings.WelcomeMessages {
		if len(msg) > 500 {
			return utils.NewValidationError("welcome message cannot exceed 500 characters")
		}
	}

	if settings.MessageRotationSeconds < 1 || settings.MessageRotationSeconds > 3600 {
		return utils.NewValidationError("message rotation must be between 1 and 3600 seconds")
	}

	// Validate schedule
	for day, schedule := range settings.Schedule {
		if schedule.Enabled {
			if schedule.Start == "" || schedule.End == "" {
				return utils.NewValidationError("start and end times required for " + day)
			}
			// TODO: add time format validation
		}
	}

	return nil
}
