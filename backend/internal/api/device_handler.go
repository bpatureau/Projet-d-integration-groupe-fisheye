package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"fisheye/internal/middleware"
	"fisheye/internal/store"
	"fisheye/internal/utils"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
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

// POST /api/device/visits/:id/message - Add voice message to visit
func (h *DeviceHandler) AddMessage(w http.ResponseWriter, r *http.Request) {
	if !middleware.IsDevice(r) {
		utils.WriteForbidden(w, "Device authentication required")
		return
	}

	ctx := r.Context()
	visitID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.WriteValidationError(w, "Invalid visit ID")
		return
	}

	// Check visit exists and has no message yet
	visit, err := h.visitStore.GetByID(ctx, visitID)
	if err != nil {
		h.logger.Error("device", "Failed to get visit", err)
		utils.WriteInternalError(w)
		return
	}

	if visit == nil {
		utils.WriteNotFound(w, "Visit not found")
		return
	}

	if visit.HasMessage {
		// Create new visit for new message
		newVisit := &store.Visit{
			Type:   "doorbell",
			Status: "pending",
		}

		if err := h.visitStore.Create(ctx, newVisit); err != nil {
			h.logger.Error("device", "Failed to create new visit", err)
			utils.WriteInternalError(w)
			return
		}

		visitID = newVisit.ID
		visit = newVisit
		h.logger.Info("device", "Created new visit for additional message: "+visitID.String())
	}

	// Handle file upload
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20) // 10MB max

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		utils.WriteValidationError(w, "File too large or invalid form data")
		return
	}

	file, handler, err := r.FormFile("audio")
	if err != nil {
		utils.WriteValidationError(w, "Failed to get audio file")
		return
	}
	defer file.Close()

	// Validate file type
	contentType := handler.Header.Get("Content-Type")
	if !isValidAudioType(contentType) {
		utils.WriteValidationError(w, "Invalid audio format. Supported: mp3, wav, m4a, webm, ogg")
		return
	}

	// Generate unique filename
	ext := filepath.Ext(handler.Filename)
	if ext == "" {
		ext = ".mp3"
	}
	filename := fmt.Sprintf("%s_%d%s", uuid.New().String(), time.Now().Unix(), ext)
	fullPath := filepath.Join(h.uploadPath, filename)

	// Save file
	dst, err := os.Create(fullPath)
	if err != nil {
		h.logger.Error("device", "Failed to create file", err)
		utils.WriteInternalError(w)
		return
	}
	defer dst.Close()

	size, err := io.Copy(dst, file)
	if err != nil {
		os.Remove(fullPath)
		h.logger.Error("device", "Failed to save file", err)
		utils.WriteInternalError(w)
		return
	}

	// Parse duration from form
	duration := 0
	if d := r.FormValue("duration"); d != "" {
		fmt.Sscanf(d, "%d", &duration)
	}

	// Update visit with message info
	if err := h.visitStore.AddMessage(ctx, visitID, filename, fullPath, size, duration); err != nil {
		os.Remove(fullPath)
		h.logger.Error("device", "Failed to save message info", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("device", fmt.Sprintf("Voice message added to visit: %s (size: %d bytes)", visitID.String(), size))

	// Return updated visit
	visit, _ = h.visitStore.GetByID(ctx, visitID)
	utils.WriteSuccess(w, http.StatusOK, visit)
}

// POST /api/device/visits/:id/answer - Mark visit as answered
func (h *DeviceHandler) AnswerVisit(w http.ResponseWriter, r *http.Request) {
	if !middleware.IsDevice(r) {
		utils.WriteForbidden(w, "Device authentication required")
		return
	}

	ctx := r.Context()
	visitID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.WriteValidationError(w, "Invalid visit ID")
		return
	}

	if err := h.visitStore.MarkAnswered(ctx, visitID); err != nil {
		h.logger.Error("device", "Failed to mark visit as answered", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("device", "Visit marked as answered: "+visitID.String())
	utils.WriteSuccess(w, http.StatusOK, map[string]string{
		"message": "Visit marked as answered",
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

func isValidAudioType(contentType string) bool {
	validTypes := map[string]bool{
		"audio/mpeg":  true,
		"audio/mp3":   true,
		"audio/wav":   true,
		"audio/wave":  true,
		"audio/x-wav": true,
		"audio/mp4":   true,
		"audio/x-m4a": true,
		"audio/webm":  true,
		"audio/ogg":   true,
	}
	return validTypes[contentType]
}
