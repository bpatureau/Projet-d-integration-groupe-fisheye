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
