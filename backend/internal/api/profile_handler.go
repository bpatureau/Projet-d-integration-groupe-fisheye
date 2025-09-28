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

type ProfileUpdateRequest struct {
	Username *string `json:"username,omitempty"`
	Email    *string `json:"email,omitempty"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func (h *ProfileHandler) HandleGetProfile(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)

	profile := &utils.UserResponse{
		ID:        user.ID.String(),
		Username:  user.Username,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
		UpdatedAt: user.UpdatedAt,
	}

	utils.WriteSuccess(w, http.StatusOK, profile)
}

func (h *ProfileHandler) HandleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)

	var req ProfileUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	// Récupérer l'utilisateur complet
	fullUser, err := h.userStore.GetUserByID(user.ID)
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

		// Vérifier l'unicité
		if exists, _ := h.userStore.UsernameExists(*req.Username); exists {
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

		// Vérifier l'unicité
		if exists, _ := h.userStore.EmailExists(*req.Email); exists {
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

	if err := h.userStore.UpdateUser(fullUser); err != nil {
		h.logger.Error("profile", "Failed to update user", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("profile", "Profile updated for user: "+fullUser.Username)

	profile := &utils.UserResponse{
		ID:        fullUser.ID.String(),
		Username:  fullUser.Username,
		Email:     fullUser.Email,
		Role:      fullUser.Role,
		CreatedAt: fullUser.CreatedAt,
		UpdatedAt: fullUser.UpdatedAt,
	}

	utils.WriteSuccess(w, http.StatusOK, profile)
}

func (h *ProfileHandler) HandleChangePassword(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	// Récupérer l'utilisateur avec le hash
	fullUser, err := h.userStore.GetUserByID(user.ID)
	if err != nil {
		h.logger.Error("profile", "Failed to get user", err)
		utils.WriteInternalError(w)
		return
	}

	// Vérifier l'ancien mot de passe
	if matches, _ := fullUser.PasswordHash.Matches(req.CurrentPassword); !matches {
		utils.WriteUnauthorized(w, "Current password is incorrect")
		return
	}

	// Valider et définir le nouveau mot de passe
	if err := utils.ValidatePassword(req.NewPassword); err != nil {
		utils.WriteValidationError(w, err.Error())
		return
	}

	if err := fullUser.PasswordHash.Set(req.NewPassword); err != nil {
		h.logger.Error("profile", "Failed to hash password", err)
		utils.WriteInternalError(w)
		return
	}

	// Mettre à jour en base
	if err := h.userStore.UpdateUserPassword(user.ID, fullUser.PasswordHash); err != nil {
		h.logger.Error("profile", "Failed to update password", err)
		utils.WriteInternalError(w)
		return
	}

	// Invalider tous les tokens sauf le courant
	currentToken := r.Header.Get("Authorization")[7:] // Remove "Bearer "
	if err := h.tokenStore.DeleteAllTokensForUser(user.ID, &currentToken); err != nil {
		h.logger.Warning("profile", "Failed to invalidate other sessions")
	}

	h.logger.Info("profile", "Password changed for user: "+user.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]string{
		"message": "Password changed successfully",
	})
}

func (h *ProfileHandler) HandleDeleteAccount(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)

	var req struct {
		Password string `json:"password"`
		Confirm  bool   `json:"confirm"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	if !req.Confirm {
		utils.WriteValidationError(w, "Please confirm account deletion")
		return
	}

	// Vérifier le mot de passe
	fullUser, err := h.userStore.GetUserByID(user.ID)
	if err != nil {
		h.logger.Error("profile", "Failed to get user", err)
		utils.WriteInternalError(w)
		return
	}

	if matches, _ := fullUser.PasswordHash.Matches(req.Password); !matches {
		utils.WriteUnauthorized(w, "Invalid password")
		return
	}

	// Empêcher la suppression du dernier admin
	if user.IsAdmin() {
		if count, _ := h.userStore.CountAdmins(); count <= 1 {
			utils.WriteValidationError(w, "Cannot delete the last admin account")
			return
		}
	}

	// Supprimer l'utilisateur
	if err := h.userStore.DeleteUser(user.ID); err != nil {
		h.logger.Error("profile", "Failed to delete user", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("profile", "Account deleted: "+user.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]string{
		"message": "Account deleted successfully",
	})
}

func (h *ProfileHandler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)

	// Extraire le token actuel
	authHeader := r.Header.Get("Authorization")
	if len(authHeader) > 7 {
		token := authHeader[7:] // Remove "Bearer "
		if err := h.tokenStore.DeleteToken(token); err != nil {
			h.logger.Warning("profile", "Failed to delete token on logout")
		}
	}

	h.logger.Info("profile", "User logged out: "+user.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]string{
		"message": "Logged out successfully",
	})
}
