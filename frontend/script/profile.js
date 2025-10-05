const BASE_URL = 'https://pi.linadu.live';
const TOKEN = getAuthToken();
if(TOKEN == null){
    window.location.href = "/login.html";
}

const statusEl = document.getElementById("status");

// Display elements
const dispUsername = document.getElementById("display-username");
const dispEmail = document.getElementById("display-email");

// Inputs
const inUsername = document.getElementById("input-username");
const inEmail = document.getElementById("input-email");

// Username buttons
const btnEditUser = document.getElementById("btn-edit-username");
const btnSaveUser = document.getElementById("btn-save-username");
const btnCancelUser = document.getElementById("btn-cancel-username");

// Email buttons
const btnEditEmail = document.getElementById("btn-edit-email");
const btnSaveEmail = document.getElementById("btn-save-email");
const btnCancelEmail = document.getElementById("btn-cancel-email");

// Password section
const btnChangePw = document.getElementById("btn-change-password");
const pwSectionCollapsed = document.getElementById("password-section-collapsed");
const pwSection = document.getElementById("password-section");
const btnCancelPw = document.getElementById("btn-cancel-password");
const btnSavePw = document.getElementById("btn-save-password");
const pwdCurrent = document.getElementById("pwd-current");
const pwdNew = document.getElementById("pwd-new");
const pwdConfirm = document.getElementById("pwd-confirm");


const btnClose = document.getElementById("btn-close");

btnClose.addEventListener("click", function() {
    window.location.href = "/home.html";
})

function setStatus(msg) { statusEl.textContent = msg; }

function authHeaders(extra = {}) {
    return { Authorization: `Bearer ${TOKEN}`, ...extra };
}


async function handleJsonResponse(res) {
    const json = await res.json();
    //console.log(json)
    //if (!res.ok) {
    //    const msg = json?.message || json?.error || `${res.status} ${res.statusText}`;
    //    throw new Error(msg);
    //}
    if (json && json.success === false) {
        console.log(json);
        const msg = json.error.message || 'Operation failed';
        throw new Error(msg);
    }
    return json;
}

function toggleEdit(group, editing) {
    const disp = group.querySelector("span.muted");
    const input = group.querySelector("input.text-input");
    const [btnEdit, btnSave, btnCancel] = group.querySelectorAll("button");

    if (editing) {
        disp.classList.add("hidden");
        input.classList.remove("hidden");
        btnEdit.classList.add("hidden");
        btnSave.classList.remove("hidden");
        btnCancel.classList.remove("hidden");
        input.focus();
        input.select?.();
    } else {
        disp.classList.remove("hidden");
        input.classList.add("hidden");
        btnEdit.classList.remove("hidden");
        btnSave.classList.add("hidden");
        btnCancel.classList.add("hidden");
    }
}

async function loadProfile() {
    try {
        setStatus("Loading profile…");
        const res = await fetch(`${BASE_URL}/api/profile`, {
            method: "GET",
            headers: authHeaders({ Accept: "application/json" })
        });
        const json = await handleJsonResponse(res);
        const data = json?.data || {};
        dispUsername.textContent = data.username || "";
        dispEmail.textContent = data.email || "";
        inUsername.value = data.username || "";
        inEmail.value = data.email || "";
        setStatus("Profile loaded");
    } catch (e) {
        setStatus("Error: " + e.message);
    }
}

// Username edit flow
btnEditUser.addEventListener("click", () => toggleEdit(document.getElementById("row-username"), true));
btnCancelUser.addEventListener("click", () => {
    inUsername.value = dispUsername.textContent;
    toggleEdit(document.getElementById("row-username"), false);
    setStatus("Canceled");
});
btnSaveUser.addEventListener("click", async () => {
    const username = inUsername.value.trim();
    if (!username) { setStatus("Username cannot be empty"); return; }
    setStatus("Saving username…");
    try {
        const res = await fetch(`${BASE_URL}/api/profile`, {
            method: "PUT",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ username })
        });
        await handleJsonResponse(res);
        dispUsername.textContent = username;
        toggleEdit(document.getElementById("row-username"), false);
        setStatus("Username updated");
    } catch (e) {
        setStatus("Error: " + e.message);
    }
});

// Email edit flow
btnEditEmail.addEventListener("click", () => toggleEdit(document.getElementById("row-email"), true));
btnCancelEmail.addEventListener("click", () => {
    inEmail.value = dispEmail.textContent;
    toggleEdit(document.getElementById("row-email"), false);
    setStatus("Canceled");
});
btnSaveEmail.addEventListener("click", async () => {
    const email = inEmail.value.trim();
    if (!email) { setStatus("Email cannot be empty"); return; }
    setStatus("Saving email…");
    try {
        const res = await fetch(`${BASE_URL}/api/profile`, {
            method: "PUT",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ email })
        });
        await handleJsonResponse(res);
        dispEmail.textContent = email;
        toggleEdit(document.getElementById("row-email"), false);
        setStatus("Email updated");
    } catch (e) {
        setStatus("Error: " + e.message);
    }
});

// Password editor
btnChangePw.addEventListener("click", () => {
    pwSectionCollapsed.classList.add("hidden");
    pwSection.classList.remove("hidden");
    pwdCurrent.focus();
});
btnCancelPw.addEventListener("click", () => {
    pwSectionCollapsed.classList.remove("hidden");
    pwSection.classList.add("hidden");
    pwdCurrent.value = "";
    pwdNew.value = "";
    pwdConfirm.value = "";
    setStatus("Canceled");
});
btnSavePw.addEventListener("click", async () => {
    const current = pwdCurrent.value;
    const next = pwdNew.value;
    const confirm = pwdConfirm.value;
    if (!current || !next || !confirm) { setStatus("Fill all password fields"); return; }
    if (next !== confirm) { setStatus("Passwords do not match"); return; }
    setStatus("Saving password…");
    try {
        const res = await fetch(`${BASE_URL}/api/profile/password`, {
            method: "POST",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ current_password: current, new_password: next })
        });
        await handleJsonResponse(res);
        pwdCurrent.value = "";
        pwdNew.value = "";
        pwdConfirm.value = "";
        pwSectionCollapsed.classList.remove("hidden");
        pwSection.classList.add("hidden");
        setStatus("Password updated");
    } catch (e) {
        setStatus("Error: " + e.message);
    }
});

// Init
loadProfile();