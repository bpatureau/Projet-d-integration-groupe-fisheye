package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"fisheye/internal/middleware"
	"fisheye/internal/store"
	"fisheye/internal/utils"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type AdminHandler struct {
	userStore  store.UserStore
	tokenStore store.TokenStore
	visitStore store.VisitStore
	logStore   store.LogStore
	logger     *utils.Logger
}

func NewAdminHandler(userStore store.UserStore, tokenStore store.TokenStore, visitStore store.VisitStore, logStore store.LogStore, logger *utils.Logger) *AdminHandler {
	return &AdminHandler{
		userStore:  userStore,
		tokenStore: tokenStore,
		visitStore: visitStore,
		logStore:   logStore,
		logger:     logger,
	}
}

func (h *AdminHandler) HandleListUsers(w http.ResponseWriter, r *http.Request) {
	// Pagination et filtres
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	search := r.URL.Query().Get("search")
	role := r.URL.Query().Get("role")

	if limit <= 0 || limit > 100 {
		limit = 20
	}

	users, total, err := h.userStore.ListUsers(limit, offset, search, role)
	if err != nil {
		h.logger.Error("admin", "Failed to list users", err)
		utils.WriteInternalError(w)
		return
	}

	userResponses := make([]*utils.UserResponse, len(users))
	for i, user := range users {
		userResponses[i] = mapUserToResponse(user)
	}

	utils.WriteSuccessWithMeta(w, http.StatusOK, userResponses, utils.PaginationMeta{
		Limit:  limit,
		Offset: offset,
		Total:  total,
	})
}

func (h *AdminHandler) HandleGetUser(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.WriteValidationError(w, "Invalid user ID")
		return
	}

	user, err := h.userStore.GetUserByID(id)
	if err != nil {
		h.logger.Error("admin", "Failed to get user", err)
		utils.WriteInternalError(w)
		return
	}

	if user == nil {
		utils.WriteNotFound(w, "User not found")
		return
	}

	utils.WriteSuccess(w, http.StatusOK, mapUserToResponse(user))
}

