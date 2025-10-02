package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"fisheye/internal/middleware"
	"fisheye/internal/store"
	"fisheye/internal/utils"
)

type DeviceHandler struct {
	visitStore    store.VisitStore
	settingsStore store.SettingsStore
	uploadPath    string
	logger        *utils.Logger
}

func NewDeviceHandler(visitStore store.VisitStore, settingsStore store.SettingsStore, logger *utils.Logger) *DeviceHandler {
	uploadPath := os.Getenv("UPLOAD_PATH")
	if uploadPath == "" {
		uploadPath = "./uploads"
	}

	absPath, _ := filepath.Abs(uploadPath)
	os.MkdirAll(absPath, 0755)

	return &DeviceHandler{
		visitStore:    visitStore,
		settingsStore: settingsStore,
		uploadPath:    absPath,
		logger:        logger,
	}
}

// POST /api/device/ring - Someone rings the doorbell
func (h *DeviceHandler) Ring(w http.ResponseWriter, r *http.Request) {
	if !middleware.IsDevice(r) {
		utils.WriteForbidden(w, "Device authentication required")
		return
	}

	ctx := r.Context()

	var req struct {
		Type string `json:"type"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Type = "doorbell" // Default
	}

	if req.Type != "doorbell" && req.Type != "motion" {
		req.Type = "doorbell"
	}

	visit := &store.Visit{
		Type:   req.Type,
		Status: "pending",
	}

	if err := h.visitStore.Create(ctx, visit); err != nil {
		h.logger.Error("device", "Failed to create visit", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("device", fmt.Sprintf("Visit recorded: %s (%s)", visit.ID.String(), visit.Type))
	utils.WriteSuccess(w, http.StatusCreated, visit)
}

// POST /api/device/visits/message - Add voice or text message to latest visit
func (h *DeviceHandler) AddMessage(w http.ResponseWriter, r *http.Request) {
	if !middleware.IsDevice(r) {
		utils.WriteForbidden(w, "Device authentication required")
		return
	}

	ctx := r.Context()

	// Get the latest pending visit
	visit, err := h.visitStore.GetLatestPending(ctx)
	if err != nil {
		h.logger.Error("device", "Failed to get latest pending visit", err)
		utils.WriteInternalError(w)
		return
	}

	if visit == nil {
		// Create new visit if no pending visit
		visit = &store.Visit{
			Type:   "doorbell",
			Status: "pending",
		}

		if err := h.visitStore.Create(ctx, visit); err != nil {
			h.logger.Error("device", "Failed to create new visit", err)
			utils.WriteInternalError(w)
			return
		}
		h.logger.Info("device", "Created new visit for message: "+visit.ID.String())
	} else if visit.HasMessage {
		// If visit already has a message, create new visit
		newVisit := &store.Visit{
			Type:   "doorbell",
			Status: "pending",
		}

		if err := h.visitStore.Create(ctx, newVisit); err != nil {
			h.logger.Error("device", "Failed to create new visit", err)
			utils.WriteInternalError(w)
			return
		}

		visit = newVisit
		h.logger.Info("device", "Created new visit for additional message: "+visit.ID.String())
	}

	var req struct {
		Type     string `json:"type"`
		Text     string `json:"text"`
		Filepath string `json:"filepath"`
		Size     int64  `json:"size"`
		Duration int    `json:"duration"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	// Validate request
	if req.Type != "voice" && req.Type != "text" {
		utils.WriteValidationError(w, "Invalid message type. Must be 'voice' or 'text'")
		return
	}

	// Handle based on message type
	if req.Type == "voice" {
		if req.Filepath == "" {
			utils.WriteValidationError(w, "Filepath is required for voice messages")
			return
		}
		if req.Size <= 0 {
			utils.WriteValidationError(w, "Size must be positive for voice messages")
			return
		}
		if req.Duration <= 0 {
			utils.WriteValidationError(w, "Duration must be positive for voice messages")
			return
		}

		if err := h.visitStore.AddVoiceMessage(ctx, visit.ID, req.Filepath, req.Size, req.Duration); err != nil {
			h.logger.Error("device", "Failed to save voice message info", err)
			utils.WriteInternalError(w)
			return
		}

		h.logger.Info("device", fmt.Sprintf("Voice message added to visit: %s (size: %d bytes, duration: %ds)",
			visit.ID.String(), req.Size, req.Duration))

	} else { // text message
		if req.Text == "" {
			utils.WriteValidationError(w, "Text is required for text messages")
			return
		}
		if len(req.Text) > 5000 {
			utils.WriteValidationError(w, "Text message too long (max 5000 characters)")
			return
		}

		if err := h.visitStore.AddTextMessage(ctx, visit.ID, req.Text); err != nil {
			h.logger.Error("device", "Failed to save text message", err)
			utils.WriteInternalError(w)
			return
		}

		h.logger.Info("device", fmt.Sprintf("Text message added to visit: %s (%d chars)",
			visit.ID.String(), len(req.Text)))
	}

	// Return updated visit
	visit, _ = h.visitStore.GetByID(ctx, visit.ID)
	utils.WriteSuccess(w, http.StatusOK, visit)
}

// POST /api/device/visits/answer - Mark latest visit as answered
func (h *DeviceHandler) AnswerVisit(w http.ResponseWriter, r *http.Request) {
	if !middleware.IsDevice(r) {
		utils.WriteForbidden(w, "Device authentication required")
		return
	}

	ctx := r.Context()

	visit, err := h.visitStore.GetLatestPending(ctx)
	if err != nil {
		h.logger.Error("device", "Failed to get latest pending visit", err)
		utils.WriteInternalError(w)
		return
	}

	if visit == nil {
		utils.WriteNotFound(w, "No pending visit found")
		return
	}

	// Vérifier que la visite a moins de 5 minutes
	fiveMinutesAgo := time.Now().Add(-5 * time.Minute)
	if visit.CreatedAt.Before(fiveMinutesAgo) {
		h.logger.Warning("device", fmt.Sprintf("Visit %s is too old to answer (created at %s)",
			visit.ID.String(), visit.CreatedAt.Format(time.RFC3339)))
		utils.WriteValidationError(w, "Visit is too old to answer (more than 5 minutes)")
		return
	}

	// Marquer comme répondu
	if err := h.visitStore.MarkAnswered(ctx, visit.ID); err != nil {
		h.logger.Error("device", "Failed to mark visit as answered", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("device", "Latest visit marked as answered: "+visit.ID.String())
	utils.WriteSuccess(w, http.StatusOK, map[string]string{
		"message":  "Latest visit marked as answered",
		"visit_id": visit.ID.String(),
	})
}

// GET /api/device/settings - Get current settings for display
func (h *DeviceHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	if !middleware.IsDevice(r) {
		utils.WriteForbidden(w, "Device authentication required")
		return
	}

	ctx := r.Context()
	settings, err := h.settingsStore.Get(ctx)
	if err != nil {
		h.logger.Error("device", "Failed to get settings", err)
		utils.WriteInternalError(w)
		return
	}

	// Return only relevant fields for device display
	deviceSettings := map[string]any{
		"device_name":      settings.DeviceName,
		"do_not_disturb":   settings.DoNotDisturb,
		"welcome_messages": settings.WelcomeMessages,
		"rotation_seconds": settings.MessageRotationSeconds,
		"schedule":         h.getCurrentSchedule(settings.Schedule),
	}

	utils.WriteSuccess(w, http.StatusOK, deviceSettings)
}

func (h *DeviceHandler) getCurrentSchedule(schedule map[string]store.DaySchedule) *store.DaySchedule {
	days := []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"}
	today := days[time.Now().Weekday()]

	if daySchedule, ok := schedule[today]; ok {
		return &daySchedule
	}

	return &store.DaySchedule{Enabled: false}
}
