function getUser() {
    const s = localStorage.getItem('user');
    return s ? JSON.parse(s) : null;
}

let isAdmin = getUser()?.role === 'admin';

const statusEl = document.getElementById('status');
const tbody = document.getElementById('users-tbody');

// Toolbar elements (assumes same IDs as before)
const btnRefresh = document.getElementById('btn-refresh');
const btnAddUser = document.getElementById('btn-add-user');

// Add panel
const addPanel = document.getElementById('add-user-panel');
const newUsername = document.getElementById('new-username');
const newEmail = document.getElementById('new-email');
const newRole = document.getElementById('new-role');
const newPassword = document.getElementById('new-password');
const btnCancelAdd = document.getElementById('btn-cancel-add');
const btnSaveAdd = document.getElementById('btn-save-add');

// Inline password panel
const resetPanel = document.getElementById('reset-password-panel');
const resetPwUser = document.getElementById('reset-pw-username');
const resetPassword = document.getElementById('reset-password');
const btnCancelReset = document.getElementById('btn-cancel-reset');
const btnSaveReset = document.getElementById('btn-save-reset');

// Inline role panel
const rolePanel = document.getElementById('edit-role-panel');
const editRoleUser = document.getElementById('edit-role-username');
const editRoleSelect = document.getElementById('edit-role-select');
const btnCancelRole = document.getElementById('btn-cancel-role');
const btnSaveRole = document.getElementById('btn-save-role');

// Filters/pagination (optional UI not shown)
let search = '';
let roleFilter = '';
let limit = 20;
let offset = 0;
let total = 0;

let currentPwUser = null;   // {id, username}
let currentRoleUser = null; // {id, username}
let editingRowId = null;    // currently inline-editing user id

function setStatus(m) { statusEl.textContent = m; }
function authHeaders(extra = {}) {
    const token = getAuthToken();
    return { Authorization: `Bearer ${token}`, ...extra };
}

async function parseJsonSafe(res) {
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    try { return await res.json(); } catch { return null; }
}
async function handleJsonResponse(res) {
    if (res.status === 401 || res.status === 403) { window.location.href = '/login.html'; throw new Error('Unauthorized'); }
    const json = await parseJsonSafe(res);
    if (!res.ok) throw new Error(json?.message || json?.error || `${res.status} ${res.statusText}`);
    if (json && json.success === false) throw new Error(json.message || 'Operation failed');
    return json;
}

function renderUsers(list) {
    tbody.innerHTML = '';
    list.forEach(u => {
        const isEditing = editingRowId === u.id;
        const tr = document.createElement('tr');
        tr.dataset.id = u.id;

        tr.innerHTML = isEditing ? `
        <td>
          <input class="text-input" type="text" value="${escapeHtml(u.username)}" data-field="username" style="width:100%;" />
        </td>
        <td>
          <input class="text-input" type="email" value="${escapeHtml(u.email)}" data-field="email" style="width:100%;" />
        </td>
        <td>
          <select data-field="role" style="width:100%;">
            <option value="user"${u.role === 'user' ? ' selected' : ''}>user</option>
            <option value="admin"${u.role === 'admin' ? ' selected' : ''}>admin</option>
          </select>
        </td>
        <td>
          <div class="actions">
            <button data-act="save-inline" data-id="${u.id}" class="default">Save</button>
            <button data-act="cancel-inline" data-id="${u.id}">Cancel</button>
          </div>
        </td>
      ` : `
        <td>${escapeHtml(u.username)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.role)}</td>
        <td>
          <div class="actions">
            <button data-act="edit-inline" data-id="${u.id}">Edit</button>
            <button data-act="role" data-id="${u.id}" data-username="${escapeAttr(u.username)}" data-role="${escapeAttr(u.role)}">Edit Role</button>
            <button data-act="pw" data-id="${u.id}" data-username="${escapeAttr(u.username)}">Change Password</button>
            <button data-act="del" data-id="${u.id}" data-username="${escapeAttr(u.username)}">Delete</button>
          </div>
        </td>
      `;
        tbody.appendChild(tr);
    });

    if (!isAdmin) {
        tbody.querySelectorAll('button').forEach(b => b.setAttribute('disabled', 'disabled'));
        btnAddUser.setAttribute('disabled', 'disabled');
    }
}

function collectInlineValues(tr) {
    const username = tr.querySelector('input[data-field="username"]').value.trim();
    const email = tr.querySelector('input[data-field="email"]').value.trim();
    const role = tr.querySelector('select[data-field="role"]').value;
    return { username, email, role };
}

async function loadUsers() {
    try {
        setStatus('Loading users…');
        const qs = new URLSearchParams();
        if (search) qs.set('search', search);
        if (roleFilter) qs.set('role', roleFilter);
        qs.set('limit', String(limit));
        qs.set('offset', String(offset));

        const res = await fetch(`${BASE_URL}/api/admin/users?${qs}`, {
            method: 'GET',
            headers: authHeaders({ Accept: 'application/json' })
        });
        const json = await handleJsonResponse(res);
        const list = json?.data || [];
        total = json?.meta?.total ?? list.length;
        renderUsers(list);
        setStatus(`Users loaded (${list.length}/${total})`);
    } catch (e) {
        setStatus('Error: ' + e.message);
    }
}

