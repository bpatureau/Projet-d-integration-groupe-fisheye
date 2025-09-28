package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"fisheye/internal/middleware"
	"fisheye/internal/store"
	"fisheye/internal/utils"
)

type SettingsHandler struct {
	settingsStore store.SettingsStore
	logger        *utils.Logger
}

func NewSettingsHandler(settingsStore store.SettingsStore, logger *utils.Logger) *SettingsHandler {
	return &SettingsHandler{
		settingsStore: settingsStore,
		logger:        logger,
	}
}

func (h *SettingsHandler) HandleGetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.settingsStore.GetSettings()
	if err != nil {
		h.logger.Error("settings", "Failed to get settings", err)
		utils.WriteInternalError(w)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, settings)
}

func (h *SettingsHandler) HandleUpdateSettings(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)

	var settings store.Settings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	current, err := h.settingsStore.GetSettings()
	if err != nil {
		h.logger.Error("settings", "Failed to get current settings", err)
		utils.WriteInternalError(w)
		return
	}

	settings.ID = current.ID
	settings.CreatedAt = current.CreatedAt

	// Valider les données
	if err := h.validateSettings(&settings); err != nil {
		utils.WriteValidationError(w, err.Error())
		return
	}

	if err := h.settingsStore.UpdateSettings(&settings); err != nil {
		h.logger.Error("settings", "Failed to update settings", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("settings", "Settings updated by admin: "+admin.Username)
	utils.WriteSuccess(w, http.StatusOK, settings)
}

func (h *SettingsHandler) HandleToggleDND(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)

	var req struct {
		Enabled bool `json:"enabled"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	if err := h.settingsStore.UpdateDND(req.Enabled); err != nil {
		h.logger.Error("settings", "Failed to update DND", err)
		utils.WriteInternalError(w)
		return
	}

	status := "disabled"
	if req.Enabled {
		status = "enabled"
	}

	h.logger.Info("settings", "DND "+status+" by admin: "+admin.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]interface{}{
		"message": "DND " + status,
		"dnd":     req.Enabled,
	})
}

func (h *SettingsHandler) HandleUpdateSchedule(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)

	var schedule store.Schedule
	if err := json.NewDecoder(r.Body).Decode(&schedule); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	// Valider les horaires
	if err := h.validateSchedule(&schedule); err != nil {
		utils.WriteValidationError(w, err.Error())
		return
	}

	if err := h.settingsStore.UpdateSchedule(&schedule); err != nil {
		h.logger.Error("settings", "Failed to update schedule", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("settings", "Schedule updated by admin: "+admin.Username)
	utils.WriteSuccess(w, http.StatusOK, schedule)
}

func (h *SettingsHandler) HandleUpdateMOTD(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)

	var motd store.MOTD
	if err := json.NewDecoder(r.Body).Decode(&motd); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	// Valider le MOTD
	if err := h.validateMOTD(&motd); err != nil {
		utils.WriteValidationError(w, err.Error())
		return
	}

	if err := h.settingsStore.UpdateMOTD(&motd); err != nil {
		h.logger.Error("settings", "Failed to update MOTD", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("settings", "MOTD updated by admin: "+admin.Username)
	utils.WriteSuccess(w, http.StatusOK, motd)
}

func (h *SettingsHandler) validateSettings(settings *store.Settings) error {
	if settings.Name == "" {
		return fmt.Errorf("name cannot be empty")
	}

	if len(settings.Name) > 100 {
		return fmt.Errorf("name cannot exceed 100 characters")
	}

	if settings.MOTD != nil {
		if err := h.validateMOTD(settings.MOTD); err != nil {
			return err
		}
	}

	if settings.Schedule != nil {
		if err := h.validateSchedule(settings.Schedule); err != nil {
			return err
		}
	}

	return nil
}

func (h *SettingsHandler) validateMOTD(motd *store.MOTD) error {
	if motd.Enabled {
		if len(motd.Messages) == 0 {
			return fmt.Errorf("at least one message is required when MOTD is enabled")
		}

		for i, message := range motd.Messages {
			if message.Text == "" {
				return fmt.Errorf("message %d cannot be empty", i+1)
			}
			if len(message.Text) > 500 {
				return fmt.Errorf("message %d cannot exceed 500 characters", i+1)
			}
		}
	}

	if motd.CooldownSeconds < 1 {
		return fmt.Errorf("cooldown must be at least 1 second")
	}

	if motd.CooldownSeconds > 3600 {
		return fmt.Errorf("cooldown cannot exceed 3600 seconds (1 hour)")
	}

	return nil
}

func (h *SettingsHandler) validateSchedule(schedule *store.Schedule) error {
	days := []*store.DaySchedule{
		schedule.Monday,
		schedule.Tuesday,
		schedule.Wednesday,
		schedule.Thursday,
		schedule.Friday,
		schedule.Saturday,
		schedule.Sunday,
	}

	for i, day := range days {
		if day != nil && day.Enabled {
			if day.Start == "" || day.End == "" {
				return fmt.Errorf("start and end times are required when day is enabled")
			}

			// Valider le format HH:MM
			if !h.isValidTimeFormat(day.Start) || !h.isValidTimeFormat(day.End) {
				return fmt.Errorf("invalid time format for day %d. Use HH:MM", i+1)
			}

			// Vérifier que l'heure de fin est après l'heure de début
			if !h.isEndAfterStart(day.Start, day.End) {
				return fmt.Errorf("end time must be after start time for day %d", i+1)
			}
		}
	}

	return nil
}

func (h *SettingsHandler) isValidTimeFormat(time string) bool {
	if len(time) != 5 {
		return false
	}

	if time[2] != ':' {
		return false
	}

	hour := time[:2]
	minute := time[3:]

	hourInt, err := strconv.Atoi(hour)
	if err != nil || hourInt < 0 || hourInt > 23 {
		return false
	}

	minuteInt, err := strconv.Atoi(minute)
	if err != nil || minuteInt < 0 || minuteInt > 59 {
		return false
	}

	return true
}

func (h *SettingsHandler) isEndAfterStart(start, end string) bool {
	startHour, _ := strconv.Atoi(start[:2])
	startMin, _ := strconv.Atoi(start[3:])
	endHour, _ := strconv.Atoi(end[:2])
	endMin, _ := strconv.Atoi(end[3:])

	if endHour < startHour {
		return false
	}

	if endHour == startHour && endMin <= startMin {
		return false
	}

	return true
}
