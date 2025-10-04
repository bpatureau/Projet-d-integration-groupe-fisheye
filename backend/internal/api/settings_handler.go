package api

import (
	"encoding/json"
	"net/http"

	"fisheye/internal/middleware"
	"fisheye/internal/store"
	"fisheye/internal/utils"
	"fisheye/internal/websocket"
)

type SettingsHandler struct {
	settingsStore store.SettingsStore
	wsHub         *websocket.Hub
	logger        *utils.Logger
}

func NewSettingsHandler(settingsStore store.SettingsStore, wsHub *websocket.Hub, logger *utils.Logger) *SettingsHandler {
	return &SettingsHandler{
		settingsStore: settingsStore,
		wsHub:         wsHub,
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
	}

	// Broadcast to devices via WebSocket
	if h.wsHub != nil {
		h.wsHub.BroadcastToDevices(&websocket.Message{
			Type: "settings_update",
			Data: deviceSettings,
		})
	}

	h.logger.Info("settings", "Settings updated by admin: "+admin.Username)
	utils.WriteSuccess(w, http.StatusOK, settings)
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

	return nil
}
