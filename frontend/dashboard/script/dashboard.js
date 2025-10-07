// Require authentication
if (!Auth.requireAuth()) {
  throw new Error("Authentication required");
}

// State
const state = {
  currentTab: "visits",
  visits: {
    data: [],
    page: 1,
    limit: Config.DEFAULT_PAGE_SIZE,
    total: 0,
    filter: {},
  },
  settings: null,
  settingsEditing: false,
  isAdmin: Auth.isAdmin(),
};

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initializeDashboard();
});

async function initializeDashboard() {
  setupUI();
  setupWebSocket();
  setupEventListeners();

  // Load initial data
  await loadProfile();
  await switchTab("visits");
}

function setupUI() {
  // Show/hide admin elements
  const adminElements = document.querySelectorAll(".admin-only");
  adminElements.forEach((el) => {
    el.style.display = state.isAdmin ? "" : "none";
  });

  // Update user info in status bar
  const user = Auth.getUser();
  const userInfoEl = document.getElementById("user-info");
  if (userInfoEl && user) {
    userInfoEl.textContent = `${user.username} (${user.role})`;
  }
}

function setupWebSocket() {
  WebSocketManager.connect();

  // Listen for visit updates
  WebSocketManager.on("visit", (data) => {
    console.log("New visit:", data);
    Utils.showToast("🔔 New doorbell ring!", "info");
    if (state.currentTab === "visits") {
      loadVisits();
    }
  });

  WebSocketManager.on("visit_update", (data) => {
    console.log("Visit updated:", data);
    if (state.currentTab === "visits") {
      loadVisits();
    }
  });

  WebSocketManager.on("visit_answered", (data) => {
    console.log("Visit answered:", data);
    Utils.showToast("✅ Visit answered", "success");
    if (state.currentTab === "visits") {
      loadVisits();
    }
  });

  WebSocketManager.on("settings_update", (data) => {
    console.log("Settings updated:", data);
    if (state.currentTab === "settings") {
      loadSettings();
    }
  });

  WebSocketManager.on("log", (data) => {
    const logData = data.data || data;

    if (
      state.currentTab === "logs" &&
      logData &&
      logData.level &&
      logData.message
    ) {
      prependLog(logData);
    }
  });
}

function setupEventListeners() {
  // Logout
  document.getElementById("btn-logout").addEventListener("click", async () => {
    UI.confirm("Sign Out", "Are you sure you want to sign out?", async () => {
      try {
        await API.logout();
      } catch (error) {
        console.error("Logout error:", error);
      }
      Auth.logout();
      WebSocketManager.disconnect();
      window.location.href = "/login.html";
    });
  });

  // Tab switching
  document.querySelectorAll(".menu-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });

  // Visits tab
  setupVisitsListeners();

  // Calendar tab
  setupCalendarListeners();

  // Settings tab
  setupSettingsListeners();

  // Users tab (admin)
  if (state.isAdmin) {
    setupUsersListeners();
  }

  // Logs tab (admin)
  if (state.isAdmin) {
    setupLogsListeners();
  }

  // Profile tab
  setupProfileListeners();
}

async function switchTab(tabName) {
  // Update active tab
  document.querySelectorAll(".menu-button").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");

  // Show/hide tab content
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.style.display = "none";
  });
  document.getElementById(`tab-${tabName}`).style.display = "flex";

  state.currentTab = tabName;

  // Load data for tab
  UI.showLoading(`Loading ${tabName}...`);

  try {
    switch (tabName) {
      case "visits":
        await loadVisits();
        break;
      case "calendar":
        await loadCalendar();
        break;
      case "settings":
        await loadSettings();
        break;
      case "users":
        await loadUsers();
        break;
      case "logs":
        await loadLogs();
        break;
      case "profile":
        await loadProfile();
        break;
    }
    UI.setStatus("Ready");
  } catch (error) {
    UI.showError(error.message);
  }
}

