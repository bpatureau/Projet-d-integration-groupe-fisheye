const WebSocketManager = {
  ws: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 3000,
  listeners: {},

  connect() {
    const token = Auth.getToken();
    if (!token) {
      console.error("No auth token available for WebSocket");
      return;
    }

    const wsUrl = `${Config.WS_BASE_URL}/frontend?token=${token}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.reconnectAttempts = 0;
        this.updateStatus(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected");
        this.updateStatus(false);
        this.attemptReconnect();
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      this.attemptReconnect();
    }
  },

  handleMessage(message) {
    console.log("WebSocket message:", message);

    // Notify listeners
    if (this.listeners[message.type]) {
      this.listeners[message.type].forEach((callback) => {
        try {
          callback(message.data);
        } catch (error) {
          console.error("Error in WebSocket listener:", error);
        }
      });
    }

    // Notify global listeners
    if (this.listeners["*"]) {
      this.listeners["*"].forEach((callback) => {
        try {
          callback(message);
        } catch (error) {
          console.error("Error in global WebSocket listener:", error);
        }
      });
    }
  },

  on(type, callback) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(callback);
  },

  off(type, callback) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(
        (cb) => cb !== callback
      );
    }
  },

  send(type, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    } else {
      console.warn("WebSocket is not connected");
    }
  },

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
    );

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  },

  updateStatus(connected) {
    const statusEl = document.getElementById("ws-status");
    if (statusEl) {
      statusEl.textContent = connected ? "🟢 Connected" : "🔴 Disconnected";
    }
  },

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  },
};