// Escape helpers for safe HTML injection
function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttr(s) { return escapeHtml(s); }

// Toolbar
btnRefresh.addEventListener('click', () => { offset = 0; loadUsers(); });
btnAddUser.addEventListener('click', () => {
    if (!isAdmin) { setStatus('Admin required'); return; }
    addPanel.classList.remove('hidden');
    newUsername.focus();
});
btnCancelAdd.addEventListener('click', () => {
    addPanel.classList.add('hidden');
    newUsername.value=''; newEmail.value=''; newPassword.value=''; newRole.value='user';
    setStatus('Canceled');
});
btnSaveAdd.addEventListener('click', async () => {
    if (!isAdmin) { setStatus('Admin required'); return; }
    const payload = {
        username: newUsername.value.trim(),
        email: newEmail.value.trim(),
        password: newPassword.value,
        role: newRole.value
    };
    if (!payload.username || !payload.email || !payload.password) { setStatus('Fill username, email, and password'); return; }
    setStatus('Creating user…');
    try {
        const res = await fetch(`${BASE_URL}/api/admin/users`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload)
        });
        await handleJsonResponse(res);
        addPanel.classList.add('hidden');
        newUsername.value=''; newEmail.value=''; newPassword.value=''; newRole.value='user';
        await loadUsers();
        setStatus('User created');
    } catch (e) {
        setStatus('Error: ' + e.message);
    }
});

// Table actions (inline editors and panels)
tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const act = btn.dataset.act;
    const id = btn.dataset.id;
    const tr = btn.closest('tr');

    if (act === 'edit-inline') {
        if (!isAdmin) { setStatus('Admin required'); return; }
        editingRowId = id;
        // Reload to render inline editors for this row
        loadUsers();
    }

    if (act === 'cancel-inline') {
        editingRowId = null;
        loadUsers();
        setStatus('Canceled');
    }

    if (act === 'save-inline') {
        if (!isAdmin) { setStatus('Admin required'); return; }
        const values = collectInlineValues(tr);
        if (!values.username || !values.email) { setStatus('Username and email are required'); return; }
        updateUser(id, values, () => {
            editingRowId = null;
            loadUsers();
        });
    }

    if (act === 'role') {
        if (!isAdmin) { setStatus('Admin required'); return; }
        const username = btn.dataset.username;
        const role = btn.dataset.role;
        currentRoleUser = { id, username };
        editRoleUser.textContent = username;
        editRoleSelect.value = role;
        rolePanel.classList.remove('hidden');
    }

    if (act === 'pw') {
        if (!isAdmin) { setStatus('Admin required'); return; }
        const username = btn.dataset.username;
        currentPwUser = { id, username };
        resetPwUser.textContent = username;
        resetPassword.value = '';
        resetPanel.classList.remove('hidden');
    }

    if (act === 'del') {
        if (!isAdmin) { setStatus('Admin required'); return; }
        if (!confirm(`Delete user "${btn.dataset.username}"?`)) return;
        deleteUser(id);
    }
});

// Role panel actions
btnCancelRole.addEventListener('click', () => {
    rolePanel.classList.add('hidden');
    currentRoleUser = null;
    setStatus('Canceled');
});
btnSaveRole.addEventListener('click', async () => {
    if (!isAdmin) { setStatus('Admin required'); return; }
    if (!currentRoleUser) return;
    const role = editRoleSelect.value;
    updateUser(currentRoleUser.id, { role }, () => {
        rolePanel.classList.add('hidden');
        currentRoleUser = null;
    });
});

// Password panel actions
btnCancelReset.addEventListener('click', () => {
    resetPanel.classList.add('hidden');
    currentPwUser = null;
    setStatus('Canceled');
});
btnSaveReset.addEventListener('click', async () => {
    if (!isAdmin) { setStatus('Admin required'); return; }
    if (!currentPwUser) return;
    const pw = resetPassword.value;
    if (!pw) { setStatus('Enter a new password'); return; }
    setStatus('Resetting password…');
    try {
        const res = await fetch(`${BASE_URL}/api/admin/users/${currentPwUser.id}/password`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ new_password: pw })
        });
        await handleJsonResponse(res);
        resetPanel.classList.add('hidden');
        currentPwUser = null;
        setStatus('Password reset successfully');
    } catch (e) {
        setStatus('Error: ' + e.message);
    }
});

async function updateUser(id, body, afterOk) {
    setStatus('Updating user…');
    try {
        const res = await fetch(`${BASE_URL}/api/admin/users/${id}`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(body)
        });
        await handleJsonResponse(res);
        await loadUsers();
        if (afterOk) afterOk();
        setStatus('User updated');
    } catch (e) {
        setStatus('Error: ' + e.message);
    }
}

async function deleteUser(id) {
    setStatus('Deleting user…');
    try {
        const res = await fetch(`${BASE_URL}/api/admin/users/${id}`, {
            method: 'DELETE',
            headers: authHeaders({ Accept: 'application/json' })
        });
        await handleJsonResponse(res);
        await loadUsers();
        setStatus('User deleted');
    } catch (e) {
        setStatus('Error: ' + e.message);
    }
}

// Initial state and load
if (!isAdmin) {
    btnAddUser.setAttribute('disabled', 'disabled');
    setStatus('Read-only: admin required');
}
loadUsers();