// ============= VISITS TAB =============
function setupVisitsListeners() {
  document
    .getElementById("btn-refresh-visits")
    .addEventListener("click", () => loadVisits());

  document.getElementById("btn-filter-apply").addEventListener("click", () => {
    const status = document.getElementById("filter-status").value;
    state.visits.filter = status ? { status } : {};
    state.visits.page = 1;
    loadVisits();
  });

  document.getElementById("btn-prev-page").addEventListener("click", () => {
    if (state.visits.page > 1) {
      state.visits.page--;
      loadVisits();
    }
  });

  document.getElementById("btn-next-page").addEventListener("click", () => {
    const maxPage = Math.ceil(state.visits.total / state.visits.limit);
    if (state.visits.page < maxPage) {
      state.visits.page++;
      loadVisits();
    }
  });
}

async function loadVisits() {
  try {
    UI.showLoading("Loading visits...");

    // Load stats
    const statsResponse = await API.getVisitStats();
    updateVisitStats(statsResponse.data);

    // Load visits
    const params = {
      limit: state.visits.limit,
      offset: (state.visits.page - 1) * state.visits.limit,
      ...state.visits.filter,
    };

    const response = await API.getVisits(params);
    state.visits.data = response.data;
    state.visits.total = response.meta?.total || 0;

    renderVisits();
    updatePagination();

    UI.setStatus("Visits loaded");
  } catch (error) {
    UI.showError("Failed to load visits: " + error.message);
  }
}

function updateVisitStats(stats) {
  document.getElementById("stat-total").textContent = stats.total || 0;
  document.getElementById("stat-pending").textContent = stats.pending || 0;
  document.getElementById("stat-today").textContent = stats.today || 0;
  document.getElementById("stat-unlistened").textContent =
    stats.unlistened_messages || 0;
}

function renderVisits() {
  const container = document.getElementById("visits-list");

  if (state.visits.data.length === 0) {
    container.innerHTML = "<p>No visits found.</p>";
    return;
  }

  container.innerHTML = state.visits.data
    .map(
      (visit) => `
        <div class="visit-card">
            <div class="visit-header">
                <span>🔔 Visit #${visit.id.substring(0, 8)}</span>
                <span class="visit-status ${
                  visit.status
                }">${visit.status.toUpperCase()}</span>
            </div>
            <div class="visit-details">
                <div><strong>Type:</strong> ${visit.type}</div>
                <div><strong>Time:</strong> ${Utils.formatRelativeTime(
                  visit.created_at
                )}</div>
                ${
                  visit.response_time
                    ? `<div><strong>Response Time:</strong> ${Utils.formatDuration(
                        visit.response_time
                      )}</div>`
                    : ""
                }
            </div>
            ${visit.has_message ? renderVisitMessage(visit) : ""}
            <div class="visit-actions">
                ${visit.has_message ? renderMessageButton(visit) : ""}
                ${
                  visit.status === "pending"
                    ? `<button onclick="markVisitAnswered('${visit.id}')">✓ Mark Answered</button>`
                    : ""
                }
                ${
                  state.isAdmin
                    ? `<button onclick="deleteVisit('${visit.id}')">🗑 Delete</button>`
                    : ""
                }
            </div>
        </div>
    `
    )
    .join("");
}

function renderVisitMessage(visit) {
  if (visit.message_type === "text") {
    return `
            <div class="visit-message">
                <strong>💬 Text Message:</strong><br>
                <div style="margin-top: 6px; padding: 8px; background: white; border: 1px solid #808080;">
                    ${Utils.escapeHtml(visit.message_text)}
                </div>
            </div>
        `;
  } else if (visit.message_type === "voice") {
    return `
            <div class="visit-message">
                <strong>🎤 Voice Message</strong> (${Utils.formatDuration(
                  visit.message_duration
                )})
                ${
                  visit.message_listened
                    ? '<span style="color: green; margin-left: 8px;">✓ Played</span>'
                    : ""
                }
            </div>
        `;
  }
  return "";
}

