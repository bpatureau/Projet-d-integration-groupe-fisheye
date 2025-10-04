package websocket

import (
	"encoding/json"
	"sync"

	"fisheye/internal/utils"
)

type Message struct {
	Type     string `json:"type"`
	Data     any    `json:"data"`
	Target   string `json:"target,omitempty"`    // "device", "frontend", or empty for broadcast
	ClientID string `json:"client_id,omitempty"` // ID of the sender
}

type Client struct {
	ID       string
	Conn     *Conn
	Hub      *Hub
	Send     chan *Message
	IsDevice bool
	mu       sync.Mutex
}

type Hub struct {
	clients    map[string]*Client
	register   chan *Client
	unregister chan *Client
	broadcast  chan *Message
	mu         sync.RWMutex
	logger     *utils.Logger
}

func NewHub(logger *utils.Logger) *Hub {
	hub := &Hub{
		clients:    make(map[string]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *Message, 256),
		logger:     logger,
	}

	go hub.run()
	return hub
}

// run handles the hub's main event loop
func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.ID] = client
			h.mu.Unlock()
			clientType := "frontend"
			if client.IsDevice {
				clientType = "device"
			}
			h.logger.Info("websocket", "Client registered: "+client.ID+" ("+clientType+")")

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				close(client.Send)
				delete(h.clients, client.ID)
				h.logger.Info("websocket", "Client unregistered: "+client.ID)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for id, client := range h.clients {
				// Check if message is targeted
				if message.Target != "" {
					if message.Target == "device" && !client.IsDevice {
						continue
					}
					if message.Target == "frontend" && client.IsDevice {
						continue
					}
				}

				select {
				case client.Send <- message:
					// Message sent successfully
				default:
					// Client's send channel is full, unregister client
					h.logger.Warning("websocket", "Client "+id+" send buffer full, disconnecting")
					go func(c *Client) {
						h.unregister <- c
					}(client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

func (h *Hub) Broadcast(message *Message) {
	select {
	case h.broadcast <- message:
	default:
		h.logger.Warning("websocket", "Broadcast channel full, message dropped")
	}
}

func (h *Hub) BroadcastToDevices(message *Message) {
	message.Target = "device"
	h.Broadcast(message)
}

func (h *Hub) BroadcastToFrontends(message *Message) {
	message.Target = "frontend"
	h.Broadcast(message)
}

func (h *Hub) SendToClient(clientID string, message *Message) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if client, ok := h.clients[clientID]; ok {
		select {
		case client.Send <- message:
			return true
		default:
			return false
		}
	}
	return false
}

func (h *Hub) GetConnectedDevicesCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	count := 0
	for _, client := range h.clients {
		if client.IsDevice {
			count++
		}
	}
	return count
}

func (h *Hub) GetConnectedClientsCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	return len(h.clients)
}

// readPump reads messages from the WebSocket connection
func (c *Client) readPump() {
	defer func() {
		c.Hub.Unregister(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(pongWait)
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(pongWait)
		return nil
	})

	for {
		_, data, err := c.Conn.ReadMessage()
		if err != nil {
			if !IsNormalClose(err) {
				c.Hub.logger.Warning("websocket", "Read error for client "+c.ID+": "+err.Error())
			}
			break
		}

		var message Message
		if err := json.Unmarshal(data, &message); err != nil {
			c.Hub.logger.Warning("websocket", "Invalid message format from client "+c.ID)
			continue
		}

		// Add client ID to message
		message.ClientID = c.ID

		// Handle message based on type
		c.handleMessage(&message)
	}
}

// writePump writes messages from the hub to the WebSocket connection
func (c *Client) writePump() {
	ticker := NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(writeWait)
			if !ok {
				// Channel closed
				c.Conn.WriteMessage(CloseMessage, []byte{})
				return
			}

			data, err := json.Marshal(message)
			if err != nil {
				c.Hub.logger.Error("websocket", "Failed to marshal message", err)
				continue
			}

			if err := c.Conn.WriteMessage(TextMessage, data); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(writeWait)
			if err := c.Conn.WriteMessage(PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage processes incoming messages from clients
func (c *Client) handleMessage(message *Message) {
	c.Hub.logger.Debug("websocket", "Message received from "+c.ID+": type="+message.Type)

	// Route message based on type
	switch message.Type {
	case "ping":
		// Respond with pong
		c.Send <- &Message{
			Type: "pong",
			Data: map[string]any{
				"timestamp": getCurrentTimestamp(),
			},
		}

	case "broadcast":
		// Broadcast to other clients (not including sender)
		c.Hub.Broadcast(message)

	default:
		// Forward other messages to broadcast channel for application handling
		c.Hub.Broadcast(message)
	}
}

func (c *Client) Start() {
	go c.writePump()
	go c.readPump()
}
