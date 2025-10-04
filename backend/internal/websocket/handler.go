package websocket

import (
	"net/http"

	"fisheye/internal/middleware"
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
	hub    *Hub
	logger *utils.Logger
}

func NewHandler(hub *Hub, logger *utils.Logger) *Handler {
	return &Handler{
		hub:    hub,
		logger: logger,
	}
}

func (h *Handler) HandleDeviceConnection(w http.ResponseWriter, r *http.Request) {
	if !middleware.IsDevice(r) {
		utils.WriteForbidden(w, "Device authentication required")
		return
	}

	h.handleConnection(w, r, true)
}

func (h *Handler) HandleFrontendConnection(w http.ResponseWriter, r *http.Request) {
	// Frontend must be authenticated
	user := middleware.GetUser(r)
	if user.IsAnonymous() {
		utils.WriteUnauthorized(w, "Authentication required")
		return
	}

	h.handleConnection(w, r, false)
}

func (h *Handler) handleConnection(w http.ResponseWriter, r *http.Request, isDevice bool) {
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

	// Send initial connection acknowledgment
	client.Send <- &Message{
		Type: "connected",
		Data: map[string]any{
			"client_id": clientID,
			"is_device": isDevice,
			"timestamp": getCurrentTimestamp(),
		},
	}

	// Start client message handling
	client.Start()
}

func (h *Handler) GetHub() *Hub {
	return h.hub
}