function renderMessageButton(visit) {
  if (visit.message_type === "text") {
    return ""; // Text messages are already visible inline
  } else if (visit.message_type === "voice") {
    return `<button onclick="playVoiceMessage('${visit.id}')">▶ Play Voice Message</button>`;
  }
  return "";
}

function updatePagination() {
  const maxPage = Math.ceil(state.visits.total / state.visits.limit);
  document.getElementById(
    "page-info"
  ).textContent = `Page ${state.visits.page} of ${maxPage}`;
  document.getElementById("btn-prev-page").disabled = state.visits.page === 1;
  document.getElementById("btn-next-page").disabled =
    state.visits.page >= maxPage;
}

// Global functions for visit actions
window.playVoiceMessage = async function (visitId) {
  try {
    UI.showLoading("Loading voice message...");

    const messageBlob = await API.downloadMessage(visitId);
    const audioUrl = URL.createObjectURL(messageBlob);

    // Create audio player modal
    const content = `
            <div class="audio-player-container">
                <audio id="audio-player" controls style="width: 100%;">
                    <source src="${audioUrl}" type="audio/mpeg">
                    Your browser does not support the audio element.
                </audio>
            </div>
        `;

    const modal = UI.createModal("Voice Message", content, [
      {
        label: "Close",
        primary: true,
        action: "close",
        onClick: (modal) => {
          const audio = modal.querySelector("#audio-player");
          if (audio) {
            audio.pause();
            URL.revokeObjectURL(audioUrl);
          }
          modal.remove();
        },
      },
    ]);

    // Auto-play
    const audio = modal.querySelector("#audio-player");
    if (audio) {
      audio.play();
    }

    // Mark as listened when played
    audio.addEventListener(
      "play",
      async () => {
        try {
          await API.updateVisit(visitId, { message_listened: true });
          // Reload visits to update the UI
          if (state.currentTab === "visits") {
            await loadVisits();
          }
        } catch (error) {
          console.error("Failed to mark as listened:", error);
        }
      },
      { once: true }
    );

    UI.setStatus("Ready");
  } catch (error) {
    UI.showError("Failed to load voice message: " + error.message);
  }
};

window.markVisitAnswered = async function (visitId) {
  try {
    await API.updateVisit(visitId, { status: "answered" });
    await loadVisits();
    UI.showSuccess("Visit marked as answered");
  } catch (error) {
    UI.showError("Failed to update visit: " + error.message);
  }
};

window.deleteVisit = async function (visitId) {
  UI.confirm(
    "Delete Visit",
    "Are you sure you want to delete this visit?",
    async () => {
      try {
        await API.deleteVisit(visitId);
        await loadVisits();
        UI.showSuccess("Visit deleted");
      } catch (error) {
        UI.showError("Failed to delete visit: " + error.message);
      }
    }
  );
};

// ============= CALENDAR TAB =============
function setupCalendarListeners() {
  document
    .getElementById("btn-refresh-calendar")
    .addEventListener("click", () => loadCalendar());

  const syncBtn = document.getElementById("btn-sync-calendar");
  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      try {
        UI.showLoading("Syncing calendar...");
        await API.syncCalendar();
        await loadCalendar();
        UI.showSuccess("Calendar synced successfully");
      } catch (error) {
        UI.showError("Failed to sync calendar: " + error.message);
      }
    });
  }
}

async function loadCalendar() {
  try {
    UI.showLoading("Loading calendar...");

    const [statusResponse, eventsResponse] = await Promise.all([
      API.getCalendarStatus(),
      API.getCalendarEvents(),
    ]);

    renderCalendarStatus(statusResponse.data);
    renderCalendarEvents(eventsResponse.data.events);

    UI.setStatus("Calendar loaded");
  } catch (error) {
    UI.showError("Failed to load calendar: " + error.message);
  }
}

