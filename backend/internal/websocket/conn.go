package websocket

import (
	"net"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second    // Time allowed to write a message to the peer
	pongWait       = 60 * time.Second    // Time allowed to read the next pong message from the peer
	pingPeriod     = (pongWait * 9) / 10 // Send pings to peer with this period (must be less than pongWait)
	maxMessageSize = 512 * 1024          // Maximum message size allowed from peer 	// 512 KB
)

const (
	TextMessage   = websocket.TextMessage
	BinaryMessage = websocket.BinaryMessage
	CloseMessage  = websocket.CloseMessage
	PingMessage   = websocket.PingMessage
	PongMessage   = websocket.PongMessage
)

type Conn struct {
	*websocket.Conn
}

func (c *Conn) SetReadDeadline(timeout time.Duration) error {
	return c.Conn.SetReadDeadline(time.Now().Add(timeout))
}

func (c *Conn) SetWriteDeadline(timeout time.Duration) error {
	return c.Conn.SetWriteDeadline(time.Now().Add(timeout))
}

type Ticker struct {
	*time.Ticker
}

func NewTicker(d time.Duration) *Ticker {
	return &Ticker{time.NewTicker(d)}
}

func IsNormalClose(err error) bool {
	if websocket.IsCloseError(err,
		websocket.CloseNormalClosure,
		websocket.CloseGoingAway,
		websocket.CloseNoStatusReceived) {
		return true
	}

	// Check for network errors that indicate client disconnect
	if netErr, ok := err.(net.Error); ok {
		return netErr.Timeout()
	}

	return false
}

func getCurrentTimestamp() int64 {
	return time.Now().Unix()
}
