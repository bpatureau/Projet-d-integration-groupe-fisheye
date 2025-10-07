const UI = {
  setStatus(message) {
    const statusEl = document.getElementById("status-text");
    if (statusEl) {
      statusEl.textContent = message;
    }
  },

  showError(message) {
    Utils.showToast(message, "error");
    this.setStatus("Error: " + message);
  },

  showSuccess(message) {
    Utils.showToast(message, "success");
    this.setStatus(message);
  },

  showLoading(message = "Loading...") {
    this.setStatus(message);
  },

  createModal(title, content, buttons = []) {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";

    const buttonsHtml = buttons
      .map(
        (btn) =>
          `<button class="${btn.primary ? "default" : ""}" data-action="${
            btn.action
          }">${btn.label}</button>`
      )
      .join("");

    modal.innerHTML = `
            <div class="window modal-window">
                <div class="title-bar">
                    <div class="title-bar-text">${Utils.escapeHtml(title)}</div>
                    <div class="title-bar-controls">
                        <button aria-label="Close" class="modal-close"></button>
                    </div>
                </div>
                <div class="window-body">
                    ${content}
                    <div class="button-row">
                        ${buttonsHtml}
                    </div>
                </div>
            </div>
        `;

    document.getElementById("modal-container").appendChild(modal);

    // Handle button clicks
    modal.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const button = buttons.find((b) => b.action === action);
        if (button && button.onClick) {
          button.onClick(modal);
        }
      });
    });

    // Handle close button
    modal.querySelector(".modal-close").addEventListener("click", () => {
      modal.remove();
    });

    // Handle backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    return modal;
  },

  confirm(title, message, onConfirm) {
    return this.createModal(title, `<p>${Utils.escapeHtml(message)}</p>`, [
      {
        label: "Yes",
        primary: true,
        action: "confirm",
        onClick: (modal) => {
          modal.remove();
          onConfirm();
        },
      },
      {
        label: "No",
        action: "cancel",
        onClick: (modal) => modal.remove(),
      },
    ]);
  },

  prompt(title, message, defaultValue = "", onSubmit) {
    const content = `
            <p>${Utils.escapeHtml(message)}</p>
            <input type="text" id="prompt-input" value="${Utils.escapeHtml(
              defaultValue
            )}" style="width: 100%;">
        `;

    const modal = this.createModal(title, content, [
      {
        label: "OK",
        primary: true,
        action: "submit",
        onClick: (modal) => {
          const input = modal.querySelector("#prompt-input");
          const value = input.value.trim();
          if (value) {
            modal.remove();
            onSubmit(value);
          }
        },
      },
      {
        label: "Cancel",
        action: "cancel",
        onClick: (modal) => modal.remove(),
      },
    ]);

    // Focus input
    setTimeout(() => {
      const input = modal.querySelector("#prompt-input");
      if (input) input.focus();
    }, 100);

    return modal;
  },
};