function renderCalendarStatus(status) {
  document.getElementById("calendar-availability").textContent =
    status.available ? "✅ Available" : "⛔ Busy";
  document.getElementById("calendar-last-sync").textContent = status.last_sync
    ? Utils.formatRelativeTime(status.last_sync)
    : "Never";

  const currentEventContainer = document.getElementById(
    "current-event-container"
  );
  if (status.current_event) {
    currentEventContainer.style.display = "block";
    document.getElementById("current-event").textContent =
      status.current_event.summary;
  } else {
    currentEventContainer.style.display = "none";
  }
}

function renderCalendarEvents(events) {
  const container = document.getElementById("events-container");

  if (!events || events.length === 0) {
    container.innerHTML = "<p>No upcoming events.</p>";
    return;
  }

  container.innerHTML = events
    .map(
      (event) => `
        <div class="event-item">
            <div class="event-summary">${Utils.escapeHtml(event.summary)}</div>
            <div class="event-time">
                ${
                  event.all_day ? "All day" : Utils.formatDate(event.start_time)
                }
            </div>
        </div>
    `
    )
    .join("");
}

// ============= SETTINGS TAB =============
function setupSettingsListeners() {
  document
    .getElementById("btn-refresh-settings")
    .addEventListener("click", () => loadSettings());

  if (state.isAdmin) {
    document
      .getElementById("btn-edit-settings")
      .addEventListener("click", () => {
        state.settingsEditing = true;
        toggleSettingsEdit(true);
      });

    document
      .getElementById("btn-save-settings")
      .addEventListener("click", saveSettings);

    document
      .getElementById("btn-cancel-settings")
      .addEventListener("click", () => {
        state.settingsEditing = false;
        loadSettings();
      });
  }
}

function toggleSettingsEdit(editing) {
  document
    .querySelectorAll(".setting-input")
    .forEach((input) => (input.disabled = !editing));
  document.getElementById("btn-edit-settings").style.display = editing
    ? "none"
    : "";
  document.getElementById("settings-buttons").style.display = editing
    ? "flex"
    : "none";
}

async function loadSettings() {
  try {
    UI.showLoading("Loading settings...");

    const response = await API.getSettings();
    state.settings = response.data;

    document.getElementById("device-name").value = state.settings.device_name;
    document.getElementById("do-not-disturb").checked =
      state.settings.do_not_disturb;
    document.getElementById("welcome-messages").value =
      state.settings.welcome_messages.join("\n");
    document.getElementById("rotation-seconds").value =
      state.settings.message_rotation_seconds;

    toggleSettingsEdit(false);
    state.settingsEditing = false;

    UI.setStatus("Settings loaded");
  } catch (error) {
    UI.showError("Failed to load settings: " + error.message);
  }
}

async function saveSettings() {
  try {
    UI.showLoading("Saving settings...");

    const settings = {
      device_name: document.getElementById("device-name").value.trim(),
      do_not_disturb: document.getElementById("do-not-disturb").checked,
      welcome_messages: document
        .getElementById("welcome-messages")
        .value.split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      message_rotation_seconds: parseInt(
        document.getElementById("rotation-seconds").value
      ),
    };

    await API.updateSettings(settings);
    await loadSettings();

    UI.showSuccess("Settings saved successfully");
  } catch (error) {
    UI.showError("Failed to save settings: " + error.message);
  }
}

// ============= USERS TAB =============
function setupUsersListeners() {
  document
    .getElementById("btn-refresh-users")
    .addEventListener("click", () => loadUsers());
  document
    .getElementById("btn-add-user")
    .addEventListener("click", () => showAddUserModal());
}

async function loadUsers() {
  try {
    UI.showLoading("Loading users...");

    const response = await API.getUsers();
    renderUsers(response.data);

    UI.setStatus("Users loaded");
  } catch (error) {
    UI.showError("Failed to load users: " + error.message);
  }
}

