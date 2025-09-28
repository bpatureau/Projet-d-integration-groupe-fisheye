package api

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"fisheye/internal/middleware"
	"fisheye/internal/store"
	"fisheye/internal/utils"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type VoiceMessageHandler struct {
	voiceMessageStore store.VoiceMessageStore
	uploadPath        string
	logger            *utils.Logger
}

func NewVoiceMessageHandler(voiceMessageStore store.VoiceMessageStore, logger *utils.Logger) *VoiceMessageHandler {
	uploadPath := os.Getenv("UPLOAD_PATH")
	if uploadPath == "" {
		uploadPath = "./uploads/voice_messages"
	}

	// Créer le dossier s'il n'existe pas
	os.MkdirAll(uploadPath, 0755)

	return &VoiceMessageHandler{
		voiceMessageStore: voiceMessageStore,
		uploadPath:        uploadPath,
		logger:            logger,
	}
}

func (h *VoiceMessageHandler) ListVoiceMessages(w http.ResponseWriter, r *http.Request) {
	// Pagination
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 20 // Par défaut
	offset := 0

	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	if offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	// Filtres
	var visitID *uuid.UUID
	if visitIDStr := r.URL.Query().Get("visit_id"); visitIDStr != "" {
		if id, err := uuid.Parse(visitIDStr); err == nil {
			visitID = &id
		}
	}

	var isListened *bool
	if isListenedStr := r.URL.Query().Get("is_listened"); isListenedStr != "" {
		if listened, err := strconv.ParseBool(isListenedStr); err == nil {
			isListened = &listened
		}
	}

	var startDate, endDate *time.Time

	if startDateStr := r.URL.Query().Get("start_date"); startDateStr != "" {
		if sd, err := time.Parse("2006-01-02", startDateStr); err == nil {
			startDate = &sd
		}
	}

	if endDateStr := r.URL.Query().Get("end_date"); endDateStr != "" {
		if ed, err := time.Parse("2006-01-02", endDateStr); err == nil {
			endOfDay := ed.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
			endDate = &endOfDay
		}
	}

	messages, total, err := h.voiceMessageStore.ListVoiceMessages(limit, offset, visitID, isListened, startDate, endDate)
	if err != nil {
		h.logger.Error("voice_messages", "Failed to list voice messages", err)
		utils.WriteInternalError(w)
		return
	}

	meta := utils.PaginationMeta{
		Limit:  limit,
		Offset: offset,
		Total:  total,
	}

	utils.WriteSuccessWithMeta(w, http.StatusOK, messages, meta)
}

func (h *VoiceMessageHandler) ListByVisit(w http.ResponseWriter, r *http.Request) {
	visitID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.WriteValidationError(w, "Invalid visit ID")
		return
	}

	messages, _, err := h.voiceMessageStore.ListVoiceMessages(100, 0, &visitID, nil, nil, nil)
	if err != nil {
		h.logger.Error("voice_messages", "Failed to get messages", err)
		utils.WriteInternalError(w)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, messages)
}

func (h *VoiceMessageHandler) Upload(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	isDevice := middleware.IsDevice(r)

	visitID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.WriteValidationError(w, "Invalid visit ID")
		return
	}

	// Limiter la taille du fichier (10MB max)
	r.ParseMultipartForm(10 << 20)

	file, handler, err := r.FormFile("audio")
	if err != nil {
		utils.WriteValidationError(w, "Failed to get audio file")
		return
	}
	defer file.Close()

	// Valider le type de fichier
	contentType := handler.Header.Get("Content-Type")
	if !isValidAudioType(contentType) {
		utils.WriteValidationError(w, "Invalid audio format. Supported: mp3, wav, m4a, webm")
		return
	}

	duration, _ := strconv.ParseInt(r.FormValue("duration"), 10, 64)

	// Générer un nom unique pour le fichier
	fileExt := filepath.Ext(handler.Filename)
	fileName := fmt.Sprintf("%s_%d%s", uuid.New().String(), time.Now().Unix(), fileExt)
	filePath := filepath.Join(h.uploadPath, fileName)

	dst, err := os.Create(filePath)
	if err != nil {
		h.logger.Error("voice_messages", "Failed to create file", err)
		utils.WriteInternalError(w)
		return
	}
	defer dst.Close()

	// Copier le contenu
	fileSize, err := io.Copy(dst, file)
	if err != nil {
		h.logger.Error("voice_messages", "Failed to save file", err)
		utils.WriteInternalError(w)
		return
	}

	voiceMessage := &store.VoiceMessage{
		VisitID:  visitID,
		Filename: fileName,
		FilePath: filePath,
		FileSize: fileSize,
		Duration: duration,
	}

	if err := h.voiceMessageStore.CreateVoiceMessage(voiceMessage); err != nil {
		os.Remove(filePath)
		h.logger.Error("voice_messages", "Failed to save voice message", err)
		utils.WriteInternalError(w)
		return
	}

	if isDevice {
		h.logger.Info("voice_messages", "Voice message uploaded by device")
	} else {
		h.logger.Info("voice_messages", "Voice message uploaded by "+user.Username)
	}

	utils.WriteSuccess(w, http.StatusCreated, voiceMessage)
}

