package websocket

import (
	"context"
	"net/http"
	"time"

	"fisheye/internal/store"
	"fisheye/internal/tokens"
	"fisheye/internal/utils"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     checkOrigin,
}

func checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	allowedOrigins := utils.GetAllowedOrigins()
	return utils.IsOriginAllowed(origin, allowedOrigins)
}

type Handler struct {
	hub        *Hub
	logger     *utils.Logger
	userStore  store.UserStore
	tokenStore store.TokenStore
	deviceKey  string
}

func NewHandler(hub *Hub, userStore store.UserStore, tokenStore store.TokenStore, deviceKey string, logger *utils.Logger) *Handler {
	return &Handler{
		hub:        hub,
		logger:     logger,
		userStore:  userStore,
		tokenStore: tokenStore,
		deviceKey:  deviceKey,
	}
}

// HandleDeviceConnection handles WebSocket connections from devices
func (h *Handler) HandleDeviceConnection(w http.ResponseWriter, r *http.Request) {
	// Get API key from query parameter
	apiKey := r.URL.Query().Get("api_key")

	if apiKey == "" {
		h.logger.Warning("websocket", "Device connection attempt without API key from: "+r.RemoteAddr)
		http.Error(w, "API key required in query parameter", http.StatusUnauthorized)
		return
	}

	// Validate device API key
	if h.deviceKey == "" {
		h.logger.Error("websocket", "Device API key not configured in server", nil)
		http.Error(w, "Device authentication not configured", http.StatusServiceUnavailable)
		return
	}

	if apiKey != h.deviceKey {
		h.logger.Warning("websocket", "Invalid device API key attempt from: "+r.RemoteAddr)
		http.Error(w, "Invalid API key", http.StatusUnauthorized)
		return
	}

	h.logger.Info("websocket", "Device authenticated from: "+r.RemoteAddr)
	h.handleConnection(w, r, true, nil)
}

// HandleFrontendConnection handles WebSocket connections from authenticated users
func (h *Handler) HandleFrontendConnection(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get token from query parameter
	token := r.URL.Query().Get("token")

	if token == "" {
		h.logger.Warning("websocket", "Frontend connection attempt without token from: "+r.RemoteAddr)
		http.Error(w, "Authentication token required in query parameter", http.StatusUnauthorized)
		return
	}

	// Validate the token and get user
	user, err := h.userStore.GetByToken(ctx, token)
	if err != nil {
		h.logger.Warning("websocket", "Token validation error: "+err.Error())
		http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
		return
	}

	if user == nil {
		h.logger.Warning("websocket", "Invalid token attempt from: "+r.RemoteAddr)
		http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
		return
	}

	// Extend token expiry asynchronously (like in the middleware)
	go func() {
		extCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := h.tokenStore.ExtendExpiry(extCtx, token, tokens.DefaultTTL); err != nil {
			h.logger.Warning("websocket", "Failed to extend token expiry: "+err.Error())
		}
	}()

	h.logger.Info("websocket", "Frontend user authenticated: "+user.Username+" from: "+r.RemoteAddr)
	h.handleConnection(w, r, false, user)
}

// handleConnection upgrades the HTTP connection to WebSocket and registers the client
func (h *Handler) handleConnection(w http.ResponseWriter, r *http.Request, isDevice bool, user *store.User) {
	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.logger.Error("websocket", "Failed to upgrade connection", err)
		return
	}

	// Create unique client ID
	clientID := uuid.New().String()

	// Create client instance
	client := &Client{
		ID:       clientID,
		Conn:     &Conn{conn},
		Hub:      h.hub,
		Send:     make(chan *Message, 256),
		IsDevice: isDevice,
	}

	// Register client with hub
	h.hub.Register(client)

	// Build connection acknowledgment data
	ackData := map[string]any{
		"client_id": clientID,
		"is_device": isDevice,
		"timestamp": getCurrentTimestamp(),
	}

	// Include user information for frontend connections
	if user != nil {
		ackData["user"] = map[string]string{
			"id":       user.ID.String(),
			"username": user.Username,
			"email":    user.Email,
			"role":     user.Role,
		}
	}

	// Send initial connection acknowledgment
	client.Send <- &Message{
		Type: "connected",
		Data: ackData,
	}

	// Start client read and write pumps
	client.Start()
}

// GetHub returns the WebSocket hub instance
func (h *Handler) GetHub() *Hub {
	return h.hub
}