function renderUsers(users) {
  const container = document.getElementById("users-container");

  if (users.length === 0) {
    container.innerHTML = "<p>No users found.</p>";
    return;
  }

  const tableHtml = `
        <table class="users-table">
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${users
                  .map(
                    (user) => `
                    <tr>
                        <td>${Utils.escapeHtml(user.username)}</td>
                        <td>${Utils.escapeHtml(user.email)}</td>
                        <td>${Utils.escapeHtml(user.role)}</td>
                        <td>${Utils.formatDate(user.created_at)}</td>
                        <td>
                            <button onclick="editUser('${
                              user.id
                            }', '${Utils.escapeHtml(
                      user.username
                    )}')">✏️ Edit</button>
                            <button onclick="resetUserPassword('${
                              user.id
                            }', '${Utils.escapeHtml(
                      user.username
                    )}')">🔑 Reset Password</button>
                            <button onclick="deleteUser('${
                              user.id
                            }', '${Utils.escapeHtml(
                      user.username
                    )}')">🗑 Delete</button>
                        </td>
                    </tr>
                `
                  )
                  .join("")}
            </tbody>
        </table>
    `;

  container.innerHTML = tableHtml;
}

function showAddUserModal() {
  const content = `
        <div class="field-row-stacked">
            <label>Username:</label>
            <input type="text" id="new-username" required>
        </div>
        <div class="field-row-stacked">
            <label>Email:</label>
            <input type="email" id="new-email" required>
        </div>
        <div class="field-row-stacked">
            <label>Password:</label>
            <input type="password" id="new-password" required>
        </div>
        <div class="field-row-stacked">
            <label>Role:</label>
            <select id="new-role">
                <option value="user">User</option>
                <option value="admin">Admin</option>
            </select>
        </div>
    `;

  UI.createModal("Add New User", content, [
    {
      label: "Create",
      primary: true,
      action: "create",
      onClick: async (modal) => {
        const username = modal.querySelector("#new-username").value.trim();
        const email = modal.querySelector("#new-email").value.trim();
        const password = modal.querySelector("#new-password").value;
        const role = modal.querySelector("#new-role").value;

        if (!username || !email || !password) {
          UI.showError("All fields are required");
          return;
        }

        try {
          await API.createUser({ username, email, password, role });
          modal.remove();
          await loadUsers();
          UI.showSuccess("User created successfully");
        } catch (error) {
          UI.showError("Failed to create user: " + error.message);
        }
      },
    },
    {
      label: "Cancel",
      action: "cancel",
      onClick: (modal) => modal.remove(),
    },
  ]);
}

window.editUser = function (userId, username) {
  UI.prompt(
    "Edit User",
    `Enter new username for ${username}:`,
    username,
    async (newUsername) => {
      try {
        await API.updateUser(userId, { username: newUsername });
        await loadUsers();
        UI.showSuccess("User updated successfully");
      } catch (error) {
        UI.showError("Failed to update user: " + error.message);
      }
    }
  );
};

window.resetUserPassword = function (userId, username) {
  UI.prompt(
    "Reset Password",
    `Enter new password for ${username}:`,
    "",
    async (newPassword) => {
      try {
        await API.resetUserPassword(userId, newPassword);
        UI.showSuccess("Password reset successfully");
      } catch (error) {
        UI.showError("Failed to reset password: " + error.message);
      }
    }
  );
};

window.deleteUser = function (userId, username) {
  UI.confirm(
    "Delete User",
    `Are you sure you want to delete user "${username}"?`,
    async () => {
      try {
        await API.deleteUser(userId);
        await loadUsers();
        UI.showSuccess("User deleted successfully");
      } catch (error) {
        UI.showError("Failed to delete user: " + error.message);
      }
    }
  );
};