func (h *VoiceMessageHandler) Download(w http.ResponseWriter, r *http.Request) {
	messageID, err := uuid.Parse(chi.URLParam(r, "messageId"))
	if err != nil {
		utils.WriteValidationError(w, "Invalid message ID")
		return
	}

	message, err := h.voiceMessageStore.GetVoiceMessageByID(messageID)
	if err != nil {
		h.logger.Error("voice_messages", "Failed to get message", err)
		utils.WriteInternalError(w)
		return
	}

	if message == nil {
		utils.WriteNotFound(w, "Voice message not found")
		return
	}

	// Vérifier que le fichier existe
	if _, err := os.Stat(message.FilePath); os.IsNotExist(err) {
		h.logger.Error("voice_messages", "File not found: "+message.FilePath, err)
		utils.WriteNotFound(w, "Audio file not found")
		return
	}

	// Ouvrir le fichier
	file, err := os.Open(message.FilePath)
	if err != nil {
		h.logger.Error("voice_messages", "Failed to open file", err)
		utils.WriteInternalError(w)
		return
	}
	defer file.Close()

	contentType := getContentType(message.Filename)

	// Headers pour le téléchargement
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", message.Filename))
	w.Header().Set("Content-Length", strconv.FormatInt(message.FileSize, 10))

	// Streamer le fichier
	io.Copy(w, file)
}

func (h *VoiceMessageHandler) MarkAsListened(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)

	messageID, err := uuid.Parse(chi.URLParam(r, "messageId"))
	if err != nil {
		utils.WriteValidationError(w, "Invalid message ID")
		return
	}

	message, err := h.voiceMessageStore.GetVoiceMessageByID(messageID)
	if err != nil {
		h.logger.Error("voice_messages", "Failed to get message", err)
		utils.WriteInternalError(w)
		return
	}

	if message == nil {
		utils.WriteNotFound(w, "Voice message not found")
		return
	}

	if message.IsListened {
		utils.WriteValidationError(w, "Message already marked as listened")
		return
	}

	if err := h.voiceMessageStore.MarkAsListened(messageID); err != nil {
		h.logger.Error("voice_messages", "Failed to mark as listened", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("voice_messages", "Message marked as listened by "+user.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]string{
		"message": "Message marked as listened",
	})
}

func (h *VoiceMessageHandler) DeleteVoiceMessage(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)

	messageID, err := uuid.Parse(chi.URLParam(r, "messageId"))
	if err != nil {
		utils.WriteValidationError(w, "Invalid message ID")
		return
	}

	message, err := h.voiceMessageStore.GetVoiceMessageByID(messageID)
	if err != nil {
		h.logger.Error("voice_messages", "Failed to get message", err)
		utils.WriteInternalError(w)
		return
	}

	if message == nil {
		utils.WriteNotFound(w, "Voice message not found")
		return
	}

	// Supprimer l'enregistrement de la base
	if err := h.voiceMessageStore.DeleteVoiceMessage(messageID); err != nil {
		h.logger.Error("voice_messages", "Failed to delete voice message", err)
		utils.WriteInternalError(w)
		return
	}

	// Supprimer le fichier physique
	if err := os.Remove(message.FilePath); err != nil {
		h.logger.Error("voice_messages", "Failed to delete file: "+message.FilePath, err)
	}

	h.logger.Info("voice_messages", "Voice message deleted by "+user.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]string{
		"message": "Voice message deleted successfully",
	})
}

func (h *VoiceMessageHandler) GetUnlistenedCount(w http.ResponseWriter, r *http.Request) {
	count, err := h.voiceMessageStore.CountUnlistenedMessages()
	if err != nil {
		h.logger.Error("voice_messages", "Failed to count unlistened messages", err)
		utils.WriteInternalError(w)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, map[string]int{
		"unlistened_count": count,
	})
}

func isValidAudioType(contentType string) bool {
	validTypes := map[string]bool{
		"audio/mpeg":  true, // MP3
		"audio/mp3":   true,
		"audio/wav":   true,
		"audio/wave":  true,
		"audio/x-wav": true,
		"audio/mp4":   true, // M4A
		"audio/x-m4a": true,
		"audio/webm":  true,
		"audio/ogg":   true,
	}
	return validTypes[contentType]
}

func getContentType(filename string) string {
	ext := filepath.Ext(filename)
	switch ext {
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	case ".m4a":
		return "audio/mp4"
	case ".webm":
		return "audio/webm"
	case ".ogg":
		return "audio/ogg"
	default:
		return "application/octet-stream"
	}
}
