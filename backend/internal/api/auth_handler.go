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

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AuthResponse struct {
	User  *UserResponse `json:"user"`
	Token *tokens.Token `json:"token"`
}

type UserResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteValidationError(w, "Invalid request payload")
		return
	}

	if req.Username == "" || req.Password == "" {
		utils.WriteValidationError(w, "Username and password are required")
		return
	}

	user, err := h.userStore.GetByUsername(ctx, req.Username)
	if err != nil {
		h.logger.Error("auth", "Database error during login", err)
		utils.WriteInternalError(w)
		return
	}

	if user == nil {
		h.logger.Warning("auth", "Failed login attempt for non-existent user: "+req.Username)
		utils.WriteUnauthorized(w, "Invalid credentials")
		return
	}

	if matches, _ := user.PasswordHash.Matches(req.Password); !matches {
		h.logger.Warning("auth", "Failed login attempt for: "+req.Username)
		utils.WriteUnauthorized(w, "Invalid credentials")
		return
	}

	token, err := h.tokenStore.Create(ctx, user.ID, tokens.DefaultTTL)
	if err != nil {
		h.logger.Error("auth", "Failed to create token", err)
		utils.WriteInternalError(w)
		return
	}

	h.logger.Info("auth", "User logged in: "+user.Username)

	response := &AuthResponse{
		User: &UserResponse{
			ID:       user.ID.String(),
			Username: user.Username,
			Email:    user.Email,
			Role:     user.Role,
		},
		Token: token,
	}

	utils.WriteSuccess(w, http.StatusOK, response)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	authHeader := r.Header.Get("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		token := authHeader[7:]
		if err := h.tokenStore.Delete(ctx, token); err != nil {
			h.logger.Warning("auth", "Failed to delete token on logout: "+err.Error())
		}
	}

	h.logger.Info("auth", "User logged out")
	utils.WriteSuccess(w, http.StatusOK, map[string]string{
		"message": "Logged out successfully",
	})
}
