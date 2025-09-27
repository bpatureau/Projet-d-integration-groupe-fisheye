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

type UserHandler struct {
	userStore  store.UserStore
	tokenStore store.TokenStore
	logger     *utils.Logger
}

func NewUserHandler(userStore store.UserStore, tokenStore store.TokenStore, logger *utils.Logger) *UserHandler {
	return &UserHandler{
		userStore:  userStore,
		tokenStore: tokenStore,
		logger:     logger,
	}
}

type UpdateUserRequest struct {
	Username *string `json:"username,omitempty"`
	Email    *string `json:"email,omitempty"`
	Role     *string `json:"role,omitempty"`
}

type CreateUserRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type UserListResponse struct {
	Users []*UserResponse      `json:"users"`
	Meta  utils.PaginationMeta `json:"meta"`
}

func (h *UserHandler) HandleListUsers(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)
	if !admin.IsAdmin() {
		utils.WriteForbidden(w, "Admin access required")
		return
	}

	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	search := r.URL.Query().Get("search")
	role := r.URL.Query().Get("role")

	limit := 20
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

	users, total, err := h.userStore.ListUsers(limit, offset, search, role)
	if err != nil {
		h.logger.Error("users", "Failed to list users", err)
		utils.WriteInternalError(w)
		return
	}

	userResponses := make([]*UserResponse, len(users))
	for i, user := range users {
		userResponses[i] = mapUserToResponse(user)
	}

	meta := utils.PaginationMeta{
		Limit:  limit,
		Offset: offset,
		Total:  total,
	}

	utils.WriteSuccessWithMeta(w, http.StatusOK, userResponses, meta)
}

func (h *UserHandler) HandleGetUser(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)
	if !admin.IsAdmin() {
		utils.WriteForbidden(w, "Admin access required")
		return
	}

	idParam := chi.URLParam(r, "id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		utils.WriteValidationError(w, "Invalid user ID")
		return
	}

	user, err := h.userStore.GetUserByID(id)
	if err != nil {
		h.logger.Error("users", "Failed to get user", err)
		utils.WriteInternalError(w)
		return
	}

	if user == nil {
		utils.WriteNotFound(w, "User not found")
		return
	}

	utils.WriteSuccess(w, http.StatusOK, mapUserToResponse(user))
}

func (h *UserHandler) HandleCreateUser(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)
	if !admin.IsAdmin() {
		utils.WriteForbidden(w, "Admin access required")
		return
	}

	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.Error("users", "Invalid create user request", err)
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

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

	user := &store.User{
		Username: req.Username,
		Email:    req.Email,
		Role:     req.Role,
	}

	if err := user.PasswordHash.Set(req.Password); err != nil {
		h.logger.Error("users", "Failed to hash password", err)
		utils.WriteInternalError(w)
		return
	}

	if err := h.userStore.CreateUser(user); err != nil {
		h.logger.Error("users", "Failed to create user", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("users", "Admin created new user: "+user.Username+" by "+admin.Username)
	utils.WriteSuccess(w, http.StatusCreated, mapUserToResponse(user))
}

func (h *UserHandler) HandleUpdateUser(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)
	if !admin.IsAdmin() {
		utils.WriteForbidden(w, "Admin access required")
		return
	}

	idParam := chi.URLParam(r, "id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		utils.WriteValidationError(w, "Invalid user ID")
		return
	}

	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.Error("users", "Invalid update user request", err)
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	user, err := h.userStore.GetUserByID(id)
	if err != nil {
		h.logger.Error("users", "Failed to get user", err)
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
		user.Username = *req.Username
		updated = true
	}

	if req.Email != nil {
		if err := utils.ValidateEmail(*req.Email); err != nil {
			utils.WriteValidationError(w, err.Error())
			return
		}
		user.Email = *req.Email
		updated = true
	}

	if req.Role != nil {
		if err := utils.ValidateRole(*req.Role); err != nil {
			utils.WriteValidationError(w, err.Error())
			return
		}

		if user.IsAdmin() && *req.Role != "admin" {
			adminCount, err := h.userStore.CountAdmins()
			if err != nil {
				h.logger.Error("users", "Failed to count admins", err)
				utils.WriteInternalError(w)
				return
			}

			if adminCount <= 1 {
				utils.WriteValidationError(w, "Cannot remove admin role from the last admin")
				return
			}
		}

		user.Role = *req.Role
		updated = true
	}

	if !updated {
		utils.WriteValidationError(w, "No fields to update")
		return
	}

	if err := h.userStore.UpdateUser(user); err != nil {
		h.logger.Error("users", "Failed to update user", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("users", "User updated: "+user.Username+" by "+admin.Username)
	utils.WriteSuccess(w, http.StatusOK, mapUserToResponse(user))
}

func (h *UserHandler) HandleDeleteUser(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)
	if !admin.IsAdmin() {
		utils.WriteForbidden(w, "Admin access required")
		return
	}

	idParam := chi.URLParam(r, "id")
	id, err := uuid.Parse(idParam)
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
		h.logger.Error("users", "Failed to get user", err)
		utils.WriteInternalError(w)
		return
	}

	if user == nil {
		utils.WriteNotFound(w, "User not found")
		return
	}

	if user.IsAdmin() {
		adminCount, err := h.userStore.CountAdmins()
		if err != nil {
			h.logger.Error("users", "Failed to count admins", err)
			utils.WriteInternalError(w)
			return
		}

		if adminCount <= 1 {
			utils.WriteValidationError(w, "Cannot delete the last admin account")
			return
		}
	}

	if err := h.userStore.DeleteUser(id); err != nil {
		h.logger.Error("users", "Failed to delete user", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("users", "User deleted: "+user.Username+" by "+admin.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]string{"message": "User deleted successfully"})
}

func (h *UserHandler) HandleResetUserPassword(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetUser(r)
	if !admin.IsAdmin() {
		utils.WriteForbidden(w, "Admin access required")
		return
	}

	idParam := chi.URLParam(r, "id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		utils.WriteValidationError(w, "Invalid user ID")
		return
	}

	var req struct {
		NewPassword string `json:"new_password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.Error("users", "Invalid reset password request", err)
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	if err := utils.ValidatePassword(req.NewPassword); err != nil {
		utils.WriteValidationError(w, err.Error())
		return
	}

	user, err := h.userStore.GetUserByID(id)
	if err != nil {
		h.logger.Error("users", "Failed to get user", err)
		utils.WriteInternalError(w)
		return
	}

	if user == nil {
		utils.WriteNotFound(w, "User not found")
		return
	}

	var passwordHash store.Password
	if err := passwordHash.Set(req.NewPassword); err != nil {
		h.logger.Error("users", "Failed to hash password", err)
		utils.WriteInternalError(w)
		return
	}

	if err := h.userStore.UpdatePassword(id, passwordHash); err != nil {
		h.logger.Error("users", "Failed to update password", err)
		utils.WriteInternalError(w)
		return
	}

	if err := h.tokenStore.DeleteAllTokensForUser(id, "authentication"); err != nil {
		h.logger.Error("users", "Failed to invalidate tokens", err)
	}

	h.logger.Info("users", "Password reset for user: "+user.Username+" by "+admin.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]string{"message": "Password reset successfully"})
}
