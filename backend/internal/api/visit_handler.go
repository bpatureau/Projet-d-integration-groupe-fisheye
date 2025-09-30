package api

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"

	"fisheye/internal/middleware"
	"fisheye/internal/store"
	"fisheye/internal/utils"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type VisitHandler struct {
	visitStore store.VisitStore
	logger     *utils.Logger
}

func NewVisitHandler(visitStore store.VisitStore, logger *utils.Logger) *VisitHandler {
	return &VisitHandler{
		visitStore: visitStore,
		logger:     logger,
	}
}

// GET /api/visits - List all visits with filters
func (h *VisitHandler) List(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	filter := store.ListFilter{
		Limit:  20,
		Offset: 0,
	}

	// Parse query parameters
	if limit := r.URL.Query().Get("limit"); limit != "" {
		if l, err := strconv.Atoi(limit); err == nil && l > 0 && l <= 100 {
			filter.Limit = l
		}
	}

	if offset := r.URL.Query().Get("offset"); offset != "" {
		if o, err := strconv.Atoi(offset); err == nil && o >= 0 {
			filter.Offset = o
		}
	}

	filter.Status = r.URL.Query().Get("status")

	if hasMessage := r.URL.Query().Get("has_message"); hasMessage != "" {
		if b, err := strconv.ParseBool(hasMessage); err == nil {
			filter.HasMessage = &b
		}
	}

	// Parse date filters
	if startDate := r.URL.Query().Get("start_date"); startDate != "" {
		if sd, err := time.Parse("2006-01-02", startDate); err == nil {
			filter.StartDate = &sd
		}
	}

	if endDate := r.URL.Query().Get("end_date"); endDate != "" {
		if ed, err := time.Parse("2006-01-02", endDate); err == nil {
			endOfDay := ed.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
			filter.EndDate = &endOfDay
		}
	}

	visits, total, err := h.visitStore.List(ctx, filter)
	if err != nil {
		h.logger.Error("visits", "Failed to list visits", err)
		utils.WriteInternalError(w)
		return
	}

	utils.WriteSuccessWithMeta(w, http.StatusOK, visits, utils.PaginationMeta{
		Limit:  filter.Limit,
		Offset: filter.Offset,
		Total:  total,
	})
}

// GET /api/visits/:id - Get single visit
func (h *VisitHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.WriteValidationError(w, "Invalid visit ID")
		return
	}

	visit, err := h.visitStore.GetByID(ctx, id)
	if err != nil {
		h.logger.Error("visits", "Failed to get visit", err)
		utils.WriteInternalError(w)
		return
	}

	if visit == nil {
		utils.WriteNotFound(w, "Visit not found")
		return
	}

	utils.WriteSuccess(w, http.StatusOK, visit)
}

// PATCH /api/visits/:id - Update visit (status, mark message as listened)
func (h *VisitHandler) Update(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := middleware.GetUser(r)

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.WriteValidationError(w, "Invalid visit ID")
		return
	}

	var req struct {
		Status          *string `json:"status,omitempty"`
		MessageListened *bool   `json:"message_listened,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	visit, err := h.visitStore.GetByID(ctx, id)
	if err != nil {
		h.logger.Error("visits", "Failed to get visit", err)
		utils.WriteInternalError(w)
		return
	}

	if visit == nil {
		utils.WriteNotFound(w, "Visit not found")
		return
	}

	updated := false

	// Update status
	if req.Status != nil {
		validStatuses := map[string]bool{
			"pending":  true,
			"answered": true,
			"missed":   true,
			"ignored":  true,
		}

		if !validStatuses[*req.Status] {
			utils.WriteValidationError(w, "Invalid status")
			return
		}

		if visit.Status != *req.Status {
			visit.Status = *req.Status
			updated = true

			// If marking as answered, update timestamp
			if *req.Status == "answered" {
				if err := h.visitStore.MarkAnswered(ctx, id); err != nil {
					h.logger.Error("visits", "Failed to mark as answered", err)
					utils.WriteInternalError(w)
					return
				}
				// Re-fetch to get updated timestamps
				visit, _ = h.visitStore.GetByID(ctx, id)
			}
		}
	}

	// Mark message as listened
	if req.MessageListened != nil && *req.MessageListened && visit.HasMessage && !visit.MessageListened {
		if err := h.visitStore.MarkMessageListened(ctx, id); err != nil {
			h.logger.Error("visits", "Failed to mark message as listened", err)
			utils.WriteInternalError(w)
			return
		}
		updated = true
		// Re-fetch to get updated fields
		visit, _ = h.visitStore.GetByID(ctx, id)
	}

	if updated {
		if req.Status == nil || *req.Status != "answered" {
			// Only update if we didn't already update via MarkAnswered
			if err := h.visitStore.Update(ctx, visit); err != nil {
				h.logger.Error("visits", "Failed to update visit", err)
				utils.WriteInternalError(w)
				return
			}
		}

		h.logger.Info("visits", "Visit updated by user: "+user.Username)
	}

	utils.WriteSuccess(w, http.StatusOK, visit)
}

// DELETE /api/visits/:id - Delete visit (admin only)
func (h *VisitHandler) Delete(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := middleware.GetUser(r)

	if !user.IsAdmin() {
		utils.WriteForbidden(w, "Admin access required")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.WriteValidationError(w, "Invalid visit ID")
		return
	}

	// Get visit to delete associated file if exists
	visit, err := h.visitStore.GetByID(ctx, id)
	if err != nil {
		h.logger.Error("visits", "Failed to get visit", err)
		utils.WriteInternalError(w)
		return
	}

	if visit == nil {
		utils.WriteNotFound(w, "Visit not found")
		return
	}

	// Delete visit
	if err := h.visitStore.Delete(ctx, id); err != nil {
		h.logger.Error("visits", "Failed to delete visit", err)
		utils.WriteInternalError(w)
		return
	}

	// Delete associated file if exists
	if visit.MessageFilepath != nil && *visit.MessageFilepath != "" {
		if err := os.Remove(*visit.MessageFilepath); err != nil {
			h.logger.Warning("visits", "Failed to delete message file: "+err.Error())
		}
	}

	h.logger.Info("visits", "Visit deleted by admin: "+user.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]string{
		"message": "Visit deleted successfully",
	})
}

// GET /api/visits/:id/message - Download voice message
func (h *VisitHandler) DownloadMessage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.WriteValidationError(w, "Invalid visit ID")
		return
	}

	visit, err := h.visitStore.GetByID(ctx, id)
	if err != nil {
		h.logger.Error("visits", "Failed to get visit", err)
		utils.WriteInternalError(w)
		return
	}

	if visit == nil {
		utils.WriteNotFound(w, "Visit not found")
		return
	}

	if !visit.HasMessage || visit.MessageFilepath == nil {
		utils.WriteNotFound(w, "No message available for this visit")
		return
	}

	file, err := os.Open(*visit.MessageFilepath)
	if err != nil {
		h.logger.Error("visits", "Failed to open message file", err)
		utils.WriteNotFound(w, "Message file not found")
		return
	}
	defer file.Close()

	// Set headers for download
	w.Header().Set("Content-Type", "audio/mpeg")
	if visit.MessageFilename != nil {
		w.Header().Set("Content-Disposition", `attachment; filename="`+*visit.MessageFilename+`"`)
	}

	io.Copy(w, file)
}

// GET /api/visits/stats - Get visit statistics
func (h *VisitHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	stats, err := h.visitStore.GetStatistics(ctx)
	if err != nil {
		h.logger.Error("visits", "Failed to get statistics", err)
		utils.WriteInternalError(w)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, stats)
}
