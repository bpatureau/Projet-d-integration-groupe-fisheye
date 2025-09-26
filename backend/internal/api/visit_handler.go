package api

import (
	"encoding/json"
	"net/http"
	"strconv"

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

type CreateVisitRequest struct {
	Type string `json:"type"`
}

type UpdateVisitStatusRequest struct {
	Status string `json:"status"`
}

func (h *VisitHandler) HandleCreateVisit(w http.ResponseWriter, r *http.Request) {
	var req CreateVisitRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.Error("visits", "Invalid create visit request", err)
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	// Valider le type de visite
	if err := utils.ValidateVisitType(req.Type); err != nil {
		utils.WriteValidationError(w, err.Error())
		return
	}

	visit := &store.Visit{
		Type:   req.Type,
		Status: "unanswered",
	}

	if err := h.visitStore.CreateVisit(visit); err != nil {
		h.logger.Error("visits", "Failed to create visit", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("visits", "New visit created: "+visit.ID.String())
	utils.WriteSuccess(w, http.StatusCreated, visit)
}

func (h *VisitHandler) HandleGetVisit(w http.ResponseWriter, r *http.Request) {
	idParam := chi.URLParam(r, "id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		utils.WriteValidationError(w, "Invalid visit ID")
		return
	}

	visit, err := h.visitStore.GetVisitByID(id)
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

func (h *VisitHandler) HandleListVisits(w http.ResponseWriter, r *http.Request) {
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

	visits, total, err := h.visitStore.ListVisits(limit, offset)
	if err != nil {
		h.logger.Error("visits", "Failed to list visits", err)
		utils.WriteInternalError(w)
		return
	}

	meta := utils.PaginationMeta{
		Limit:  limit,
		Offset: offset,
		Total:  total,
	}

	utils.WriteSuccessWithMeta(w, http.StatusOK, visits, meta)
}

func (h *VisitHandler) HandleUpdateVisitStatus(w http.ResponseWriter, r *http.Request) {
	idParam := chi.URLParam(r, "id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		utils.WriteValidationError(w, "Invalid visit ID")
		return
	}

	var req UpdateVisitStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.Error("visits", "Invalid update status request", err)
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	// Valider le statut
	if err := utils.ValidateVisitStatus(req.Status); err != nil {
		utils.WriteValidationError(w, err.Error())
		return
	}

	// Vérifier que la visite existe
	visit, err := h.visitStore.GetVisitByID(id)
	if err != nil {
		h.logger.Error("visits", "Failed to get visit", err)
		utils.WriteInternalError(w)
		return
	}

	if visit == nil {
		utils.WriteNotFound(w, "Visit not found")
		return
	}

	// Mettre à jour le statut
	if err := h.visitStore.UpdateVisitStatus(id, req.Status); err != nil {
		h.logger.Error("visits", "Failed to update visit status", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("visits", "Visit status updated: "+id.String()+" to "+req.Status)
	utils.WriteSuccess(w, http.StatusOK, map[string]string{"message": "Status updated successfully"})
}

func (h *VisitHandler) HandleRespondToVisit(w http.ResponseWriter, r *http.Request) {
	idParam := chi.URLParam(r, "id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		utils.WriteValidationError(w, "Invalid visit ID")
		return
	}

	// Vérifier que la visite existe
	visit, err := h.visitStore.GetVisitByID(id)
	if err != nil {
		h.logger.Error("visits", "Failed to get visit", err)
		utils.WriteInternalError(w)
		return
	}

	if visit == nil {
		utils.WriteNotFound(w, "Visit not found")
		return
	}

	// Marquer comme répondu
	if err := h.visitStore.MarkAsResponded(id); err != nil {
		h.logger.Error("visits", "Failed to mark visit as responded", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("visits", "Visit marked as responded: "+id.String())
	utils.WriteSuccess(w, http.StatusOK, map[string]string{"message": "Visit marked as responded"})
}

func (h *VisitHandler) HandleGetRecentVisits(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 10 // Par défaut

	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 50 {
			limit = l
		}
	}

	visits, err := h.visitStore.GetRecentVisits(limit)
	if err != nil {
		h.logger.Error("visits", "Failed to get recent visits", err)
		utils.WriteInternalError(w)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, visits)
}

func (h *VisitHandler) HandleGetUnrespondedVisits(w http.ResponseWriter, r *http.Request) {
	visits, err := h.visitStore.GetUnrespondedVisits()
	if err != nil {
		h.logger.Error("visits", "Failed to get unresponded visits", err)
		utils.WriteInternalError(w)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, visits)
}

func (h *VisitHandler) HandleGetStatistics(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if !user.IsAdmin() {
		utils.WriteForbidden(w, "Admin access required")
		return
	}

	stats, err := h.visitStore.GetVisitStatistics()
	if err != nil {
		h.logger.Error("visits", "Failed to get visit statistics", err)
		utils.WriteInternalError(w)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, stats)
}
