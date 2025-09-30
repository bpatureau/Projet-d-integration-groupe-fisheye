package api

import (
	"encoding/json"
	"net/http"

	"fisheye/internal/middleware"
	"fisheye/internal/store"
	"fisheye/internal/utils"
)

type ProfileHandler struct {
	userStore  store.UserStore
	tokenStore store.TokenStore
	logger     *utils.Logger
}

func NewProfileHandler(userStore store.UserStore, tokenStore store.TokenStore, logger *utils.Logger) *ProfileHandler {
	return &ProfileHandler{
		userStore:  userStore,
		tokenStore: tokenStore,
		logger:     logger,
	}
}

// GET /api/profile
func (h *ProfileHandler) Get(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)

	profile := map[string]any{
		"id":         user.ID.String(),
		"username":   user.Username,
		"email":      user.Email,
		"role":       user.Role,
		"created_at": user.CreatedAt,
		"updated_at": user.UpdatedAt,
	}

	utils.WriteSuccess(w, http.StatusOK, profile)
}

// PUT /api/profile
func (h *ProfileHandler) Update(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := middleware.GetUser(r)

	var req struct {
		Username *string `json:"username,omitempty"`
		Email    *string `json:"email,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	fullUser, err := h.userStore.GetByID(ctx, user.ID)
	if err != nil {
		h.logger.Error("profile", "Failed to get user", err)
		utils.WriteInternalError(w)
		return
	}

	updated := false

	if req.Username != nil && *req.Username != fullUser.Username {
		if err := utils.ValidateUsername(*req.Username); err != nil {
			utils.WriteValidationError(w, err.Error())
			return
		}

		if exists, _ := h.userStore.UsernameExists(ctx, *req.Username); exists {
			utils.WriteValidationError(w, "Username already taken")
			return
		}

		fullUser.Username = *req.Username
		updated = true
	}

	if req.Email != nil && *req.Email != fullUser.Email {
		if err := utils.ValidateEmail(*req.Email); err != nil {
			utils.WriteValidationError(w, err.Error())
			return
		}

		if exists, _ := h.userStore.EmailExists(ctx, *req.Email); exists {
			utils.WriteValidationError(w, "Email already taken")
			return
		}

		fullUser.Email = *req.Email
		updated = true
	}

	if !updated {
		utils.WriteValidationError(w, "No changes provided")
		return
	}

	if err := h.userStore.Update(ctx, fullUser); err != nil {
		h.logger.Error("profile", "Failed to update user", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("profile", "Profile updated for user: "+fullUser.Username)

	profile := map[string]any{
		"id":         fullUser.ID.String(),
		"username":   fullUser.Username,
		"email":      fullUser.Email,
		"role":       fullUser.Role,
		"created_at": fullUser.CreatedAt,
		"updated_at": fullUser.UpdatedAt,
	}

	utils.WriteSuccess(w, http.StatusOK, profile)
}

// POST /api/profile/password
func (h *ProfileHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := middleware.GetUser(r)

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	fullUser, err := h.userStore.GetByID(ctx, user.ID)
	if err != nil {
		h.logger.Error("profile", "Failed to get user", err)
		utils.WriteInternalError(w)
		return
	}

	if matches, _ := fullUser.PasswordHash.Matches(req.CurrentPassword); !matches {
		utils.WriteUnauthorized(w, "Current password is incorrect")
		return
	}

	if err := utils.ValidatePassword(req.NewPassword); err != nil {
		utils.WriteValidationError(w, err.Error())
		return
	}

	newPasswordHash := store.Password{}
	if err := newPasswordHash.Set(req.NewPassword); err != nil {
		h.logger.Error("profile", "Failed to hash password", err)
		utils.WriteInternalError(w)
		return
	}

	if err := h.userStore.UpdatePassword(ctx, user.ID, newPasswordHash); err != nil {
		h.logger.Error("profile", "Failed to update password", err)
		utils.WriteInternalError(w)
		return
	}

	// Invalidate all tokens except current
	currentToken := r.Header.Get("Authorization")
	if len(currentToken) > 7 {
		currentToken = currentToken[7:]
		h.tokenStore.DeleteAllForUser(ctx, user.ID, &currentToken)
	}

	h.logger.Info("profile", "Password changed for user: "+user.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]string{
		"message": "Password changed successfully",
	})
}
