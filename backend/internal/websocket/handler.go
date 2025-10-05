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

type Handler struct {
	hub            *Hub
	logger         *utils.Logger
	userStore      store.UserStore
	tokenStore     store.TokenStore
	deviceKey      string
	allowedOrigins []string
}

func NewHandler(hub *Hub, userStore store.UserStore, tokenStore store.TokenStore, deviceKey string, allowedOrigins []string, logger *utils.Logger) *Handler {
	return &Handler{
		hub:            hub,
		logger:         logger,
		userStore:      userStore,
		tokenStore:     tokenStore,
		deviceKey:      deviceKey,
		allowedOrigins: allowedOrigins,
	}
}

func (h *Handler) checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")

	if origin == "" {
		return true
	}

	for _, allowed := range h.allowedOrigins {
		if allowed == "*" {
			return true
		}
		if allowed == origin {
			return true
		}
	}

	return false
}

func (h *Handler) HandleDeviceConnection(w http.ResponseWriter, r *http.Request) {
	apiKey := r.URL.Query().Get("api_key")

	if apiKey == "" {
		h.logger.Warning("websocket", "Device connection attempt without API key from: "+r.RemoteAddr)
		http.Error(w, "API key required in query parameter", http.StatusUnauthorized)
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

func (h *Handler) HandleFrontendConnection(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	token := r.URL.Query().Get("token")

	if token == "" {
		h.logger.Warning("websocket", "Frontend connection attempt without token from: "+r.RemoteAddr)
		http.Error(w, "Authentication token required in query parameter", http.StatusUnauthorized)
		return
	}

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

func (h *Handler) handleConnection(w http.ResponseWriter, r *http.Request, isDevice bool, user *store.User) {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     h.checkOrigin,
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.logger.Error("websocket", "Failed to upgrade connection", err)
		return
	}

	clientID := uuid.New().String()
	client := &Client{
		ID:       clientID,
		Conn:     &Conn{conn},
		Hub:      h.hub,
		Send:     make(chan *Message, 256),
		IsDevice: isDevice,
	}

	h.hub.Register(client)

	ackData := map[string]any{
		"client_id": clientID,
		"is_device": isDevice,
		"timestamp": getCurrentTimestamp(),
	}

	if user != nil {
		ackData["user"] = map[string]string{
			"id":       user.ID.String(),
			"username": user.Username,
			"email":    user.Email,
			"role":     user.Role,
		}
	}

	client.Send <- &Message{
		Type: "connected",
		Data: ackData,
	}

	client.Start()
}

func (h *Handler) GetHub() *Hub {
	return h.hub
}
