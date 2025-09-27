package api

import (
	"encoding/json"
	"net/http"
	"time"

	"fisheye/internal/middleware"
	"fisheye/internal/store"
	"fisheye/internal/tokens"
	"fisheye/internal/utils"
)

type AuthHandler struct {
	userStore  store.UserStore
	tokenStore store.TokenStore
	logger     *utils.Logger
}

func NewAuthHandler(userStore store.UserStore, tokenStore store.TokenStore, logger *utils.Logger) *AuthHandler {
	return &AuthHandler{
		userStore:  userStore,
		tokenStore: tokenStore,
		logger:     logger,
	}
}

type RegisterRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AuthResponse struct {
	User  *UserResponse `json:"user"`
	Token *tokens.Token `json:"token"`
}

type UserResponse struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

type RefreshTokenRequest struct {
	Token string `json:"token"`
}

func (h *AuthHandler) HandleRegister(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.Error("auth", "Invalid register request payload", err)
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	// Valider les données d'entrée
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

	// Vérifier si c'est le premier utilisateur (devient admin)
	userCount, err := h.userStore.CountUsers()
	if err != nil {
		h.logger.Error("auth", "Failed to count users", err)
		utils.WriteInternalError(w)
		return
	}

	user := &store.User{
		Username: req.Username,
		Email:    req.Email,
		Role:     "user",
	}

	// Le premier utilisateur devient admin
	if userCount == 0 {
		user.Role = "admin"
		h.logger.Info("auth", "Creating first admin user: "+req.Username)
	}

	if err := user.PasswordHash.Set(req.Password); err != nil {
		h.logger.Error("auth", "Failed to hash password", err)
		utils.WriteInternalError(w)
		return
	}

	if err := h.userStore.CreateUser(user); err != nil {
		h.logger.Error("auth", "Failed to create user", err)
		utils.WriteInternalError(w)
		return
	}

	// Créer le token d'authentification
	token, err := h.tokenStore.CreateNewToken(user.ID, 24*time.Hour, tokens.ScopeAuth)
	if err != nil {
		h.logger.Error("auth", "Failed to create token", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("auth", "User registered successfully: "+user.Username)

	response := &AuthResponse{
		User:  mapUserToResponse(user),
		Token: token,
	}

	utils.WriteSuccess(w, http.StatusCreated, response)
}

func (h *AuthHandler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.Error("auth", "Invalid login request payload", err)
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	user, err := h.userStore.GetUserByUsername(req.Username)
	if err != nil {
		h.logger.Error("auth", "Failed to get user by username", err)
		utils.WriteInternalError(w)
		return
	}

	if user == nil {
		utils.WriteUnauthorized(w, "Invalid credentials")
		return
	}

	passwordsMatch, err := user.PasswordHash.Matches(req.Password)
	if err != nil {
		h.logger.Error("auth", "Password matching error", err)
		utils.WriteInternalError(w)
		return
	}

	if !passwordsMatch {
		utils.WriteUnauthorized(w, "Invalid credentials")
		return
	}

	var tokenDuration time.Duration
	if user.IsDevice() {
		tokenDuration = 30 * 24 * time.Hour // 30 jours pour les devices
	} else {
		tokenDuration = 24 * time.Hour // 24h pour les utilisateurs normaux
	}

	token, err := h.tokenStore.CreateNewToken(user.ID, tokenDuration, tokens.ScopeAuth)
	if err != nil {
		h.logger.Error("auth", "Failed to create token", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("auth", "User logged in successfully: "+user.Username)

	response := &AuthResponse{
		User:  mapUserToResponse(user),
		Token: token,
	}

	utils.WriteSuccess(w, http.StatusOK, response)
}

func (h *AuthHandler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user.IsAnonymous() {
		utils.WriteUnauthorized(w, "Authentication required")
		return
	}

	// Supprimer tous les tokens d'authentification de l'utilisateur
	if err := h.tokenStore.DeleteAllTokensForUser(user.ID, tokens.ScopeAuth); err != nil {
		h.logger.Error("auth", "Failed to delete user tokens", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("auth", "User logged out: "+user.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

func (h *AuthHandler) HandleChangePassword(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user.IsAnonymous() {
		utils.WriteUnauthorized(w, "Authentication required")
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.Error("auth", "Invalid change password request", err)
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	// Récupérer l'utilisateur complet avec le hash du mot de passe
	fullUser, err := h.userStore.GetUserByID(user.ID)
	if err != nil {
		h.logger.Error("auth", "Failed to get user", err)
		utils.WriteInternalError(w)
		return
	}

	// Vérifier l'ancien mot de passe
	passwordsMatch, err := fullUser.PasswordHash.Matches(req.OldPassword)
	if err != nil {
		h.logger.Error("auth", "Password matching error", err)
		utils.WriteInternalError(w)
		return
	}

	if !passwordsMatch {
		utils.WriteUnauthorized(w, "Invalid old password")
		return
	}

	// Valider le nouveau mot de passe
	if err := utils.ValidatePassword(req.NewPassword); err != nil {
		utils.WriteValidationError(w, err.Error())
		return
	}

	// Hasher le nouveau mot de passe
	if err := fullUser.PasswordHash.Set(req.NewPassword); err != nil {
		h.logger.Error("auth", "Failed to hash new password", err)
		utils.WriteInternalError(w)
		return
	}

	// Mettre à jour le mot de passe en base
	if err := h.userStore.UpdatePassword(user.ID, fullUser.PasswordHash); err != nil {
		h.logger.Error("auth", "Failed to update password", err)
		utils.WriteInternalError(w)
		return
	}

	// Invalider tous les tokens existants (forcer la reconnexion)
	if err := h.tokenStore.DeleteAllTokensForUser(user.ID, tokens.ScopeAuth); err != nil {
		h.logger.Error("auth", "Failed to invalidate tokens", err)
		// On continue quand même, le mot de passe est changé
	}

	h.logger.Info("auth", "Password changed for user: "+user.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]string{"message": "Password changed successfully"})
}

func (h *AuthHandler) HandleRefreshToken(w http.ResponseWriter, r *http.Request) {
	var req RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.Error("auth", "Invalid refresh token request", err)
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	// Vérifier le token actuel
	user, err := h.userStore.GetUserToken(tokens.ScopeAuth, req.Token)
	if err != nil {
		h.logger.Error("auth", "Failed to validate token", err)
		utils.WriteUnauthorized(w, "Invalid token")
		return
	}

	if user == nil {
		utils.WriteUnauthorized(w, "Token expired or invalid")
		return
	}

	// Créer un nouveau token
	var tokenDuration time.Duration
	if user.IsDevice() {
		tokenDuration = 30 * 24 * time.Hour // 30 jours pour les devices
	} else {
		tokenDuration = 24 * time.Hour // 24h pour les utilisateurs
	}

	newToken, err := h.tokenStore.CreateNewToken(user.ID, tokenDuration, tokens.ScopeAuth)
	if err != nil {
		h.logger.Error("auth", "Failed to create new token", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("auth", "Token refreshed for user: "+user.Username)

	response := &AuthResponse{
		User:  mapUserToResponse(user),
		Token: newToken,
	}

	utils.WriteSuccess(w, http.StatusOK, response)
}

func (h *AuthHandler) HandleDeleteAccount(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user.IsAnonymous() {
		utils.WriteUnauthorized(w, "Authentication required")
		return
	}

	// Vérifier le mot de passe pour confirmation
	var req struct {
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.Error("auth", "Invalid delete account request", err)
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	// Récupérer l'utilisateur complet
	fullUser, err := h.userStore.GetUserByID(user.ID)
	if err != nil {
		h.logger.Error("auth", "Failed to get user", err)
		utils.WriteInternalError(w)
		return
	}

	// Vérifier le mot de passe
	passwordsMatch, err := fullUser.PasswordHash.Matches(req.Password)
	if err != nil {
		h.logger.Error("auth", "Password matching error", err)
		utils.WriteInternalError(w)
		return
	}

	if !passwordsMatch {
		utils.WriteUnauthorized(w, "Invalid password")
		return
	}

	// Empêcher la suppression du dernier admin
	if user.IsAdmin() {
		adminCount, err := h.userStore.CountAdmins()
		if err != nil {
			h.logger.Error("auth", "Failed to count admins", err)
			utils.WriteInternalError(w)
			return
		}

		if adminCount <= 1 {
			utils.WriteValidationError(w, "Cannot delete the last admin account")
			return
		}
	}

	// Supprimer l'utilisateur (les tokens seront supprimés en cascade)
	if err := h.userStore.DeleteUser(user.ID); err != nil {
		h.logger.Error("auth", "Failed to delete user", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("auth", "Account deleted: "+user.Username)
	utils.WriteSuccess(w, http.StatusOK, map[string]string{"message": "Account deleted successfully"})
}

func (h *AuthHandler) HandleMe(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user.IsAnonymous() {
		utils.WriteUnauthorized(w, "Authentication required")
		return
	}

	utils.WriteSuccess(w, http.StatusOK, mapUserToResponse(user))
}

func mapUserToResponse(user *store.User) *UserResponse {
	return &UserResponse{
		ID:        user.ID.String(),
		Username:  user.Username,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
	}
}