// ============= LOGS TAB =============
function setupLogsListeners() {
  document
    .getElementById("btn-refresh-logs")
    .addEventListener("click", () => loadLogs());

  document.getElementById("btn-filter-logs").addEventListener("click", () => {
    loadLogs();
  });

  document.getElementById("btn-clear-logs").addEventListener("click", () => {
    UI.prompt(
      "Clear Old Logs",
      "Delete logs older than how many days?",
      "30",
      async (days) => {
        const daysNum = parseInt(days);
        if (isNaN(daysNum) || daysNum < 1) {
          UI.showError("Please enter a valid number of days");
          return;
        }

        try {
          await API.clearOldLogs(daysNum);
          await loadLogs();
          UI.showSuccess(`Logs older than ${daysNum} days deleted`);
        } catch (error) {
          UI.showError("Failed to clear logs: " + error.message);
        }
      }
    );
  });
}

async function loadLogs() {
  try {
    UI.showLoading("Loading logs...");

    const level = document.getElementById("filter-log-level").value;
    const params = {
      limit: 100,
      ...(level && { level }),
    };

    const response = await API.getLogs(params);
    renderLogs(response.data);

    UI.setStatus("Logs loaded");
  } catch (error) {
    UI.showError("Failed to load logs: " + error.message);
  }
}

function renderLogs(logs) {
  const container = document.getElementById("logs-container");

  if (!logs || logs.length === 0) {
    container.innerHTML = '<div style="color: #808080;">No logs found.</div>';
    return;
  }

  container.innerHTML = logs
    .map(
      (log) => `
        <div class="log-entry ${log.level}">
            <span class="log-time">[${Utils.formatDate(log.created_at)}]</span>
            <span class="log-component">[${log.component || "system"}]</span>
            [${log.level.toUpperCase()}] ${Utils.escapeHtml(log.message)}
        </div>
    `
    )
    .join("");
}

function prependLog(logData) {
  const container = document.getElementById("logs-container");
  if (!container) return;

  // Validate log data structure
  if (!logData || typeof logData !== "object") {
    console.warn("Invalid log data type:", logData);
    return;
  }

  // Handle nested data wrapper
  const log = logData.data || logData;

  if (!log.level || !log.message) {
    console.warn("Invalid log data structure:", log);
    return;
  }

  const logEntry = document.createElement("div");
  logEntry.className = `log-entry ${log.level}`;
  logEntry.innerHTML = `
        <span class="log-time">[${Utils.formatDate(
          log.created_at || new Date()
        )}]</span>
        <span class="log-component">[${Utils.escapeHtml(
          log.component || "system"
        )}]</span>
        [${log.level.toUpperCase()}] ${Utils.escapeHtml(log.message)}
    `;

  container.insertBefore(logEntry, container.firstChild);

  // Keep max 200 log entries in view
  while (container.children.length > 200) {
    container.removeChild(container.lastChild);
  }
}

// ============= PROFILE TAB =============
function setupProfileListeners() {
  document
    .getElementById("password-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const currentPassword = document.getElementById("current-password").value;
      const newPassword = document.getElementById("new-password").value;
      const confirmPassword = document.getElementById("confirm-password").value;

      if (newPassword !== confirmPassword) {
        UI.showError("Passwords do not match");
        return;
      }

      try {
        UI.showLoading("Changing password...");
        await API.changePassword(currentPassword, newPassword);

        // Clear form
        e.target.reset();

        UI.showSuccess("Password changed successfully");
      } catch (error) {
        UI.showError("Failed to change password: " + error.message);
      }
    });
}

async function loadProfile() {
  try {
    const response = await API.getProfile();
    const profile = response.data;

    document.getElementById("profile-username").textContent = profile.username;
    document.getElementById("profile-email").textContent = profile.email;
    document.getElementById("profile-role").textContent = profile.role;
    document.getElementById("profile-created").textContent = Utils.formatDate(
      profile.created_at
    );
  } catch (error) {
    UI.showError("Failed to load profile: " + error.message);
  }
}