func (h *AdminHandler) HandleCreateUser(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)

	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	// Validations
	if err := utils.ValidateUsername(req.Username); err != nil {
		utils.WriteValidationError(w, err.Error())
		return
	}

	if err := utils.ValidateEmail(req.Email); err != nil {
		utils.WriteValidationError(w, err.Error())
		return
	}

	if err := utils.ValidatePassword(req.Password); err != nil {
		utils.WriteValidationError(w, err.Error())
		return
	}

	if err := utils.ValidateRole(req.Role); err != nil {
		utils.WriteValidationError(w, err.Error())
		return
	}

	// Vérifier l'unicité
	if exists, _ := h.userStore.UsernameExists(req.Username); exists {
		utils.WriteValidationError(w, "Username already taken")
		return
	}

	if exists, _ := h.userStore.EmailExists(req.Email); exists {
		utils.WriteValidationError(w, "Email already registered")
		return
	}

	// Créer l'utilisateur
	user := &store.User{
		Username: req.Username,
		Email:    req.Email,
		Role:     req.Role,
	}

	if err := user.PasswordHash.Set(req.Password); err != nil {
		h.logger.Error("admin", "Failed to hash password", err)
		utils.WriteInternalError(w)
		return
	}

	if err := h.userStore.CreateUser(user); err != nil {
		h.logger.Error("admin", "Failed to create user", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("admin", "User created by admin "+admin.Username+": "+user.Username)
	utils.WriteSuccess(w, http.StatusCreated, mapUserToResponse(user))
}

func (h *AdminHandler) HandleUpdateUser(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.WriteValidationError(w, "Invalid user ID")
		return
	}

	var req struct {
		Username *string `json:"username,omitempty"`
		Email    *string `json:"email,omitempty"`
		Role     *string `json:"role,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	user, err := h.userStore.GetUserByID(id)
	if err != nil {
		h.logger.Error("admin", "Failed to get user", err)
		utils.WriteInternalError(w)
		return
	}

	if user == nil {
		utils.WriteNotFound(w, "User not found")
		return
	}

	updated := false

	if req.Username != nil {
		if err := utils.ValidateUsername(*req.Username); err != nil {
			utils.WriteValidationError(w, err.Error())
			return
		}
		if *req.Username != user.Username {
			if exists, _ := h.userStore.UsernameExists(*req.Username); exists {
				utils.WriteValidationError(w, "Username already taken")
				return
			}
			user.Username = *req.Username
			updated = true
		}
	}

	if req.Email != nil {
		if err := utils.ValidateEmail(*req.Email); err != nil {
			utils.WriteValidationError(w, err.Error())
			return
		}
		if *req.Email != user.Email {
			if exists, _ := h.userStore.EmailExists(*req.Email); exists {
				utils.WriteValidationError(w, "Email already registered")
				return
			}
			user.Email = *req.Email
			updated = true
		}
	}

	if req.Role != nil {
		if err := utils.ValidateRole(*req.Role); err != nil {
			utils.WriteValidationError(w, err.Error())
			return
		}

		// Vérifier qu'on ne supprime pas le dernier admin
		if user.Role == "admin" && *req.Role != "admin" {
			if count, _ := h.userStore.CountAdmins(); count <= 1 {
				utils.WriteValidationError(w, "Cannot remove admin role from the last admin")
				return
			}
		}

		user.Role = *req.Role
		updated = true
	}

	if !updated {
		utils.WriteValidationError(w, "No changes provided")
		return
	}

	if err := h.userStore.UpdateUser(user); err != nil {
		h.logger.Error("admin", "Failed to update user", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("admin", "User updated by admin "+admin.Username+": "+user.Username)
	utils.WriteSuccess(w, http.StatusOK, mapUserToResponse(user))
}

func (h *AdminHandler) HandleDeleteUser(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.WriteValidationError(w, "Invalid user ID")
		return
	}

	if id == admin.ID {
		utils.WriteValidationError(w, "Cannot delete your own account")
		return
	}

	user, err := h.userStore.GetUserByID(id)
	if err != nil {
		h.logger.Error("admin", "Failed to get user", err)
		utils.WriteInternalError(w)
		return
	}

	if user == nil {
		utils.WriteNotFound(w, "User not found")
		return
	}

	// Vérifier qu'on ne supprime pas le dernier admin
	if user.Role == "admin" {
		if count, _ := h.userStore.CountAdmins(); count <= 1 {
			utils.WriteValidationError(w, "Cannot delete the last admin")
			return
		}
	}

	if err := h.userStore.DeleteUser(id); err != nil {
		h.logger.Error("admin", "Failed to delete user", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("admin", "User deleted by admin "+admin.Username+": "+user.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]string{
		"message": "User deleted successfully",
	})
}

func (h *AdminHandler) HandleResetUserPassword(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.WriteValidationError(w, "Invalid user ID")
		return
	}

	var req struct {
		NewPassword string `json:"new_password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	if err := utils.ValidatePassword(req.NewPassword); err != nil {
		utils.WriteValidationError(w, err.Error())
		return
	}

	user, err := h.userStore.GetUserByID(id)
	if err != nil {
		h.logger.Error("admin", "Failed to get user", err)
		utils.WriteInternalError(w)
		return
	}

	if user == nil {
		utils.WriteNotFound(w, "User not found")
		return
	}

	var passwordHash store.Password
	if err := passwordHash.Set(req.NewPassword); err != nil {
		h.logger.Error("admin", "Failed to hash password", err)
		utils.WriteInternalError(w)
		return
	}

	if err := h.userStore.UpdateUserPassword(id, passwordHash); err != nil {
		h.logger.Error("admin", "Failed to update password", err)
		utils.WriteInternalError(w)
		return
	}

	// Invalider tous les tokens de l'utilisateur
	if err := h.tokenStore.DeleteAllTokensForUser(id, nil); err != nil {
		h.logger.Warning("admin", "Failed to invalidate user tokens")
	}

	h.logger.Info("admin", "Password reset by admin "+admin.Username+" for user: "+user.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]string{
		"message": "Password reset successfully",
	})
}

func (h *AdminHandler) HandleGetVisitStatistics(w http.ResponseWriter, r *http.Request) {
	stats, err := h.visitStore.GetVisitStatistics()
	if err != nil {
		h.logger.Error("admin", "Failed to get visit statistics", err)
		utils.WriteInternalError(w)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, stats)
}

func (h *AdminHandler) HandleListSystemLogs(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	level := r.URL.Query().Get("level")
	component := r.URL.Query().Get("component")

	if limit <= 0 || limit > 100 {
		limit = 50
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

	logs, total, err := h.logStore.ListLogs(limit, offset, level, component, startDate, endDate)
	if err != nil {
		h.logger.Error("admin", "Failed to get system logs", err)
		utils.WriteInternalError(w)
		return
	}

	utils.WriteSuccessWithMeta(w, http.StatusOK, logs, utils.PaginationMeta{
		Limit:  limit,
		Offset: offset,
		Total:  total,
	})
}

func (h *AdminHandler) HandleClearLogs(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)

	var req struct {
		OlderThanDays int `json:"older_than_days"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	if req.OlderThanDays < 1 {
		utils.WriteValidationError(w, "older_than_days must be at least 1")
		return
	}

	count, err := h.logStore.DeleteOldLogs(req.OlderThanDays)
	if err != nil {
		h.logger.Error("admin", "Failed to clear logs", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("admin", "Logs cleared by admin "+admin.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]interface{}{
		"message":       "Logs cleared successfully",
		"deleted_count": count,
	})
}
