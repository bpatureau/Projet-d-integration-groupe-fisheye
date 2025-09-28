package api

import (
	"encoding/json"
	"net/http"

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
	User  *utils.UserResponse `json:"user"`
	Token *tokens.Token       `json:"token"`
}

type RefreshTokenRequest struct {
	Token string `json:"token"`
}

func (h *AuthHandler) HandleRegister(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	// Validation
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
		Role:     "user",
	}

	// Premier utilisateur devient admin
	if count, _ := h.userStore.CountUsers(); count == 0 {
		user.Role = "admin"
		h.logger.Info("auth", "Creating first admin user")
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

	token, err := h.tokenStore.CreateNewToken(user.ID, tokens.DefaultTTL)
	if err != nil {
		h.logger.Error("auth", "Failed to create token", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("auth", "User registered: "+user.Username)

	response := &AuthResponse{
		User:  mapUserToResponse(user),
		Token: token,
	}

	utils.WriteSuccess(w, http.StatusCreated, response)
}

func (h *AuthHandler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	// Récupérer l'utilisateur
	user, err := h.userStore.GetUserByUsername(req.Username)
	if err != nil {
		h.logger.Error("auth", "Database error during login", err)
		utils.WriteInternalError(w)
		return
	}

	if user == nil {
		utils.WriteUnauthorized(w, "Invalid credentials")
		return
	}

	// Vérifier le mot de passe
	if matches, _ := user.PasswordHash.Matches(req.Password); !matches {
		h.logger.Warning("auth", "Failed login attempt for: "+req.Username)
		utils.WriteUnauthorized(w, "Invalid credentials")
		return
	}

	// Créer les tokens
	token, err := h.tokenStore.CreateNewToken(user.ID, tokens.DefaultTTL)
	if err != nil {
		h.logger.Error("auth", "Failed to create token", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("auth", "User logged in: "+user.Username)

	response := &AuthResponse{
		User:  mapUserToResponse(user),
		Token: token,
	}

	utils.WriteSuccess(w, http.StatusOK, response)
}

func mapUserToResponse(user *store.User) *utils.UserResponse {
	return &utils.UserResponse{
		ID:        user.ID.String(),
		Username:  user.Username,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
		UpdatedAt: user.UpdatedAt,
	}
}
