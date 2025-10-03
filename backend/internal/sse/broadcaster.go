package sse

import (
	"fmt"
	"sync"
	"time"

	"fisheye/internal/utils"
)

type Event struct {
	Type string `json:"type"`
	Data any    `json:"data"`
}

type Client struct {
	ID       string
	Channel  chan Event
	IsDevice bool
}

type Broadcaster struct {
	clients    map[string]*Client
	register   chan *Client
	unregister chan *Client
	broadcast  chan Event
	mu         sync.RWMutex
	logger     *utils.Logger
}

func NewBroadcaster(logger *utils.Logger) *Broadcaster {
	b := &Broadcaster{
		clients:    make(map[string]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan Event, 10),
		logger:     logger,
	}

	go b.run()
	return b
}

func (b *Broadcaster) run() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case client := <-b.register:
			b.mu.Lock()
			b.clients[client.ID] = client
			b.mu.Unlock()
			b.logger.Info("sse", fmt.Sprintf("Client registered: %s (device: %v)", client.ID, client.IsDevice))

		case client := <-b.unregister:
			b.mu.Lock()
			if _, ok := b.clients[client.ID]; ok {
				close(client.Channel)
				delete(b.clients, client.ID)
				b.logger.Info("sse", fmt.Sprintf("Client unregistered: %s", client.ID))
			}
			b.mu.Unlock()

		case event := <-b.broadcast:
			b.mu.RLock()
			for id, client := range b.clients {
				select {
				case client.Channel <- event:
					// Event sent successfully
				default:
					// Client channel is full, skip
					b.logger.Warning("sse", fmt.Sprintf("Client %s channel full, skipping event", id))
				}
			}
			b.mu.RUnlock()

		case <-ticker.C:
			// Send heartbeat to all clients
			b.sendHeartbeat()
		}
	}
}

func (b *Broadcaster) sendHeartbeat() {
	heartbeat := Event{
		Type: "heartbeat",
		Data: map[string]any{
			"timestamp": time.Now().Unix(),
		},
	}

	b.mu.RLock()
	defer b.mu.RUnlock()

	for _, client := range b.clients {
		select {
		case client.Channel <- heartbeat:
			// Heartbeat sent
		default:
			// Channel full, client might be dead
		}
	}
}

func (b *Broadcaster) Register(client *Client) {
	b.register <- client
}

func (b *Broadcaster) Unregister(client *Client) {
	b.unregister <- client
}

func (b *Broadcaster) BroadcastSettingsUpdate(settings any) {
	event := Event{
		Type: "settings_update",
		Data: settings,
	}

	select {
	case b.broadcast <- event:
		b.logger.Info("sse", "Settings update broadcasted")
	default:
		b.logger.Warning("sse", "Broadcast channel full")
	}
}

func (b *Broadcaster) BroadcastToDevices(event Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for id, client := range b.clients {
		if client.IsDevice {
			select {
			case client.Channel <- event:
				b.logger.Debug("sse", fmt.Sprintf("Event sent to device %s", id))
			default:
				b.logger.Warning("sse", fmt.Sprintf("Device %s channel full", id))
			}
		}
	}
}

func (b *Broadcaster) GetConnectedDevicesCount() int {
	b.mu.RLock()
	defer b.mu.RUnlock()

	count := 0
	for _, client := range b.clients {
		if client.IsDevice {
			count++
		}
	}
	return count
}
