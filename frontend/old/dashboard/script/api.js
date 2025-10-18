const API = {
  async request(endpoint, options = {}) {
    const token = Auth.getToken();

    const config = {
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...options,
    };

    try {
      const response = await fetch(`${Config.API_BASE_URL}${endpoint}`, config);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Request failed");
      }

      return data;
    } catch (error) {
      console.error("API Error:", error);

      if (
        error.message.includes("401") ||
        error.message.includes("Unauthorized")
      ) {
        Auth.logout();
        window.location.href = "/login.html";
      }

      throw error;
    }
  },

  // Auth
  async login(username, password) {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },

  async logout() {
    return this.request("/auth/logout", { method: "POST" });
  },

  // Profile
  async getProfile() {
    return this.request("/profile");
  },

  async updateProfile(data) {
    return this.request("/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async changePassword(currentPassword, newPassword) {
    return this.request("/profile/password", {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  },

  // Visits
  async getVisits(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/visits${queryString ? "?" + queryString : ""}`);
  },

  async getVisitById(id) {
    return this.request(`/visits/${id}`);
  },

  async updateVisit(id, data) {
    return this.request(`/visits/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteVisit(id) {
    return this.request(`/visits/${id}`, { method: "DELETE" });
  },

  async getVisitStats() {
    return this.request("/visits/stats");
  },

  async downloadMessage(id) {
    const token = Auth.getToken();
    const response = await fetch(
      `${Config.API_BASE_URL}/visits/${id}/message`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) throw new Error("Failed to download message");

    const contentType = response.headers.get("content-type");
    if (contentType.includes("application/json")) {
      return response.json();
    }

    return response.blob();
  },

  // Calendar
  async getCalendarStatus() {
    return this.request("/calendar/status");
  },

  async getCalendarEvents() {
    return this.request("/calendar/events");
  },

  async syncCalendar() {
    return this.request("/calendar/sync", { method: "POST" });
  },

  // Settings
  async getSettings() {
    return this.request("/settings");
  },

  async updateSettings(data) {
    return this.request("/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Admin - Users
  async getUsers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/admin/users${queryString ? "?" + queryString : ""}`);
  },

  async createUser(data) {
    return this.request("/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateUser(id, data) {
    return this.request(`/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteUser(id) {
    return this.request(`/admin/users/${id}`, { method: "DELETE" });
  },

  async resetUserPassword(id, newPassword) {
    return this.request(`/admin/users/${id}/password`, {
      method: "POST",
      body: JSON.stringify({ new_password: newPassword }),
    });
  },

  // Admin - Logs
  async getLogs(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/admin/logs${queryString ? "?" + queryString : ""}`);
  },

  async clearOldLogs(olderThanDays) {
    return this.request("/admin/logs", {
      method: "DELETE",
      body: JSON.stringify({ older_than_days: olderThanDays }),
    });
  },
};
